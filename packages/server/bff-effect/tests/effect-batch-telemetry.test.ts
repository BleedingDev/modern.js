import { type Span, trace } from '@opentelemetry/api';

import {
  type DataBatchRequestPayload,
  DEFAULT_DATA_BATCH_ENDPOINT,
} from '../src/data-platform';
import {
  BatchBucketRegistry,
  createBatchTransportQueue,
} from '../src/data-platform/batch/queue';

const createQueue = (
  onEvent?: () => void,
  bucketRegistry = new BatchBucketRegistry(),
) => ({
  bucketRegistry,
  request: createBatchTransportQueue({
    bucketRegistry,
    options: {
      flushIntervalMs: 100,
      maxBatchSize: 2,
      onEvent,
    },
    baseFetch: async (input, init) => {
      expect(String(input)).toBe(
        `http://localhost${DEFAULT_DATA_BATCH_ENDPOINT}`,
      );
      const payload = JSON.parse(String(init?.body)) as DataBatchRequestPayload;
      return Response.json({
        protocolVersion: 2,
        batchId: payload.batchId,
        receivedAt: Date.now(),
        items: payload.items.map(item => ({
          id: item.id,
          status: 200,
          headers: [['content-type', 'application/json']],
          body: {
            encoding: 'base64',
            data: btoa(JSON.stringify({ path: item.path })),
          },
        })),
      });
    },
  }),
});

describe('Effect batch telemetry isolation', () => {
  afterEach(() => {
    rs.restoreAllMocks();
  });

  test.each([
    'event callback',
    'active-span event emission',
  ] as const)('settles requests when the %s observer throws', async observer => {
    const callbackError = new Error(`${observer} failed`);
    const onEvent = rs.fn(() => {
      if (observer === 'event callback') {
        throw callbackError;
      }
    });
    const addEvent = rs.fn(() => {
      if (observer === 'active-span event emission') {
        throw callbackError;
      }
    });
    rs.spyOn(trace, 'getActiveSpan').mockReturnValue({
      addEvent,
    } as unknown as Span);
    const { bucketRegistry, request } = createQueue(onEvent);

    await expect(
      Promise.all([
        request('http://localhost/first'),
        request('http://localhost/second'),
      ]),
    ).resolves.toEqual([{ path: '/first' }, { path: '/second' }]);
    expect(bucketRegistry.size).toBe(0);
    expect(onEvent).toHaveBeenCalled();
    expect(addEvent).toHaveBeenCalled();
  });
});
