import { describe, expect, test } from '@rstest/core';
import {
  interpolateRouteParams,
  normalizeSearch,
} from '../src/runtime/linkHelpers';

describe('native link target normalization', () => {
  test('splat params preserve separators and percent-encode each segment', () => {
    expect(
      interpolateRouteParams('/files/*', { '*': 'resume drafts/Q1 deck.pdf' }),
    ).toBe('/files/resume%20drafts/Q1%20deck.pdf');
  });
  const searchScenarios: Array<{
    name: string;
    search: Parameters<typeof normalizeSearch>[0];
    searchFromTo: string;
    expected: ReturnType<typeof normalizeSearch>;
  }> = [
    {
      name: 'object array values are preserved',
      search: { tag: ['boots', 'sale'], page: 2 },
      searchFromTo: '?ignored=1',
      expected: {
        searchString: '?tag=boots&tag=sale&page=2',
        searchObject: { tag: ['boots', 'sale'], page: '2' },
      },
    },
    {
      name: 'target query arrays are preserved',
      search: undefined,
      searchFromTo: '?tag=boots&tag=sale&page=2',
      expected: {
        searchString: '?tag=boots&tag=sale&page=2',
        searchObject: { tag: ['boots', 'sale'], page: '2' },
      },
    },
    {
      name: 'empty search clears the target query',
      search: '',
      searchFromTo: '?tag=boots&tag=sale',
      expected: {
        searchString: '',
        searchObject: undefined,
      },
    },
  ];

  for (const scenario of searchScenarios) {
    test(`normalizes search: ${scenario.name}`, () => {
      expect(normalizeSearch(scenario.search, scenario.searchFromTo)).toEqual(
        scenario.expected,
      );
    });
  }
});
