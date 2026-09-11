import { createDataBatchTransport } from '../src/data-platform';
import { createDataPlatformBatchRequestHandler } from '../src/effect/handler/batch-handler';

const FIXED_NOW = 1_700_000_000_000;
const MAX_BATCH_BYTES = 1_024;

describe('Effect batch byte limits', () => {
  beforeEach(() => {
    rs.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    rs.restoreAllMocks();
  });

  test('falls back an oversized mutation exactly once without placing it in a batch', async () => {
    const calls: Array<{ url: string; method: string; body: string }> = [];
    const transport = createDataBatchTransport({
      allowedMethods: ['POST'],
      flushIntervalMs: 1_000,
      maxBatchBytes: MAX_BATCH_BYTES,
      fetch: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method || 'GET',
          body: String(init?.body || ''),
        });
        return Response.json({ accepted: true });
      },
    });

    await expect(
      transport('http://localhost/mutate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'x'.repeat(MAX_BATCH_BYTES) }),
      }),
    ).resolves.toEqual({ accepted: true });

    expect(calls).toEqual([
      {
        url: 'http://localhost/mutate',
        method: 'POST',
        body: JSON.stringify({ value: 'x'.repeat(MAX_BATCH_BYTES) }),
      },
    ]);
  });

  test('accepts the exact server limit and rejects plus one', async () => {
    const handler = createDataPlatformBatchRequestHandler({
      dataPlatform: { batch: { maxBatchBytes: MAX_BATCH_BYTES } },
      handleItem: async () => Response.json({ ok: true }),
    });
    const makePayload = (size: number) => {
      const base = JSON.stringify({
        protocolVersion: 2,
        batchId: 'batch-limit',
        sentAt: FIXED_NOW,
        items: [{ id: 'a', path: '/', method: 'GET' }],
      });
      const insertion = 'x'.repeat(
        size - new TextEncoder().encode(base).length,
      );
      return base.replace('"path":"/"', `"path":"/${insertion}"`);
    };
    const exact = makePayload(MAX_BATCH_BYTES);
    const plusOne = `${exact} `;
    expect(new TextEncoder().encode(exact)).toHaveLength(MAX_BATCH_BYTES);
    expect(new TextEncoder().encode(plusOne)).toHaveLength(MAX_BATCH_BYTES + 1);

    const exactResponse = await handler.handle(
      new Request('http://localhost/_data/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: exact,
      }),
    );
    const plusOneResponse = await handler.handle(
      new Request('http://localhost/_data/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: plusOne,
      }),
    );

    expect(exactResponse.status).toBe(200);
    expect(plusOneResponse.status).toBe(413);
  });

  test('fast-rejects declared oversize and cancels streaming input after the cap', async () => {
    let declaredPulls = 0;
    const declaredBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([123]));
      },
      pull(controller) {
        declaredPulls += 1;
        controller.enqueue(new Uint8Array([123]));
      },
    });
    const handler = createDataPlatformBatchRequestHandler({
      dataPlatform: { batch: { maxBatchBytes: MAX_BATCH_BYTES } },
      handleItem: async () => Response.json({ ok: true }),
    });
    const declaredInit: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      duplex: 'half',
      headers: {
        'content-length': String(MAX_BATCH_BYTES + 1),
        'content-type': 'application/json',
      },
      body: declaredBody,
    };
    const declaredRequest = new Request(
      'http://localhost/_data/batch',
      declaredInit,
    );
    const declaredResponse = await handler.handle(declaredRequest);
    expect(declaredResponse.status).toBe(413);
    expect(declaredPulls).toBe(0);

    let streamedPulls = 0;
    let cancelled = false;
    const streamedBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        streamedPulls += 1;
        controller.enqueue(new Uint8Array(600).fill(120));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamedInit: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      duplex: 'half',
      headers: { 'content-type': 'application/json' },
      body: streamedBody,
    };
    const streamedResponse = await handler.handle(
      new Request('http://localhost/_data/batch', streamedInit),
    );
    expect(streamedResponse.status).toBe(413);
    expect(streamedPulls).toBe(2);
    expect(cancelled).toBe(true);
  });
});
