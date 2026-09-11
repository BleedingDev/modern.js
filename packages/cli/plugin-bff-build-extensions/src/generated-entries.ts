import { pathToFileURL } from 'node:url';
import type {
  AppTools,
  BffGeneratedEntries,
  BffGeneration,
} from '@modern-js/app-tools';
import type { CLIPluginAPI } from '@modern-js/plugin';
import { fs, upath as path } from '@modern-js/utils';
import {
  BFF_REQUEST_RUNTIME,
  type BffGenerationMetadata,
} from './client-artifacts';
import type { CrossProjectBffDescriptor } from './cross-project';

export function registerBffGeneratedEntries(
  api: CLIPluginAPI<AppTools>,
  metadata: WeakMap<BffGeneration, BffGenerationMetadata>,
) {
  api.modifyBffGeneratedEntries(async (entries: BffGeneratedEntries) => {
    const { generation } = entries;
    const details = metadata.get(generation);
    if (!details)
      throw new Error(
        'BFF entries require completed operation contract collection.',
      );
    metadata.delete(generation);
    const packageJson = await fs.readJSON(
      path.join(generation.appDirectory, 'package.json'),
    );
    const runtimeSpecifier =
      api.getNormalizedConfig().bff?.runtimeCreateRequest ||
      BFF_REQUEST_RUNTIME;
    const dependencies = [
      '@modern-js/plugin-bff-build-extensions',
      '@modern-js/plugin-bff-extensions',
    ];
    const emitsClient =
      details.runtimeFramework === 'hono' && generation.apiFiles.length > 0;
    if (
      details.runtimeFramework === 'hono' &&
      (runtimeSpecifier === BFF_REQUEST_RUNTIME ||
        (emitsClient &&
          (generation.requestCreator || BFF_REQUEST_RUNTIME) ===
            BFF_REQUEST_RUNTIME))
    )
      dependencies.push('@modern-js/runtime-extensions');
    for (const name of dependencies) {
      const specifier =
        packageJson.dependencies?.[name] ||
        packageJson.devDependencies?.[name] ||
        fs.readJSONSync(require.resolve(`${name}/package.json`)).version;
      entries.packageDependencies[name] = specifier;
    }
    const descriptor: CrossProjectBffDescriptor = {
      native: {
        packageName: packageJson.name,
        prefix: generation.prefix,
        relativeDistPath: path.normalize(generation.relativeDistPath),
        relativeApiPath: path.relative(
          generation.appDirectory,
          generation.apiDirectory,
        ),
        relativeLambdaPath: path.relative(
          generation.appDirectory,
          generation.lambdaDirectory,
        ),
      },
      runtimeFramework: details.runtimeFramework,
      relativeEffectEntry: details.relativeEffectEntry,
      requestId: generation.requestId,
      operationContracts: details.operationContracts,
    };
    const isModule =
      api.getAppContext().moduleType === 'module' ||
      packageJson.type === 'module';
    entries.plugin = {
      code: isModule
        ? `import { createCrossProjectBffPlugin } from '@modern-js/plugin-bff-build-extensions/cross-project';\nexport const crossProjectApiPlugin = () => createCrossProjectBffPlugin(${JSON.stringify(descriptor)});\n`
        : `'use strict';\nconst { createCrossProjectBffPlugin } = require('@modern-js/plugin-bff-build-extensions/cross-project');\nexports.crossProjectApiPlugin = () => createCrossProjectBffPlugin(${JSON.stringify(descriptor)});\n`,
      declaration: `import type { AppTools, CliPlugin } from '@modern-js/app-tools';
export declare const crossProjectApiPlugin: () => CliPlugin<AppTools>;
`,
    };
    if (details.runtimeFramework === 'effect') {
      entries.runtime = null;
      return entries;
    }
    const runtime = JSON.stringify(runtimeSpecifier);
    const esmRuntime = JSON.stringify(
      path.isAbsolute(runtimeSpecifier)
        ? pathToFileURL(runtimeSpecifier).href
        : runtimeSpecifier,
    );
    entries.runtime = {
      code: isModule
        ? `import { configure as _configure } from ${esmRuntime};\nimport { createProducerClient } from '@modern-js/plugin-bff-extensions/producer-runtime';\nexport const configure = createProducerClient(_configure, { requestId: ${JSON.stringify(generation.requestId)} });\nexport const initProducerClient = configure;\n`
        : `'use strict';\nconst { configure: _configure } = require(${runtime});\nconst { createProducerClient } = require('@modern-js/plugin-bff-extensions/producer-runtime');\nconst configure = createProducerClient(_configure, { requestId: ${JSON.stringify(generation.requestId)} });\nexports.configure = configure;\nexports.initProducerClient = configure;\n`,
      declaration: `type Runtime = typeof import(${runtime});
export declare const initProducerClient: (options?: Parameters<Runtime['configure']>[0]) => ReturnType<Runtime['configure']>;
export declare const configure: typeof initProducerClient;
`,
    };
    return entries;
  });
}
