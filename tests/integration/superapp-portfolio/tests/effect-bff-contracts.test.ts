import dns from 'node:dns';
import path from 'node:path';
import { buildFixtureOnce } from '../../../utils/fixtureBuild';
import {
  getPort,
  killApp,
  modernBuild,
  modernServe,
} from '../../../utils/modernTestUtils';
import { setSuiteTimeout } from '../../../utils/setSuiteTimeout';

dns.setDefaultResultOrder('ipv4first');
setSuiteTimeout(1000 * 60 * 8);

const appDir = path.resolve(__dirname, '../');
const host = 'http://localhost';
const fullModuleSet = [
  'rides',
  'dispatch',
  'orders',
  'erp',
  'chat',
  'mf-remotes',
  'security',
  'billing',
];

type BootstrapPayload = {
  apps: unknown[];
  events: Array<Record<string, unknown>>;
  pilotRuns: unknown[];
  summary: {
    eventCount: number;
    failureMode: string;
  };
};

async function postJson(
  port: number,
  pathname: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(`${host}:${port}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readResponse(response: Response) {
  const text = await response.text();
  try {
    return {
      payload: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
      text,
    };
  } catch {
    return { payload: undefined, text };
  }
}

async function getBootstrap(port: number): Promise<BootstrapPayload> {
  const response = await fetch(`${host}:${port}/bff-api/effect/bootstrap`);
  expect(response.status).toBe(200);
  return response.json() as Promise<BootstrapPayload>;
}

async function resetPortfolio(port: number) {
  const response = await postJson(port, '/bff-api/effect/reset');
  expect(response.status).toBe(200);
}

function workflowPath(appId: string) {
  return `/bff-api/effect/apps/${appId}/workflow`;
}

function expectNoStateDrift(after: BootstrapPayload, before: BootstrapPayload) {
  expect(after.summary).toEqual(before.summary);
  expect(after.events).toEqual(before.events);
  expect(after.apps).toEqual(before.apps);
  expect(after.pilotRuns).toEqual(before.pilotRuns);
}

describe('superapp server Effect BFF contracts', () => {
  let port: number;
  let app: Awaited<ReturnType<typeof modernServe>> | undefined;

  beforeAll(async () => {
    const build = await buildFixtureOnce(appDir, {
      build: () => modernBuild(appDir),
    });
    expect(build.code).toBe(0);
    port = await getPort();
    app = await modernServe(appDir, port, {
      cwd: appDir,
      stderr: false,
      stdout: false,
    });
  });

  afterAll(async () => {
    await killApp(app);
  });

  beforeEach(async () => {
    await resetPortfolio(port);
  });

  test('rejects malformed payloads before handlers mutate state', async () => {
    const before = await getBootstrap(port);
    const [workflow, pilot, security] = await Promise.all([
      postJson(port, workflowPath('mobility-marketplace'), {
        action: 'quote',
        actor: 'contract.schema',
        requestId: 123,
      }),
      postJson(port, '/bff-api/effect/pilot/grab-marketplace/run', {
        tenant: 'superapp-global',
        actor: 'contract.schema',
        requestId: 'contract-schema-pilot',
        modules: ['rides', 'not-a-module'],
        chaos: 'none',
      }),
      postJson(
        port,
        '/bff-api/effect/security/probe',
        {
          targetTenant: 'security-root',
          targetAppId: 'unknown-app',
          action: 'boundary-policy-evaluate',
          requestId: 'contract-schema-security',
          mutation: true,
        },
        {
          authorization: 'Bearer schema-secret-token',
          origin: `${host}:${port}`,
          'x-csrf-token': 'superapp-valid-csrf',
          'x-tenant-id': 'security-root',
          'x-user-role': 'security-admin',
        },
      ),
    ]);

    expect([workflow.status, pilot.status, security.status]).toEqual([
      400, 400, 400,
    ]);
    const bodies = await Promise.all(
      [workflow, pilot, security].map(readResponse),
    );
    expect(bodies.map(body => body.text).join('\n')).not.toContain(
      'schema-secret-token',
    );
    expectNoStateDrift(await getBootstrap(port), before);
  });

  test('redacts server errors without mutating state', async () => {
    const before = await getBootstrap(port);
    const pilot = await postJson(
      port,
      '/bff-api/effect/pilot/grab-marketplace/run',
      {
        tenant: 'missing-tenant',
        actor: 'contract.defect',
        requestId: 'contract-domain-defect',
        modules: fullModuleSet,
        chaos: 'none',
      },
    );
    const security = await postJson(
      port,
      '/bff-api/effect/security/probe',
      {
        targetTenant: 'security-root',
        targetAppId: 'tenant-security',
        action: 'boundary-policy-evaluate',
        requestId: 'contract-security-defect',
        mutation: true,
      },
      {
        authorization: 'Bearer defect-secret-token',
        origin: 'https://evil.example',
        'x-csrf-token': 'superapp-valid-csrf',
        'x-tenant-id': 'security-root',
        'x-user-role': 'security-admin',
      },
    );

    expect(pilot.status).toBeGreaterThanOrEqual(500);
    expect(security.status).toBeGreaterThanOrEqual(500);
    const [pilotBody, securityBody] = await Promise.all([
      readResponse(pilot),
      readResponse(security),
    ]);
    expect(pilotBody.text).not.toContain('contract-domain-defect');
    expect(securityBody.text).not.toContain('defect-secret-token');
    expectNoStateDrift(await getBootstrap(port), before);
  });

  test('propagates one request context through a workflow boundary', async () => {
    const response = await postJson(
      port,
      workflowPath('mobility-marketplace'),
      {
        action: 'context-propagation',
        actor: 'contract.context',
        requestId: 'context-workflow-1',
      },
      { 'x-tenant-id': 'city-ops-eu' },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      event: {
        action: 'context-propagation',
        actor: 'contract.context',
        appId: 'mobility-marketplace',
        requestId: 'context-workflow-1',
        status: 'accepted',
      },
    });
  });
});
