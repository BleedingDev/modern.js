import {
  Effect,
  makeEffectHttpApiClient,
  runEffectRequest,
} from '@modern-js/bff-effect/effect-client';
import { useEffect, useState } from 'react';
import { bffEffectApi } from '../../../shared/effect-api';

export default function CustomSdkPage() {
  const [message, setMessage] = useState('pending');
  useEffect(() => {
    runEffectRequest(
      makeEffectHttpApiClient(bffEffectApi, {
        baseUrl: '/bff-api',
        transformResponse: response =>
          response.pipe(
            Effect.map(() => ({
              message: 'Hello Effect Custom SDK',
              runtime: 'effect' as const,
            })),
          ),
      }).pipe(Effect.flatMap(client => client.greetings.hello({}))),
    ).then(data => setMessage(data.message));
  }, []);
  return <div className="custom-sdk-message">{message}</div>;
}
