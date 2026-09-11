import * as Logger from 'effect/Logger';
import type { DataBatchResponsePayload } from '../src/data-platform';
import {
  BatchItemTimeoutError,
  promiseWithTimeout,
} from '../src/effect/handler/batch';
import { createDataPlatformBatchRequestHandler } from '../src/effect/handler/batch-handler';

describe('Effect batch operation boundary', () => {
  test('preserves the timeout instance passed to cancellation and rejection', async () => {
    let cancellationError: BatchItemTimeoutError | undefined;
    const pending = new Promise<never>(() => undefined);
    const failure = await promiseWithTimeout(pending, 1, error => {
      cancellationError = error;
    }).catch(error => error);

    expect(failure).toBe(cancellationError);
    expect(failure).toBeInstanceOf(BatchItemTimeoutError);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe('Error');
    expect(failure.message).toBe('Batch item timeout after 1ms');
  });

  test('isolates mixed item failures without leaking diagnostics or changing order', async () => {
    const loggedErrors: unknown[] = [];
    const loggerSpy = rs
      .spyOn(Logger.defaultLogger, 'log')
      .mockImplementation(({ message, logLevel }) => {
        expect(logLevel).toBe('Error');
        loggedErrors.push(message);
      });
    const abortedIds: string[] = [];
    const thrownSecret = 'postgres://admin:secret@example.test/private';
    const querySecret = 'bearer-token-that-must-not-be-logged';
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>(resolve => {
      releaseSlow = resolve;
    });
    const handler = createDataPlatformBatchRequestHandler({
      dataPlatform: {
        batch: { requestTimeoutMs: 15, maxConcurrency: 4 },
      },
      handleItem: async request => {
        const id = new URL(request.url).pathname.slice(1);
        if (id === 'slow') {
          await slowGate;
          return new Response('slow', { status: 202 });
        }
        if (id === 'timeout') {
          return new Promise<Response>((_resolve, reject) => {
            request.signal.addEventListener(
              'abort',
              () => {
                abortedIds.push(id);
                reject(request.signal.reason);
              },
              { once: true },
            );
          });
        }
        if (id === 'throw') {
          throw new Error(thrownSecret);
        }
        if (id === 'ok') {
          releaseSlow();
          return new Response('ok');
        }
        throw new Error(`Unexpected dispatch: ${id}`);
      },
    });

    try {
      const response = await handler.handle(
        new Request('http://localhost/_data/batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            protocolVersion: 2,
            batchId: 'boundary-batch',
            sentAt: Date.now(),
            items: [
              { id: 'slow-id', path: '/slow', method: 'GET' },
              {
                id: 'timeout-id',
                path: `/timeout?token=${encodeURIComponent(querySecret)}`,
                method: 'GET',
              },
              {
                id: 'throw-id',
                path: `/throw?token=${encodeURIComponent(querySecret)}`,
                method: 'GET',
              },
              { id: 'ok-id', path: '/ok', method: 'GET' },
              {
                id: 'invalid-header-id',
                path: '/never-dispatched',
                method: 'GET',
                headers: { 'invalid header': 'value' },
              },
            ],
          }),
        }),
      );
      const payload = (await response.json()) as DataBatchResponsePayload;

      expect(response.status).toBe(200);
      expect(response.headers.get('x-modernjs-data-batch')).toBe('2');
      expect(payload.protocolVersion).toBe(2);
      expect(payload.items.map(item => item.id)).toEqual([
        'slow-id',
        'timeout-id',
        'throw-id',
        'ok-id',
        'invalid-header-id',
      ]);
      expect(payload.items.map(item => item.status)).toEqual([
        202, 504, 500, 200, 400,
      ]);
      expect(abortedIds).toEqual(['timeout']);

      expect(loggedErrors.flat()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'bff.batch.item.failure',
            itemId: 'throw-id',
            path: '/throw',
          }),
          expect.objectContaining({
            event: 'bff.batch.item.timeout',
            itemId: 'timeout-id',
            path: '/timeout',
          }),
        ]),
      );
      const serializedDiagnostics = JSON.stringify(loggedErrors);
      expect(serializedDiagnostics).not.toContain(thrownSecret);
      expect(serializedDiagnostics).not.toContain(querySecret);
    } finally {
      loggerSpy.mockRestore();
    }
  });
});
