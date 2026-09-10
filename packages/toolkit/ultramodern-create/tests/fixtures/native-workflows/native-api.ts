// Server-only example. A browser client imports the contract, never this module.
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  Schema,
} from '@modern-js/bff-effect/effect-client';
import {
  defineEffectBff,
  Effect,
  HttpApiBuilder,
  Layer,
} from '@modern-js/bff-effect/effect-edge';

export const catalogApi = HttpApi.make('NativeCatalog').add(
  HttpApiGroup.make('catalog').add(
    HttpApiEndpoint.get('list', '/catalog', {
      success: Schema.Struct({ items: Schema.Array(Schema.String) }),
    }),
  ),
);

const handlers = HttpApiBuilder.group(catalogApi, 'catalog', group =>
  group.handle('list', () => Effect.succeed({ items: ['plough'] })),
);
const layer = HttpApiBuilder.layer(catalogApi).pipe(Layer.provide(handlers));

export default defineEffectBff({ api: catalogApi, layer });
