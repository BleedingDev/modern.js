import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectConfig } from '@rstest/core';
import { withTestPreset } from '@scripts/rstest-config';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const commonConfig: ProjectConfig = {
  setupFiles: [
    resolve(packageDirectory, '../../../scripts/rstest-config/setup.ts'),
  ],
  globals: true,
  tools: { swc: { jsc: { transform: { react: { runtime: 'automatic' } } } } },
};

export default {
  projects: [
    withTestPreset({
      name: 'i18n-integration-node',
      testEnvironment: 'node',
      include: [
        'tests/cli.test.ts',
        'tests/server.test.ts',
        'tests/urlStrategy.test.ts',
        'tests/runtimeRegistration.test.tsx',
        'tests/runtimeBoundary.test.ts',
        'tests/publicExports.test.ts',
        'tests/federatedI18nBoundary.test.tsx',
        'tests/federationRegistration.test.tsx',
      ],
      extends: commonConfig,
    }),
    withTestPreset({
      name: 'i18n-integration-client',
      testEnvironment: 'happy-dom',
      include: [
        'tests/navigation.test.tsx',
        'tests/strategyIsolation.client.test.tsx',
        'tests/federatedI18nBoundary.client.test.tsx',
      ],
      extends: commonConfig,
    }),
  ],
};
