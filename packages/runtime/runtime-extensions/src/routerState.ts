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

/**
 * Listeners per runtime context, so a consumer can react to the slot being
 * filled in. A router provider publishes its instance during render - TanStack
 * installs it when `RouterWrapper` renders - which is after anything that
 * wraps the app has already evaluated. Without a notification those wrappers
 * would hold a routerless view of the app for the rest of the session.
 *
 * Keyed weakly: the runtime context outlives neither the app nor this map.
 */
const routerRuntimeStateListeners = new WeakMap<object, Set<() => void>>();

/**
 * Observe the router runtime-state slot for the given runtime context.
 * Returns an unsubscribe function; safe to call for a context that never
 * receives a router.
 */
export function subscribeRouterRuntimeState(
  runtimeContext: object,
  listener: () => void,
): () => void {
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    return () => undefined;
  }
  let listeners = routerRuntimeStateListeners.get(runtimeContext);
  if (!listeners) {
    listeners = new Set();
    routerRuntimeStateListeners.set(runtimeContext, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners?.delete(listener);
  };
}

/** Contexts with a notification already scheduled, so a burst coalesces. */
const pendingRouterRuntimeStateNotifications = new WeakSet<object>();

function notifyRouterRuntimeState(runtimeContext: object) {
  const listeners = routerRuntimeStateListeners.get(runtimeContext);
  if (!listeners?.size) {
    return;
  }
  if (pendingRouterRuntimeStateNotifications.has(runtimeContext)) {
    return;
  }
  pendingRouterRuntimeStateNotifications.add(runtimeContext);
  // Deferred deliberately. A router provider publishes its instance from
  // inside its own render - `RouterWrapper` does - so calling observers
  // synchronously would schedule an update on a component that is rendering,
  // which React reports as "Cannot update a component while rendering a
  // different component". Delivering after the current render lands keeps the
  // notification correct and silent.
  const deliver = () => {
    pendingRouterRuntimeStateNotifications.delete(runtimeContext);
    const current = routerRuntimeStateListeners.get(runtimeContext);
    if (!current?.size) {
      return;
    }
    for (const listener of [...current]) {
      try {
        listener();
      } catch {
        // One bad observer must not stop the router from being published.
      }
    }
  };
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(deliver);
  } else {
    setTimeout(deliver, 0);
  }
}

export function applyRouterRuntimeState<Context extends object>(
  runtimeContext: Context,
  state: InternalRouterRuntimeState,
) {
  const previous = routerRuntimeStateExtension.get(runtimeContext);
  const normalized = createRouterRuntimeState(state);
  routerRuntimeStateExtension.set(runtimeContext, normalized);
  if (normalized.serverSnapshot) {
    routerServerSnapshotExtension.set(
      runtimeContext,
      normalized.serverSnapshot,
    );
  }
  // Only a change of identity is worth a re-render; `RouterWrapper` reapplies
  // the same instance on every render of the app.
  if (
    previous?.instance !== normalized.instance ||
    previous?.framework !== normalized.framework
  ) {
    notifyRouterRuntimeState(runtimeContext);
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
