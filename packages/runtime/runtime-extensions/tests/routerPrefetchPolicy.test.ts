import { createRouterPrefetchPolicy } from '../src/routerPrefetchPolicy';

const settle = async () => {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
};

afterEach(() => rstest.useRealTimers());

test('implements render defaults and cancels delayed intent before dispatch', async () => {
  rstest.useFakeTimers();
  const policy = createRouterPrefetchPolicy();
  const notify = rstest.fn();
  const render = policy.observe({ element: null, notify });
  expect(notify).toHaveBeenLastCalledWith({ code: true, data: true });
  render.dispose();
  const intent = policy.observe({
    element: null,
    prefetch: 'none',
    preload: 'intent',
    notify,
  });
  intent.onIntent();
  intent.onCancel();
  await rstest.advanceTimersByTimeAsync(100);
  expect(notify).toHaveBeenLastCalledWith({ code: false, data: false });
  intent.onIntent();
  await rstest.advanceTimersByTimeAsync(100);
  expect(notify).toHaveBeenLastCalledWith({ code: true, data: false });
  intent.dispose();
});

test('limits concurrent loads, removes cancelled queued keys, and retries rejected loads', async () => {
  const policy = createRouterPrefetchPolicy();
  const context = {};
  const loader = {};
  const started: number[] = [];
  const releases: (() => void)[] = [];
  const schedule = (id: number) =>
    policy.schedule({
      runtimeContext: context,
      chunkLoader: loader,
      publicPath: '/',
      key: String(id),
      run: () => {
        started.push(id);
        return new Promise<void>(resolve => releases.push(resolve));
      },
    });
  const cancellations = Array.from({ length: 6 }, (_, id) => schedule(id));
  await settle();
  expect(started).toEqual([0, 1, 2, 3]);
  cancellations[4]();
  releases[0]();
  await settle();
  expect(started).toEqual([0, 1, 2, 3, 5]);
  schedule(4);
  releases[1]();
  await settle();
  expect(started).toEqual([0, 1, 2, 3, 5, 4]);
  for (const release of releases) release();
  await settle();
  const fail = rstest.fn(() => Promise.reject(new Error('retry')));
  const options = {
    runtimeContext: context,
    chunkLoader: loader,
    publicPath: '/',
    key: 'failed',
    run: fail,
  };
  policy.schedule(options);
  await settle();
  policy.schedule(options);
  await settle();
  expect(fail).toHaveBeenCalledTimes(2);
});

test('deduplicates only within matching context, loader, public path and live TTL', async () => {
  let now = 0;
  rstest.spyOn(performance, 'now').mockImplementation(() => now);
  const policy = createRouterPrefetchPolicy();
  const run = rstest.fn(() => Promise.resolve());
  const options = {
    runtimeContext: {},
    chunkLoader: {},
    publicPath: '/',
    key: 'route',
    run,
  };
  policy.schedule(options);
  policy.schedule(options);
  await settle();
  expect(run).toHaveBeenCalledTimes(1);
  policy.schedule({ ...options, runtimeContext: {} });
  policy.schedule({ ...options, chunkLoader: {} });
  policy.schedule({ ...options, publicPath: '/other/' });
  await settle();
  expect(run).toHaveBeenCalledTimes(4);
  now = 30_001;
  policy.schedule(options);
  await settle();
  expect(run).toHaveBeenCalledTimes(5);
});
