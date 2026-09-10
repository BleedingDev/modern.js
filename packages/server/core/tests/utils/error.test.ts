// @rstest-environment happy-dom

import { createErrorHtml } from '../../src/utils';

describe('test utils.error', () => {
  it.each([
    {
      status: 404,
      title: '404: This page could not be found.',
      message: 'This page could not be found.',
    },
    {
      status: 500,
      title: '500: Internal Server Error.',
      message: 'Internal Server Error.',
    },
  ])('should create an accessible, viewport-centered $status error document', ({
    status,
    title,
    message,
  }) => {
    const errorDocument = new DOMParser().parseFromString(
      createErrorHtml(status),
      'text/html',
    );

    expect(errorDocument.documentElement.lang).toBe('en');
    expect(errorDocument.characterSet).toBe('utf-8');
    expect(
      errorDocument
        .querySelector('meta[name="viewport"]')
        ?.getAttribute('content'),
    ).toBe('width=device-width');
    expect(errorDocument.title).toBe(title);

    expect(errorDocument.body.children).toHaveLength(1);
    const page = errorDocument.body.firstElementChild;
    expect(page).not.toBeNull();
    expect(page?.children).toHaveLength(2);

    const headings = errorDocument.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(String(status));
    expect(headings[0].nextElementSibling?.textContent).toBe(message);

    const style = page
      ? errorDocument.defaultView?.getComputedStyle(page)
      : undefined;
    expect(style).toMatchObject({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    });
    expect(style?.height).toBe(`${errorDocument.defaultView?.innerHeight}px`);
  });
});
