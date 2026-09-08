import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Requires the package's release build, like compiledYamlExports.test.ts.
// Source/CJS tests cannot reproduce Node's native import(CJS) namespace shape.
test('release-built ESM utils normalize server plugin exports', () => {
  const cwd = join(__dirname, '..');
  const output = execFileSync(
    process.execPath,
    ['--test', 'tests/fixtures/compat-require-built/run.mjs'],
    {
      cwd,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30_000,
      encoding: 'utf8',
    },
  );
  expect(output).toContain('fail 0');
}, 90_000);
