import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ServerPluginAPI } from '@modern-js/server-core';
import { resolveAdapterCrossProjectPolicy } from '../src/cross-project-policy';

const REQUEST_ID = 'crm.producer-a';
const handlers = [
  {
    name: 'getCustomer',
    routePath: '/api/customer/:id',
    httpMethod: 'GET',
  },
];

describe('cross-project server policy source', () => {
  it('discovers the producer version without relying on a CommonJS require', () => {
    const packageDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'modern-bff-policy-'),
    );
    const apiDirectory = path.join(packageDirectory, 'dist', 'api');
    fs.mkdirSync(apiDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(packageDirectory, 'package.json'),
      JSON.stringify({ version: '7.4.2' }),
    );

    try {
      const api = {
        getServerConfig: () => ({
          bff: {
            crossProjectPolicy: { enabled: true },
            isCrossProjectServer: true,
            requestId: REQUEST_ID,
          },
        }),
        getServerContext: () => ({ apiDirectory }),
      } as unknown as ServerPluginAPI;

      const policy = resolveAdapterCrossProjectPolicy(api, handlers);
      expect(
        policy?.expectedOperationContracts['GET:/api/customer/:id']
          ?.operationVersion,
      ).toBe(7);
    } finally {
      fs.rmSync(packageDirectory, { recursive: true, force: true });
    }
  });
});
