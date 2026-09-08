import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@rstest/core';

const require = createRequire(import.meta.url);

test('CLI route declarations resolve React in a Node-only types environment', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'modern-cli-react-types-'));
  const declarations = fileURLToPath(
    new URL('../cli/index.d.ts', import.meta.url),
  );
  const compiler = path.join(
    path.dirname(require.resolve('typescript/package.json')),
    'bin/tsc',
  );
  try {
    writeFileSync(
      path.join(directory, 'fixture.mts'),
      `
import type { Route, NestedRoute } from ${JSON.stringify(declarations)};
const route: Route = { type: 'page', element: null, errorElement: null };
const nested: NestedRoute<string> = { type: 'nested', origin: 'config', component: 'page.tsx' };
void route;
void nested;
`,
    );
    writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          allowImportingTsExtensions: true,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          types: ['node'],
          typeRoots: [
            path.dirname(
              path.dirname(require.resolve('@types/node/package.json')),
            ),
          ],
        },
        files: ['fixture.mts'],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [compiler, '-p', path.join(directory, 'tsconfig.json')],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    expect({
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    }).toEqual({
      status: 0,
      stdout: '',
      stderr: '',
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
