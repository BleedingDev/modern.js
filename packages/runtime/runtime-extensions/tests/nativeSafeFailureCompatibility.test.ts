import {
  createSafeFailureHttpResult,
  createSafeJsonFailureResponse,
} from '../src/safeFailure';

describe('native safe failure contract compatibility', () => {
  it('should create safe JSON failure envelopes without leaking raw messages', async () => {
    const result = createSafeFailureHttpResult(
      new Error('database password leaked in stack'),
    );

    expect(result).toEqual({
      status: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Server Error',
          status: 500,
        },
      },
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });

    const response = createSafeJsonFailureResponse(
      new Error('database password leaked in stack'),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual(result.body);
  });

  it('should preserve service unavailable status and Retry-After metadata', () => {
    const error = Object.assign(new Error('maintenance window details'), {
      status: 503,
      retryAfterSeconds: 120,
    });

    expect(createSafeFailureHttpResult(error)).toEqual({
      status: 503,
      body: {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service Unavailable',
          status: 503,
        },
      },
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Retry-After': '120',
      },
    });
  });

  it.each([
    ['delay-seconds text', '120', '120'],
    [
      'the largest safely serializable delay',
      Number.MAX_SAFE_INTEGER,
      String(Number.MAX_SAFE_INTEGER),
    ],
    [
      'an HTTP-date string',
      'Sun, 30 Aug 2026 20:00:00 GMT',
      'Sun, 30 Aug 2026 20:00:00 GMT',
    ],
    [
      'a Date instance',
      new Date(Date.UTC(2026, 7, 30, 20, 0, 0)),
      'Sun, 30 Aug 2026 20:00:00 GMT',
    ],
  ])('should preserve %s in Retry-After', (_, retryAfter, expected) => {
    const result = createSafeFailureHttpResult({
      status: 503,
      retryAfter,
    });

    expect(result.headers['Retry-After']).toBe(expected);
  });

  it.each([
    ['a header-injection payload', '120\r\nX-Injected: true'],
    ['a non-numeric delay', 'after maintenance'],
    ['a delay too large for integer serialization', 1e21],
    ['an invalid HTTP date', 'Wed, 99 Jun 2026 25:61:61 GMT'],
    ['an invalid Date object', new Date(Number.NaN)],
  ])('should ignore %s in Retry-After without throwing', (_, retryAfter) => {
    const error = Object.assign(new Error('maintenance window details'), {
      status: 503,
      retryAfter,
    });

    expect(createSafeFailureHttpResult(error)).toEqual({
      status: 503,
      body: {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service Unavailable',
          status: 503,
        },
      },
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
    expect(() => createSafeJsonFailureResponse(error)).not.toThrow();
  });

  it('should clamp invalid thrown status values to 500', () => {
    expect(createSafeFailureHttpResult({ status: 200 }).status).toBe(500);
    expect(createSafeFailureHttpResult({ statusCode: 799 }).status).toBe(500);
  });
});
