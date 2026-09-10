import { createSyncHook } from '@modern-js/plugin';
import {
  createRouterProviderRealm,
  type RouterProviderFactory,
  reportUnsupportedProviderRegistryHooks as reportProviderHooks,
  resolveRouterProvider,
} from '@modern-js/runtime-extensions/router-provider';
import type { RuntimePlugin } from '../../src/core';
import * as contextSeam from '../../src/core/context';
import type { RouterExtendsHooks } from '../../src/router/runtime/hooks';
import * as routerHooks from '../../src/router/runtime/hooks';
import { routerProviderRegistryHooks } from '../../src/router/runtime/hooks';

const reportUnsupportedProviderRegistryHooks = (
  provider: Parameters<typeof reportProviderHooks>[0],
) => reportProviderHooks(provider, routerProviderRegistryHooks);

const createFactory = (name: string): RouterProviderFactory => {
  return () =>
    ({
      name,
      setup: () => undefined,
    }) as RuntimePlugin<{ extendHooks: RouterExtendsHooks }>;
};

describe('router provider registry hooks (single declaration source)', () => {
  it('exposes exactly the six router hooks with the canonical instances', () => {
    expect(routerProviderRegistryHooks).toEqual({
      modifyRoutes: routerHooks.modifyRoutes,
      onAfterCreateRouter: routerHooks.onAfterCreateRouter,
      onAfterHydrateRouter: routerHooks.onAfterHydrateRouter,
      onBeforeCreateRouter: routerHooks.onBeforeCreateRouter,
      onBeforeCreateRoutes: routerHooks.onBeforeCreateRoutes,
      onBeforeHydrateRouter: routerHooks.onBeforeHydrateRouter,
    });
    expect(Object.keys(routerProviderRegistryHooks)).toHaveLength(6);
  });

  it("is re-exported through the '@modern-js/runtime/context' seam", () => {
    expect(contextSeam.routerProviderRegistryHooks).toBe(
      routerProviderRegistryHooks,
    );
  });
});

describe('reportUnsupportedProviderRegistryHooks', () => {
  it('warns about provider hooks outside the router hook contract instead of dropping them silently', () => {
    const warnSpy = rstest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const unsupported = reportUnsupportedProviderRegistryHooks({
        name: 'hooky-provider',
        registryHooks: {
          ...routerProviderRegistryHooks,
          onSeventhHook: createSyncHook<() => void>(),
        },
      });

      expect(unsupported).toEqual(['onSeventhHook']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/hooky-provider.*onSeventhHook/s),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('stays silent for providers using exactly the canonical hook set', () => {
    const warnSpy = rstest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(
        reportUnsupportedProviderRegistryHooks({
          name: 'canonical-provider',
          registryHooks: routerProviderRegistryHooks,
        }),
      ).toEqual([]);
      expect(
        reportUnsupportedProviderRegistryHooks({ name: 'hookless-provider' }),
      ).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('router provider realms', () => {
  it('resolves the app-owned default and explicit providers', () => {
    const localReactRouter = createFactory('local-react-router');
    const localTanstack = createFactory('local-tanstack');

    const realm = createRouterProviderRealm([
      {
        name: 'react-router',
        factory: localReactRouter,
        isDefault: true,
      },
      { name: 'tanstack', factory: localTanstack },
    ]);

    expect(resolveRouterProvider(undefined, { realm })).toBe(localReactRouter);
    expect(resolveRouterProvider('tanstack', { realm })).toBe(localTanstack);
    expect(realm.names()).toEqual(['react-router', 'tanstack']);
  });
  it('rejects ambiguous provider declarations inside one runtime realm', () => {
    const tanstack = createFactory('tanstack');
    expect(() =>
      createRouterProviderRealm([
        { name: 'tanstack', factory: tanstack },
        { name: 'tanstack', factory: tanstack },
      ]),
    ).toThrow(/declared more than once/);

    expect(() =>
      createRouterProviderRealm([
        {
          name: 'react-router',
          factory: createFactory('react-router'),
          isDefault: true,
        },
        {
          name: 'tanstack',
          factory: tanstack,
          isDefault: true,
        },
      ]),
    ).toThrow(/declares both .* as defaults/);
  });
});
