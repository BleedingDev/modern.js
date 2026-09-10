import type { AppTools, BffCompilation } from '@modern-js/app-tools';
import type { CLIPluginAPI } from '@modern-js/plugin';
import {
  serializeServerGlobalVars,
  transformServerGlobalVars,
} from './server-global-vars';

export function registerBffCompilation(api: CLIPluginAPI<AppTools>) {
  const serialized = new WeakMap<
    BffCompilation,
    ReturnType<typeof serializeServerGlobalVars>
  >();
  api.onBeforeBffCompile(context => {
    serialized.set(
      context,
      serializeServerGlobalVars(api.getNormalizedConfig().source.globalVars),
    );
  });
  api.onAfterBffCompile(async context => {
    const globals = serialized.get(context);
    if (!globals)
      throw new Error('BFF compilation completed without its before hook.');
    serialized.delete(context);
    await transformServerGlobalVars([...context.outputDirectories], globals);
    if (api.getAppContext().bffRuntimeFramework !== 'effect') return;
    // Hosted APIs use the producer's compiled entry; it is not emitted by this app.
    if (api.getNormalizedConfig().bff?.isCrossProjectServer === true) return;
    const { bundleBuiltEffectEntryForNode } = await import(
      '@modern-js/plugin-bff-extensions/effect-source-loader'
    );
    await bundleBuiltEffectEntryForNode({
      appDir: context.appDirectory,
      apiDir: context.apiDirectory,
      distDir: context.distDirectory,
      effectEntry: api.getNormalizedConfig().bff?.effect?.entry,
      format: context.moduleType === 'module' ? 'esm' : 'cjs',
    });
  });
}
