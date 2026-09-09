// @effect-diagnostics asyncFunction:off nodeBuiltinImport:off strictBooleanExpressions:off unnecessaryArrowBlock:off

import { serializeJson } from '@modern-js/runtime-utils/node';
import type { HeadersData } from '@modern-js/runtime-utils/universal/request';
import type { IncomingHttpHeaders } from 'http';
import { type RenderLevel, SSR_DATA_JSON_ID } from '../../constants';
import type { TInternalRuntimeContext } from '../../context';
import type { SSRContainer } from '../../types';
import { CHUNK_JS_PLACEHOLDER, SSR_DATA_PLACEHOLDER } from '../constants';
import type { HandleRequestConfig } from '../requestHandler';
import {
  type BuildHtmlCb,
  buildHtml,
  type createSSRRenderLifecycle,
  replaceSSRTemplateChunk,
  type SSRConfig,
} from '../shared';
import { attributesToString } from '../utils';

export type BuildShellAfterTemplateOptions = {
  runtimeContext: TInternalRuntimeContext;
  renderLevel: RenderLevel;
  ssrConfig: SSRConfig;
  request: Request;
  entryName: string;
  config: HandleRequestConfig;
  lifecycle?: ReturnType<typeof createSSRRenderLifecycle>;
};

export function buildShellAfterTemplate(
  afterAppTemplate: string,
  options: BuildShellAfterTemplateOptions,
) {
  const {
    request,
    config,
    ssrConfig,
    runtimeContext,
    renderLevel,
    entryName,
    lifecycle,
  } = options;

  const callbacks: BuildHtmlCb[] = [
    template => injectJs(template, entryName, config.nonce),
    createReplaceSSRData({
      request,
      ssrConfig,
      nonce: config.nonce,
      useJsonScript: config.useJsonScript,
      runtimeContext,
      renderLevel,
      lifecycle,
    }),
  ];

  async function injectJs(template: string, entryName: string, nonce?: string) {
    const assets: string[] =
      runtimeContext.routeManifest?.routeAssets?.[`async-${entryName}`]
        ?.assets ?? [];
    const jsChunkStr = assets
      .filter(asset => asset.endsWith('.js'))
      .map(
        asset =>
          `<script${attributesToString({ src: asset, nonce })}></script>`,
      )
      .join(' ');
    return replaceSSRTemplateChunk(
      {
        name: 'scripts',
        template,
        placeholder: CHUNK_JS_PLACEHOLDER,
        content: jsChunkStr,
      },
      lifecycle,
      { preserveEmpty: true },
    );
  }

  return buildHtml(afterAppTemplate, callbacks);
}

function createReplaceSSRData(options: {
  request: Request;
  runtimeContext: TInternalRuntimeContext;
  ssrConfig: SSRConfig;
  nonce?: string;
  useJsonScript?: boolean;
  renderLevel: RenderLevel;
  lifecycle?: ReturnType<typeof createSSRRenderLifecycle>;
}) {
  const {
    runtimeContext,
    nonce,
    renderLevel,
    useJsonScript,
    ssrConfig,
    lifecycle,
  } = options;

  const { request, reporter } = runtimeContext.ssrContext!;

  const headers =
    typeof ssrConfig === 'object' && ssrConfig.unsafeHeaders
      ? Object.fromEntries(
          Object.entries(request.headers as HeadersData).filter(([key, _]) => {
            return ssrConfig.unsafeHeaders
              ?.map(header => header.toLowerCase())
              ?.includes(key.toLowerCase());
          }),
        )
      : undefined;

  const ssrData: SSRContainer = {
    data: {
      initialData: runtimeContext.initialData,
      i18nData: runtimeContext.__i18nData__ as Record<string, unknown>,
    },
    context: {
      reporter: {
        sessionId: reporter?.sessionId,
      },

      request: {
        query: request.query,
        params: request.params,
        pathname: request.pathname,
        host: request.host,
        url: request.url,
        headers: headers as IncomingHttpHeaders,
      },
    },
    mode: 'stream',
    renderLevel,
  };
  const attrsStr = attributesToString({ nonce });
  const serializeSSRData = serializeJson(ssrData);

  const ssrDataScript = useJsonScript
    ? `<script type="application/json" id="${SSR_DATA_JSON_ID}">${serializeSSRData}</script>`
    : `<script${attrsStr}>window._SSR_DATA = ${serializeSSRData}</script>`;

  return (template: string) =>
    replaceSSRTemplateChunk(
      {
        name: 'data',
        template,
        placeholder: SSR_DATA_PLACEHOLDER,
        content: ssrDataScript,
      },
      lifecycle,
    );
}
