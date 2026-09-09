import { pathToFileURL } from 'node:url';
import type { BffGeneratedModule } from '@modern-js/app-tools';
import { fs } from '@modern-js/utils';
import path from 'path';

interface RuntimeGeneratorOptions {
  runtime: string;
  appDirectory: string;
  relativeDistPath: string;
  packageName?: string;
}

export function renderBffRuntime(
  options: RuntimeGeneratorOptions,
): BffGeneratedModule {
  const packagePath = path.resolve(options.appDirectory, 'package.json');
  const packageJson = fs.existsSync(packagePath)
    ? fs.readJSONSync(packagePath)
    : {};
  const requestId =
    options.packageName ||
    packageJson.name ||
    process.env.npm_package_name ||
    'default';
  const runtime = JSON.stringify(options.runtime);
  const esmRuntime = JSON.stringify(
    path.isAbsolute(options.runtime)
      ? pathToFileURL(options.runtime).href
      : options.runtime,
  );
  return {
    code:
      packageJson.type === 'module'
        ? `import { configure as _configure } from ${esmRuntime};\nexport const initProducerClient = options => _configure({ requestId: ${JSON.stringify(requestId)}, ...options });\nexport const configure = initProducerClient;\n`
        : `'use strict';\nconst { configure: _configure } = require(${runtime});\nconst initProducerClient = options => _configure({ requestId: ${JSON.stringify(requestId)}, ...options });\nexports.initProducerClient = initProducerClient;\nexports.configure = initProducerClient;\n`,
    declaration: `type Runtime = typeof import(${runtime});
export declare const initProducerClient: (options?: Parameters<Runtime['configure']>[0]) => ReturnType<Runtime['configure']>;
export declare const configure: typeof initProducerClient;
`,
  };
}

export default async function runtimeGenerator(
  options: RuntimeGeneratorOptions,
  rendered?: BffGeneratedModule,
) {
  const module = rendered ?? renderBffRuntime(options);
  const directory = path.resolve(
    options.appDirectory,
    options.relativeDistPath,
    'runtime',
  );
  await fs.outputFile(path.join(directory, 'index.js'), module.code);
  await fs.outputFile(path.join(directory, 'index.d.ts'), module.declaration);
}
