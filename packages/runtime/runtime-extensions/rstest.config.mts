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

const browserPolicyProject = withTestPreset({
  name: 'runtime-extensions-request-policy-browser',
  testEnvironment: 'happy-dom',
  extends: commonConfig,
  include: ['tests/request-policy/browser-policy.test.ts'],
});

export default {
  projects: [
    withTestPreset({
      name: 'runtime-extensions-node',
      exclude: ['tests/request-policy/browser-policy.test.ts'],
      testEnvironment: 'node',
      extends: commonConfig,
    }),
    browserPolicyProject,
  ],
};
