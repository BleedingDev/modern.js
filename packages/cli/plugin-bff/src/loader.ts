// @effect-diagnostics asyncFunction:off nodeBuiltinImport:off strictBooleanExpressions:off
import { type GenClientOptions, generateClient } from '@modern-js/bff-core';
import type { HttpMethodDecider } from '@modern-js/types';
import { logger } from '@modern-js/utils';
import type { Rspack } from '@rsbuild/core';

const createErrorModule = (message: string) =>
  `throw new Error(${JSON.stringify(message)});`;

export type APILoaderOptions = {
  prefix: string;
  appDir: string;
  apiDir: string;
  lambdaDir: string;
  existLambda: boolean;
  port: number;
  fetcher?: string;
  requestCreator?: string;
  clientCodegenPlugin?: string;
  requestId?: string;
  target: string;
  httpMethodDecider?: HttpMethodDecider;
};

async function loader(
  this: Rspack.LoaderContext<APILoaderOptions>,
  source: string,
) {
  this.cacheable();

  const { resourcePath } = this;

  delete require.cache[resourcePath];

  const callback = this.async();

  const draftOptions = this.getOptions();
  const warning = `The file ${resourcePath} is not allowed to be imported in src directory, only API definition files are allowed.`;

  if (!draftOptions.existLambda) {
    logger.warn(warning);
    callback(null, createErrorModule(warning));
    return;
  }

  const options: GenClientOptions = {
    prefix: (Array.isArray(draftOptions.prefix)
      ? draftOptions.prefix[0]
      : draftOptions.prefix) as string,
    appDir: draftOptions.appDir,
    apiDir: draftOptions.apiDir,
    lambdaDir: draftOptions.lambdaDir,
    target: draftOptions.target,
    port: Number(draftOptions.port),
    source,
    resourcePath,
    httpMethodDecider: draftOptions.httpMethodDecider,
    clientCodegenPlugin: draftOptions.clientCodegenPlugin,
    requestId: draftOptions.requestId,
  };

  const { lambdaDir } = draftOptions;
  if (!resourcePath.startsWith(lambdaDir)) {
    logger.warn(warning);
    callback(null, createErrorModule(warning));
    return;
  }

  if (draftOptions.fetcher) {
    options.fetcher = draftOptions.fetcher;
  }

  if (draftOptions.requestCreator) {
    options.requestCreator = draftOptions.requestCreator;
  }

  options.requireResolve = require.resolve;

  try {
    const result = await generateClient(options);
    if (result.isOk) {
      callback(undefined, result.value);
    } else {
      callback(undefined, createErrorModule(result.value));
    }
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
  }
}

export default loader;
