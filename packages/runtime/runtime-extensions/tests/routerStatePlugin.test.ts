import {
  applyRouterRuntimeState,
  getRouterRuntimeState,
  getRouterServerSnapshot,
} from '../src/routerState';
import { createRouterStatePlugin } from '../src/routerStatePlugin';

function install() {
  const registryHooks = { onAfterCreateRouter: { call() {} } };
  const plugin = createRouterStatePlugin({ registryHooks });
  let beforeRender!: (context: object) => void;
  let afterCreate!: Parameters<
    Parameters<typeof plugin.setup>[0]['onAfterCreateRouter']
  >[0];
  plugin.setup({
    onBeforeRender: callback => {
      beforeRender = callback;
    },
    onAfterCreateRouter: callback => {
      afterCreate = callback;
    },
  });
  return { plugin, registryHooks, beforeRender, afterCreate };
}

test('keeps injected hooks and per-context policies stable without sharing app values', () => {
  const { plugin, registryHooks, beforeRender } = install();
  expect(plugin.registryHooks).toBe(registryHooks);
  const first: any = {};
  const second: any = {};
  beforeRender(first);
  const policy = first.linkPrefetchPolicy;
  beforeRender(first);
  beforeRender(second);
  expect(first.linkPrefetchPolicy).toBe(policy);
  expect(second.linkPrefetchPolicy).not.toBe(policy);
});

test('stores the exact native client instance and retains an earlier server snapshot', () => {
  const { afterCreate } = install();
  const context = {};
  applyRouterRuntimeState(context, {
    framework: 'react-router',
    serverSnapshot: { statusCode: 207, matchedRouteIds: ['server'] },
  });
  const router = { navigate() {} };
  afterCreate({
    framework: 'react-router',
    phase: 'client-create',
    runtimeContext: context,
    router,
    basename: '/app',
  });
  expect(getRouterRuntimeState(context)?.instance).toBe(router);
  expect(getRouterServerSnapshot(context)?.statusCode).toBe(207);
});

test('projects loader data, errors and valid route ids from injected SSR input', () => {
  const { afterCreate } = install();
  const errors = { route: new Error('route error') };
  const context = {
    routerContext: {
      statusCode: 503,
      errors,
      loaderData: { root: { ok: true } },
      matches: [{ route: { id: 'root' } }, { route: {} }],
    },
  };
  afterCreate({
    framework: 'react-router',
    phase: 'ssr-prepare',
    runtimeContext: context,
    router: context.routerContext,
    basename: '/nested',
  });
  expect(getRouterRuntimeState(context)?.instance).toBe(context.routerContext);
  expect(getRouterServerSnapshot(context)).toMatchObject({
    framework: 'react-router',
    basename: '/nested',
    statusCode: 503,
    matchedRouteIds: ['root'],
    routerData: { loaderData: context.routerContext.loaderData, errors },
  });
});

test('leaves other providers and incomplete native preparation untouched', () => {
  const { afterCreate } = install();
  const context = {};
  applyRouterRuntimeState(context, {
    framework: 'tanstack',
    hydrationScripts: ['<script>hydrate()</script>'],
    matches: [{ routeId: 'r', assetRouteId: 'asset' }],
  });
  const state = getRouterRuntimeState(context);
  afterCreate({
    framework: 'tanstack',
    phase: 'ssr-prepare',
    runtimeContext: context,
  });
  expect(getRouterRuntimeState(context)).toBe(state);
  const incomplete = {};
  afterCreate({
    framework: 'react-router',
    phase: 'ssr-prepare',
    runtimeContext: incomplete,
  });
  expect(getRouterRuntimeState(incomplete)).toBeUndefined();
});
