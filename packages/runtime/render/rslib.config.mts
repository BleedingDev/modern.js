import { ts7DtsConfig } from '@modern-js/rslib';
import { defineConfig } from '@rslib/core';

const sharedConfig = {
  format: 'esm' as const,
  syntax: 'es2021' as const,
  bundle: true,
  dts: false,
  output: {
    distPath: {
      root: './dist/esm',
    },
    target: 'web' as const,
  },
};

export default defineConfig({
  lib: [
    {
      ...sharedConfig,
      dts: ts7DtsConfig,
      output: {
        ...sharedConfig.output,
        externals: [
          {
            '@modern-js/render/rsc': 'module-import @modern-js/render/rsc',
            '@modern-js/render/rsc-worker':
              'module-import @modern-js/render/rsc-worker',
          },
        ],
      },
      source: {
        entry: {
          ssr: './src/ssr.ts',
          client: './src/client.ts',
        },
      },
    },
    {
      ...sharedConfig,
      source: {
        entry: {
          rsc: './src/rsc.ts',
        },
      },
    },
    {
      ...sharedConfig,
      output: {
        ...sharedConfig.output,
        externals: {
          'react-server-dom-rspack/server.node':
            'module-import react-server-dom-rspack/server.edge',
          'react-server-dom-rspack/client.node':
            'module-import react-server-dom-rspack/client.edge',
        },
      },
      source: {
        entry: {
          rscWorker: './src/rsc.worker.ts',
        },
      },
    },
  ],
});
