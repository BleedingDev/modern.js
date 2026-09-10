import {
  classifyModuleFederationFallback,
  emitModuleFederationFallbackTelemetry,
  ModuleFederationRemoteComponentContractError,
  ModuleFederationRemoteLoadError,
  ModuleFederationRemoteLoadTimeoutError,
} from '../../src/module-federation';

describe('module federation degraded telemetry', () => {
  test('classifies deterministic fallback reasons', () => {
    expect(
      classifyModuleFederationFallback(
        new ModuleFederationRemoteLoadTimeoutError('remote/Widget', 20),
      ),
    ).toBe('timeout');
    expect(
      classifyModuleFederationFallback(new Error('failed to fetch chunk')),
    ).toBe('network');
    expect(
      classifyModuleFederationFallback(
        new ModuleFederationRemoteComponentContractError(
          'remote/Widget',
          'default',
        ),
      ),
    ).toBe('contract');
    expect(
      classifyModuleFederationFallback(
        new Error('@tanstack/react-router requiredVersion mismatch'),
      ),
    ).toBe('version-skew');
    expect(
      classifyModuleFederationFallback(
        new ModuleFederationRemoteLoadError(
          'remote/Widget',
          1,
          new Error('manifest not found'),
        ),
      ),
    ).toBe('remote-unavailable');
  });

  test('posts a classified fallback signal with trust fields only when requested', async () => {
    const fetchImpl = rs.fn(async () => new Response('ok', { status: 202 }));

    await expect(
      emitModuleFederationFallbackTelemetry(
        {
          appName: 'crm-shell',
          classification: 'network',
          entry: 'https://erp.example.com/remoteEntry.js',
          error: new Error('failed to fetch chunk'),
          exportName: 'default',
          metadata: {
            compatibility: {
              '@tanstack/react-router': '1.170.15',
            },
          },
          phase: 'load',
          remote: 'remote/Widget',
          runtimeDigest: 'digest-crm-v1',
        },
        {
          authToken: 'runtime-token',
          endpoint: '/_modern/contract-gates/runtime-fallback',
          fetchImpl,
        },
      ),
    ).resolves.toEqual({
      dispatched: true,
      posted: true,
      postStatus: 202,
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/_modern/contract-gates/runtime-fallback');
    expect(init.method).toBe('POST');
    expect(
      (init.headers as Headers).get('x-modernjs-runtime-signal-token'),
    ).toBe('runtime-token');
    expect(JSON.parse(String(init.body))).toMatchObject({
      appName: 'crm-shell',
      entry: 'https://erp.example.com/remoteEntry.js',
      eventName: 'modernjs:mf-runtime-fallback',
      phase: 'load',
      reason: 'network',
      runtimeDigest: 'digest-crm-v1',
      schemaVersion: 1,
      metadata: {
        classification: 'network',
        compatibility: {
          '@tanstack/react-router': '1.170.15',
        },
        errorName: 'Error',
        errorMessage: 'failed to fetch chunk',
        exportName: 'default',
        remote: 'remote/Widget',
        runtimeDigest: 'digest-crm-v1',
        status: 'degraded',
      },
    });
  });

  test('emits recovery events without mutating runtime fallback gates by default', async () => {
    const fetchImpl = rs.fn(async () => new Response('ok', { status: 202 }));

    await expect(
      emitModuleFederationFallbackTelemetry(
        {
          appName: 'crm-shell',
          classification: 'remote-unavailable',
          phase: 'recover',
          remote: 'remote/Widget',
          status: 'recovered',
        },
        {
          fetchImpl,
        },
      ),
    ).resolves.toEqual({
      dispatched: true,
      posted: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
