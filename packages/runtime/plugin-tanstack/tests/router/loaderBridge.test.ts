import { isNotFound, isRedirect } from '@tanstack/react-router';
import {
  modernLoaderToTanstack,
  throwTanstackRedirect,
} from '../../src/runtime/loaderBridge';

type RedirectLike = {
  options?: {
    href?: string;
    to?: string;
  };
};

function catchThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the function to throw');
}

describe('modernLoaderToTanstack', () => {
  const baseCtx = {
    location: { href: 'http://localhost/products/1' },
    params: { id: '1' },
  };

  test('passes request/params/context through to the modern loader', async () => {
    const seen: { request?: Request; params?: unknown; context?: unknown } = {};
    const loader = modernLoaderToTanstack({ hasSplat: false }, (args: any) => {
      seen.request = args.request;
      seen.params = args.params;
      seen.context = args.context;
      return { ok: true };
    });

    await expect(
      loader({
        ...baseCtx,
        context: { requestContext: { user: 'u1' } },
      }),
    ).resolves.toEqual({ ok: true });
    expect(seen.request).toBeInstanceOf(Request);
    expect(seen.request?.url).toBe('http://localhost/products/1');
    expect(seen.params).toEqual({ id: '1' });
    expect(seen.context).toEqual({ user: 'u1' });
  });

  test('uses current location when context carries a previous request', async () => {
    const seen: { request?: Request } = {};
    const loader = modernLoaderToTanstack({ hasSplat: false }, (args: any) => {
      seen.request = args.request;
      return { ok: true };
    });

    await expect(
      loader({
        ...baseCtx,
        location: { href: 'http://localhost/products/2?sort=price' },
        context: {
          request: new Request('http://localhost/products/1?sort=name'),
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(seen.request).toBeInstanceOf(Request);
    expect(seen.request?.url).toBe('http://localhost/products/2?sort=price');
  });

  test('translates an absolute-URL redirect Response into redirect({ href })', async () => {
    const loader = modernLoaderToTanstack({ hasSplat: false }, () =>
      Response.redirect('https://example.com/away', 302),
    );

    const thrown = (await loader(baseCtx).then(
      () => {
        throw new Error('expected redirect');
      },
      (err: unknown) => err,
    )) as RedirectLike;

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown.options?.href).toBe('https://example.com/away');
    expect(thrown.options?.to).toBeUndefined();
  });

  test('translates a relative redirect Response into redirect({ to })', async () => {
    const loader = modernLoaderToTanstack(
      { hasSplat: false },
      () =>
        new Response(null, { status: 302, headers: { Location: '/login' } }),
    );

    const thrown = (await loader(baseCtx).then(
      () => {
        throw new Error('expected redirect');
      },
      (err: unknown) => err,
    )) as RedirectLike;

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown.options?.to).toBe('/login');
  });

  test('translates a 404 Response into notFound()', async () => {
    const loader = modernLoaderToTanstack(
      { hasSplat: false },
      () => new Response(null, { status: 404 }),
    );

    const thrown = await loader(baseCtx).then(
      () => {
        throw new Error('expected notFound');
      },
      (err: unknown) => err,
    );

    expect(isNotFound(thrown)).toBe(true);
  });

  test('translates redirect Responses thrown synchronously by the loader', () => {
    const loader = modernLoaderToTanstack({ hasSplat: false }, () => {
      throw new Response(null, {
        status: 301,
        headers: { Location: 'https://example.com/moved' },
      });
    });

    // A synchronous loader throw surfaces synchronously (TanStack handles
    // thrown redirects from the loader call itself).
    const thrown = catchThrown(() => loader(baseCtx)) as RedirectLike;

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown.options?.href).toBe('https://example.com/moved');
  });

  test('re-throws TanStack redirects thrown by the loader untouched', async () => {
    const loader = modernLoaderToTanstack({ hasSplat: false }, async () => {
      throwTanstackRedirect('/inner');
    });

    const thrown = (await loader(baseCtx).then(
      () => {
        throw new Error('expected redirect');
      },
      (err: unknown) => err,
    )) as RedirectLike;

    // The bridge must not re-translate its own redirect (a Response without
    // a Location header) — that used to collapse internal targets to '/'.
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown.options?.to).toBe('/inner');
  });
});
