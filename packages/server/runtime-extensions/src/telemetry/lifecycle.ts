import type { ServerTelemetryUserConfig } from '@modern-js/runtime-extensions/server-config';
import { logger } from '@modern-js/utils';
import {
  type ContractGateSnapshotStore,
  resolveContractGateSnapshotPath,
} from '../contract-gate-snapshot-store';
import { ContractGateSnapshotObserver } from '../contractGateSnapshotObserver';
import {
  createOtlpTelemetryExporter,
  createVictoriaMetricsTelemetryExporter,
  TelemetryHealthMonitor,
  TelemetryRegistry,
  warnOnMetricsOtlpEndpoint,
} from '../telemetryCore';

type TelemetryLifecycleApi = {
  onDispose: (disposer: () => Promise<void>) => () => void;
  onPrepare: (prepare: () => Promise<void>) => void;
};

type RegisterTelemetryLifecycleOptions = {
  api: TelemetryLifecycleApi;
  registry: TelemetryRegistry;
  telemetryConfig: ServerTelemetryUserConfig;
  healthConfig: ServerTelemetryUserConfig['health'] | undefined;
  healthMonitor?: TelemetryHealthMonitor;
  gateSnapshotStorePromise?: Promise<ContractGateSnapshotStore>;
  appDirectory: string;
};

/**
 * Active telemetry lane disposers, flushed by a single shared process
 * `beforeExit` hook (a per-lane listener would accumulate listeners across
 * dev-server restarts and embedded multi-server setups).
 */
const activeTelemetryLaneClosers = new Set<() => Promise<void>>();
let telemetryBeforeExitHookInstalled = false;
const ensureTelemetryBeforeExitHook = () => {
  if (telemetryBeforeExitHookInstalled) {
    return;
  }
  telemetryBeforeExitHookInstalled = true;
  process.on('beforeExit', () => {
    for (const close of [...activeTelemetryLaneClosers]) {
      void close().catch((error: unknown) => logger.error(error));
    }
  });
};

export const registerTelemetryLifecycle = ({
  api,
  registry,
  telemetryConfig,
  healthConfig,
  healthMonitor,
  gateSnapshotStorePromise,
  appDirectory,
}: RegisterTelemetryLifecycleOptions) => {
  let contractGateSnapshotObserver: ContractGateSnapshotObserver | undefined;
  let closePromise: Promise<void> | undefined;
  const closeTelemetryLane = () => {
    closePromise ??= Promise.resolve().then(async () => {
      activeTelemetryLaneClosers.delete(closeTelemetryLane);
      contractGateSnapshotObserver?.stop();
      healthMonitor?.stop();
      await registry.shutdown();
    });
    return closePromise;
  };

  // Registration precedes exporter startup and any later plugin failure.
  // Native prod/dev shutdown and runtime retirement share this disposal path.
  api.onDispose(closeTelemetryLane);
  activeTelemetryLaneClosers.add(closeTelemetryLane);
  ensureTelemetryBeforeExitHook();

  let prepared = false;
  api.onPrepare(async () => {
    if (prepared || closePromise) {
      return;
    }
    prepared = true;

    if (telemetryConfig.exporters?.otlp?.enabled) {
      warnOnMetricsOtlpEndpoint(telemetryConfig.exporters.otlp.endpoint);
      await registry.register(
        createOtlpTelemetryExporter(telemetryConfig.exporters.otlp),
      );
    }

    if (telemetryConfig.exporters?.victoriaMetrics?.enabled) {
      await registry.register(
        createVictoriaMetricsTelemetryExporter(
          telemetryConfig.exporters.victoriaMetrics,
        ),
      );
    }

    await registry.startupHealthCheck({
      failLoud: telemetryConfig.failLoudStartup ?? true,
    });

    if (!healthMonitor) {
      return;
    }

    healthMonitor.start();
    if (gateSnapshotStorePromise) {
      const gateSnapshotStore = await gateSnapshotStorePromise;
      contractGateSnapshotObserver = new ContractGateSnapshotObserver({
        monitor: healthMonitor,
        gateSnapshotPath: resolveContractGateSnapshotPath(
          appDirectory,
          healthConfig?.snapshotObservation?.gateSnapshotPath,
        ),
        gateSnapshotStore,
        pollIntervalMs: healthConfig?.snapshotObservation?.pollIntervalMs,
        gateStaleAfterMs: healthConfig?.snapshotObservation?.gateStaleAfterMs,
      });
    }
    if (contractGateSnapshotObserver) {
      await contractGateSnapshotObserver.start();
    }
    healthMonitor.evaluate();
  });
};
