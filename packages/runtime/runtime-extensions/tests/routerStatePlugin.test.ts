import {
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
  const { beforeRender } = install();
  const first: any = {};
  const second: any = {};
  beforeRender(first);
  const policy = first.linkPrefetchPolicy;
  beforeRender(first);
  beforeRender(second);
  expect(first.linkPrefetchPolicy).toBe(policy);
  expect(second.linkPrefetchPolicy).not.toBe(policy);
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
