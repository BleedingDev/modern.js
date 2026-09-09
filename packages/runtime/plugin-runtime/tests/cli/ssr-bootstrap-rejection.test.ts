import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { generateCode } from '../../src/cli/code';
import * as serverTemplate from '../../src/cli/template.server';

test('an early SSR import failure stays observable without terminating Node before a request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'modern-ssr-bootstrap-'));
  const serverIndex = rs
    .spyOn(serverTemplate, 'serverIndex')
    .mockReturnValue(
      `throw new Error('remote manifest unavailable'); export const requestHandler = undefined;`,
    );
  try {
    await generateCode(
      [
        {
          entryName: 'main',
          entry: join(directory, 'App.tsx'),
          isAutoMount: true,
        },
      ] as any,
      {
        appDirectory: directory,
        internalDirectory: directory,
        srcDirectory: directory,
        internalSrcAlias: '@_modern_js_src',
        metaName: 'modern-js',
        serverRoutes: [],
      } as any,
      {
        html: { mountId: 'root' },
        source: { enableAsyncEntry: true },
        server: { ssr: true },
      } as any,
      {
        _internalRuntimePlugins: { call: async () => ({ plugins: [] }) },
      } as any,
    );
    const outfile = join(directory, 'bootstrap.cjs');
    await build({
      entryPoints: [join(directory, 'main/bootstrap.server.jsx')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile,
    });
    const result = spawnSync(
      process.execPath,
      [
        '--unhandled-rejections=strict',
        '-e',
        `
      const assert = require('node:assert/strict');
      const { requestHandler } = require(process.argv[1]);
      setTimeout(async () => {
        await assert.rejects(requestHandler, /remote manifest unavailable/);
        process.stdout.write('request received original failure');
      }, 50);
    `,
        outfile,
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('request received original failure');
  } finally {
    serverIndex.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
