import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDirectory = fileURLToPath(new URL('..', import.meta.url));

// Resolve the public package entry, including its platform conditions.
test.each([
  'browser',
  'node',
] as const)('public %s entry selects the matching renderer adapter', async platform => {
  const output = await build({
    absWorkingDir: packageDirectory,
    stdin: {
      contents:
        "export { default } from '@modern-js/runtime-renderer-extensions'",
      resolveDir: packageDirectory,
    },
    bundle: true,
    write: false,
    metafile: true,
    platform,
    format: 'esm',
    conditions: ['modern:source'],
  });
  const inputs = Object.keys(output.metafile.inputs);
  expect(inputs.some(input => input.endsWith('/runtimePlugin.ts'))).toBe(true);
  expect(
    inputs.some(input => input.endsWith('/runtime-extensions/src/node.ts')),
  ).toBe(platform === 'node');
  expect(
    inputs.some(
      input =>
        input === 'src/node.ts' ||
        input.endsWith('/renderer-extensions/src/node.ts'),
    ),
  ).toBe(platform === 'node');
});
