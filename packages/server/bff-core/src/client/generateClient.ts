import { pathToFileURL } from 'node:url';
import type { HttpMethodDecider } from '@modern-js/types';
import * as path from 'path';
import { type APIHandlerInfo, ApiRouter } from '../router';
import { Err, Ok, type Result } from './result';

export type GenClientResult = Result<string>;

export type GenClientOptions = {
  resourcePath: string;
  source: string;
  appDir: string;
  apiDir: string;
  lambdaDir: string;
  prefix: string;
  port: number;
  requestCreator?: string;
  fetcher?: string;
  target?: string;
  requireResolve?: typeof require.resolve;
  httpMethodDecider?: HttpMethodDecider;
  domain?: string;
  requestId?: string;
  /** Node module exporting a modifyClient code-generation transform. */
  clientCodegenPlugin?: string;
};

export interface ClientHandlerDraft {
  readonly handlerInfo: APIHandlerInfo;
  /** Source expressions, including native server port and fetch bindings. */
  optionProperties: string[];
}

export interface ClientModuleDraft {
  requestCreator: string;
  imports: string[];
  statements: string[];
  readonly handlers: readonly ClientHandlerDraft[];
}

export interface ClientCodegenContext {
  readonly options: Readonly<GenClientOptions>;
  readonly handlerInfos: readonly APIHandlerInfo[];
}

export type ClientCodegenPlugin = (
  draft: ClientModuleDraft,
  context: ClientCodegenContext,
) => void | Promise<void>;

/** A failed transform must not be downgraded to best-effort publication. */
export class ClientCodegenError extends Error {
  constructor(plugin: string, cause: unknown) {
    super(`BFF client code-generation plugin failed: ${plugin}`, { cause });
    this.name = 'ClientCodegenError';
  }
}

export const INNER_CLIENT_REQUEST_CREATOR = '@modern-js/plugin-bff/client';

export const generateClient = async (
  options: GenClientOptions,
): Promise<GenClientResult> => {
  const {
    appDir,
    resourcePath,
    apiDir,
    lambdaDir,
    prefix,
    port,
    target,
    fetcher,
    requireResolve = require.resolve,
    httpMethodDecider,
    domain,
    requestId,
    clientCodegenPlugin,
  } = options;
  const apiRouter = new ApiRouter({
    appDir,
    apiDir,
    lambdaDir,
    prefix,
    httpMethodDecider,
  });
  const handlerInfos = await apiRouter.getSingleModuleHandlers(resourcePath);
  if (!handlerInfos) {
    return Err(`generate client error: Cannot require module ${resourcePath}`);
  }

  const draft: ClientModuleDraft = {
    requestCreator: options.requestCreator || INNER_CLIENT_REQUEST_CREATOR,
    imports: fetcher
      ? [`import { fetch } from ${JSON.stringify(fetcher)};`]
      : [],
    statements: [],
    handlers: handlerInfos.map(handlerInfo => {
      const optionProperties = [
        `path: ${JSON.stringify(handlerInfo.routePath)}`,
      ];
      if (handlerInfo.action !== 'upload') {
        const portExpression =
          target === 'server'
            ? `process.env.PORT || ${String(port)}`
            : String(port);
        optionProperties.push(
          `method: ${JSON.stringify(handlerInfo.httpMethod.toUpperCase())}`,
          `port: ${portExpression}`,
          `httpMethodDecider: ${JSON.stringify(httpMethodDecider || 'functionName')}`,
        );
      }
      if (domain) optionProperties.push(`domain: ${JSON.stringify(domain)}`);
      if (fetcher && handlerInfo.action !== 'upload')
        optionProperties.push('fetch');
      if (requestId)
        optionProperties.push(`requestId: ${JSON.stringify(requestId)}`);
      return { handlerInfo, optionProperties };
    }),
  };

  if (clientCodegenPlugin) {
    try {
      const specifier = clientCodegenPlugin.startsWith('.')
        ? path.resolve(appDir, clientCodegenPlugin)
        : clientCodegenPlugin;
      const resolved = requireResolve(specifier, { paths: [appDir] });
      const extension = await import(pathToFileURL(resolved).href);
      const modifyClient: ClientCodegenPlugin | undefined =
        extension.modifyClient ?? extension.default?.modifyClient;
      if (typeof modifyClient !== 'function') {
        throw new TypeError('The module must export a modifyClient function.');
      }
      await modifyClient(draft, { options, handlerInfos });
    } catch (cause) {
      throw new ClientCodegenError(clientCodegenPlugin, cause);
    }
  }

  const hasUploadHandler = handlerInfos.some(info => info.action === 'upload');
  const requestImports = `createRequest${hasUploadHandler ? ', createUploader' : ''}`;
  const importCode = [
    `import { ${requestImports} } from ${JSON.stringify(draft.requestCreator)};`,
    ...draft.imports,
  ].join('\n');
  const handlersCode = draft.handlers
    .map(({ handlerInfo, optionProperties }) => {
      const exportStatement =
        handlerInfo.name.toLowerCase() === 'default'
          ? 'default'
          : `var ${handlerInfo.name} =`;
      const creator =
        handlerInfo.action === 'upload' ? 'createUploader' : 'createRequest';
      return `export ${exportStatement} ${creator}({ ${optionProperties.join(', ')} });`;
    })
    .join('\n');
  return Ok(
    `${[importCode, ...draft.statements, handlersCode].filter(Boolean).join('\n\n')}\n`,
  );
};
