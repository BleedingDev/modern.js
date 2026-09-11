import { createStorage } from '../src/utils/storage';

// Production keys the storage with Symbol.for(...) (see src/context.ts): a
// second loaded copy must read the same context or BFF handlers throw.
it('shares the context written by the public run() with a duplicate copy keyed by the production symbol', async () => {
  const { run, useHonoContext } = await import('../src/context');
  const duplicate = createStorage<{ id: number }>(
    Symbol.for('modernjs.server-core.honoContextStorage'),
  );
  const context = { id: 7 };
  await run(context as any, () => {
    expect(useHonoContext()).toBe(context);
    expect(duplicate.useHonoContext()).toBe(context);
  });
});
