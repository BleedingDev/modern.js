import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/unstable/httpapi';
import { createHttpApiHandler } from '../src/effect';
import { makeEffectHttpApiClient } from '../src/effect-client';

class ItemMissing extends Schema.TaggedError<ItemMissing>()('ItemMissing', {
  id: Schema.String,
}) {}
const api = HttpApi.make('NativeClientApi').add(
  HttpApiGroup.make('items').add(
    HttpApiEndpoint.get('read', '/items/:id', {
      params: { id: Schema.String },
      query: { count: Schema.FiniteFromString },
      success: Schema.Struct({ id: Schema.String, count: Schema.Number }),
      error: ItemMissing.pipe(HttpApiSchema.status(404)),
    }),
    HttpApiEndpoint.post('create', '/items', {
      payload: Schema.Struct({ title: Schema.String }),
      success: Schema.Struct({ title: Schema.String }),
    }),
  ),
);
const handlers = HttpApiBuilder.group(api, 'items', handlers =>
  handlers
    .handle('read', ({ params, query }) =>
      params.id === 'missing'
        ? Effect.fail(new ItemMissing({ id: params.id }))
        : Effect.succeed({ id: params.id, count: query.count }),
    )
    .handle('create', ({ payload }) => Effect.succeed(payload)),
);

test('native HttpApi clients encode requests and decode responses and declared errors from the shared contract', async () => {
  const server = createHttpApiHandler({
    api,
    layer: HttpApiBuilder.layer(api).pipe(Layer.provide(handlers)),
  });
  const requests: Request[] = [];
  const transport = rstest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      return server.handler(request);
    });
  try {
    const client = await Effect.runPromise(
      makeEffectHttpApiClient(api, {
        baseUrl: 'http://localhost',
        requestContext: { locale: 'cs' },
      }),
    );
    await expect(
      Effect.runPromise(
        client.items.read({ params: { id: '42' }, query: { count: 3 } }),
      ),
    ).resolves.toEqual({ id: '42', count: 3 });
    expect(new URL(requests[0]!.url).searchParams.get('count')).toBe('3');
    expect(requests[0]!.headers.get('accept-language')).toBe('cs');
    await expect(
      Effect.runPromise(client.items.create({ payload: { title: 'native' } })),
    ).resolves.toEqual({ title: 'native' });
    const error = await Effect.runPromise(
      client.items
        .read({ params: { id: 'missing' }, query: { count: 1 } })
        .pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(ItemMissing);
    expect(error).toMatchObject({ _tag: 'ItemMissing', id: 'missing' });
    transport.mockResolvedValueOnce(
      Response.json({ id: 42, count: 'invalid' }),
    );
    const invalid = await Effect.runPromise(
      client.items
        .read({ params: { id: '42' }, query: { count: 1 } })
        .pipe(Effect.flip),
    );
    expect(invalid._tag).toBe('SchemaError');
  } finally {
    transport.mockRestore();
    await server.dispose();
  }
});
