// Fork-owned coverage guard. Lives outside packages/ because the assertion is
// about the published @modern-js/utils ESM build, not about its source; it was
// removed from the upstream-owned packages/toolkit/utils/tests/compatRequire.test.ts.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Guards the ESM release build used for plugin loading: Node's native import()
// of a transpiled CJS plugin must still hand back the callable factory.
test('release-built ESM normalizes transpiled CJS plugin factories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'compat-require-built-'));
  try {
    const plugin = join(dir, 'plugin.cjs');
    writeFileSync(
      plugin,
      "Object.defineProperty(exports,'__esModule',{value:true});exports.default=o=>({name:'plugin',options:o});",
    );
    const entry = pathToFileURL(
      path.resolve(
        __dirname,
        '../node_modules/@modern-js/utils/dist/esm-node/index.mjs',
      ),
    ).href;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { compatibleRequire } from ${JSON.stringify(entry)};
         const loaded = await compatibleRequire(${JSON.stringify(plugin)});
         console.log(JSON.stringify([typeof loaded, loaded({ enabled: true })]));`,
      ],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect(result.stderr, result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual([
      'function',
      { name: 'plugin', options: { enabled: true } },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 90_000);
