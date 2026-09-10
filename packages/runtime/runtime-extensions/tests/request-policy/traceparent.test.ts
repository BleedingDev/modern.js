import { parseTraceparent } from '@modern-js/runtime-extensions/request-context';

describe('parseTraceparent', () => {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  const spanId = '00f067aa0ba902b7';

  test.each([
    ['01', true],
    ['00', false],
  ])('parses a valid traceparent with flags %s', (flags, sampled) => {
    expect(parseTraceparent(`00-${traceId}-${spanId}-${flags}`)).toEqual({
      traceId,
      spanId,
      sampled,
    });
  });

  test('lowercases mixed-case ids and trims surrounding whitespace', () => {
    expect(
      parseTraceparent(
        `  00-${traceId.toUpperCase()}-${spanId.toUpperCase()}-01  `,
      ),
    ).toEqual({
      traceId,
      spanId,
      sampled: true,
    });
  });

  test('reads the sampled bit from arbitrary flag values', () => {
    expect(parseTraceparent(`00-${traceId}-${spanId}-03`)?.sampled).toBe(true);
    expect(parseTraceparent(`00-${traceId}-${spanId}-02`)?.sampled).toBe(false);
  });

  test('rejects missing, empty, and malformed headers', () => {
    expect(parseTraceparent(undefined)).toBeUndefined();
    expect(parseTraceparent(null)).toBeUndefined();
    expect(parseTraceparent('')).toBeUndefined();
    expect(parseTraceparent('not-a-traceparent')).toBeUndefined();
    expect(parseTraceparent(`00-${traceId}-${spanId}`)).toBeUndefined();
    expect(parseTraceparent(`01-${traceId}-${spanId}-01`)).toBeUndefined();
    expect(
      parseTraceparent(`00-${traceId.slice(1)}-${spanId}-01`),
    ).toBeUndefined();
  });

  test('rejects all-zero trace and span ids per the W3C spec', () => {
    expect(
      parseTraceparent(`00-${'0'.repeat(32)}-${spanId}-01`),
    ).toBeUndefined();
    expect(
      parseTraceparent(`00-${traceId}-${'0'.repeat(16)}-01`),
    ).toBeUndefined();
  });
});
