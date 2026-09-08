import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEffectApiImportResolver } from '../src/strict-effect-runtime';

test('resolves nested owner-local imports through a symlinked workspace and rejects foreign symlinks', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-api-resolver-'));
  try {
    const owner = path.join(temp, 'workspace/vertical');
    fs.mkdirSync(path.join(owner, 'api'), { recursive: true });
    fs.mkdirSync(path.join(owner, 'shared'));
    fs.writeFileSync(
      path.join(owner, 'api/handlers.ts'),
      'export const handlers = {};',
    );
    fs.writeFileSync(
      path.join(owner, 'shared/api.ts'),
      'export const api = {};',
    );
    fs.writeFileSync(
      path.join(temp, 'foreign.ts'),
      'export const foreign = {};',
    );
    fs.symlinkSync(
      path.join(temp, 'workspace'),
      path.join(temp, 'alias'),
      'dir',
    );
    fs.symlinkSync(
      path.join(temp, 'foreign.ts'),
      path.join(owner, 'api/foreign.ts'),
    );
    const resolve = createEffectApiImportResolver(
      path.join(temp, 'alias/vertical/api/index.ts'),
    );
    const handlers = resolve('./handlers.ts');
    expect(handlers?.id).toBe(
      fs.realpathSync(path.join(owner, 'api/handlers.ts')),
    );
    expect(handlers?.resolveImport?.('../shared/api.ts')?.source).toBe(
      'export const api = {};',
    );
    expect(resolve('./foreign.ts')).toBeUndefined();
    expect(resolve('../../../foreign.ts')).toBeUndefined();
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
