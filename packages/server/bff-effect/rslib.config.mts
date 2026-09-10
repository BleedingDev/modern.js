import { rslibConfig } from '@modern-js/rslib';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  ...rslibConfig,
  lib: rslibConfig.lib?.map(config => ({
    ...config,
    source: {
      ...config.source,
      define: {
        ...config.source?.define,
        __MODERN_EFFECT_NODE_RUNTIME__: JSON.stringify(
          config.output?.target === 'node',
        ),
      },
    },
  })),
});
