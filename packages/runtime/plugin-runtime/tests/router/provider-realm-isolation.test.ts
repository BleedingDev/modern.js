import type { RouterProviderFactory } from '@modern-js/runtime-extensions/router-provider';
import { rstest } from '@rstest/core';

type ProviderRuntime =
  typeof import('@modern-js/runtime-extensions/router-provider');

function createFactory(owner: string): RouterProviderFactory {
  const factory = (() => {
    throw new Error(`factory for "${owner}" was invoked unexpectedly`);
  }) as RouterProviderFactory;
  (factory as unknown as { __owner: string }).__owner = owner;
  return factory;
}

function ownerOf(factory: RouterProviderFactory): string {
  return (factory as unknown as { __owner: string }).__owner;
}

async function loadVerticalRuntime(): Promise<ProviderRuntime> {
  rstest.resetModules();
  return import('@modern-js/runtime-extensions/router-provider');
}

function createVerticalRealm(
  runtime: ProviderRuntime,
  reactRouter: RouterProviderFactory,
  provider: { name: string; factory: RouterProviderFactory },
) {
  return runtime.createRouterProviderRealm([
    { name: 'react-router', factory: reactRouter, isDefault: true },
    provider,
  ]);
}

describe('router provider runtime-realm isolation', () => {
  it('resolves each independently evaluated vertical provider from its own realm', async () => {
    const warnSpy = rstest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const verticalA = await loadVerticalRuntime();
      const reactRouterA = createFactory('A:react-router');
      const tanstackA = createFactory('A:tanstack');
      const realmA = createVerticalRealm(verticalA, reactRouterA, {
        name: 'tanstack',
        factory: tanstackA,
      });

      const verticalB = await loadVerticalRuntime();
      const reactRouterB = createFactory('B:react-router');
      const tanstackB = createFactory('B:tanstack');
      const realmB = createVerticalRealm(verticalB, reactRouterB, {
        name: 'tanstack',
        factory: tanstackB,
      });

      expect(
        ownerOf(verticalA.resolveRouterProvider('tanstack', { realm: realmA })),
      ).toBe('A:tanstack');
      expect(
        ownerOf(verticalB.resolveRouterProvider('tanstack', { realm: realmB })),
      ).toBe('B:tanstack');
      expect(
        verticalA.resolveRouterProvider(undefined, { realm: realmA }),
      ).toBe(reactRouterA);
      expect(
        verticalB.resolveRouterProvider(undefined, { realm: realmB }),
      ).toBe(reactRouterB);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
