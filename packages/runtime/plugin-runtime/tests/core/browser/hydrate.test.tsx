// @rstest-environment happy-dom

import { SSR_HYDRATION_ID_PREFIX } from '@modern-js/utils/universal/constants';
import { act, useId, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateWithReact } from '../../../src/core/browser/hydrate';

const App = () => {
  const id = useId();
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <label htmlFor={id}>Name</label>
      <input id={id} />
      <button onClick={() => setSubmitted(true)} type="button">
        {submitted ? 'Submitted' : 'Submit'}
      </button>
    </>
  );
};

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('React DOM hydration', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test('adopts server markup, preserves useId labels, and remains interactive', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<App />, {
      identifierPrefix: SSR_HYDRATION_ID_PREFIX,
    });
    document.body.appendChild(container);

    let root: Awaited<ReturnType<typeof hydrateWithReact>>;
    await act(async () => {
      root = await hydrateWithReact(<App />, container);
    });

    const label = container.querySelector('label');
    const input = container.querySelector('input');
    expect(label?.htmlFor).toBe(input?.id);

    await act(async () => {
      container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('button')?.textContent).toBe('Submitted');

    root!.unmount();
  });
});
