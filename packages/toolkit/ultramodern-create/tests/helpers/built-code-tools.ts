import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const packageRoot = path.resolve(__dirname, '../../../code-tools');

/** Link the real release build; fixtures must never replace the validator. */
export function linkBuiltCodeTools(nodeModulesDirectory: string): void {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  );
  const entry = manifest.exports['./strict-effect-runtime'];
  assert.deepEqual(
    entry,
    manifest.publishConfig.exports['./strict-effect-runtime'],
    'API fixtures must resolve the same strict Effect entry as published consumers',
  );
  for (const condition of ['import', 'require', 'types']) {
    const target = entry[condition];
    assert.equal(typeof target, 'string', `Missing ${condition} export`);
    assert.ok(
      fs.existsSync(path.resolve(packageRoot, target)),
      `Build @modern-js/code-tools before API fixtures: missing ${condition} entry ${target}`,
    );
  }

  const link = path.join(nodeModulesDirectory, '@modern-js/code-tools');
  if (fs.existsSync(link)) {
    assert.equal(fs.realpathSync(link), fs.realpathSync(packageRoot));
    return;
  }
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(packageRoot, link, 'dir');
}
