import type { ServerTelemetryUserConfig } from '@modern-js/runtime-extensions/server-config';
import {
  type ContractGateSnapshotStore,
  DEFAULT_CONTRACT_GATE_SNAPSHOT_PATH,
  resolveContractGateSnapshotPath,
  resolveContractGateSnapshotStore,
} from '../contract-gate-snapshot-store';
import {
  createRuntimeFallbackSignalRuntimeState,
  DEFAULT_RUNTIME_FALLBACK_FAILURE_HOLD_MS,
  DEFAULT_RUNTIME_FALLBACK_GATE_NAME,
  DEFAULT_RUNTIME_FALLBACK_MAX_BODY_BYTES,
  normalizeRequiredRuntimeFallbackSignalAuthConfig,
  normalizeRuntimeFallbackSignalAuthConfig,
  normalizeRuntimeFallbackTrustPolicy,
  type RuntimeFallbackSignalAuthConfig,
  type RuntimeFallbackSignalConfig,
  resolveRuntimeFallbackSignalEndpoint,
} from '../runtimeFallbackSignal';
import {
  type TelemetryHealthEvaluation,
  TelemetryHealthMonitor,
  TelemetryRegistry,
} from '../telemetryCore';

type SetupTelemetryHealthMonitoringOptions = {
  registry: TelemetryRegistry;
  appDirectory: string;
  healthConfig: ServerTelemetryUserConfig['health'] | undefined;
};

type SetupTelemetryHealthMonitoringResult = {
  healthMonitor?: TelemetryHealthMonitor;
  gateSnapshotStorePromise?: Promise<ContractGateSnapshotStore>;
  runtimeFallbackSignalConfig?: RuntimeFallbackSignalConfig;
  runtimeStatusAuthConfig?: RuntimeFallbackSignalAuthConfig;
};

function emitHealthTransitionMetric(
  registry: TelemetryRegistry,
  evaluation: TelemetryHealthEvaluation,
) {
  try {
    registry.enqueueMetric({
      name: 'telemetry.health.transition',
      value: 1,
      unit: 'count',
      tags: {
        transition: evaluation.transition,
        state: evaluation.state,
        failures: String(evaluation.failures.length),
      },
    });
  } catch (_error) {
    // Health transition metrics are best-effort and must not break requests.
  }
}

export const setupTelemetryHealthMonitoring = ({
  registry,
  appDirectory,
  healthConfig,
}: SetupTelemetryHealthMonitoringOptions): SetupTelemetryHealthMonitoringResult => {
  if (!healthConfig?.enabled) {
    return {};
  }

  const contractGates = healthConfig.contractGates as
    | Record<string, boolean | { passed: boolean; reason?: string }>
    | undefined;

  const healthMonitor = new TelemetryHealthMonitor({
    registry,
    evaluationIntervalMs: healthConfig.evaluationIntervalMs,
    minConsecutiveHealthyEvaluations:
      healthConfig.minConsecutiveHealthyEvaluations,
    minConsecutiveFailedEvaluations:
      healthConfig.minConsecutiveFailedEvaluations,
    maxQueueUtilization: healthConfig.maxQueueUtilization,
    maxTotalDropped: healthConfig.maxTotalDropped,
    maxUnhealthyExporters: healthConfig.maxUnhealthyExporters,
    requiredContractGates: Object.keys(contractGates || {}),
    onTransition: evaluation => {
      emitHealthTransitionMetric(registry, evaluation);
    },
  });

  if (contractGates) {
    healthMonitor.setContractGates(contractGates);
  }

  let gateSnapshotStorePromise: Promise<ContractGateSnapshotStore> | undefined;
  let runtimeFallbackSignalConfig: RuntimeFallbackSignalConfig | undefined;

  const snapshotObservationEnabled =
    healthConfig.snapshotObservation?.enabled ?? true;
  if (snapshotObservationEnabled) {
    const gateSnapshotPath = resolveContractGateSnapshotPath(
      appDirectory,
      healthConfig.snapshotObservation?.gateSnapshotPath,
    );
    gateSnapshotStorePromise = resolveContractGateSnapshotStore({
      appDirectory,
      gateSnapshotPath: gateSnapshotPath || DEFAULT_CONTRACT_GATE_SNAPSHOT_PATH,
      stateStore: healthConfig.snapshotObservation?.stateStore,
    });

    const runtimeSignalConfig =
      healthConfig.snapshotObservation?.runtimeFallbackSignal;
    if (runtimeSignalConfig?.enabled === true) {
      runtimeFallbackSignalConfig = {
        endpoint: resolveRuntimeFallbackSignalEndpoint(
          runtimeSignalConfig.endpoint,
        ),
        gateName:
          runtimeSignalConfig.gateName?.trim() ||
          DEFAULT_RUNTIME_FALLBACK_GATE_NAME,
        gateSnapshotStore: gateSnapshotStorePromise,
        failureHoldMs: Math.max(
          1_000,
          runtimeSignalConfig.failureHoldMs ??
            DEFAULT_RUNTIME_FALLBACK_FAILURE_HOLD_MS,
        ),
        maxBodyBytes: Math.max(
          512,
          runtimeSignalConfig.maxBodyBytes ??
            DEFAULT_RUNTIME_FALLBACK_MAX_BODY_BYTES,
        ),
        auth: normalizeRequiredRuntimeFallbackSignalAuthConfig(
          runtimeSignalConfig.auth,
        ),
        trustPolicy: normalizeRuntimeFallbackTrustPolicy(
          runtimeSignalConfig.trustPolicy,
        ),
        runtimeState: createRuntimeFallbackSignalRuntimeState(),
      };
    }
  }

  // Detailed runtime status stays authenticated even when signal ingestion is
  // disabled.
  const runtimeStatusAuthConfig =
    runtimeFallbackSignalConfig?.auth ??
    normalizeRuntimeFallbackSignalAuthConfig(
      healthConfig.snapshotObservation?.runtimeFallbackSignal?.auth,
    );

  return {
    healthMonitor,
    gateSnapshotStorePromise,
    runtimeFallbackSignalConfig,
    runtimeStatusAuthConfig,
  };
};
