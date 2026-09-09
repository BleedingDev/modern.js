// @effect-diagnostics asyncFunction:off strictBooleanExpressions:off
import { createRuntimeContextExtension } from './contextExtensions';
import type {
  InternalRouterRuntimeState,
  InternalRouterServerSnapshot,
  RouterRouteMatchSnapshot,
  RouterServerPrepareResult,
} from './routerStateTypes';

export type {
  BuiltInRouterFramework,
  InternalRouterRuntimeState,
  InternalRouterServerSnapshot,
  RouterFramework,
  RouterLifecyclePhase,
  RouterRouteMatchSnapshot,
  RouterServerPrepareResult,
} from './routerStateTypes';

/**
 * Router runtime state is shared by every router provider (react-router,
 * @modern-js/plugin-tanstack, ...) and consumed by the SSR pipeline. It lives
 * in the runtime-context extension slot instead of ad-hoc fields on
 * `TInternalRuntimeContext`.
 */
const routerRuntimeStateExtension =
  createRuntimeContextExtension<InternalRouterRuntimeState>(
    '@modern-js/runtime:router-runtime-state',
  );

/**
 * The server snapshot is tracked separately: a later
 * `applyRouterRuntimeState` call without a snapshot must not clear a
 * previously captured one.
 */
const routerServerSnapshotExtension =
  createRuntimeContextExtension<InternalRouterServerSnapshot>(
    '@modern-js/runtime:router-server-snapshot',
  );

export function getRouterRuntimeState(
  runtimeContext: object,
): InternalRouterRuntimeState | undefined {
  return routerRuntimeStateExtension.get(runtimeContext);
}

export function getRouterServerSnapshot(
  runtimeContext: object,
): InternalRouterServerSnapshot | undefined {
  return routerServerSnapshotExtension.get(runtimeContext);
}

type RouterSnapshotLike = Partial<InternalRouterServerSnapshot>;

function toHydrationScripts(state: {
  hydrationScript?: string;
  hydrationScripts?: string[];
}) {
  if (state.hydrationScripts?.length) {
    return state.hydrationScripts;
  }

  return state.hydrationScript ? [state.hydrationScript] : undefined;
}

function getMatchedRouteIdsFromMatches(matches?: RouterRouteMatchSnapshot[]) {
  const routeIds = matches
    ?.map(match => match.assetRouteId ?? match.routeId)
    .filter((routeId): routeId is string => typeof routeId === 'string');

  return routeIds?.length ? routeIds : undefined;
}

export function createRouterServerSnapshot(
  state: RouterSnapshotLike,
): InternalRouterServerSnapshot {
  const hydrationScripts = toHydrationScripts(state);
  const matchedRouteIds =
    state.matchedRouteIds ?? getMatchedRouteIdsFromMatches(state.matches);

  return {
    ...state,
    ...(hydrationScripts?.length
      ? {
          hydrationScript: state.hydrationScript ?? hydrationScripts[0],
          hydrationScripts,
        }
      : {}),
    ...(matchedRouteIds ? { matchedRouteIds } : {}),
  };
}

export function createRouterRuntimeState(
  state: InternalRouterRuntimeState,
): InternalRouterRuntimeState {
  const hasSnapshotState =
    Boolean(state.serverSnapshot) ||
    Boolean(state.hydrationScript) ||
    Boolean(state.hydrationScripts?.length) ||
    Boolean(state.matchedRouteIds?.length) ||
    Boolean(state.matches?.length);
  const serverSnapshot = state.serverSnapshot
    ? createRouterServerSnapshot({
        ...state.serverSnapshot,
        framework: state.serverSnapshot.framework ?? state.framework,
        basename: state.serverSnapshot.basename ?? state.basename,
        hydrationScript:
          state.serverSnapshot.hydrationScript ?? state.hydrationScript,
        hydrationScripts:
          state.serverSnapshot.hydrationScripts ?? state.hydrationScripts,
        matchedRouteIds:
          state.serverSnapshot.matchedRouteIds ?? state.matchedRouteIds,
        matches: state.serverSnapshot.matches ?? state.matches,
      })
    : hasSnapshotState
      ? createRouterServerSnapshot({
          framework: state.framework,
          basename: state.basename,
          hydrationScript: state.hydrationScript,
          hydrationScripts: state.hydrationScripts,
          matchedRouteIds: state.matchedRouteIds,
          matches: state.matches,
        })
      : undefined;
  const hydrationScripts = toHydrationScripts({
    hydrationScript: state.hydrationScript ?? serverSnapshot?.hydrationScript,
    hydrationScripts:
      state.hydrationScripts ?? serverSnapshot?.hydrationScripts,
  });
  const matchedRouteIds =
    state.matchedRouteIds ??
    serverSnapshot?.matchedRouteIds ??
    getMatchedRouteIdsFromMatches(state.matches);

  return {
    ...state,
    ...(hydrationScripts?.length
      ? {
          hydrationScript: state.hydrationScript ?? hydrationScripts[0],
          hydrationScripts,
        }
      : {}),
    ...(matchedRouteIds ? { matchedRouteIds } : {}),
    ...(serverSnapshot ? { serverSnapshot } : {}),
  };
}

export function applyRouterRuntimeState<Context extends object>(
  runtimeContext: Context,
  state: InternalRouterRuntimeState,
) {
  const normalized = createRouterRuntimeState(state);
  routerRuntimeStateExtension.set(runtimeContext, normalized);
  if (normalized.serverSnapshot) {
    routerServerSnapshotExtension.set(
      runtimeContext,
      normalized.serverSnapshot,
    );
  }

  return runtimeContext;
}

export function applyRouterServerPrepareResult<Context extends object>(
  runtimeContext: Context,
  result: RouterServerPrepareResult,
) {
  const state = createRouterRuntimeState({
    ...result.state,
    cleanup: result.cleanup ?? result.state.cleanup,
    serverSnapshot: result.snapshot ?? result.state.serverSnapshot,
  });
  applyRouterRuntimeState(runtimeContext, state);
  return runtimeContext;
}

export function getRouterHydrationScripts(runtimeContext: object) {
  const serverSnapshot = getRouterServerSnapshot(runtimeContext);
  const runtimeState = getRouterRuntimeState(runtimeContext);
  return (
    serverSnapshot?.hydrationScripts ??
    toHydrationScripts({
      hydrationScript: serverSnapshot?.hydrationScript,
    }) ??
    runtimeState?.hydrationScripts ??
    toHydrationScripts({
      hydrationScript: runtimeState?.hydrationScript,
    }) ??
    []
  );
}

export function getRouterMatchedRouteIds(runtimeContext: object) {
  const serverSnapshot = getRouterServerSnapshot(runtimeContext);
  const runtimeState = getRouterRuntimeState(runtimeContext);
  return (
    serverSnapshot?.matchedRouteIds ??
    getMatchedRouteIdsFromMatches(serverSnapshot?.matches) ??
    runtimeState?.matchedRouteIds ??
    getMatchedRouteIdsFromMatches(runtimeState?.matches)
  );
}

export async function cleanupRouterRuntimeState(runtimeContext: object) {
  try {
    await getRouterRuntimeState(runtimeContext)?.cleanup?.();
  } catch {}
}
