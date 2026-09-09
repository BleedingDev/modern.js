import type {
  Collector,
  RuntimePlugin,
  SSRRenderLifecycle,
  StreamSSRExtender,
} from '@modern-js/plugin/runtime';
import {
  abortHeadRender,
  beginHeadRender,
  completeHeadRender,
  createConservingWebShellStream,
  publishHeadRender,
} from '@modern-js/runtime-extensions';
import { projectRuntimeContext } from '@modern-js/runtime-extensions/context-projection';
import { createHeadRuntime } from '@modern-js/runtime-extensions/head-runtime';
import { ensureHelmetContext } from '@modern-js/runtime-extensions/helmet-context';
import React from 'react';

export type RendererHeadPluginOptions = {
  processNodeStream?: (
    source: NodeJS.ReadWriteStream,
    context: object,
    terminalMarker: string,
  ) => NodeJS.ReadWriteStream;
};

export function createRendererHeadPlugin(
  options: RendererHeadPluginOptions = {},
): RuntimePlugin<{}> {
  return {
    name: '@modern-js/runtime-renderer-extensions',
    setup(api) {
      const head = createHeadRuntime();
      api.resolveComponent((component, { name }) =>
        name === 'head.Helmet' ? head.Head : component,
      );
      api.transformRuntimeContext(projectRuntimeContext);
      api.wrapRoot(Root => {
        const HeadRoot = (props: React.ComponentProps<typeof Root>) =>
          head.wrapClientRoot(React.createElement(Root, props));
        return HeadRoot;
      });

      const createState = (runtimeContext: object) => {
        const helmetContext = ensureHelmetContext(runtimeContext);
        const lifecycle: SSRRenderLifecycle = {
          beforeReact() {
            beginHeadRender(runtimeContext);
          },
          completedBody(html, { phase }) {
            if (phase === 'complete') {
              return completeHeadRender(runtimeContext, html);
            }
            publishHeadRender(runtimeContext);
            return html;
          },
          getHeadData() {
            return helmetContext.helmet ?? undefined;
          },
          onTerminal(terminal) {
            if (terminal.status !== 'complete') abortHeadRender(runtimeContext);
          },
        };
        return {
          lifecycle,
          wrap(root: React.ReactNode) {
            return head.wrapServerRoot(root, { runtimeContext, helmetContext });
          },
        };
      };

      api.extendStringSSRCollectors(({ render }): Collector => {
        const state = createState(render.runtimeContext);
        return {
          ...state.lifecycle,
          collect: state.wrap,
          effect() {},
        };
      });
      api.extendStreamSSR((info): StreamSSRExtender => {
        const { runtimeContext, terminalMarker } = info;
        const processNodeStream = options.processNodeStream;
        if (info.platform === 'node' && processNodeStream === undefined) {
          throw new Error(
            'Node head rendering requires the Node runtime-renderer-extensions entry',
          );
        }
        const state = createState(runtimeContext);
        return {
          ...state.lifecycle,
          modifyRootElement: state.wrap,
          streamPhase: 'body',
          processStream:
            processNodeStream === undefined
              ? undefined
              : source =>
                  processNodeStream(source, runtimeContext, terminalMarker),
          processReadableStream: source =>
            createConservingWebShellStream(
              source,
              runtimeContext,
              terminalMarker,
            ),
        };
      });
    },
  };
}

export const rendererHeadPlugin = (): RuntimePlugin<{}> =>
  createRendererHeadPlugin();

export default rendererHeadPlugin;
