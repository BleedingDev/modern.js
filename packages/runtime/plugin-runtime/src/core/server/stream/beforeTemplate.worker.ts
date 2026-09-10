// @effect-diagnostics asyncFunction:off processEnv:off strictBooleanExpressions:off unnecessaryArrowBlock:off
import type { SSRHeadData } from '@modern-js/plugin/runtime';
import type { TInternalRuntimeContext } from '../../context';
import { CHUNK_CSS_PLACEHOLDER } from '../constants';
import { createReplaceHelemt } from '../helmet';
import type { HandleRequestConfig } from '../requestHandler';
import {
  type BuildHtmlCb,
  buildHtml,
  type createSSRRenderLifecycle,
  replaceSSRTemplateChunk,
} from '../shared';
import { hasStylesheetLink } from '../utils';

const checkIsInline = (
  chunk: string,
  enableInline: boolean | RegExp | undefined,
) => {
  // only production apply the inline config
  if (process.env.NODE_ENV === 'production') {
    if (enableInline instanceof RegExp) {
      return enableInline.test(chunk);
    } else {
      return Boolean(enableInline);
    }
  } else {
    return false;
  }
};

export interface BuildShellBeforeTemplateOptions {
  runtimeContext: TInternalRuntimeContext;
  entryName: string;
  config: HandleRequestConfig;
  styledComponentsStyleTags?: string;
  lifecycle?: ReturnType<typeof createSSRRenderLifecycle>;
  helmetData?: SSRHeadData;
}

type RouteManifest = {
  referenceCssAssets?: string[];
};

type RouteManifestLike = {
  routeAssets?: Record<string, RouteManifest | undefined>;
};

export async function buildShellBeforeTemplate(
  beforeAppTemplate: string,
  options: BuildShellBeforeTemplateOptions,
) {
  const {
    config,
    runtimeContext,
    styledComponentsStyleTags,
    entryName,
    lifecycle,
    helmetData,
  } = options;

  const callbacks: BuildHtmlCb[] = [
    createReplaceHelemt(helmetData),
    template => injectCss(template, entryName, styledComponentsStyleTags),
  ];

  return buildHtml(beforeAppTemplate, callbacks);

  async function injectCss(
    template: string,
    entryName: string,
    styledComponentsStyleTags?: string,
  ) {
    let css = await getCssChunks();
    if (styledComponentsStyleTags) {
      css += styledComponentsStyleTags;
    }
    return replaceSSRTemplateChunk(
      {
        name: 'styles',
        template,
        placeholder: CHUNK_CSS_PLACEHOLDER,
        content: css,
        emittedAssets: css
          .match(/href="([^"]+)"/g)
          ?.map(item => item.replace(/^href="/, '').replace(/"$/, '')),
      },
      lifecycle,
    );

    async function getCssChunks() {
      const { routeManifest } = runtimeContext;
      const routeAssets = (routeManifest as RouteManifestLike | undefined)
        ?.routeAssets;
      if (!routeAssets) {
        return '';
      }

      const matchedRouteManifests: RouteManifest[] = [];

      const createAsset = (url: string) => ({ url });
      const groups = [
        {
          name: 'route',
          assets: matchedRouteManifests
            .flatMap(manifest => manifest.referenceCssAssets ?? [])
            .map(createAsset),
        },
        {
          name: 'async-entry',
          assets: (
            routeAssets[`async-${entryName}`]?.referenceCssAssets ?? []
          ).map(createAsset),
        },
      ];
      const assets =
        lifecycle?.transformAssets(groups, {
          kind: 'style',
          source: 'template',
          template,
          createAsset,
        }) ?? groups.flatMap(group => group.assets);
      const cssChunks = assets
        .map(asset => asset.url)
        .filter(
          asset =>
            asset.endsWith('.css') && !hasStylesheetLink(template, asset),
        );

      const { inlineStyles } = config;

      const styles = cssChunks.map(chunk => {
        const link = `<link href="${chunk}" rel="stylesheet" />`;
        if (checkIsInline(chunk, inlineStyles)) {
          return link;
        }
        return link;
      });

      return `${styles.join('')}`;
    }
  }
}
