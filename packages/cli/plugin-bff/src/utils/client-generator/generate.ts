// @effect-diagnostics asyncFunction:off nodeBuiltinImport:off processEnv:off strictBooleanExpressions:off
import type { BffClientArtifacts, BffGeneration } from '@modern-js/app-tools';
import {
  ClientCodegenError,
  type GenClientOptions,
  generateClient,
} from '@modern-js/bff-core';
import type { HttpMethodDecider } from '@modern-js/types';
import { fs, logger } from '@modern-js/utils';
import path from 'path';
import {
  CLIENT_DIR,
  createFileDetails,
  type FileDetails,
  readDirectoryFiles,
  writeTargetFile,
} from './files';
import { getPackageName } from './package-json';
import {
  buildClientTypeFacade,
  createMissingClientDeclarationError,
  DEFAULT_EXPORT_RE,
  isMissingClientDeclarationError,
} from './type-facade';
import { setPackage, writeClientModuleBoundary } from './write-package';

export type APILoaderOptions = {
  prefix: string;
  appDir: string;
  apiDir: string;
  lambdaDir: string;
  existLambda: boolean;
  port?: number;
  requestCreator?: string;
  clientCodegenPlugin?: string;
  httpMethodDecider?: HttpMethodDecider;
  relativeDistPath: string;
  relativeApiPath: string;
  requestId?: string;
  /**
   * Absolute paths of the valid API files, resolved by ApiRouter with the same
   * `API_FILE_RULES` the runtime router uses. Passing them in keeps the client
   * generator and the router in agreement about what an API module is, so
   * stray artifacts next to the sources (compiled `.d.ts`/`.js`, tests,
   * private files) never reach `generateClient`.
   */
  apiFiles: string[];
};

export interface ClientGenerationIntegration {
  generation: BffGeneration;
  modifyArtifacts: (context: BffClientArtifacts) => Promise<BffClientArtifacts>;
  beforePublish: () => Promise<Record<string, string> | void>;
}

