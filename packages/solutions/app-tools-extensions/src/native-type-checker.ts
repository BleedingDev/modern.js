import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Rspack, RspackChain } from '@rsbuild/core';

const execute = promisify(execFile);
const name = 'UltramodernNativeTypeChecker';

export class UltramodernNativeTypeChecker {
  constructor(
    private readonly options: {
      compiler: () => string;
      configFile: string;
      build: boolean;
    },
  ) {}

  async check(): Promise<void> {
    const { compiler, configFile, build } = this.options;
    const args = build
      ? ['--build', configFile, '--stopBuildOnErrors']
      : ['--project', configFile, '--noEmit'];
    try {
      await execute(compiler(), [...args, '--pretty', 'false'], {
        cwd: path.dirname(configFile),
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (cause) {
      const output = cause as { stdout?: string; stderr?: string };
      throw new Error(
        `${name} failed:\n${output.stdout ?? ''}${output.stderr ?? ''}`,
        { cause },
      );
    }
  }

  apply(compiler: Rspack.Compiler): void {
    compiler.hooks.beforeCompile.tapPromise(name, () => this.check());
    compiler.hooks.thisCompilation.tap(name, compilation => {
      compilation.fileDependencies.add(this.options.configFile);
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
