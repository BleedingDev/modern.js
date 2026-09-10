import type {
  TelemetryHealthEvaluation,
  TelemetryHealthStatusSnapshot,
} from './healthMonitor';
import type { TelemetryRegistry } from './registry';

type CanaryState = 'canary' | 'promoted' | 'rolled_back';

// Preserve the legacy reporting contract without a second monitor or timer.
// Rollback remains terminal in this view even when observed health recovers.
export const createTelemetryCanaryCompatibility = (
  registry: TelemetryRegistry,
) => {
  let state: CanaryState = 'canary';

  return {
    observe(evaluation: TelemetryHealthEvaluation) {
      let action: 'promote' | 'rollback';
      if (evaluation.transition === 'became_healthy' && state === 'canary') {
        state = 'promoted';
        action = 'promote';
      } else if (
        evaluation.transition === 'became_unhealthy' &&
        state !== 'rolled_back'
      ) {
        state = 'rolled_back';
        action = 'rollback';
      } else {
        return;
      }

      try {
        registry.enqueueMetric({
          name: `telemetry.canary.${action}`,
          value: 1,
          unit: 'count',
          tags: {
            action,
            state,
            failures: String(evaluation.failures.length),
          },
        });
      } catch (_error) {
        // Legacy decision metrics must not break health observation.
      }
    },
    getStatusSnapshot(snapshot: TelemetryHealthStatusSnapshot) {
      return { ...snapshot, state };
    },
  };
};

export type TelemetryCanaryCompatibility = ReturnType<
  typeof createTelemetryCanaryCompatibility
>;
