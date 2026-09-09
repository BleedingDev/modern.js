import { initHooks } from '../src/runtime/hooks';
import type { Collector, StreamSSRExtender } from '../src/types/runtime/hooks';

test('keeps old collectors and zero-argument stream factories compatible', () => {
  const hooks = initHooks<{}, { requestId: string }>();
  const collector: Collector = { effect() {} };
  const extender: StreamSSRExtender = {
    init({ rootElement, forceStream2String }) {
      expect(rootElement).toBeDefined();
      expect(typeof forceStream2String).toBe('boolean');
    },
    processStream: stream => stream,
  };
  hooks.extendStringSSRCollectors.tap(({ chunkSet, render }) => {
    const requestId: string = render.runtimeContext.requestId;
    expect(requestId).toBe('request-1');
    chunkSet.cssChunk += '<style>legacy</style>';
    return collector;
  });
  hooks.extendStreamSSR.tap(() => extender);
  const request = new Request('http://localhost/');
  const render = {
    runtimeContext: { requestId: 'request-1' },
    request,
    platform: 'node' as const,
    mode: 'string' as const,
    isRsc: false,
  };
  const chunkSet = {
    renderLevel: 0,
    ssrScripts: '',
    jsChunk: '',
    cssChunk: '',
  };
  expect(hooks.extendStringSSRCollectors.call({ chunkSet, render })).toEqual([
    collector,
  ]);
  expect(chunkSet.cssChunk).toBe('<style>legacy</style>');
  expect(
    hooks.extendStreamSSR.call({
      ...render,
      mode: 'stream',
      terminalMarker: 'shell',
    }),
  ).toEqual([extender]);
});
