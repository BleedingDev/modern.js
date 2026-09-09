type PrefetchBehavior = 'intent' | 'render' | 'viewport' | 'none';

export function resolvePreloadFromPrefetch(
  prefetch: PrefetchBehavior | undefined,
  preload: unknown,
) {
  if (typeof preload !== 'undefined') {
    return preload;
  }

  if (prefetch === 'none') {
    return false;
  }

  if (
    prefetch === 'intent' ||
    prefetch === 'render' ||
    prefetch === 'viewport'
  ) {
    return prefetch;
  }

  return 'viewport';
}

// React Router supplies its render default before calling this adapter.
export function normalizePreloadBehavior(
  preload: PrefetchBehavior | false | undefined,
  prefetch: PrefetchBehavior,
): PrefetchBehavior {
  const resolved = resolvePreloadFromPrefetch(prefetch, preload);
  return resolved === false ? 'none' : (resolved as PrefetchBehavior);
}
