import path from 'node:path';
import { withTestPreset } from '@scripts/rstest-config';

export default withTestPreset({
  root: __dirname,
  testEnvironment: 'node',
  globals: true,
  setupFiles: ['@scripts/rstest-config/setup.ts'],
  resolve: {
    alias: {
      '@modern-js/app-tools$': path.resolve(
        __dirname,
        '../app-tools/src/index.ts',
      ),
      '@modern-js/plugin-bff$': path.resolve(
        __dirname,
        '../../cli/plugin-bff/src/cli.ts',
      ),
    },
  },
  tools: {
    rspack: {
      module: { parser: { javascript: { requireResolve: true } } },
    },
  },
});
