import { createRuntimeContextExtension } from '../src/contextExtensions';
import {
  applyRouterRuntimeState,
  applyRouterServerPrepareResult,
  cleanupRouterRuntimeState,
  createRouterRuntimeState,
  createRouterServerSnapshot,
  getRouterHydrationScripts,
  getRouterMatchedRouteIds,
  getRouterRuntimeState,
  getRouterServerSnapshot,
  type InternalRouterRuntimeState,
} from '../src/routerState';

describe('router state primitives', () => {
  it('normalizes snapshots without changing explicit values or input objects', () => {
    const matches = [
      { routeId: 'route-a', assetRouteId: 'asset-a' },
      { routeId: 'route-b' },
    ];
    const snapshot = {
      framework: 'custom',
      hydrationScript: '<script>first()</script>',
      matches,
    };

    expect(createRouterServerSnapshot(snapshot)).toEqual({
      ...snapshot,
      hydrationScripts: ['<script>first()</script>'],
      matchedRouteIds: ['asset-a', 'route-b'],
    });
    expect(snapshot).not.toHaveProperty('hydrationScripts');
    expect(snapshot).not.toHaveProperty('matchedRouteIds');
    expect(
      createRouterServerSnapshot({
        ...snapshot,
        hydrationScripts: ['<script>explicit()</script>'],
        matchedRouteIds: [],
      }),
    ).toMatchObject({
      hydrationScript: '<script>first()</script>',
      hydrationScripts: ['<script>explicit()</script>'],
      matchedRouteIds: [],
    });
  });

  it('preserves snapshot precedence and a captured snapshot across client state updates', () => {
    const context = { requestId: 'one' };
    expect(
      applyRouterRuntimeState(context, {
        framework: 'custom',
        basename: '/client',
        hydrationScripts: ['client'],
        matchedRouteIds: ['client-route'],
        serverSnapshot: {
          basename: '/server',
          hydrationScripts: ['server'],
          matchedRouteIds: ['server-route'],
        },
      }),
    ).toBe(context);
    const snapshot = getRouterServerSnapshot(context);
    expect(snapshot).toMatchObject({
      framework: 'custom',
      basename: '/server',
      hydrationScripts: ['server'],
      matchedRouteIds: ['server-route'],
    });
    expect(getRouterHydrationScripts(context)).toEqual(['server']);
    expect(getRouterMatchedRouteIds(context)).toEqual(['server-route']);

    applyRouterRuntimeState(context, {
      framework: 'custom',
      instance: { client: true },
    });
    expect(getRouterRuntimeState(context)?.serverSnapshot).toBeUndefined();
    expect(getRouterServerSnapshot(context)).toBe(snapshot);
    expect(getRouterHydrationScripts(context)).toEqual(['server']);
    expect(getRouterMatchedRouteIds(context)).toEqual(['server-route']);
  });

  it('shares interned slots across accessors and context spreads without serializing state', () => {
    const context = { requestId: 'one' };
    const state: InternalRouterRuntimeState = {
      framework: 'custom',
      instance: { private: true },
      hydrationScript: 'legacy',
      matches: [{ routeId: 'route', assetRouteId: 'asset' }],
    };
    const otherAccessor =
      createRuntimeContextExtension<InternalRouterRuntimeState>(
        '@modern-js/runtime:router-runtime-state',
      );
    otherAccessor.set(context, state);
    expect(getRouterRuntimeState({ ...context })).toBe(state);
    expect(getRouterHydrationScripts(context)).toEqual(['legacy']);
    expect(getRouterMatchedRouteIds(context)).toEqual(['asset']);
    expect(Object.keys(context)).toEqual(['requestId']);
    expect(JSON.stringify(context)).toBe('{"requestId":"one"}');
    expect(getRouterRuntimeState({})).toBeUndefined();
  });

  it('applies server prepare overrides and awaits cleanup without propagating failures', async () => {
    const context = {};
    const stateCleanup = rstest.fn();
    const cleanup = rstest.fn(async () => {
      await Promise.resolve();
    });
    expect(
      applyRouterServerPrepareResult(context, {
        state: {
          framework: 'custom',
          cleanup: stateCleanup,
          serverSnapshot: { statusCode: 200 },
        },
        snapshot: { statusCode: 299 },
        cleanup,
      }),
    ).toBe(context);
    expect(getRouterServerSnapshot(context)?.statusCode).toBe(299);
    await cleanupRouterRuntimeState(context);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(stateCleanup).not.toHaveBeenCalled();

    applyRouterRuntimeState(context, {
      framework: 'custom',
      cleanup: async () => {
        throw new Error('cleanup failed');
      },
    });
    await expect(cleanupRouterRuntimeState(context)).resolves.toBeUndefined();
    await expect(cleanupRouterRuntimeState({})).resolves.toBeUndefined();
  });

  it('keeps empty state empty and derives server data only when present', () => {
    expect(createRouterRuntimeState({ framework: 'custom' })).toEqual({
      framework: 'custom',
    });
    expect(getRouterHydrationScripts({})).toEqual([]);
    expect(getRouterMatchedRouteIds({})).toBeUndefined();
    expect(
      createRouterRuntimeState({
        framework: 'custom',
        matches: [{ routeId: 'root' }],
        hydrationScripts: ['first', 'second'],
      }),
    ).toMatchObject({
      hydrationScript: 'first',
      matchedRouteIds: ['root'],
      serverSnapshot: {
        framework: 'custom',
        hydrationScripts: ['first', 'second'],
        matchedRouteIds: ['root'],
      },
    });
  });
});
