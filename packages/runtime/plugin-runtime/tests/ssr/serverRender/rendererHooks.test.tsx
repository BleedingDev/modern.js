import { Transform } from 'node:stream';
import { initHooks } from '@modern-js/plugin/runtime';
import React from 'react';
import {
  getInitialContext,
  setGlobalContext,
  setGlobalInternalRuntimeContext,
} from '../../../src/core/context';
import { renderStreaming } from '../../../src/core/server/stream';
import { renderString } from '../../../src/core/server/string';

const createOptions = (onError = rs.fn()) => {
  const runtimeContext = Object.assign(getInitialContext(false), {
    initialData: {},
    __i18nData__: {},
    ssrContext: {
      request: {
        params: {},
        query: {},
        pathname: '/',
        host: 'localhost',
        url: 'http://localhost/',
        headers: {},
      },
      response: { locals: {} },
      reporter: { sessionId: 'test' },
    },
  });
  return {
    resource: {
      entryName: 'main',
      htmlTemplate: '<html><head></head><body><!--<?- html ?>--></body></html>',
      routeManifest: {},
    },
    runtimeContext,
    config: {},
    onError,
    onTiming: rs.fn(),
  } as unknown as Parameters<typeof renderString>[2];
};

const installHooks = () => {
  setGlobalContext({ enableRsc: false });
  const hooks = initHooks<{}, ReturnType<typeof getInitialContext>>();
  setGlobalInternalRuntimeContext({ hooks });
  return hooks;
};

const passthrough = () =>
  new Transform({
    transform(chunk, _encoding, callback) {
      callback(null, chunk);
    },
  });

test('string lifecycle receives original context and completes body before head/effects', async () => {
  const hooks = installHooks();
  const options = createOptions();
  const request = new Request('http://localhost/');
  const order: string[] = [];
  const App = () => {
    order.push('react');
    return <main>body</main>;
  };
  hooks.extendStringSSRCollectors.tap(({ render }) => {
    expect(render.runtimeContext).toBe(options.runtimeContext);
    expect(render.request).toBe(request);
    expect(render).toMatchObject({ mode: 'string', isRsc: false });
    order.push('factory');
    return {
      collect(root) {
        order.push('collect');
        return root;
      },
      beforeReact() {
        order.push('beforeReact');
      },
      completedBody(html, { phase }) {
        order.push(phase);
        return `${html}<p>completed</p>`;
      },
      getHeadData() {
        order.push('head');
        return {
          htmlAttributes: '',
          bodyAttributes: '',
          title: '<title>supplied</title>',
          base: '',
          link: '',
          meta: '',
          noscript: '',
          script: '',
          style: '',
        };
      },
      effect() {
        order.push('effect');
      },
      onTerminal(result) {
        order.push(result.status);
      },
    };
  });
  const html = await renderString(request, <App />, options);
  expect(html).toContain('<title>supplied</title>');
  expect(html).toContain('<main>body</main><p>completed</p>');
  expect(order).toEqual([
    'factory',
    'collect',
    'beforeReact',
    'react',
    'complete',
    'head',
    'effect',
    'complete',
  ]);
});

test('string failures notify all collectors once and retain fallback effects', async () => {
  const hooks = installHooks();
  const terminal = rs.fn();
  const effect = rs.fn();
  hooks.extendStringSSRCollectors.tap(() => ({
    beforeReact() {
      throw new Error('setup failed');
    },
    effect,
    onTerminal: terminal,
  }));
  hooks.extendStringSSRCollectors.tap(() => ({ effect, onTerminal: terminal }));
  const options = createOptions();
  const html = await renderString(
    new Request('http://localhost/'),
    <p>unused</p>,
    options,
  );
  expect(html).toBe('<html><head></head><body></body></html>');
  expect(terminal).toHaveBeenCalledTimes(2);
  expect(terminal).toHaveBeenNthCalledWith(1, {
    status: 'fallback',
    error: expect.any(Error),
  });
  expect(effect).toHaveBeenCalledTimes(2);
  expect(options.onError).toHaveBeenCalledTimes(1);
});

test('effect rejection is a terminal error after successful React output', async () => {
  const hooks = installHooks();
  const terminal = rs.fn();
  hooks.extendStringSSRCollectors.tap(() => ({
    effect() {
      throw new Error('effect failed');
    },
    onTerminal: terminal,
  }));
  await expect(
    renderString(
      new Request('http://localhost/'),
      <p>body</p>,
      createOptions(),
    ),
  ).rejects.toThrow('effect failed');
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'error',
    error: expect.any(Error),
  });
});

