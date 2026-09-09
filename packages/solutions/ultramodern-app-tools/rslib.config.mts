import { rslibConfig } from '@modern-js/rslib';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  ...rslibConfig,
  lib: rslibConfig.lib?.map(lib => ({
    ...lib,
    source: { ...lib.source, entry: { index: ['./src/**/*.ts'] } },
  })),
});
