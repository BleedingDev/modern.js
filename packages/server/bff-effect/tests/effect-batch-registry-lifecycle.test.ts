import {
  BatchBucketRegistry,
  createBatchTransportQueue,
} from '../src/data-platform/batch/queue';

const advance = async (milliseconds: number) => {
  await rs.advanceTimersByTimeAsync(milliseconds);
  await Promise.resolve();
};

describe('Effect batch bucket registry lifecycle', () => {
  beforeEach(() => {
    rs.useFakeTimers();
  });

  afterEach(() => {
    rs.useRealTimers();
    rs.restoreAllMocks();
  });

  test('isolates origins, custom endpoint paths, and staggered timers in a shared registry', async () => {
    const registry = new BatchBucketRegistry();
    const calls: string[] = [];
    const baseFetch = rs.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      return Response.json({ url });
    });
    const createQueue = (endpoint: string) =>
      createBatchTransportQueue({
        baseFetch,
        bucketRegistry: registry,
        options: { endpoint, flushIntervalMs: 25, maxBatchSize: 8 },
      });
    const alpha = createQueue('/internal/batch-alpha');
    const beta = createQueue('/internal/batch-beta');

    const firstWave = Promise.all([
      alpha('http://one.test/api/alpha-one'),
      beta('http://one.test/api/beta-one'),
    ]);
    await Promise.resolve();

    expect(registry.size).toBe(2);
    expect(baseFetch).not.toHaveBeenCalled();
    await advance(10);

    const secondWave = Promise.all([
      alpha('http://two.test/api/alpha-two'),
      beta('http://two.test/api/beta-two'),
    ]);
    await Promise.resolve();

    expect(registry.size).toBe(4);
    expect(baseFetch).not.toHaveBeenCalled();
    await advance(14);
    expect(baseFetch).not.toHaveBeenCalled();
    await advance(1);

    await expect(firstWave).resolves.toEqual([
      { url: 'http://one.test/api/alpha-one' },
      { url: 'http://one.test/api/beta-one' },
    ]);
    expect(calls).toEqual([
      'http://one.test/api/alpha-one',
      'http://one.test/api/beta-one',
    ]);
    expect(registry.size).toBe(2);

    await advance(9);
    expect(baseFetch).toHaveBeenCalledTimes(2);
    await advance(1);

    await expect(secondWave).resolves.toEqual([
      { url: 'http://two.test/api/alpha-two' },
      { url: 'http://two.test/api/beta-two' },
    ]);
    expect(calls).toEqual([
      'http://one.test/api/alpha-one',
      'http://one.test/api/beta-one',
      'http://two.test/api/alpha-two',
      'http://two.test/api/beta-two',
    ]);
    expect(registry.size).toBe(0);
  });
});
