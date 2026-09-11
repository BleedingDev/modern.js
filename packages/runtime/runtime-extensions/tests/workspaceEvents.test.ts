import * as contracts from '../src/workspaceEvents';

const cases = [
  {
    name: 'ultramodern:navigate',
    valid: { to: '/dashboard', replace: false, state: { from: 'shell' } },
    invalid: [
      {},
      { to: '' },
      { to: '  ' },
      { to: 42 },
      { to: '/', replace: 'false' },
      { to: '/', state: [] },
      { to: '/', state: null },
    ],
    validate: contracts.isUltramodernNavigatePayload,
    dispatch: contracts.dispatchUltramodernNavigate,
    on: contracts.onUltramodernNavigate,
  },
  {
    name: 'ultramodern:route-settled',
    valid: { pathname: '/cs', locale: 'cs', title: 'Home' },
    invalid: [
      {},
      { pathname: ' ' },
      { pathname: '/', locale: 'de' },
      { pathname: '/', locale: null },
      { pathname: '/', title: '' },
      { pathname: '/', title: 42 },
    ],
    validate: contracts.isUltramodernRouteSettledPayload,
    dispatch: contracts.dispatchUltramodernRouteSettled,
    on: contracts.onUltramodernRouteSettled,
  },
  {
    name: 'ultramodern:remote-ready',
    valid: { appId: 'catalog', build: 'a', surface: 'ui', version: '1' },
    invalid: [
      {},
      { appId: 42 },
      { appId: ' ' },
      { appId: 'catalog', build: '' },
      { appId: 'catalog', surface: null },
      { appId: 'catalog', version: 1 },
    ],
    validate: contracts.isUltramodernRemoteReadyPayload,
    dispatch: contracts.dispatchUltramodernRemoteReady,
    on: contracts.onUltramodernRemoteReady,
  },
  {
    name: 'ultramodern:performance-signal',
    valid: {
      signalId: 'bfcache',
      status: 'pass',
      durationMs: 0,
      detail: { source: 'browser' },
    },
    invalid: [
      {},
      { signalId: 'unknown', status: 'pass' },
      { signalId: 'bfcache', status: 'unknown' },
      ...[-1, Number.NaN, Number.POSITIVE_INFINITY, '1', null].map(
        durationMs => ({ signalId: 'bfcache', status: 'pass', durationMs }),
      ),
      { signalId: 'bfcache', status: 'pass', detail: [] },
      { signalId: 'bfcache', status: 'pass', detail: null },
    ],
    validate: contracts.isUltramodernPerformanceSignalPayload,
    dispatch: contracts.dispatchUltramodernPerformanceSignal,
    on: contracts.onUltramodernPerformanceSignal,
  },
] as const;

