import type { RouterProviderFactory } from '@modern-js/runtime-extensions/router-provider';
import { rstest } from '@rstest/core';
import type { RouterExtendsHooks } from '../src/runtime/hooks';

type RuntimeContextModule = typeof import('@modern-js/runtime/context');
type RouterModule = typeof import('../src/runtime/router');

type Vertical = {
  context: RuntimeContextModule;
  providers: typeof import('@modern-js/runtime-extensions/router-provider');
  factory: RouterProviderFactory;
  hooks: RouterExtendsHooks;
  Link: unknown;
  routerPlugin: RouterModule['routerPlugin'];
  useMatches: unknown;
};

async function loadVertical(): Promise<Vertical> {
  rstest.resetModules();
  const routerModule = (await import('../src/runtime/router')) as RouterModule;
  const context = (await import(
    '@modern-js/runtime/context'
  )) as RuntimeContextModule;
  const { tanstackRouterProviderFactory } = await import(
    '../src/runtime/register'
  );
  const { routerProviderRegistryHooks } = await import('../src/runtime/hooks');
  const { Link } = await import('../src/runtime/prefetchLink');
  const { useMatches } = await import('../src/runtime/routeHooks');

  const providers = await import(
    '@modern-js/runtime-extensions/router-provider'
  );
  return {
    context,
    providers,
    factory: tanstackRouterProviderFactory,
    hooks: routerProviderRegistryHooks,
    Link,
    routerPlugin: routerModule.routerPlugin,
    useMatches,
  };
}

function setupRouterWrapper(vertical: Vertical) {
  let onBeforeRender:
    | ((context: any, interrupt: (value?: unknown) => unknown) => unknown)
    | undefined;

  const plugin = vertical.routerPlugin({ framework: 'tanstack' });
  plugin.setup?.({
    getHooks: () => vertical.hooks,
    onAfterCreateRouter: () => undefined,
    getRuntimeConfig: () => ({ router: { framework: 'tanstack' } }),
    onBeforeRender: listener => {
      onBeforeRender = listener;
    },
    wrapRoot: () => undefined,
  });

  expect(typeof onBeforeRender).toBe('function');
  const runtimeContext: any = {};
  onBeforeRender?.(runtimeContext, () => undefined);
  return runtimeContext.router as { Link: unknown; useMatches: unknown };
}

describe('TanStack provider runtime-realm isolation', () => {
  beforeEach(() => {
    rstest.resetModules();
    (
      globalThis as typeof globalThis & {
        __webpack_require__?: { u: (chunkId: unknown) => string };
      }
    ).__webpack_require__ = { u: chunkId => String(chunkId) };
  });

  afterEach(() => {
    rstest.resetModules();
  });

  it('binds each production router wrapper to its own real provider graph', async () => {
    const warnSpy = rstest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const verticalA = await loadVertical();
      const routerA = setupRouterWrapper(verticalA);
      expect(routerA.Link).toBe(verticalA.Link);
      expect(routerA.useMatches).toBe(verticalA.useMatches);

      const verticalB = await loadVertical();
      expect(verticalB.context).not.toBe(verticalA.context);
      expect(verticalB.factory).not.toBe(verticalA.factory);
      expect(verticalB.Link).not.toBe(verticalA.Link);
      expect(verticalB.useMatches).not.toBe(verticalA.useMatches);

      const routerB = setupRouterWrapper(verticalB);
      expect(routerB.Link).toBe(verticalB.Link);
      expect(routerB.useMatches).toBe(verticalB.useMatches);
      expect(routerB.Link).not.toBe(verticalA.Link);
      expect(routerB.useMatches).not.toBe(verticalA.useMatches);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