export async function clientGenerator(
  draftOptions: APILoaderOptions,
  integration?: ClientGenerationIntegration,
) {
  const generatedClientDir = path.resolve(
    draftOptions.appDir,
    draftOptions.relativeDistPath,
    CLIENT_DIR,
  );
  await fs.remove(generatedClientDir);
  const requestId =
    draftOptions.requestId ||
    getPackageName(draftOptions.appDir) ||
    process.env.npm_package_name;

  const lambdaSourceList = draftOptions.existLambda
    ? await readDirectoryFiles(
        draftOptions.appDir,
        draftOptions.lambdaDir,
        draftOptions.relativeDistPath,
        draftOptions.apiFiles,
      )
    : [];
  const generatedSourceList = [...lambdaSourceList];
  const getClitentCode = async (resourcePath: string, source: string) => {
    const warning = `The file ${resourcePath} is not allowed to be imported in src directory, only API definition files are allowed.`;

    if (!draftOptions.existLambda) {
      logger.warn(warning);
      return;
    }

    const options: GenClientOptions = {
      prefix: (Array.isArray(draftOptions.prefix)
        ? draftOptions.prefix[0]
        : draftOptions.prefix) as string,
      appDir: draftOptions.appDir,
      apiDir: draftOptions.apiDir,
      lambdaDir: draftOptions.lambdaDir,
      port: Number(draftOptions.port),
      source,
      resourcePath,
      target: 'bundle',
      httpMethodDecider: draftOptions.httpMethodDecider,
      requestCreator: draftOptions.requestCreator,
      clientCodegenPlugin: draftOptions.clientCodegenPlugin,
      requestId,
    };

    const { lambdaDir } = draftOptions;
    if (!resourcePath.startsWith(lambdaDir)) {
      logger.warn(warning);
      return;
    }

    const result = await generateClient(options);

    return result;
  };

  // The generated client directory always carries `{"type": "module"}` (see
  // writeClientModuleBoundary), so its declarations are native ESM whatever the
  // surrounding app's moduleType is, and their re-export specifiers always need
  // the explicit `.js` extension. Deriving this from the app-level moduleType
  // — as upstream's cli.ts does — would emit extensionless specifiers into an
  // ESM package and break node16/nodenext consumers with TS2835.
  const writeClientTypeFacade = async (
    source: FileDetails,
    clientCode: string,
  ) => {
    if (
      !(await fs.pathExists(
        path.resolve(draftOptions.appDir, source.relativeTargetDistDir),
      ))
    ) {
      throw createMissingClientDeclarationError(
        source.resourcePath,
        path.resolve(draftOptions.appDir, source.relativeTargetDistDir),
      );
    }

    const clientTypesFile = source.absTargetDir.replace(/\.js$/, '.d.ts');
    await writeTargetFile(
      path.resolve(clientTypesFile),
      buildClientTypeFacade(
        clientTypesFile,
        path.resolve(draftOptions.appDir, source.relativeTargetDistDir),
        DEFAULT_EXPORT_RE.test(clientCode),
        true,
      ),
    );
  };

  try {
    for (const source of lambdaSourceList) {
      const code = await getClitentCode(source.resourcePath, source.source);
      if (code?.value) {
        await writeTargetFile(source.absTargetDir, code.value);
        await writeClientTypeFacade(source, code.value);
      }
    }

    logger.info(`Client bundle generate succeed`);
  } catch (error) {
    // A missing handler declaration silently published a broken type surface,
    // which is exactly the defect this generator now guards; it must not be
    // downgraded to a log line by the surrounding best-effort handler.
    if (
      isMissingClientDeclarationError(error) ||
      error instanceof ClientCodegenError
    ) {
      throw error;
    }
    logger.error(`Client bundle generate failed: ${error}`);
  }

  let packageDependencies: Record<string, string> | undefined;
  if (integration) {
    const artifacts = await integration.modifyArtifacts({
      generation: integration.generation,
      additionalArtifacts: [],
    });
    if (artifacts.generation !== integration.generation) {
      throw new Error('BFF artifacts must preserve generation identity.');
    }
    const sourcePaths = new Set(
      generatedSourceList.map(file => path.resolve(file.resourcePath)),
    );
    const exportKeys = new Set(generatedSourceList.map(file => file.exportKey));
    const outputPaths = new Set(
      generatedSourceList.map(file => path.resolve(file.absTargetDir)),
    );
    const additionalFiles = artifacts.additionalArtifacts.map(artifact => {
      const relative = artifact.sourcePath;
      const resourcePath = path.resolve(draftOptions.apiDir, relative);
      if (
        !relative ||
        path.isAbsolute(relative) ||
        relative.includes('\\') ||
        path
          .relative(draftOptions.apiDir, resourcePath)
          .split(path.sep)
          .includes('..') ||
        path
          .relative(draftOptions.apiDir, resourcePath)
          .split(path.sep)
          .join('/') !== relative ||
        !/\.[cm]?[jt]sx?$/.test(relative)
      ) {
        throw new Error(`Invalid BFF client artifact source path: ${relative}`);
      }
      const file = createFileDetails({
        appDirectory: draftOptions.appDir,
        baseDirectory: draftOptions.apiDir,
        resourcePath,
        source: '',
        relativeDistPath: draftOptions.relativeDistPath,
      });
      if (
        sourcePaths.has(resourcePath) ||
        exportKeys.has(file.exportKey) ||
        outputPaths.has(path.resolve(file.absTargetDir))
      ) {
        throw new Error(`BFF client artifact collision: ${relative}`);
      }
      sourcePaths.add(resourcePath);
      exportKeys.add(file.exportKey);
      outputPaths.add(path.resolve(file.absTargetDir));
      return { file, artifact };
    });
    for (const { file, artifact } of additionalFiles) {
      await writeTargetFile(file.absTargetDir, artifact.code);
      await writeTargetFile(
        file.absTargetDir.replace(/\.js$/, '.d.ts'),
        artifact.declaration,
      );
      generatedSourceList.push(file);
    }
    packageDependencies = (await integration.beforePublish()) || undefined;
  }

  if (generatedSourceList.length > 0) {
    await writeClientModuleBoundary(
      draftOptions.appDir,
      draftOptions.relativeDistPath,
    );
  }

  await setPackage(
    generatedSourceList,
    draftOptions.appDir,
    draftOptions.relativeDistPath,
    packageDependencies,
  );

  return null;
}

export default clientGenerator;
