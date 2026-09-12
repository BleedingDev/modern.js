import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { refreshTsgoCheckerConfig } from '@modern-js/builder';
import type { Rspack, RspackChain } from '@rsbuild/core';

const execute = promisify(execFile);
const name = 'UltramodernNativeTypeChecker';

// Windows file events expand 8.3 aliases; register the same native path spelling.
// A path that does not exist yet (a project tsconfig mid-edit) cannot be
// realpathed; it is registered as spelled so its return still triggers a build.
const watchDependencyPath = (file: string): string => {
  if (process.platform !== 'win32') return file;
  try {
    return realpathSync.native(file);
  } catch {
    return file;
  }
};

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

  private async watchInputs(): Promise<{
    inputs: Set<string>;
    missing: Set<string>;
  }> {
    const inputs = new Set<string>();
    const missing = new Set<string>();
    const projects = [this.options.configFile];
    const visited = new Set<string>();
    for (const configFile of projects) {
      if (visited.has(configFile)) continue;
      visited.add(configFile);
      // Registered before it is parsed: a referenced config that is absent or
      // unparsable right now must still be watched, or creating or repairing
      // it never re-triggers the compilation. `check()` reports the error.
      inputs.add(configFile);
      if (!existsSync(configFile)) {
        missing.add(configFile);
        continue;
      }
      let config: { files?: string[]; references?: { path: string }[] };
      try {
        config = JSON.parse(
          await this.run(['--showConfig', '--project', configFile]),
        );
      } catch {
        continue;
      }
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
    return { inputs, missing };
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
            const watched = watchDependencyPath(projectConfigFile);
            compilation.fileDependencies.add(watched);
            // Absent mid-edit: a missing dependency makes its (re)appearance
            // a rebuild trigger, so the dev server recovers on its own.
            if (!existsSync(projectConfigFile)) {
              compilation.missingDependencies.add(watched);
            }
          }
          const { inputs, missing } = await this.watchInputs();
          for (const file of inputs)
            compilation.fileDependencies.add(watchDependencyPath(file));
          for (const file of missing)
            compilation.missingDependencies.add(watchDependencyPath(file));
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
