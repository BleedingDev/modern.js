export type HandleRequestConfig = Record<string, any>;
export type ChunkSet = {
  renderLevel: any;
  ssrScripts: string;
  jsChunk: string;
  cssChunk: string;
};
export type SSRRenderInfo<RuntimeContext = object> = {
  /** The original request context, before public or RSC projection. */
  runtimeContext: RuntimeContext;
  request: Request;
  platform: 'node' | 'web';
  mode: 'string' | 'stream';
  isRsc: boolean;
};

export type SSRHeadPart = { toString(): string };
export type SSRHeadData = Record<
  | 'htmlAttributes'
  | 'bodyAttributes'
  | 'title'
  | 'base'
  | 'link'
  | 'meta'
  | 'noscript'
  | 'script'
  | 'style',
  SSRHeadPart
> & { priority?: SSRHeadPart };

export type SSRRenderTerminal =
  | { status: 'complete' }
  | { status: 'fallback'; error: unknown }
  | { status: 'error'; error: unknown }
  | { status: 'cancelled'; reason: unknown };

export interface SSRRenderLifecycle {
  beforeReact?: () => void;
  /** Runs before the completed body or shell's head data is read. */
  completedBody?: (
    html: string,
    info: { phase: 'complete' | 'shell' },
  ) => string;
  getHeadData?: () => SSRHeadData | undefined;
  /** Exactly one notification for this render attempt. */
  onTerminal?: (terminal: SSRRenderTerminal) => void;
}

export type Collector = SSRRenderLifecycle & {
  collect?: (component: React.ReactElement) => React.ReactElement;
  effect: () => void | Promise<void>;
};

import type React from 'react';
import type { AsyncInterruptHook, CollectSyncHook, SyncHook } from '../hooks';

export type OnBeforeRenderFn<RuntimeContext> = (
  context: RuntimeContext,
  interrupt: (info: any) => any,
) => Promise<any> | any;

export type ExtendStringSSRCollectorsFn<RuntimeContext> = (
  context: RuntimeContext,
) => Collector;

export type StringSSRCollectorsInfo<RuntimeContext = object> = {
  chunkSet: ChunkSet;
  render: SSRRenderInfo<RuntimeContext>;
};

export type StreamSSRInfo<RuntimeContext = object> =
  SSRRenderInfo<RuntimeContext> & { terminalMarker: string };

export interface StreamSSRExtender extends SSRRenderLifecycle {
  init?: (params: {
    rootElement: React.ReactElement;
    forceStream2String: boolean;
  }) => void;

  modifyRootElement?: (rootElement: React.ReactElement) => React.ReactElement;

  getStyleTags?: () => string;

  processStream?: (stream: NodeJS.ReadWriteStream) => NodeJS.ReadWriteStream;

  processReadableStream?: (
    stream: ReadableStream<Uint8Array>,
  ) => ReadableStream<Uint8Array>;

  /** Body transforms run after all render transforms, preserving order in each phase. */
  streamPhase?: 'render' | 'body';
}

export type ExtendStreamSSRFn<RuntimeContext = object> = (
  info: StreamSSRInfo<RuntimeContext>,
) => StreamSSRExtender;

export type WrapRootFn = (
  root: React.ComponentType<any>,
) => React.ComponentType<any>;

export type ResolveComponentFn = (
  component: React.ComponentType<any>,
  options: { name: string },
) => React.ComponentType<any>;

export type PickContextFn<RuntimeContext> = (
  context: RuntimeContext,
) => RuntimeContext;

export type RuntimeContextProjection<RuntimeContext> = {
  internalContext: RuntimeContext;
  publicContext: RuntimeContext;
};

export type TransformRuntimeContextFn<RuntimeContext> = (
  projection: RuntimeContextProjection<RuntimeContext>,
  options: {
    /** Original request context, unchanged across callbacks in the pipeline. */
    context: RuntimeContext;
    /** Whether the application's RSC mode is enabled. */
    isRsc: boolean;
  },
) => RuntimeContextProjection<RuntimeContext>;

export type ConfigFn<RuntimeConfig> = () => RuntimeConfig;

export type Hooks<RuntimeConfig, RuntimeContext> = {
  onBeforeRender: AsyncInterruptHook<OnBeforeRenderFn<RuntimeContext>>;
  wrapRoot: SyncHook<WrapRootFn>;
  resolveComponent: SyncHook<ResolveComponentFn>;
  pickContext: SyncHook<PickContextFn<RuntimeContext>>;
  transformRuntimeContext: SyncHook<TransformRuntimeContextFn<RuntimeContext>>;
  config: CollectSyncHook<ConfigFn<RuntimeConfig>>;
  extendStringSSRCollectors: CollectSyncHook<
    ExtendStringSSRCollectorsFn<StringSSRCollectorsInfo<RuntimeContext>>
  >;
  extendStreamSSR: CollectSyncHook<ExtendStreamSSRFn<RuntimeContext>>;
};
