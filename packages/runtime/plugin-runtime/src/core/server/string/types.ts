import type { RenderLevel } from '../../constants';

export type { Collector } from '@modern-js/plugin/runtime';

export type ChunkSet = {
  renderLevel: RenderLevel;
  ssrScripts: string;
  jsChunk: string;
  cssChunk: string;
};
