import path from 'node:path';
import { withTestPreset } from '@scripts/rstest-config';

export default {
  projects: [
    withTestPreset({
      root: __dirname,
      name: 'render-native',
      testEnvironment: 'node',
      globals: true,
      exclude: ['tests/ssr/htmlRoot.test.tsx'],
    }),
    withTestPreset({
      root: __dirname,
      name: 'render-html-root',
      testEnvironment: 'node',
      globals: true,
      include: ['tests/ssr/htmlRoot.test.tsx'],
      resolve: {
        alias: {
          [path.join(__dirname, 'src/rsc.ts')]: path.join(
            __dirname,
            'tests/fixtures/rsc-server.ts',
          ),
          [path.join(__dirname, 'src/rsc.worker.ts')]: path.join(
            __dirname,
            'tests/fixtures/rsc-server.ts',
          ),
          'react-server-dom-rspack/client.browser': path.join(
            __dirname,
            'tests/fixtures/rsc-client.ts',
          ),
          'react-server-dom-rspack/client.edge': path.join(
            __dirname,
            'tests/fixtures/rsc-client.ts',
          ),
          '@modern-js/render/rsc': path.join(
            __dirname,
            'tests/fixtures/rsc-server.ts',
          ),
          '@modern-js/render/rsc-worker': path.join(
            __dirname,
            'tests/fixtures/rsc-server.ts',
          ),
        },
      },
    }),
  ],
};
