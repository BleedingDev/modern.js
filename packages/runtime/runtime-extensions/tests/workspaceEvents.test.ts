import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { transformSync } from 'esbuild';
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
          message: `Invalid payload for UltraModern workspace event "${name}"`,
          eventName: name,
          payload,
        });
        // The existing public error is a data class, not an Error subclass.
        expect(error).not.toBeInstanceOf(Error);
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

  it('retains permissive records, unknown fields and undefined optional fields', () => {
    const payload = Object.assign(Object.create(null), {
      to: ' /raw ',
      state: new Date(0),
      replace: undefined,
      extension: 'consumer-owned',
    });
    expect(
      contracts.assertUltramodernWorkspaceEventPayload(
        'ultramodern:navigate',
        payload,
      ),
    ).toBe(payload);
    expect(payload.to).toBe(' /raw ');
    for (const locale of ['en', 'cs', undefined]) {
      expect(
        contracts.isUltramodernRouteSettledPayload({
          pathname: '/',
          locale,
          title: undefined,
        }),
      ).toBe(true);
    }
    expect(
      contracts.isUltramodernRemoteReadyPayload({
        appId: 'catalog',
        build: undefined,
        surface: undefined,
        version: undefined,
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
      for (const status of ['pass', 'warn', 'fail']) {
        expect(
          contracts.isUltramodernPerformanceSignalPayload({
            signalId,
            status,
            durationMs: undefined,
            detail: undefined,
          }),
        ).toBe(true);
      }
    }
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

  it('keeps event-name payload inference and compile-time rejection', () => {
    const temporaryRoot = mkdtempSync(
      path.join(tmpdir(), 'workspace-events-types-'),
    );
    try {
      const fixture = path.join(temporaryRoot, 'consumer.ts');
      writeFileSync(
        fixture,
        `
import * as c from ${JSON.stringify(path.resolve(__dirname, '../src/workspaceEvents'))};
const target = new EventTarget();
const value: unknown = { to: '/' };
if (c.isUltramodernWorkspaceEventPayload(c.ultramodernWorkspaceEventNames.navigate, value)) {
  const destination: string = value.to;
  // @ts-expect-error Navigate payload has no pathname
  value.pathname;
}
const event: CustomEvent<c.UltramodernRemoteReadyPayload> =
  c.createUltramodernWorkspaceEvent('ultramodern:remote-ready', { appId: 'catalog' });
const cleanup: () => void = c.onUltramodernPerformanceSignal(target, (payload, event) => {
  const status: c.UltramodernPerformanceReadinessSignalStatus = payload.status;
  const signal: c.UltramodernPerformanceReadinessSignalId = event.detail.signalId;
});
const dispatched: boolean = c.dispatchUltramodernRouteSettled(target, { pathname: '/', locale: 'en' });
const asserted: c.UltramodernNavigatePayload = c.assertUltramodernWorkspaceEventPayload('ultramodern:navigate', value);
// @ts-expect-error Event names are closed
c.createUltramodernWorkspaceEvent('consumer:unknown', {});
// @ts-expect-error Wrong payload for the chosen event
c.dispatchUltramodernWorkspaceEvent(target, 'ultramodern:navigate', { appId: 'catalog' });
// @ts-expect-error Unsupported locale
c.dispatchUltramodernRouteSettled(target, { pathname: '/', locale: 'de' });
// @ts-expect-error Unsupported signal status
c.dispatchUltramodernPerformanceSignal(target, { signalId: 'bfcache', status: 'ok' });
`,
      );
      const requireFromPackage = createRequire(
        path.resolve(__dirname, '../package.json'),
      );
      const compilerPackage = requireFromPackage.resolve(
        'typescript/package.json',
      );
      const metadata = JSON.parse(readFileSync(compilerPackage, 'utf8'));
      const compiler = path.resolve(
        path.dirname(compilerPackage),
        metadata.bin.tsc,
      );
      const config = path.join(temporaryRoot, 'tsconfig.json');
      writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: {
            noEmit: true,
            strict: true,
            skipLibCheck: true,
            types: [],
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
          },
          files: [fixture],
        }),
      );
      const checked = spawnSync(
        process.execPath,
        [compiler, '--project', config, '--pretty', 'false'],
        {
          cwd: temporaryRoot,
          encoding: 'utf8',
        },
      );
      expect(checked.error).toBeUndefined();
      expect({
        status: checked.status,
        output: checked.stdout + checked.stderr,
      }).toEqual({ status: 0, output: '' });
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('supports native browser targets, shadow propagation and foreign realm events', async () => {
    const requireFromBrowserFixture = createRequire(
      path.resolve(
        __dirname,
        '../../../../tests/integration/rstest/basic-app-rstest-browser/package.json',
      ),
    );
    const { chromium } = requireFromBrowserFixture('playwright');
    const source = readFileSync(
      path.resolve(__dirname, '../src/workspaceEvents.ts'),
      'utf8',
    );
    const compiled = transformSync(source, {
      loader: 'ts',
      format: 'cjs',
    }).code;
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const result = await page.evaluate((compiled: string) => {
        const module = { exports: {} };
        new Function('module', 'exports', compiled)(module, module.exports);
        const api = module.exports as typeof contracts;
        const host = document.createElement('div');
        document.body.append(host);
        const inner = document.createElement('button');
        host.attachShadow({ mode: 'open' }).append(inner);
        const payload = { to: '/shadow' };
        const seen: unknown[] = [];
        const off = api.onUltramodernNavigate(document, (detail, event) => {
          seen.push({
            same: detail === payload,
            target: event.target === host,
          });
        });
        api.dispatchUltramodernNavigate(inner, payload);
        off();
        api.dispatchUltramodernNavigate(inner, payload);
        const iframe = document.createElement('iframe');
        document.body.append(iframe);
        const foreignWindow = iframe.contentWindow as Window &
          typeof globalThis;
        const foreignEvent = new foreignWindow.CustomEvent(
          'ultramodern:navigate',
          {
            detail: payload,
          },
        );
        let foreignReceived = false;
        const offForeign = api.onUltramodernNavigate(
          document,
          (detail, event) => {
            foreignReceived = detail === payload && event === foreignEvent;
          },
        );
        document.dispatchEvent(foreignEvent);
        offForeign();
        const foreignTarget = new foreignWindow.EventTarget();
        let foreignTargetReceived = false;
        const offTarget = api.onUltramodernNavigate(foreignTarget, detail => {
          foreignTargetReceived = detail === payload;
        });
        api.dispatchUltramodernNavigate(foreignTarget, payload);
        offTarget();
        return {
          seen,
          foreignReceived,
          foreignTargetReceived,
          distinctRealm: !(foreignEvent instanceof CustomEvent),
        };
      }, compiled);
      expect(result).toEqual({
        seen: [{ same: true, target: true }],
        foreignReceived: true,
        foreignTargetReceived: true,
        distinctRealm: true,
      });
    } finally {
      await browser.close();
    }
  });
});
