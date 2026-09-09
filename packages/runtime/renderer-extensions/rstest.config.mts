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
      name: 'renderer-extensions-node',
      testEnvironment: 'node',
      extends: commonConfig,
    }),
  ],
};