test('Node processes legacy transforms before body transforms and completes delivered output', async () => {
  const hooks = installHooks();
  const order: string[] = [];
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({
    streamPhase: 'body',
    processStream(source) {
      order.push('body');
      return source.pipe(passthrough());
    },
    onTerminal: terminal,
  }));
  hooks.extendStreamSSR.tap(() => ({
    processStream(source) {
      order.push('legacy');
      return source.pipe(passthrough());
    },
  }));
  const stream = await renderStreaming(
    new Request('http://localhost/'),
    <p>α🌐body</p>,
    createOptions(),
  );
  expect(terminal).not.toHaveBeenCalled();
  expect(await new Response(stream).text()).toBe(
    '<html><head></head><body><p>α🌐body</p></body></html>',
  );
  expect(order).toEqual(['legacy', 'body']);
  expect(terminal).toHaveBeenCalledExactlyOnceWith({ status: 'complete' });
});

test('Node cancellation stops a suspended render and reports one cancellation', async () => {
  const hooks = installHooks();
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({ onTerminal: terminal }));
  const never = new Promise<never>(() => {});
  const Suspend = (): never => {
    throw never;
  };
  const options = createOptions();
  const stream = await renderStreaming(
    new Request('http://localhost/'),
    <React.Suspense fallback={<p>shell</p>}>
      <Suspend />
    </React.Suspense>,
    options,
  );
  const reader = stream.getReader();
  await reader.cancel('stop');
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'cancelled',
    reason: 'stop',
  });
  expect(options.onError).not.toHaveBeenCalled();
});

test('Node stream errors reject the delivered body and report once', async () => {
  const hooks = installHooks();
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({
    processStream(source) {
      return source.pipe(
        new Transform({
          transform(_chunk, _encoding, callback) {
            callback(new Error('transform failed'));
          },
        }),
      );
    },
    onTerminal: terminal,
  }));
  const options = createOptions();
  const stream = await renderStreaming(
    new Request('http://localhost/'),
    <p>body</p>,
    options,
  );
  await expect(new Response(stream).text()).rejects.toThrow('transform failed');
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'error',
    error: expect.any(Error),
  });
  expect(options.onError).toHaveBeenCalledTimes(1);
});

test('Node cancellation after shell awaits async transform destruction', async () => {
  const hooks = installHooks();
  let release!: () => void;
  let started!: () => void;
  const destroying = new Promise<void>(resolve => {
    started = resolve;
  });
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const destroy = rs.fn((_error, callback) => {
    started();
    gate.then(() => callback());
  });
  hooks.extendStreamSSR.tap(() => ({
    processStream(source) {
      return source.pipe(
        new Transform({
          transform(chunk, _encoding, callback) {
            callback(null, chunk);
          },
          destroy,
        }),
      );
    },
  }));
  const never = new Promise<never>(() => {});
  const Suspend = (): never => {
    throw never;
  };
  const stream = await renderStreaming(
    new Request('http://localhost/'),
    <div>
      <p>shell</p>
      <React.Suspense fallback={<p>waiting</p>}>
        <Suspend />
      </React.Suspense>
    </div>,
    createOptions(),
  );
  const reader = stream.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toContain(
    '<p>shell</p>',
  );
  let settled = false;
  const cancellation = reader.cancel('stop').then(() => {
    settled = true;
  });
  await destroying;
  expect(settled).toBe(false);
  release();
  await cancellation;
  expect(destroy).toHaveBeenCalledTimes(1);
});

test('Node cancellation rejects actual transform cleanup failures', async () => {
  const hooks = installHooks();
  hooks.extendStreamSSR.tap(() => ({
    processStream(source) {
      return source.pipe(
        new Transform({
          transform(chunk, _encoding, callback) {
            callback(null, chunk);
          },
          destroy(_error, callback) {
            callback(new Error('cleanup failed'));
          },
        }),
      );
    },
  }));
  const never = new Promise<never>(() => {});
  const Suspend = (): never => {
    throw never;
  };
  const stream = await renderStreaming(
    new Request('http://localhost/'),
    <React.Suspense fallback={<p>shell</p>}>
      <Suspend />
    </React.Suspense>,
    createOptions(),
  );
  await expect(stream.cancel('stop')).rejects.toThrow('cleanup failed');
});
