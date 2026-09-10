import type {
  SSRRenderInfo,
  SSRRenderLifecycle,
} from '@modern-js/plugin/runtime';
import {
  createRouteHydrationScriptTags,
  replaceChunkJsPlaceholder,
} from '@modern-js/runtime-extensions';
import {
  getRouterHydrationScripts,
  getRouterMatchedRouteIds,
  getRouterServerSnapshot,
} from '@modern-js/runtime-extensions/router-state';
import { getRendererResources } from './assetPolicy';
import { createFederatedCssLinks } from './federatedCss';

export function createTemplatePolicy(
  render: SSRRenderInfo,
): Pick<SSRRenderLifecycle, 'transformTemplateChunk' | 'getRouterData'> {
  const { resource, routeManifest, entryName } = getRendererResources(render);
  const config = render.config as { nonce?: string } | undefined;
  return {
    getRouterData() {
      return (
        getRouterServerSnapshot(render.runtimeContext)?.routerData || undefined
      );
    },
    transformTemplateChunk(chunk, formatting) {
      if (chunk.name === 'styles') {
        return {
          ...chunk,
          content:
            chunk.content +
            createFederatedCssLinks(
              resource?.moduleFederationCssAssets,
              {
                template: chunk.template,
                attributes: chunk.attributes,
                existingAssets: chunk.emittedAssets,
              },
              formatting,
            ),
        };
      }
      let content = chunk.content;
      if (chunk.name === 'scripts' && render.mode === 'stream') {
        content = createRouteHydrationScriptTags(
          routeManifest,
          getRouterMatchedRouteIds(render.runtimeContext) ?? [],
          entryName,
          { nonce: config?.nonce, template: chunk.template },
        );
      } else if (chunk.name === 'data') {
        const scripts = getRouterHydrationScripts(render.runtimeContext);
        if (scripts.length > 0) content += `\n${scripts.join('\n')}`;
      }
      return {
        ...chunk,
        content: '',
        template: replaceChunkJsPlaceholder(
          chunk.template,
          content,
          entryName,
          chunk.placeholder,
        ),
      };
    },
  };
}
