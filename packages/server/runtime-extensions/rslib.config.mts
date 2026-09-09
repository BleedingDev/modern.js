import { RSLIB_CODE_ENTRY_GLOB, rslibConfig } from '@modern-js/rslib';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  ...rslibConfig,
  lib: rslibConfig.lib.map(lib =>
    lib.id === 'esm-web'
      ? {
          ...lib,
          source: {
            ...lib.source,
            entry: {
              index: [RSLIB_CODE_ENTRY_GLOB, '!./src/static-serving/**'],
            },
          },
        }
      : lib,
  ),
});
