import {
  BFF_LOCALE_HEADER,
  BFF_TRACEPARENT_HEADER,
  createRequestContextHeaders,
  createRequestContextSnapshot,
} from '@modern-js/runtime-extensions/request-policy/client';

describe('request context helpers', () => {
  test('should create propagation headers from explicit locale and traceparent', () => {
    expect(
      createRequestContextHeaders({
        locale: 'cs-CZ',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
    ).toEqual({
      [BFF_LOCALE_HEADER]: 'cs-CZ',
      [BFF_TRACEPARENT_HEADER]:
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
  });

  test('should derive locale and trace metadata from incoming headers', () => {
    expect(
      createRequestContextSnapshot({
        headers: {
          'accept-language': 'en-US,en;q=0.8',
          traceparent:
            '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      }),
    ).toEqual({
      headers: {
        'accept-language': 'en-US,en;q=0.8',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      locale: 'en-US,en;q=0.8',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
    });
  });

  test('should keep operation context in snapshots without widening propagation headers', () => {
    const snapshot = createRequestContextSnapshot({
      locale: 'cs-CZ',
      operationContext: {
        operationId: 'shell:list',
        routePath: '/effect/recommendations',
        method: 'GET',
        source: 'generated-client',
        scope: { workspace: 'demo' },
        sessionClaims: { role: 'viewer' },
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      },
    });

    expect(Object.keys(snapshot.headers)).toEqual([
      BFF_LOCALE_HEADER,
      BFF_TRACEPARENT_HEADER,
    ]);
    expect(snapshot.operationContext?.traceId).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(snapshot.operationContext?.spanId).toBe('bbbbbbbbbbbbbbbb');
  });
});
