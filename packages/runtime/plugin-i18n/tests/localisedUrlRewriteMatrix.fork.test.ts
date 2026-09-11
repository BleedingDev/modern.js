// Fork-owned coverage guard (FORK-DIVERGENCE.md: "Retain native Link target
// normalization, splat separator/percent encoding and search normalization
// cases"). Keeps them out of the upstream-owned tests/link.test.tsx.
import {
  interpolateRouteParams,
  normalizeSearch,
} from '../src/runtime/linkHelpers';

describe('Link query and splat normalization', () => {
  test('encodes splat segments without escaping the path separator', () => {
    // Each segment is encoded separately, so `/` stays a path separator.
    expect(
      interpolateRouteParams('/files/*', { '*': 'resume drafts/Q1 deck.pdf' }),
    ).toBe('/files/resume%20drafts/Q1%20deck.pdf');
  });

  test('builds the Link query from object, target and empty search props', () => {
    // Array values repeat the key instead of collapsing to "boots,sale".
    expect(
      normalizeSearch({ tag: ['boots', 'sale'], page: 2 }, '?ignored=1'),
    ).toEqual({
      searchString: '?tag=boots&tag=sale&page=2',
      searchObject: { tag: ['boots', 'sale'], page: '2' },
    });
    // No search prop: the target's own query survives, arrays included.
    expect(normalizeSearch(undefined, '?tag=boots&tag=sale&page=2')).toEqual({
      searchString: '?tag=boots&tag=sale&page=2',
      searchObject: { tag: ['boots', 'sale'], page: '2' },
    });
    // An explicit empty search clears the target's query.
    expect(normalizeSearch('', '?tag=boots&tag=sale')).toEqual({
      searchString: '',
      searchObject: undefined,
    });
  });
});
