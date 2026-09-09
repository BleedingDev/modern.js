import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { linkBuiltCodeTools } from './helpers/built-code-tools';

const require = createRequire(import.meta.url);
const checker = path.resolve(
  __dirname,
  '../templates/workspace-scripts/check-ultramodern-api-boundaries.mts',
);
const invalidApi =
  'export const handler = () => new Response("invalid");\nexport const responseSchema = Schema.Unknown;\n';
const write = (root: string, relativePath: string, source: string) => {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
};
const check = (root: string) =>
  spawnSync(process.execPath, [path.join(root, 'scripts/check.mts')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ULTRAMODERN_WORKSPACE_ROOT: root },
  });

test('API checker excludes only registered app Cloudflare output, not authored lookalikes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-build-output-'));
  try {
    write(root, 'scripts/check.mts', fs.readFileSync(checker, 'utf8'));
    write(
      root,
      'scripts/microvertical-api-baseline-boundary.mts',
      fs.readFileSync(
        path.join(
          path.dirname(checker),
          'microvertical-api-baseline-boundary.mts',
        ),
        'utf8',
      ),
    );
    const typescriptScope = path.join(root, 'node_modules/@typescript');
    fs.mkdirSync(typescriptScope, { recursive: true });
    fs.symlinkSync(
      path.dirname(require.resolve('typescript/package.json')),
      path.join(typescriptScope, 'native'),
      'dir',
    );
    linkBuiltCodeTools(path.join(root, 'node_modules'));
    write(
      root,
      '.modernjs/ultramodern.json',
      JSON.stringify({
        topology: {
          apps: [
            { path: 'apps/shell-super-app', kind: 'shell' },
            {
              path: 'verticals/catalog',
              kind: 'vertical',
              surfaceProfile: 'ui-only',
            },
          ],
        },
      }),
    );
    for (const app of ['apps/shell-super-app', 'verticals/catalog']) {
      write(root, `${app}/dist-cloudflare/api/index.js`, invalidApi);
    }
    const positive = check(root);
    assert.equal(positive.status, 0, positive.stdout + positive.stderr);
    assert.match(positive.stdout, /UltraModern API boundary check passed/u);

    for (const authored of [
      'verticals/catalog/api/authored.ts',
      'verticals/catalog/src/dist-cloudflare/api/authored.ts',
      'apps/shell-super-app/src/dist-cloudflare/api/authored.ts',
      'verticals/catalog/dist-cloudflare-lookalike/api/authored.ts',
      'packages/shared/dist-cloudflare/api/authored.ts',
      'apps/unregistered/dist-cloudflare/api/authored.ts',
    ]) {
      write(root, authored, invalidApi);
      const negative = check(root);
      assert.equal(negative.status, 1, negative.stdout + negative.stderr);
      assert.ok(
        negative.stderr.includes(
          `${authored}: API modules must not hand-build Response objects`,
        ),
        negative.stderr,
      );
      assert.ok(
        negative.stderr.includes(
          `${authored}: API modules must use concrete request, response and error schemas`,
        ),
        negative.stderr,
      );
      assert.ok(
        !negative.stderr.includes('dist-cloudflare/api/index.js:'),
        negative.stderr,
      );
      fs.rmSync(path.join(root, authored));
    }

    // Missing topology cannot promote a path into trusted generated output.
    fs.rmSync(path.join(root, '.modernjs/ultramodern.json'));
    const missingTopology = check(root);
    assert.equal(missingTopology.status, 1);
    assert.match(
      missingTopology.stderr,
      /required to classify generated API surfaces/u,
    );
    assert.match(
      missingTopology.stderr,
      /dist-cloudflare\/api\/index\.js: API modules must not hand-build Response objects/u,
    );
    for (const required of [
      'verticals/catalog/api/index.ts',
      'verticals/catalog/shared/api.ts',
      'packages/shared-contracts/package.json',
    ]) {
      assert.ok(
        missingTopology.stderr.includes(`${required} is required.`),
        missingTopology.stderr,
      );
    }
    assert.doesNotMatch(missingTopology.stderr, /ENOENT/u);

    // Each dependent structural check must tolerate its own missing input,
    // without swallowing unrelated authored-source violations.
    write(root, 'verticals/catalog/api/index.ts', invalidApi);
    write(root, 'verticals/catalog/shared/api.ts', 'export const api = {};\n');
    const missingManifest = check(root);
    assert.equal(missingManifest.status, 1);
    assert.match(
      missingManifest.stderr,
      /packages\/shared-contracts\/package\.json is required\./u,
    );
    assert.match(
      missingManifest.stderr,
      /verticals\/catalog\/api\/index\.ts: API modules must not hand-build Response objects/u,
    );
    assert.doesNotMatch(missingManifest.stderr, /ENOENT/u);

    write(
      root,
      'packages/shared-contracts/package.json',
      '{"name":"@fixture/shared-contracts"}',
    );
    fs.rmSync(path.join(root, 'verticals/catalog/shared/api.ts'));
    const missingContract = check(root);
    assert.equal(missingContract.status, 1);
    assert.match(
      missingContract.stderr,
      /verticals\/catalog\/shared\/api\.ts is required\./u,
    );
    assert.match(
      missingContract.stderr,
      /verticals\/catalog\/api\/index\.ts: API modules must not hand-build Response objects/u,
    );
    assert.doesNotMatch(missingContract.stderr, /ENOENT/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
