import type {
  SSRRenderInfo,
  SSRRenderLifecycle,
} from '@modern-js/plugin/runtime';
import {
  getMatchedRouteChunks,
  orderHydrationScriptChunks,
} from '@modern-js/runtime-extensions';
import { getRouterMatchedRouteIds } from '@modern-js/runtime-extensions/router-state';

export type RendererRouteManifest = {
  routeAssets?: Record<
    string,
    | {
        assets?: string[];
        referenceCssAssets?: string[];
      }
    | undefined
  >;
};

export type RendererResource = {
  entryName?: string;
  htmlTemplate?: string;
  routeManifest?: RendererRouteManifest;
  moduleFederationCssAssets?: string[];
};

export function getRendererResources(render: SSRRenderInfo) {
  const resource = render.resource as RendererResource | undefined;
  const context = render.runtimeContext as {
    routeManifest?: RendererRouteManifest;
  };
  return {
    resource,
    entryName: resource?.entryName ?? 'index',
    // String mode deliberately honors an explicitly omitted resource manifest.
    routeManifest:
      render.mode === 'string'
        ? resource?.routeManifest
        : context.routeManifest,
  };
}

export function createAssetPolicy(
  render: SSRRenderInfo,
): Pick<SSRRenderLifecycle, 'transformAssets'> {
  const { routeManifest, entryName } = getRendererResources(render);
  return {
    transformAssets(assets, info) {
      const matchedRouteIds =
        getRouterMatchedRouteIds(render.runtimeContext) ?? [];
      if (info.source === 'loadable') {
        const matched = getMatchedRouteChunks(
          routeManifest,
          matchedRouteIds,
          info.createAsset,
        );
        if (info.kind === 'style') return [...assets, ...matched];
        const asyncEntryChunks = [
          ...(info.groups.find(group => group.name === 'async-entry')?.assets ??
            []),
        ];
        const collectedChunks = [
          ...(info.groups.find(group => group.name === 'loadable')?.assets ??
            []),
        ];
        return orderHydrationScriptChunks({
          asyncEntryChunks,
          collectedChunks,
          matchedRouteChunks: matched,
          entryName,
        });
      }
      if (info.kind !== 'style' || matchedRouteIds.length === 0) return assets;
      const routeAssets = routeManifest?.routeAssets;
      if (routeAssets === undefined) return assets;
      const matched = matchedRouteIds
        .flatMap(routeId => routeAssets[routeId]?.referenceCssAssets ?? [])
        .map(info.createAsset);
      const entry =
        info.groups.find(group => group.name === 'async-entry')?.assets ?? [];
      return [...matched, ...entry];
    },
  };
}
