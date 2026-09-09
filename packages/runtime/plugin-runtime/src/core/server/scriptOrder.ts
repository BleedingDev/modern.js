import {
  getMatchedRouteChunks as collectMatchedRouteChunks,
  createRouteHydrationScriptTags as createHydrationTags,
  type RouteManifestLike,
  replaceChunkJsPlaceholder as replaceHydrationPlaceholder,
} from '@modern-js/runtime-extensions';
import { getRouterMatchedRouteIds } from '@modern-js/runtime-extensions/router-state';
import type { TInternalRuntimeContext } from '../context';
import { CHUNK_JS_PLACEHOLDER } from './constants';

export {
  injectBeforeHydrationEntryScript,
  orderHydrationScriptChunks,
} from '@modern-js/runtime-extensions';

export function getMatchedRouteChunks<T>(
  runtimeContext: TInternalRuntimeContext,
  routeManifest: RouteManifestLike | undefined,
  routeAssetToChunk: (asset: string) => T,
) {
  if (routeManifest === undefined) {
    return [];
  }

  return collectMatchedRouteChunks(
    routeManifest,
    getRouterMatchedRouteIds(runtimeContext) ?? [],
    routeAssetToChunk,
  );
}

export function replaceChunkJsPlaceholder(
  template: string,
  scripts: string,
  entryName?: string,
  placeholder = CHUNK_JS_PLACEHOLDER,
) {
  return replaceHydrationPlaceholder(template, scripts, entryName, placeholder);
}

export function createRouteHydrationScriptTags(
  runtimeContext: TInternalRuntimeContext,
  entryName: string,
  options: { nonce?: string; template?: string } = {},
) {
  return createHydrationTags(
    runtimeContext.routeManifest,
    getRouterMatchedRouteIds(runtimeContext) ?? [],
    entryName,
    options,
  );
}
