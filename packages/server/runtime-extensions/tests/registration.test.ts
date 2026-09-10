import { createDefaultPlugins, createServerBase } from '@modern-js/server-core';
import { getDefaultAppContext, getDefaultConfig } from './helpers';

describe('plugin registration', () => {
  test('bare server-core ignores telemetry config without explicit registration', async () => {
    const config = getDefaultConfig();
    config.server = {
      telemetry: {
        enabled: true,
        canary: {
          enabled: true,
        },
      },
    } as any;

    const server = createServerBase({
      config,
      pwd: process.cwd(),
      appContext: getDefaultAppContext(),
    });
    server.addPlugins([...createDefaultPlugins({ logger: false })]);
    await server.init();

    const response = await server.request('/_modern/runtime/status', {}, {});
    expect(response.status).toBe(404);
  });
});
