import { setupTelemetryHealthMonitoring } from '../src/telemetry/healthSetup';
import { TelemetryRegistry } from '../src/telemetryCore';

const createMonitoring = (initiallyHealthy = true) => {
  const registry = new TelemetryRegistry({
    service: 'svc',
    module: 'server',
    environment: 'test',
    flushIntervalMs: 60_000,
  });
  const monitoring = setupTelemetryHealthMonitoring({
    registry,
    appDirectory: process.cwd(),
    legacyHealthConfig: {
      enabled: true,
      minConsecutiveHealthyEvaluations: 2,
      rollbackConsecutiveFailures: 2,
      contractGates: { contracts: initiallyHealthy },
      autopilot: { enabled: false },
    },
  });
  if (!monitoring.healthMonitor || !monitoring.canaryCompatibility) {
    throw new Error('Expected enabled telemetry health monitoring');
  }
  return {
    registry,
    monitor: monitoring.healthMonitor,
    compatibility: monitoring.canaryCompatibility,
  };
};

describe('telemetry canary reporting compatibility', () => {
  test('preserves legacy decisions while native health recovers', async () => {
    const { registry, monitor, compatibility } = createMonitoring();
    const enqueueMetric = rs.spyOn(registry, 'enqueueMetric');
    const snapshot = () =>
      compatibility.getStatusSnapshot(monitor.getStatusSnapshot());

    try {
      expect(snapshot().state).toBe('canary');
      monitor.evaluate();
      expect(snapshot().state).toBe('canary');
      monitor.evaluate();
      monitor.evaluate();
      expect(snapshot()).toEqual({
        ...monitor.getStatusSnapshot(),
        timestamp: expect.any(Number),
        state: 'promoted',
      });

      monitor.setContractGate('contracts', false, 'schema drift');
      monitor.evaluate();
      expect(snapshot().state).toBe('promoted');
      monitor.evaluate();
      expect(snapshot()).toMatchObject({
        state: 'rolled_back',
        consecutiveFailures: 2,
        failurePreview: [{ reason: 'contract_gate_failed', gate: 'contracts' }],
      });

      monitor.setContractGate('contracts', true);
      monitor.evaluate();
      monitor.evaluate();
      expect(monitor.getStatusSnapshot().state).toBe('healthy');
      expect(snapshot()).toMatchObject({
        state: 'rolled_back',
        consecutiveHealthy: 2,
        failurePreview: [],
      });
      monitor.setContractGate('contracts', false);
      monitor.evaluate();
      monitor.evaluate();
      expect(snapshot().state).toBe('rolled_back');

      const metrics = enqueueMetric.mock.calls.map(([metric]) => metric);
      expect(
        metrics.filter(metric => metric.name.startsWith('telemetry.canary.')),
      ).toEqual([
        {
          name: 'telemetry.canary.promote',
          value: 1,
          unit: 'count',
          tags: { action: 'promote', state: 'promoted', failures: '0' },
        },
        {
          name: 'telemetry.canary.rollback',
          value: 1,
          unit: 'count',
          tags: { action: 'rollback', state: 'rolled_back', failures: '1' },
        },
      ]);
      expect(
        metrics
          .filter(metric => metric.name === 'telemetry.health.transition')
          .map(metric => metric.tags?.transition),
      ).toEqual([
        'became_healthy',
        'became_unhealthy',
        'became_healthy',
        'became_unhealthy',
      ]);
    } finally {
      await registry.shutdown();
    }
  });

  test('does not promote after an initial rollback', async () => {
    const { registry, monitor, compatibility } = createMonitoring(false);
    const enqueueMetric = rs.spyOn(registry, 'enqueueMetric');
    try {
      monitor.evaluate();
      monitor.evaluate();
      monitor.setContractGate('contracts', true);
      monitor.evaluate();
      monitor.evaluate();
      expect(monitor.getStatusSnapshot().state).toBe('healthy');
      expect(
        compatibility.getStatusSnapshot(monitor.getStatusSnapshot()).state,
      ).toBe('rolled_back');
      expect(
        enqueueMetric.mock.calls
          .filter(([metric]) => metric.name.startsWith('telemetry.canary.'))
          .map(([metric]) => metric.name),
      ).toEqual(['telemetry.canary.rollback']);
    } finally {
      await registry.shutdown();
    }
  });

  test('isolates metric failures and retains the legacy decision', async () => {
    const { registry, monitor, compatibility } = createMonitoring();
    const enqueueMetric = rs
      .spyOn(registry, 'enqueueMetric')
      .mockImplementation(() => {
        throw new Error('metric unavailable');
      });
    try {
      expect(() => {
        monitor.evaluate();
        monitor.evaluate();
      }).not.toThrow();
      expect(monitor.getStatusSnapshot().state).toBe('healthy');
      expect(
        compatibility.getStatusSnapshot(monitor.getStatusSnapshot()).state,
      ).toBe('promoted');
      expect(enqueueMetric).toHaveBeenCalledTimes(2);
    } finally {
      enqueueMetric.mockRestore();
      await registry.shutdown();
    }
  });
});
