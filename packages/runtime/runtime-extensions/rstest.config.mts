import type { ProjectConfig } from '@rstest/core';
import { withTestPreset } from '@scripts/rstest-config';

const commonConfig: ProjectConfig = {
  root: __dirname,
  globals: true,
  setupFiles: ['@scripts/rstest-config/setup.ts'],
  tools: {
    swc: {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    },
  },
};

export default {
  projects: [
    withTestPreset({
      name: 'runtime-extensions-node',
      testEnvironment: 'node',
      exclude: ['tests/boundary-debugger/client.test.tsx'],
      extends: commonConfig,
    }),
    withTestPreset({
      name: 'runtime-extensions-client',
      testEnvironment: 'happy-dom',
      include: ['tests/boundary-debugger/client.test.tsx'],
      extends: commonConfig,
    }),
  ],
};
