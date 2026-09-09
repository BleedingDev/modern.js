import { initHooks } from '@modern-js/plugin/runtime';
import { storage } from '@modern-js/runtime-utils/node';
import React from 'react';
import { JSX_SHELL_STREAM_END_MARK } from '../../../src/common';
import {
  getInitialContext,
  setGlobalContext,
  setGlobalInternalRuntimeContext,
} from '../../../src/core/context';
import { createReadableStreamFromElement } from '../../../src/core/server/stream/createReadableStream.worker';

const install = () => {
  setGlobalContext({ enableRsc: false });
  const hooks = initHooks<{}, ReturnType<typeof getInitialContext>>();
  setGlobalInternalRuntimeContext({ hooks });
  return hooks;
};
const options = () =>
  ({
    runtimeContext: Object.assign(getInitialContext(false), {
      initialData: {},
      __i18nData__: {},
      ssrContext: { request: { headers: {} }, reporter: {} },
    }),
    htmlTemplate: '<html><head></head><body><!--<?- html ?>--></body></html>',
    config: {},
    ssrConfig: {},
    entryName: 'main',
    onError: rs.fn(),
  }) as unknown as Parameters<typeof createReadableStreamFromElement>[2];
const render = (
  root: React.ReactElement,
  opts = options(),
  request = new Request('http://localhost/'),
) =>
  storage.run({}, () => createReadableStreamFromElement(request, root, opts));

test('worker orders transforms and preserves split UTF-8 shell/tail until delivered EOF', async () => {
  const hooks = install();
  const terminal = rs.fn();
  const order: string[] = [];
  const opts = options();
  hooks.extendStreamSSR.tap(info => {
    expect(info.runtimeContext).toBe(opts.runtimeContext);
    expect(info.platform).toBe('web');
    return {
      streamPhase: 'body',
      modifyRootElement(root) {
        order.push('wrap');
        return root;
      },
      beforeReact() {
        order.push('before');
      },
      processReadableStream(source) {
        order.push('body');
        return source;
      },
      onTerminal: terminal,
    };
  });
  hooks.extendStreamSSR.tap(() => ({
    processReadableStream(source) {
      order.push('legacy');
      return source.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            for (const byte of chunk) controller.enqueue(Uint8Array.of(byte));
          },
        }),
      );
    },
  }));
  const stream = await render(
    <>
      <p>α🌐</p>
      {`${JSX_SHELL_STREAM_END_MARK}尾`}
    </>,
    opts,
  );
  expect(terminal).not.toHaveBeenCalled();
  expect(await new Response(stream).text()).toBe(
    '<html><head></head><body><p>α🌐</p></body></html>尾',
  );
  expect(order).toEqual(['wrap', 'before', 'legacy', 'body']);
  expect(terminal).toHaveBeenCalledExactlyOnceWith({ status: 'complete' });
});

test('worker cancellation awaits source teardown and reports cancellation once', async () => {
  const hooks = install();
  const terminal = rs.fn();
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const cancelling = new Promise<void>(resolve => {
    started = resolve;
  });
  const cancel = rs.fn();
  hooks.extendStreamSSR.tap(() => ({
    onTerminal: terminal,
    processReadableStream(source) {
      const reader = source.getReader();
      return new ReadableStream({
        async pull(controller) {
          const result = await reader.read();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        },
        async cancel(reason) {
          cancel(reason);
          started();
          await reader.cancel(reason);
          await gate;
        },
      });
    },
  }));
  const never = new Promise<never>(() => {});
  const Suspend = (): never => {
    throw never;
  };
  const opts = options();
  const stream = await render(
    <>
      <React.Suspense fallback={<p>shell</p>}>
        <Suspend />
      </React.Suspense>
      {JSX_SHELL_STREAM_END_MARK}
    </>,
    opts,
  );
  let settled = false;
  const cancellation = stream.cancel('stop').then(() => {
    settled = true;
  });
  await cancelling;
  expect(settled).toBe(false);
  release();
  await cancellation;
  expect(cancel).toHaveBeenCalledExactlyOnceWith('stop');
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'cancelled',
    reason: 'stop',
  });
  expect(opts.onError).not.toHaveBeenCalled();
});

test('worker missing marker is a delivered stream error reported once', async () => {
  const hooks = install();
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({ onTerminal: terminal }));
  const opts = options();
  const stream = await render(<p>incomplete</p>, opts);
  await expect(new Response(stream).text()).rejects.toThrow(
    'ended before the shell marker',
  );
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'error',
    error: expect.any(Error),
  });
  expect(opts.onError).toHaveBeenCalledTimes(1);
});

test('worker setup failure selects fallback and cleans observers once', async () => {
  const hooks = install();
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({
    beforeReact() {
      throw new Error('setup failed');
    },
    onTerminal: terminal,
  }));
  const opts = options();
  const stream = await render(<p>unused</p>, opts);
  expect(await new Response(stream).text()).toBe(
    '<html><head></head><body></body></html>',
  );
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'fallback',
    error: expect.any(Error),
  });
  expect(opts.onError).toHaveBeenCalledTimes(1);
});

test('request abort settles the real worker body as one cancellation', async () => {
  const hooks = install();
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({ onTerminal: terminal }));
  const never = new Promise<never>(() => {});
  const Suspend = (): never => {
    throw never;
  };
  const abort = new AbortController();
  const opts = options();
  const stream = await render(
    <>
      <React.Suspense fallback={<p>shell</p>}>
        <Suspend />
      </React.Suspense>
      {JSX_SHELL_STREAM_END_MARK}
    </>,
    opts,
    new Request('http://localhost/', { signal: abort.signal }),
  );
  const failure = new Error('request stopped');
  abort.abort(failure);
  await expect(new Response(stream).text()).rejects.toBe(failure);
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'cancelled',
    reason: failure,
  });
  expect(opts.onError).not.toHaveBeenCalled();
});

test('worker transform errors reject delivered output and report once', async () => {
  const hooks = install();
  const terminal = rs.fn();
  hooks.extendStreamSSR.tap(() => ({
    onTerminal: terminal,
    processReadableStream(source) {
      return source.pipeThrough(
        new TransformStream({
          transform() {
            throw new Error('transform failed');
          },
        }),
      );
    },
  }));
  const opts = options();
  const stream = await render(
    <>
      <p>body</p>
      {JSX_SHELL_STREAM_END_MARK}
    </>,
    opts,
  );
  await expect(new Response(stream).text()).rejects.toThrow('transform failed');
  expect(terminal).toHaveBeenCalledExactlyOnceWith({
    status: 'error',
    error: expect.any(Error),
  });
  expect(opts.onError).toHaveBeenCalledTimes(1);
});
