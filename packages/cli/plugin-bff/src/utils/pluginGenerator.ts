import type { BffGeneratedModule } from '@modern-js/app-tools';
import { fs, logger, normalizeToPosixPath } from '@modern-js/utils';
import path from 'path';

interface PluginGeneratorOptions {
  prefix: string;
  appDirectory: string;
  relativeDistPath: string;
  relativeApiPath: string;
  relativeLambdaPath: string;
}

export async function renderBffPlugin(
  options: PluginGeneratorOptions,
): Promise<BffGeneratedModule> {
  const packageJson = await fs.readJSON(
    path.resolve(options.appDirectory, 'package.json'),
  );
  const descriptor = {
    packageName: packageJson.name,
    prefix: options.prefix,
    relativeDistPath: normalizeToPosixPath(options.relativeDistPath),
    relativeApiPath: normalizeToPosixPath(options.relativeApiPath),
    relativeLambdaPath: normalizeToPosixPath(options.relativeLambdaPath),
  };
  return {
    code:
      packageJson.type === 'module'
        ? `import { createCrossProjectApiPlugin } from '@modern-js/plugin-bff/cross-project';\nexport const crossProjectApiPlugin = () => createCrossProjectApiPlugin(${JSON.stringify(descriptor)});\n`
        : `'use strict';\nconst { createCrossProjectApiPlugin } = require('@modern-js/plugin-bff/cross-project');\nexports.crossProjectApiPlugin = () => createCrossProjectApiPlugin(${JSON.stringify(descriptor)});\n`,
    declaration: `import type { AppTools, CliPlugin } from '@modern-js/app-tools';
export declare const crossProjectApiPlugin: () => CliPlugin<AppTools>;
`,
  };
}

export default async function pluginGenerator(
  options: PluginGeneratorOptions,
  rendered?: BffGeneratedModule,
) {
  const module = rendered ?? (await renderBffPlugin(options));
  const directory = path.resolve(
    options.appDirectory,
    options.relativeDistPath,
    'plugin',
  );
  await fs.outputFile(path.join(directory, 'index.js'), module.code);
  await fs.outputFile(path.join(directory, 'index.d.ts'), module.declaration);
  logger.info('Api plugin generate succeed');
}
