import {
  type Effect,
  makeEffectHttpApiClient,
} from '@modern-js/bff-effect/effect-client';
import { bffCrossProjectEffectApi } from 'bff-api-app/effect-contract';

const client = makeEffectHttpApiClient(bffCrossProjectEffectApi);
type Client = Effect.Success<typeof client>;
type Greeting = Effect.Success<ReturnType<Client['greetings']['hello']>>;
const greeting: Greeting = {
  runtime: 'effect',
  message: 'inferred across package exports',
};
void greeting;
// @ts-expect-error The contract preserves literal response types.
const wrong: Greeting = { runtime: 'unknown', message: 'rejected' };
void wrong;
export function checkRequestInference(api: Client) {
  const valid = api.greetings.hello({});
  // @ts-expect-error The shared contract has no such endpoint.
  const missing = api.greetings.missing({});
  // @ts-expect-error This endpoint has no payload.
  const invalid = api.greetings.hello({ payload: { invented: true } });
  return [valid, missing, invalid];
}