describe('workspace event contracts', () => {
  for (const { name, valid, invalid, validate, dispatch, on } of cases) {
    it(`${name} preserves schema validation and error data`, () => {
      expect(validate(valid)).toBe(true);
      expect(
        contracts.assertUltramodernWorkspaceEventPayload(name, valid),
      ).toBe(valid);
      for (const payload of [null, undefined, [], false, 'text', ...invalid]) {
        expect(validate(payload)).toBe(false);
        expect(
          contracts.isUltramodernWorkspaceEventPayload(name, payload),
        ).toBe(false);
        let error: unknown;
        try {
          contracts.assertUltramodernWorkspaceEventPayload(name, payload);
        } catch (caught) {
          error = caught;
        }
        expect(error).toBeInstanceOf(
          contracts.UltramodernWorkspaceEventValidationError,
        );
        expect(error).toMatchObject({
          name: 'UltramodernWorkspaceEventValidationError',
          eventName: name,
          payload,
        });
      }
    });

    it(`${name} uses native dispatch, preserves payload identity and cleans up`, () => {
      const target = new EventTarget();
      const received: unknown[] = [];
      const handler = (payload: unknown, event: CustomEvent<unknown>) => {
        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe(name);
        expect(event.bubbles).toBe(true);
        expect(event.composed).toBe(true);
        expect(event.cancelable).toBe(false);
        expect(event.target).toBe(target);
        expect(event.detail).toBe(payload);
        received.push(payload);
      };
      const unsubscribe = on(target, handler);
      // Each table row correlates the convenience dispatch with its own schema.
      const dispatchPayload = dispatch as (
        target: EventTarget,
        payload: typeof valid,
      ) => boolean;
      expect(dispatchPayload(target, valid)).toBe(true);
      expect(received).toEqual([valid]);
      expect(received[0]).toBe(valid);
      unsubscribe();
      unsubscribe();
      dispatchPayload(target, valid);
      expect(received).toEqual([valid]);
    });
  }

  it('accepts consumer-owned fields, explicit undefined optionals and every signal id', () => {
    const payload = {
      to: '/raw',
      replace: undefined,
      state: undefined,
      extension: 'consumer-owned',
    };
    expect(
      contracts.assertUltramodernWorkspaceEventPayload(
        'ultramodern:navigate',
        payload,
      ),
    ).toBe(payload);
    expect(
      contracts.isUltramodernRouteSettledPayload({
        pathname: '/',
        locale: undefined,
        title: undefined,
      }),
    ).toBe(true);
    for (const signalId of [
      'bfcache',
      'core-web-vitals-rum',
      'duplicate-prefetch-warmup',
      'cache-policy-sanity',
      'save-data-behavior',
      'cloudflare-ssr-cache-hints',
    ]) {
      expect(
        contracts.isUltramodernPerformanceSignalPayload({
          signalId,
          status: 'warn',
        }),
      ).toBe(true);
    }
  });

  it('accepts detail-carrying events from another realm', () => {
    const target = new EventTarget();
    const add = rstest.spyOn(target, 'addEventListener');
    const handler = rstest.fn();
    const unsubscribe = contracts.onUltramodernNavigate(target, handler);
    const listener = add.mock.calls[0]?.[1] as EventListener;
    // A CustomEvent from an iframe/foreign realm fails `instanceof`; the
    // listener must duck-type on `detail` instead of rejecting it.
    const payload = { to: '/foreign' };
    listener({ type: 'ultramodern:navigate', detail: payload } as never);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBe(payload);
    unsubscribe();
    add.mockRestore();
  });

  it('rejects invalid dispatch before notifying listeners', () => {
    const target = new EventTarget();
    const handler = rstest.fn();
    const unsubscribe = contracts.onUltramodernNavigate(target, handler);
    expect(() =>
      contracts.dispatchUltramodernNavigate(target, { to: '' }),
    ).toThrow();
    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('validates incoming event details and removes only its own listener', () => {
    const target = new EventTarget();
    const add = rstest.spyOn(target, 'addEventListener');
    const remove = rstest.spyOn(target, 'removeEventListener');
    const handler = rstest.fn();
    const first = contracts.onUltramodernNavigate(target, handler);
    const listener = add.mock.calls[0]?.[1] as EventListener;
    for (const event of [
      new Event('ultramodern:navigate'),
      new CustomEvent('ultramodern:navigate', { detail: { to: '' } }),
    ]) {
      // Native dispatch reports listener errors asynchronously; invoke the
      // registered listener directly to inspect the precise validation failure.
      expect(() => listener(event)).toThrow();
    }
    expect(handler).not.toHaveBeenCalled();
    const second = contracts.onUltramodernNavigate(target, handler);
    first();
    expect(remove).toHaveBeenCalledWith('ultramodern:navigate', listener);
    contracts.dispatchUltramodernNavigate(target, { to: '/still-subscribed' });
    expect(handler).toHaveBeenCalledTimes(1);
    second();
    add.mockRestore();
    remove.mockRestore();
  });
});
