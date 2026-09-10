import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

type DecoderScenario =
  | 'async-iterator'
  | 'blob-type'
  | 'cycle'
  | 'form-data-roundtrip';

const resolvePackage = createRequire(
  path.join(__dirname, 'rsc-decoder-security-resolver.cjs'),
).resolve;
const childPath = path.join(
  __dirname,
  'fixtures',
  'rscDecoderSecurityChild.cjs',
);

function runDecoderScenario(options: {
  entry: 'edge' | 'node';
  scenario: DecoderScenario;
}): Record<string, unknown> {
  const result = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      childPath,
      options.scenario,
      resolvePackage(`react-server-dom-rspack/server.${options.entry}`),
      resolvePackage(`react-server-dom-rspack/client.${options.entry}`),
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 5_000,
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `RSC decoder child failed for ${options.entry}/production/${options.scenario}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
      { cause: result.error },
    );
  }

  return JSON.parse(result.stdout) as Record<string, unknown>;
}

for (const entry of ['node', 'edge'] as const) {
  describe(`${entry} production Flight decoder security`, () => {
    test('bounds cyclic Map reconstruction before invoking constructors', () => {
      const result = runDecoderScenario({ entry, scenario: 'cycle' });

      expect(result.rejected).toBe(true);
      expect(result.mapArrayConstructions).toBeLessThanOrEqual(2);
    });

    test('round-trips referenced FormData through the public client and server APIs', () => {
      expect(
        runDecoderScenario({ entry, scenario: 'form-data-roundtrip' }),
      ).toEqual({ values: ['first', 'second'] });
    });

    test('rejects a Blob reference backed by a string', () => {
      expect(runDecoderScenario({ entry, scenario: 'blob-type' })).toEqual({
        rejected: true,
        returnedString: false,
      });
    });

    test('does not recursively throw into a rejecting async iterator', () => {
      expect(runDecoderScenario({ entry, scenario: 'async-iterator' })).toEqual(
        { throwCalls: 1 },
      );
    });
  });
}
