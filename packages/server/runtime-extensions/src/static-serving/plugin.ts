import type { ServerPlugin } from '@modern-js/server-core';
import { createStaticExtensionResponders } from './responders';

export function injectStaticServingPlugin(): ServerPlugin {
  return {
    name: '@modern-js/server-static-extensions',
    post: ['@modern-js/plugin-server-static'],
    setup(api) {
      api.updateServerContext({
        staticAssetResponders: createStaticExtensionResponders(),
      });
    },
  };
}

export default injectStaticServingPlugin;
