import { Api, Data, Headers, Params, Put, Query } from '@modern-js/bff-core';
import { z } from 'zod';

const getOrigin = ({ query: { id } }: { query: { id: string } }) => ({ id });

export default getOrigin;

export const DELETE = ({ data: { id } }: { data: { id: string } }) => ({ id });

export const handler = () => 'Hello Jupiter';

export const putRepo = Api(
  Put('/put-repo'),
  Data(z.object({ body: z.string() })),
  Query(z.object({ query: z.string() })),
  Params(z.object({ id: z.string() })),
  Headers(z.object({ token: z.string() })),
  async () => {
    return 'Put repo';
  },
);
