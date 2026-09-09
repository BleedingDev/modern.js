import {
  normalizePreloadBehavior,
  resolvePreloadFromPrefetch,
} from '../src/prefetchPolicy';

const behaviors = ['intent', 'render', 'viewport', 'none'] as const;

describe('router prefetch precedence', () => {
  describe.each(behaviors)('React Router prefetch=%s', prefetch => {
    it('inherits prefetch when preload is omitted', () => {
      expect(normalizePreloadBehavior(undefined, prefetch)).toBe(prefetch);
    });

    it.each([
      ...behaviors,
      false,
    ] as const)('honors explicit preload=%s using none for disabled', preload => {
      expect(normalizePreloadBehavior(preload, prefetch)).toBe(
        preload === false ? 'none' : preload,
      );
    });
  });

  describe.each([undefined, ...behaviors])('TanStack prefetch=%s', prefetch => {
    it('inherits supported prefetch with viewport as the default', () => {
      expect(resolvePreloadFromPrefetch(prefetch, undefined)).toBe(
        prefetch === 'none' ? false : (prefetch ?? 'viewport'),
      );
    });

    it.each([
      ...behaviors,
      false,
      null,
      'custom',
      0,
    ])('passes explicit preload=%s through unchanged', preload => {
      expect(resolvePreloadFromPrefetch(prefetch, preload)).toBe(preload);
    });
  });

  it('preserves the routers different defaults', () => {
    expect(normalizePreloadBehavior(undefined, 'render')).toBe('render');
    expect(resolvePreloadFromPrefetch(undefined, undefined)).toBe('viewport');
  });

  it('preserves object identity for TanStack preload pass-through', () => {
    const preload = {};
    expect(resolvePreloadFromPrefetch('none', preload)).toBe(preload);
  });
});
