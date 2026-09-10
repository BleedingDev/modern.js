import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@rstest/core';
import {
  FsBackendWithSave,
  resolveFsBackendConstructor,
} from '../src/runtime/i18n/backend/middleware.node';

describe('i18n runtime utils', () => {
  test('normalizes node fs backend CJS and ESM namespace shapes', () => {
    class FakeBackend {}

    expect(resolveFsBackendConstructor(FakeBackend)).toBe(FakeBackend);
    expect(resolveFsBackendConstructor({ default: FakeBackend })).toBe(
      FakeBackend,
    );
    expect(resolveFsBackendConstructor({ 'module.exports': FakeBackend })).toBe(
      FakeBackend,
    );
    expect(
      resolveFsBackendConstructor({ default: { default: FakeBackend } }),
    ).toBe(FakeBackend);
    expect(
      resolveFsBackendConstructor({
        default: { 'module.exports': FakeBackend },
      }),
    ).toBe(FakeBackend);
  });

  test('loads translation resources through the node fs backend', async () => {
    const root = await mkdtemp(join(tmpdir(), 'i18n-backend-'));

    try {
      await mkdir(join(root, 'cs'), { recursive: true });
      await writeFile(
        join(root, 'cs', 'common.json'),
        JSON.stringify({ title: 'Ahoj' }),
      );
      const backend = new FsBackendWithSave(
        {},
        { loadPath: join(root, '{{lng}}', '{{ns}}.json') },
        {},
      );
      const resources = await new Promise<unknown>((resolve, reject) => {
        backend.read('cs', 'common', (error: Error | null, data: unknown) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });

      expect(resources).toEqual({ title: 'Ahoj' });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
