import {
  Effect,
  makeEffectHttpApiClient,
  runEffectRequest,
} from '@modern-js/bff-effect/effect-client';
import { bffCrossProjectEffectApi } from 'bff-api-app/effect-contract';
import { useEffect, useState } from 'react';

const App = () => {
  const [message, setMessage] = useState('loading');
  const [contextMessage, setContextMessage] = useState('loading');

  useEffect(() => {
    const client = makeEffectHttpApiClient(bffCrossProjectEffectApi, {
      baseUrl: '/api-app',
      requestContext: { locale: 'cs-CZ' },
      crossProject: {
        requestId: 'bff-api-app',
        operationVersion: 2,
        prefix: '/api-app',
      },
    });
    runEffectRequest(
      client.pipe(Effect.flatMap(api => api.greetings.hello({}))),
    ).then(data => {
      setMessage(`${data.runtime}:${data.message}`);
    });
    runEffectRequest(
      client.pipe(
        Effect.flatMap(api => api.greetings.traceHeader({ headers: {} })),
      ),
    ).then(data => {
      setContextMessage(
        `${data.runtime}:${data.locale ?? 'missing'}:${data.traceparent ?? 'missing'}`,
      );
    });
  }, []);

  return (
    <>
      <div className="effect">{message}</div>
      <div className="effect-context">{contextMessage}</div>
    </>
  );
};

export default App;
