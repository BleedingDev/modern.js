import { createRuntimeContextExtension } from '../src/contextExtensions';

describe('runtime context extensions', () => {
  it('does not leak into string-key enumeration of the context', () => {
    const extension = createRuntimeContextExtension<string>('test:hidden');
    const context = {};
    const keysBefore = Object.keys(context);

    extension.set(context, 'secret');

    expect(Object.keys(context)).toEqual(keysBefore);
    expect(JSON.stringify(context)).not.toContain('secret');
    for (const key in context) {
      expect(typeof key).toBe('string');
      expect((context as Record<string, unknown>)[key]).not.toBe('secret');
    }
  });

  it('survives object spreads so SSR context copies keep their extensions', () => {
    const extension = createRuntimeContextExtension<string>('test:spread');
    const context = {};
    extension.set(context, 'carried');

    const copy = { ...context };
    expect(extension.get(copy)).toBe('carried');
  });
});
