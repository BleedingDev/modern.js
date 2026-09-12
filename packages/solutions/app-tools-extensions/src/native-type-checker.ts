import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { refreshTsgoCheckerConfig } from '@modern-js/builder';
import type { Rspack, RspackChain } from '@rsbuild/core';

const execute = promisify(execFile);
const name = 'UltramodernNativeTypeChecker';

// Windows file events expand 8.3 aliases; register the same native path spelling.
const watchDependencyPath = (file: string): string =>
  process.platform === 'win32' ? realpathSync.native(file) : file;

export class UltramodernNativeTypeChecker {
  constructor(
    private readonly options: {
      compiler: () => string;
      configFile: string;
      build: boolean;
    },
  ) {}

  async check(): Promise<void> {
    const { configFile, build } = this.options;
    const args = build
      ? ['--build', configFile, '--stopBuildOnErrors']
      : ['--project', configFile, '--noEmit'];
    await this.run([...args, '--pretty', 'false']);
  }

  private async run(args: string[]): Promise<string> {
    try {
      const result = await execute(this.options.compiler(), args, {
        cwd: path.dirname(this.options.configFile),
        maxBuffer: 16 * 1024 * 1024,
      });
      return result.stdout;
    } catch (cause) {
      const output = cause as { stdout?: string; stderr?: string };
      const diagnostics = `${output.stdout ?? ''}${output.stderr ?? ''}`;
      throw new Error(
        `${name} failed:\n${diagnostics || (cause instanceof Error ? cause.message : String(cause))}`,
        { cause },
      );
    }
  }

  private async watchInputs(): Promise<Set<string>> {
    const inputs = new Set<string>();
    const projects = [this.options.configFile];
    const visited = new Set<string>();
    for (const configFile of projects) {
      if (visited.has(configFile)) continue;
      visited.add(configFile);
      inputs.add(configFile);
      const config = JSON.parse(
        await this.run(['--showConfig', '--project', configFile]),
      ) as {
        files?: string[];
        references?: { path: string }[];
      };
      const directory = path.dirname(configFile);
      for (const file of config.files ?? [])
        inputs.add(path.resolve(directory, file));
      for (const reference of config.references ?? []) {
        const target = path.resolve(directory, reference.path);
        projects.push(
          path.extname(target) === '.json'
            ? target
            : path.join(target, 'tsconfig.json'),
        );
      }
    }
    return inputs;
  }

  apply(compiler: Rspack.Compiler): void {
    compiler.hooks.thisCompilation.tap(name, compilation => {
      compilation.hooks.processAssets.tapPromise(name, async () => {
        try {
          compilation.fileDependencies.add(
            watchDependencyPath(this.options.configFile),
          );
          // A generated checker config restates values TypeScript does not
          // inherit through `extends` (project references above all). Rebuild
          // it from the project's own tsconfig before every check, and watch
          // that tsconfig, so an edit during `modern dev` reaches the next
          // compilation instead of the next restart.
          const projectConfigFile = refreshTsgoCheckerConfig(
            this.options.configFile,
          );
          if (projectConfigFile) {
            compilation.fileDependencies.add(
              watchDependencyPath(projectConfigFile),
            );
          }
          for (const file of await this.watchInputs())
            compilation.fileDependencies.add(watchDependencyPath(file));
          await this.check();
        } catch (cause) {
          compilation.errors.push(
            new Error(cause instanceof Error ? cause.message : String(cause), {
              cause,
            }),
          );
        }
      });
    });
  }
}

/** Preserve project-reference emit contracts in the native Effect compiler. */
export function configureUltramodernTypeChecker(
  chain: RspackChain,
  pluginId: string,
  resolveCompiler: (configFile: string) => string,
): void {
  if (!chain.plugins.has(pluginId)) return;
  const options = chain.plugin(pluginId).get('args')?.[0] as
    | { typescript?: { configFile?: string; build?: boolean; tsgo?: boolean } }
    | undefined;
  const typescript = options?.typescript;
  if (typescript?.tsgo === false) return;
  if (!typescript?.configFile) {
    throw new Error(`${name} requires the configured TypeScript project.`);
  }
  const configFile = path.resolve(typescript.configFile);
  chain.plugin(pluginId).use(UltramodernNativeTypeChecker, [
    {
      build: typescript.build === true,
      compiler: () => resolveCompiler(configFile),
      configFile,
    },
  ]);
}
