import type {
  SSRAssetGroup,
  SSRAssetTransformInfo,
  SSRRenderAsset,
  SSRRenderLifecycle,
  SSRRenderTerminal,
  SSRRouterData,
  SSRTemplateChunk,
  StreamSSRExtender,
} from '@modern-js/plugin/runtime';
import type { ServerUserConfig } from '@modern-js/server-core';
import type { HandleRequestOptions } from './requestHandler';
import { attributesToString, hasStylesheetLink, safeReplace } from './utils';

export type RenderOptions = HandleRequestOptions;

export type SSRConfig = NonNullable<ServerUserConfig['ssr']>;

export type RenderStreaming = (
  request: Request,
  serverRoot: React.ReactElement,
  optinos: RenderOptions,
) => Promise<ReadableStream>;

export type RenderString = (
  request: Request,
  serverRoot: React.ReactElement,
  optinos: RenderOptions,
) => Promise<string>;

export type BuildHtmlCb = (template: string) => string | Promise<string>;

export function buildHtml(template: string, callbacks: BuildHtmlCb[]) {
  return callbacks.reduce(
    (promise, buildHtmlCb) => promise.then(template => buildHtmlCb(template)),
    Promise.resolve(template),
  );
}

export function createSSRRenderLifecycle(observers: SSRRenderLifecycle[]) {
  let terminal: SSRRenderTerminal | undefined;
  return {
    transformAssets<T extends SSRRenderAsset>(
      groups: readonly SSRAssetGroup<T>[],
      info: Omit<SSRAssetTransformInfo<T>, 'groups'>,
    ): readonly T[] {
      let assets: readonly T[] = groups.flatMap(group => group.assets);
      for (const observer of observers) {
        assets =
          observer.transformAssets?.(assets, { ...info, groups }) ?? assets;
      }
      return assets;
    },
    transformTemplateChunk(chunk: SSRTemplateChunk): SSRTemplateChunk {
      for (const observer of observers) {
        chunk =
          observer.transformTemplateChunk?.(chunk, {
            attributesToString,
            hasStylesheetLink,
          }) ?? chunk;
      }
      return chunk;
    },
    getRouterData(): SSRRouterData | undefined {
      let data: SSRRouterData | undefined;
      for (const observer of observers)
        data = observer.getRouterData?.() ?? data;
      return data;
    },
    get terminal() {
      return terminal;
    },
    beforeReact() {
      for (const observer of observers) observer.beforeReact?.();
    },
    completedBody(html: string, phase: 'complete' | 'shell') {
      for (const observer of observers) {
        html = observer.completedBody?.(html, { phase }) ?? html;
      }
      return html;
    },
    finish(result: SSRRenderTerminal) {
      if (terminal !== undefined) return;
      terminal = result;
      for (const observer of observers) {
        try {
          observer.onTerminal?.(result);
        } catch {
          // One observer cannot prevent the other render resources closing.
        }
      }
    },
  };
}

export function replaceSSRTemplateChunk(
  chunk: SSRTemplateChunk,
  lifecycle?: ReturnType<typeof createSSRRenderLifecycle>,
  options: { preserveEmpty?: boolean } = {},
): string {
  const result = lifecycle?.transformTemplateChunk(chunk) ?? chunk;
  if (options.preserveEmpty === true && result.content === '')
    return result.template;
  return safeReplace(result.template, result.placeholder, result.content);
}

export function orderSSRStreamTransforms(extenders: StreamSSRExtender[]) {
  return [
    ...extenders.filter(extender => extender.streamPhase !== 'body'),
    ...extenders.filter(extender => extender.streamPhase === 'body'),
  ];
}

export function createSSRStreamErrorReporter(
  onError: (error: unknown) => void,
) {
  let reported = false;
  return (error: unknown) => {
    if (reported) return;
    reported = true;
    try {
      onError(error);
    } catch {
      // Reporting must not leave the response stream unsettled.
    }
  };
}

/** Observe the delivered body, rather than declaring completion at allReady. */
export function observeSSRStream(
  source: ReadableStream<Uint8Array>,
  options: {
    lifecycle: ReturnType<typeof createSSRRenderLifecycle>;
    onError: (error: unknown) => void | Promise<void>;
    signal: AbortSignal;
    onCancel?: (reason: unknown) => void | Promise<void>;
    onComplete?: () => void | Promise<void>;
  },
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let ended = false;
  let cancellation: Promise<void> | undefined;
  const cleanup = () => {
    options.signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  };
  const cancel = (reason: unknown): Promise<void> => {
    if (cancellation !== undefined) return cancellation;
    if (ended) return Promise.resolve();
    ended = true;
    options.lifecycle.finish({ status: 'cancelled', reason });
    cancellation = (async () => {
      try {
        const observer = Promise.withResolvers<void>();
        try {
          observer.resolve(options.onCancel?.(reason));
        } catch (error) {
          observer.reject(error);
        }
        const results = await Promise.allSettled([
          observer.promise,
          reader.cancel(reason),
        ]);
        const rejected = results.find(result => result.status === 'rejected');
        if (rejected?.status === 'rejected') throw rejected.reason;
      } finally {
        cleanup();
      }
    })();
    return cancellation;
  };
  const onAbort = () => {
    if (ended) return;
    const reason = options.signal.reason;
    // Retain cancellation and delay the visible abort until owned resources close.
    cancel(reason).then(
      () => controller.error(reason),
      error => {
        controller.error(reason);
        return options.onError(error);
      },
    );
  };
  return new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      options.signal.addEventListener('abort', onAbort, { once: true });
      if (options.signal.aborted) onAbort();
    },
    async pull(value) {
      if (ended) {
        await cancellation;
        return;
      }
      try {
        const result = await reader.read();
        if (ended) {
          await cancellation;
          return;
        }
        if (result.done) {
          await options.onComplete?.();
          if (ended) {
            await cancellation;
            return;
          }
          ended = true;
          options.lifecycle.finish({ status: 'complete' });
          cleanup();
          value.close();
        } else {
          value.enqueue(result.value);
        }
      } catch (error) {
        if (ended) {
          await cancellation;
          return;
        }
        ended = true;
        options.lifecycle.finish({ status: 'error', error });
        try {
          await options.onError(error);
        } finally {
          cleanup();
          value.error(error);
        }
      }
    },
    cancel,
  });
}
