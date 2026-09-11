import { createDefaultPlugins, createServerBase } from '@modern-js/server-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { injectTelemetryPlugin } from '../src/telemetry';
import { getDefaultAppContext, getDefaultConfig } from './helpers';

type ServerBase = ReturnType<typeof createServerBase>;

const SIGNAL_ENDPOINT = '/_modern/contract-gates/runtime-fallback';
const TOKEN_HEADER = 'x-modernjs-runtime-signal-token';

/**
 * Boots a real server with the telemetry plugin and the given snapshot-
 * observation
 * config, then tears the temp workspace down. `server.init()` is left to the
 * caller so fail-closed init can be asserted.
 */
const withHealthObservation = async (
  snapshotObservation: Record<string, unknown>,
  run: (server: ServerBase, snapshotPath: string) => Promise<void>,
) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'modern-telemetry-health-observation-'),
  );
  const snapshotPath = path.join(tempDir, '.modern/contract-gates.json');
  try {
    const config = getDefaultConfig();
    config.server = {
      telemetry: {
        enabled: true,
        health: {
          enabled: true,
          minConsecutiveFailedEvaluations: 1,
          snapshotObservation: {
            enabled: true,
            gateSnapshotPath: snapshotPath,
            ...snapshotObservation,
          },
        },
      },
    } as any;

    const server = createServerBase({
      config,
      pwd: tempDir,
      appContext: getDefaultAppContext(),
    });
    server.addPlugins([
      ...createDefaultPlugins({ logger: false }),
      injectTelemetryPlugin(),
    ]);

    await run(server, snapshotPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const postSignal = (server: ServerBase, token: string | null, body: unknown) =>
  server.request(
    SIGNAL_ENDPOINT,
    {
      method: 'POST',
      headers: new Headers({
        'content-type': 'application/json',
        ...(token ? { [TOKEN_HEADER]: token } : {}),
      }),
      body: JSON.stringify(body),
    },
    {},
  );

describe('telemetry health observation runtime signal', () => {
  test('rejects oversized runtime fallback signal payload', async () => {
    await withHealthObservation(
      {
        runtimeFallbackSignal: {
          enabled: true,
          endpoint: SIGNAL_ENDPOINT,
          maxBodyBytes: 16,
          auth: { expectedValue: 'oversize-signal-token' },
        },
      },
      async server => {
        await server.init();
        const response = await postSignal(server, 'oversize-signal-token', {
          reason: 'x'.repeat(2_048),
        });
        expect(response.status).toBe(413);
        const payload = (await response.json()) as { error?: string };
        expect(String(payload.error)).toContain('payload too large');
      },
    );
  });

  test('requires runtime fallback auth token when configured', async () => {
    await withHealthObservation(
      {
        runtimeFallbackSignal: {
          enabled: true,
          endpoint: SIGNAL_ENDPOINT,
          auth: {
            enabled: true,
            headerName: TOKEN_HEADER,
            expectedValue: 'top-secret-token',
          },
        },
      },
      async (server, snapshotPath) => {
        await server.init();
        const signal = {
          reason: 'remote_load_failed',
          phase: 'load',
          appName: 'crm',
        };

        const rejected = await postSignal(server, null, signal);
        expect(rejected.status).toBe(401);
        expect(fs.existsSync(snapshotPath)).toBe(false);

        const accepted = await postSignal(server, 'top-secret-token', signal);
        expect(accepted.status).toBe(202);
        expect(fs.existsSync(snapshotPath)).toBe(true);
      },
    );
  });

  test('enforces runtime fallback trust policy before mutating gate snapshots', async () => {
    await withHealthObservation(
      {
        runtimeFallbackSignal: {
          enabled: true,
          endpoint: SIGNAL_ENDPOINT,
          auth: { expectedValue: 'trust-policy-token' },
          trustPolicy: {
            allowedApps: ['crm-shell'],
            allowedEntryOrigins: ['https://erp.example.com'],
            expectedRuntimeDigests: { 'crm-shell': 'digest-crm-v1' },
            enforceRuntimeDigest: true,
          },
        },
      },
      async (server, snapshotPath) => {
        await server.init();
        const base = {
          reason: 'remote_load_failed',
          phase: 'load',
          appName: 'crm-shell',
          entry: 'https://erp.example.com/remoteEntry.js',
          runtimeDigest: 'digest-crm-v1',
        };

        const untrustedApp = await postSignal(server, 'trust-policy-token', {
          ...base,
          appName: 'unknown-app',
        });
        expect(untrustedApp.status).toBe(403);

        const digestMismatch = await postSignal(server, 'trust-policy-token', {
          ...base,
          runtimeDigest: 'digest-wrong',
        });
        expect(digestMismatch.status).toBe(403);

        const trusted = await postSignal(server, 'trust-policy-token', {
          ...base,
          metadata: {
            compatibility: { '@tanstack/react-router': '1.170.15' },
          },
        });
        expect(trusted.status).toBe(202);

        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as {
          gates?: Record<string, any>;
        };
        const gate = snapshot.gates?.['runtime-mf-fallback-health'];
        expect(gate?.passed).toBe(false);
        expect(
          gate?.metadata?.metadata?.compatibility?.['@tanstack/react-router'],
        ).toBe('1.170.15');
      },
    );
  });

  test('dedupes repeated fallback events and rate limits rotated identities', async () => {
    await withHealthObservation(
      {
        runtimeFallbackSignal: {
          enabled: true,
          endpoint: SIGNAL_ENDPOINT,
          auth: { expectedValue: 'rate-limit-token' },
          trustPolicy: {
            dedupeWindowMs: 60_000,
            maxSignalsPerWindow: 1,
            windowMs: 60_000,
          },
        },
      },
      async server => {
        await server.init();
        const sendSignal = (appName: string) =>
          postSignal(server, 'rate-limit-token', {
            reason: 'remote_mount_failed',
            phase: 'mount',
            appName,
            entry: `https://${appName}.example.com/remoteEntry.js`,
          });

        expect((await sendSignal('app-a')).status).toBe(202);

        const duplicate = await sendSignal('app-a');
        expect(duplicate.status).toBe(202);
        expect(((await duplicate.json()) as any).deduped).toBe(true);

        // A rotated appName/entry pair used to mint a fresh rate-limit bucket;
        // the limiter is now keyed on connection identity instead.
        expect((await sendSignal('app-b')).status).toBe(429);
      },
    );
  });

  test('keeps the runtime fallback signal endpoint disabled unless explicitly enabled', async () => {
    // no runtimeFallbackSignal config: the health kill switch must stay OFF.
    await withHealthObservation({}, async (server, snapshotPath) => {
      await server.init();
      const response = await postSignal(server, null, {
        reason: 'remote_load_failed',
        phase: 'load',
        appName: 'dashboard',
      });
      expect(response.status).toBe(404);
      expect(fs.existsSync(snapshotPath)).toBe(false);
    });
  });

  test('refuses to enable the runtime fallback signal endpoint without an auth token', async () => {
    await withHealthObservation(
      // enabled with no auth token configured: init must fail closed.
      { runtimeFallbackSignal: { enabled: true } },
      async server => {
        await expect(server.init()).rejects.toThrow(
          /requires an auth token|auth\.expectedValue/,
        );
      },
    );
  });

  test('runtime status endpoint stays a bare health probe without configured auth', async () => {
    await withHealthObservation({}, async server => {
      await server.init();
      const response = await server.request('/_modern/runtime/status', {}, {});
      expect(response.status).toBe(200);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload.ok).toBe(true);
      // No telemetry/health/trust internals are disclosed without auth.
      expect(payload.telemetry).toBeUndefined();
      expect(payload.health).toBeUndefined();
      expect(payload.runtimeFallbackSignal).toBeUndefined();
    });
  });

  test('runtime status auth works even when the signal endpoint stays disabled', async () => {
    await withHealthObservation(
      {
        runtimeFallbackSignal: {
          // endpoint stays disabled, but its auth config still guards the
          // status endpoint detail view.
          auth: { enabled: true, expectedValue: 'status-only-token' },
        },
      },
      async server => {
        await server.init();

        const signalResponse = await postSignal(server, 'status-only-token', {
          appName: 'dashboard',
        });
        expect(signalResponse.status).toBe(404);

        const unauthorized = await server.request(
          '/_modern/runtime/status',
          {},
          {},
        );
        expect(unauthorized.status).toBe(401);

        const authorized = await server.request(
          '/_modern/runtime/status',
          {
            method: 'GET',
            headers: new Headers({ [TOKEN_HEADER]: 'status-only-token' }),
          },
          {},
        );
        expect(authorized.status).toBe(200);
        const payload = (await authorized.json()) as Record<string, any>;
        expect(payload.health?.enabled).toBe(true);
        expect(payload.runtimeFallbackSignal?.enabled).toBe(false);
      },
    );
  });
});
