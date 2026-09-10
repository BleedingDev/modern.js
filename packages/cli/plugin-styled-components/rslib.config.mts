import { rslibConfig, ts7DtsConfig } from '@modern-js/rslib';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  ...rslibConfig,
  lib: rslibConfig.lib?.map(lib =>
    lib.id === 'esm-node'
      ? {
          ...lib,
          dts: {
            ...ts7DtsConfig,
            autoExtension: true,
            distPath: './dist/types-esm',
          },
        }
      : lib,
  ),
});
