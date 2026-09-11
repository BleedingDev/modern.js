import {
  createOtlpTelemetryExporter,
  createTelemetryAwareMetrics,
  createVictoriaMetricsTelemetryExporter,
  type TelemetryEnvelope,
  TelemetryRegistry,
  TelemetryStartupHealthError,
} from '../src/telemetry';

const createEnvelope = (partial: Record<string, unknown> = {}) => ({
  timestamp: Date.now(),
  service: 'svc',
  module: 'server',
  environment: 'test',
  signalType: 'metric' as const,
  name: 'server.handle.request',
  value: 10,
  unit: 'ms',
  ...partial,
});

describe('telemetry registry', () => {
  test('redacts configured keys recursively', async () => {
    const batches: unknown[] = [];
    const registry = new TelemetryRegistry({
      service: 'svc',
      module: 'server',
      environment: 'test',
      flushIntervalMs: 60_000,
      redactionKeys: ['token'],
    });
    await registry.register({
      name: 'memory',
      async emit(batch) {
        batches.push(...batch);
      },
    });

    registry.enqueue(
      createEnvelope({
        name: 'sensitive',
        attributes: {
          token: 'secret',
          nested: {
            token: 'inner-secret',
            keep: true,
          },
        },
      }),
    );

    await registry.flush();
    await registry.shutdown();

    const item = batches.find(
      entry => (entry as { name?: string }).name === 'sensitive',
    ) as
      | {
          attributes?: {
            token?: string;
            nested?: {
              token?: string;
              keep?: boolean;
            };
          };
        }
      | undefined;
    expect(item).toBeDefined();
    expect(item?.attributes?.token).toBe('[REDACTED]');
    expect(item?.attributes?.nested?.token).toBe('[REDACTED]');
    expect(item?.attributes?.nested?.keep).toBe(true);
  });

  test('wraps metrics and preserves trace tags in envelopes', async () => {
    const emitted: TelemetryEnvelope[] = [];
    const registry = new TelemetryRegistry({
      service: 'svc',
      module: 'server',
      environment: 'test',
      flushIntervalMs: 60_000,
    });
    await registry.register({
      name: 'memory',
      async emit(batch) {
        emitted.push(...batch);
      },
    });

    const base = {
      gauges: rs.fn(),
      emitCounter: rs.fn(),
      emitTimer: rs.fn(),
    };
    const metrics = createTelemetryAwareMetrics(base as any, registry);
    metrics.emitCounter('server.request.count', 1, {
      pathname: '/foo',
      trace_id: '11112222333344445555666677778888',
    });
    metrics.emitTimer('server.request.cost', 25, {
      pathname: '/foo',
      span_id: '1111222233334444',
    });

    await registry.flush();
    await registry.shutdown();

    expect(base.emitCounter).toHaveBeenCalledTimes(1);
    expect(base.emitTimer).toHaveBeenCalledTimes(1);

    const countEnvelope = emitted.find(
      item => item.name === 'server.request.count',
    )!;
    const timerEnvelope = emitted.find(
      item => item.name === 'server.request.cost',
    )!;

    expect(countEnvelope.unit).toBe('count');
    expect(countEnvelope.traceId).toBe('11112222333344445555666677778888');
    expect(timerEnvelope.unit).toBe('ms');
    expect(timerEnvelope.spanId).toBe('1111222233334444');
  });

  test('startup health check fails loud by default when exporter is unhealthy', async () => {
    const registry = new TelemetryRegistry({
      service: 'svc',
      module: 'server',
      environment: 'test',
      flushIntervalMs: 60_000,
    });
    await registry.register({
      name: 'failing',
      async emit() {
        throw new Error('connection refused');
      },
    });

    await expect(registry.startupHealthCheck()).rejects.toBeInstanceOf(
      TelemetryStartupHealthError,
    );
    const health = registry.getExporterHealth();
    expect(health).toHaveLength(1);
    expect(health[0].healthy).toBe(false);
    expect(health[0].failures).toBeGreaterThan(0);
    await registry.shutdown();
  });
});

describe('telemetry exporters', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('otlp exporter sends envelope batch with JSON body', async () => {
    const mockFetch = rs.fn(async () => new Response('ok', { status: 200 }));
    globalThis.fetch = mockFetch as typeof fetch;

    const exporter = createOtlpTelemetryExporter({
      endpoint: 'http://localhost:4318/v1/logs',
    });
    await exporter.emit([
      createEnvelope({
        signalType: 'log',
        name: 'hello',
        level: 'info',
      }),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://localhost:4318/v1/logs');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe(
      'application/json',
    );
    const payload = JSON.parse(String(init.body)) as {
      resource: {
        service: string;
        module: string;
        environment: string;
      };
      emittedAt: number;
      events: unknown[];
    };
    expect(payload.resource).toEqual({
      service: 'svc',
      module: 'server',
      environment: 'test',
    });
    expect(payload.emittedAt).toEqual(expect.any(Number));
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]).toMatchObject({
      service: 'svc',
      module: 'server',
      environment: 'test',
      signalType: 'log',
      name: 'hello',
      level: 'info',
    });
  });

  test('victoria metrics exporter emits prometheus lines', async () => {
    const mockFetch = rs.fn(async () => new Response('ok', { status: 200 }));
    globalThis.fetch = mockFetch as typeof fetch;

    const exporter = createVictoriaMetricsTelemetryExporter({
      endpoint: 'http://localhost:8428/api/v1/import/prometheus',
      metricPrefix: 'modernjs',
    });
    await exporter.emit([
      createEnvelope({
        signalType: 'metric',
        name: 'server.handle.request',
        value: 42,
      }),
      createEnvelope({
        signalType: 'log',
        name: 'request.error',
        level: 'error',
      }),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://localhost:8428/api/v1/import/prometheus');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe(
      'text/plain; version=0.0.4',
    );
    const body = String(init.body);
    expect(body.endsWith('\n')).toBe(true);
    const lines = body.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /^modernjs_metric_server_handle_request\{environment="test",module="server",service="svc"\} 42 \d+$/,
    );
    expect(lines[1]).toMatch(
      /^modernjs_log_request_error\{environment="test",level="error",module="server",service="svc"\} 10 \d+$/,
    );
  });
});
