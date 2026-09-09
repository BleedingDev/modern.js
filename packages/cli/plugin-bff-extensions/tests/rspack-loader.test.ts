import os from 'node:os';
import path from 'node:path';
import { fs } from '@modern-js/utils';
import loader from '../src/effect-source-loader/rspack-loader';

async function fixture() {
  const appDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'effect-rspack-loader-'),
  );
  const entry = path.join(appDir, 'api/index.ts');
  const source = 'export const value: number = 42;';
  await fs.outputFile(entry, source);
  await fs.outputJSON(path.join(appDir, 'package.json'), {
    name: 'effect-loader',
  });
  const run = async (resourceQuery: string, resourcePath = entry) => {
    const callback = rstest.fn();
    const dependencies: string[] = [];
    await loader.call(
      {
        resourcePath,
        resourceQuery,
        cacheable: () => {},
        async: () => callback,
        getOptions: () => ({
          appDir,
          apiDir: path.join(appDir, 'api'),
          effectEntry: entry,
          port: 8080,
          prefix: '/api',
          target: 'web',
        }),
        addDependency: (file: string) => dependencies.push(file),
      } as never,
      source,
    );
    return { callback, dependencies };
  };
  return { appDir, entry, run };
}

test('source-runtime query strips TypeScript and returns compiled source through one callback', async () => {
  const { appDir, entry, run } = await fixture();
  try {
    const { callback, dependencies } = await run('?modern-bff-runtime-source');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
    expect(callback.mock.calls[0][1]).toContain('42');
    expect(callback.mock.calls[0][1]).not.toContain(': number');
    expect(dependencies).toContain(entry);
  } finally {
    await fs.remove(appDir);
  }
});

test('unexpected resources and failed code generation report one callback error', async () => {
  const { appDir, run } = await fixture();
  try {
    const sibling = path.join(appDir, 'api/sibling.ts');
    await fs.outputFile(sibling, 'export const value = 1;');
    const unexpected = await run('', sibling);
    expect(unexpected.callback).toHaveBeenCalledTimes(1);
    expect(unexpected.callback.mock.calls[0][0].message).toContain(
      'Unexpected Effect BFF loader resource',
    );
    const invalid = await run('');
    expect(invalid.callback).toHaveBeenCalledTimes(1);
    expect(invalid.callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(invalid.callback.mock.calls[0][1]).toBeUndefined();
  } finally {
    await fs.remove(appDir);
  }
});
