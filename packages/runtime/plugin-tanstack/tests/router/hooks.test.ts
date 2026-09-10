import {
  modifyRoutes as canonicalModifyRoutes,
  routerProviderRegistryHooks,
} from '@modern-js/runtime/context';
import * as tanstackHooks from '../../src/runtime/hooks';
import { tanstackRouterPlugin as browserPlugin } from '../../src/runtime/plugin';
import { tanstackRouterPlugin as nodePlugin } from '../../src/runtime/plugin.node';

describe('tanstack router hooks single declaration source', () => {
  test('re-exports and registers the canonical hook instances', () => {
    // Identity matters: separate instances would split the hook registry
    // between the built-in router wrapper and this provider.
    expect(tanstackHooks.modifyRoutes).toBe(canonicalModifyRoutes);
    expect(tanstackHooks.routerProviderRegistryHooks).toBe(
      routerProviderRegistryHooks,
    );
    expect(tanstackHooks.modifyRoutes).toBe(
      routerProviderRegistryHooks.modifyRoutes,
    );
    expect(browserPlugin().registryHooks).toBe(routerProviderRegistryHooks);
    expect(nodePlugin().registryHooks).toBe(routerProviderRegistryHooks);
  });
});
