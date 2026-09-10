/** Server-only assembly for the invariant tail of a strict Effect BFF runtime factory. */
import * as Layer from 'effect/Layer';
import type { HttpApi, HttpApiGroup } from 'effect/unstable/httpapi';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { defineEffectBff } from './effect/handler/definition';
import type { EffectRuntimeRequirements } from './effect/handler/types';

export interface EffectBffRuntimeAssembly<
  ApiId extends string,
  Groups extends HttpApiGroup.Constraint,
  HandlerRequirements extends EffectRuntimeRequirements,
  TransportRequirements extends EffectRuntimeRequirements = never,
> {
  readonly api: HttpApi.HttpApi<ApiId, Groups>;
  readonly handlers: Layer.Layer<
    HttpApiGroup.ToService<ApiId, Groups>,
    never,
    HandlerRequirements
  >;
  readonly transport?: Layer.Layer<never, never, TransportRequirements>;
}

export const assembleEffectBffRuntime = <
  ApiId extends string,
  Groups extends HttpApiGroup.Constraint,
  HandlerRequirements extends EffectRuntimeRequirements,
  TransportRequirements extends EffectRuntimeRequirements = never,
>({
  api,
  handlers,
  transport,
}: EffectBffRuntimeAssembly<
  ApiId,
  Groups,
  HandlerRequirements,
  TransportRequirements
>) => {
  const apiLayer = HttpApiBuilder.layer(api).pipe(Layer.provide(handlers));
  const layer =
    transport === undefined ? apiLayer : apiLayer.pipe(Layer.merge(transport));

  return defineEffectBff({ api, layer });
};
