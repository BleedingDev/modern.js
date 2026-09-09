import { rslibConfig } from '@modern-js/rslib';
import { defineConfig } from '@rslib/core';

import { publicDeclarationsPlugin } from '../../../scripts/prebundle/ultramodern/public-declarations.mjs';

export default defineConfig({
  ...rslibConfig,
  plugins: [
    ...(rslibConfig.plugins ?? []),
    publicDeclarationsPlugin('builder'),
  ],
});
