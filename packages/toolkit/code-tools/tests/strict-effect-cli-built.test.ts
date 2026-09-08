import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Exercise the release output through the actual CLI/native Oxlint, including
// its JS plugin context. Rule.create mocks cannot detect worker/tool failures.
test('release-built strict Effect CLI preserves provenance in every format', () => {
  const output = execFileSync(
    process.execPath,
    ['--test', join(__dirname, 'fixtures/strict-effect-cli/run.mjs')],
    {
      encoding: 'utf8',
      timeout: 120_000,
    },
  );
  expect(output).toContain('fail 0');
}, 150_000);
