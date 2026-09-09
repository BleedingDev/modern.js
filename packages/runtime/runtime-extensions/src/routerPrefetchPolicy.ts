import { getNavigationWarmupCacheKey } from './navigationWarmup';
import { normalizePreloadBehavior } from './prefetchPolicy';

type PrefetchBehavior = 'intent' | 'render' | 'viewport' | 'none';
type PrefetchState = { code: boolean; data: boolean };

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

type WarmupTask = {
  key: string;
  run: () => Promise<unknown>;
  cancelled: boolean;
};

const INTENT_DELAY = 100;
const VIEWPORT_ROOT_MARGIN = '200px';
const MAX_CONCURRENT_WARMUPS = 4;
const WARMUP_TTL = 30_000;

/** Policy-only contract: native links supply elements, route inputs and loads. */
export function createRouterPrefetchPolicy() {
  const cache = new Map<string, number>();
  const queue: WarmupTask[] = [];
  let activeWarmups = 0;

  const canWarmup = () => {
    const navigator = globalThis.navigator as
      | (Navigator & {
          connection?: NetworkInformationLike;
          mozConnection?: NetworkInformationLike;
          webkitConnection?: NetworkInformationLike;
        })
      | undefined;
    const connection =
      navigator?.connection ||
      navigator?.mozConnection ||
      navigator?.webkitConnection;
    return (
      !connection?.saveData &&
      connection?.effectiveType !== 'slow-2g' &&
      connection?.effectiveType !== '2g'
    );
  };

  const runNext = () => {
    while (activeWarmups < MAX_CONCURRENT_WARMUPS && queue.length > 0) {
      const task = queue.shift()!;
      if (task.cancelled) {
        continue;
      }
      activeWarmups += 1;
      task
        .run()
        .catch(() => {
          cache.delete(task.key);
        })
        .finally(() => {
          activeWarmups -= 1;
          runNext();
        });
    }
  };

  return {
    canWarmup,
    allowData(route: unknown) {
      return (
        (route as { handle?: { navigationWarmup?: { data?: boolean } } })
          ?.handle?.navigationWarmup?.data !== false
      );
    },
    observe({
      element,
      prefetch: inputPrefetch,
      preload: inputPreload,
      notify,
    }: {
      element: HTMLAnchorElement | null;
      prefetch?: PrefetchBehavior;
      preload?: PrefetchBehavior | false;
      notify: (state: PrefetchState) => void;
    }) {
      const prefetch = inputPrefetch ?? 'render';
      const preload = normalizePreloadBehavior(inputPreload, prefetch);
      let state: PrefetchState = {
        code: prefetch === 'render' || preload === 'render',
        data: prefetch === 'render',
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      let observer: IntersectionObserver | undefined;
      const update = (next: PrefetchState) => {
        state = next;
        notify(state);
      };
      const cancelTimer = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      };
      notify(state);

      if (
        element &&
        (prefetch === 'viewport' || preload === 'viewport') &&
        typeof IntersectionObserver !== 'undefined'
      ) {
        observer = new IntersectionObserver(
          entries => {
            if (!entries.some(entry => entry.isIntersecting)) {
              return;
            }
            update({
              code: true,
              data: state.data || prefetch === 'viewport',
            });
            observer?.disconnect();
          },
          { rootMargin: VIEWPORT_ROOT_MARGIN },
        );
        observer.observe(element);
      }

      return {
        onIntent() {
          if (prefetch !== 'intent' && preload !== 'intent') {
            return;
          }
          if (timer !== undefined) {
            return;
          }
          timer = setTimeout(() => {
            timer = undefined;
            update({ code: true, data: state.data || prefetch === 'intent' });
          }, INTENT_DELAY);
        },
        onCancel() {
          if (prefetch === 'intent' || preload === 'intent') {
            cancelTimer();
            update({ code: false, data: false });
          }
        },
        dispose() {
          cancelTimer();
          observer?.disconnect();
        },
      };
    },
    schedule({
      runtimeContext,
      chunkLoader,
      publicPath,
      key: operationKey,
      run,
    }: {
      runtimeContext: object;
      chunkLoader: object;
      publicPath: string;
      key: string;
      run: () => Promise<unknown>;
    }) {
      if (!canWarmup()) {
        return () => {};
      }
      const now = performance.now();
      for (const [key, timestamp] of cache) {
        if (now - timestamp > WARMUP_TTL) {
          cache.delete(key);
        }
      }
      const key = getNavigationWarmupCacheKey(
        runtimeContext,
        chunkLoader,
        publicPath,
        operationKey,
      );
      if (cache.has(key)) {
        return () => {};
      }
      cache.set(key, now);
      const task: WarmupTask = { key, run, cancelled: false };
      queue.push(task);
      runNext();
      return () => {
        task.cancelled = true;
        if (queue.includes(task)) {
          cache.delete(key);
        }
      };
    },
  };
}
