import { createNodeHeadMarkerStripper } from '@modern-js/runtime-extensions/node';
import { createRendererHeadPlugin } from './runtimePlugin';

export {
  createRendererHeadPlugin,
  type RendererHeadPluginOptions,
} from './runtimePlugin';

export const rendererHeadPlugin = () =>
  createRendererHeadPlugin({
    processNodeStream(source, context, terminalMarker) {
      return source.pipe(createNodeHeadMarkerStripper(context, terminalMarker));
    },
  });

export default rendererHeadPlugin;
