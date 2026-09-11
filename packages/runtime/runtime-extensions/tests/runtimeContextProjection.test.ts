import { createRuntimeContextExtension } from '../src/contextExtensions';
import { projectRuntimeContext } from '../src/runtimeContextProjection';

describe('fork runtime context projection', () => {
  it('removes copied enumerable extension state only from the public projection', () => {
    const context = { isBrowser: false, requestId: 'original' };
    const extension = createRuntimeContextExtension<object>('test:projection');
    const state = { router: 'private' };
    extension.set(context, state);
    const publicInput = { ...context };

    const result = projectRuntimeContext(
      { internalContext: context, publicContext: publicInput },
      { context, isRsc: false },
    );

    expect(result.internalContext).toBe(context);
    expect(result.publicContext).not.toBe(publicInput);
    expect(extension.get(result.internalContext)).toBe(state);
    expect(extension.get(publicInput)).toBe(state);
    expect(extension.get(result.publicContext)).toBeUndefined();
    expect(Object.getOwnPropertySymbols(result.publicContext)).not.toContain(
      Symbol.for('@modern-js/runtime:context-extensions'),
    );
  });

  it('projects RSC request fields and locals without mutating the original response', () => {
    const response = {
      setHeader: rstest.fn(),
      status: rstest.fn(),
      locals: { tenant: 'tractor-store' },
    };
    const request = {
      params: { category: 'compact' },
      pathname: '/tractors',
      query: { sort: 'price' },
      headers: { accept: 'text/html' },
      host: 'example.test',
      url: 'https://example.test/tractors?sort=price',
      raw: new Request('https://example.test/tractors'),
    };
    const context = { isBrowser: false, ssrContext: { request, response } };
    const extension = createRuntimeContextExtension<object>('test:rsc');
    const state = { original: true };
    extension.set(context, state);
    const publicContext = { isBrowser: false };
    const result = projectRuntimeContext(
      { internalContext: context, publicContext },
      { context, isRsc: true },
    );
    const internal = result.internalContext as typeof result.internalContext & {
      context: { request: object; response: typeof response };
      requestContext: { request: object; response: typeof response };
    };
    const publicValue = result.publicContext as typeof internal;

    expect(internal).not.toBe(context);
    expect(internal.ssrContext).toBeUndefined();
    expect(internal.requestContext).toBe(publicValue.requestContext);
    expect(internal.context).toBe(internal.requestContext);
    expect(publicValue.context).toBe(internal.requestContext);
    expect(internal.requestContext.response.locals).toBe(response.locals);
    expect(context.ssrContext.response).toBe(response);
    expect(extension.get(context)).toBe(state);
    // Internal RSC copy behavior is retained pending separate Flight proof.
    expect(extension.get(internal)).toBe(state);
    expect(extension.get(publicValue)).toBeUndefined();
  });

  it('does not apply server request projection to an RSC browser context', () => {
    const context = {
      isBrowser: true,
      ssrContext: { request: {}, response: { locals: { browser: true } } },
    };
    const result = projectRuntimeContext(
      { internalContext: context, publicContext: { ...context } },
      { context, isRsc: true },
    );
    expect(result.internalContext).toBe(context);
    expect(result.internalContext.ssrContext).toBe(context.ssrContext);
    expect(result.publicContext).not.toHaveProperty('requestContext');
  });
});
