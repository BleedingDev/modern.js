// Fork-owned coverage guard. Lives outside packages/ because the assertion is
// about the published @modern-js/server-core build's cross-copy context
// contract, not about its source; it replaces the fork's edit to the
// upstream-owned packages/server/core/tests/context.test.ts.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The published build keys its hono context storage with this Symbol.for(...)
// on globalThis, so a second loaded copy of server-core — the normal case once
// a BFF pulls in its own resolution of the package — reads the same store. If
// that ever regresses, cross-package BFF handlers throw "Can't call useContext
// out of server scope" instead of seeing the request.
test('the published run() writes the context a duplicate server-core copy reads', () => {
  const entry = pathToFileURL(
    path.resolve(
      __dirname,
      '../../packages/server/core/dist/esm-node/index.mjs',
    ),
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import { run, useHonoContext } from ${JSON.stringify(entry)};
       const context = { id: 7 };
       await run(context, () => {
         const duplicate =
           globalThis[Symbol.for('modernjs.server-core.honoContextStorage')];
         console.log(
           JSON.stringify([
             useHonoContext() === context,
             duplicate?.getStore() === context,
           ]),
         );
       });`,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );

  expect(result.stderr, result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toEqual([true, true]);
}, 90_000);
