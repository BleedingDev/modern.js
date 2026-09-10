import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compile } from '@modern-js/server-utils';
import serverBuildPlugin from '../src/plugins/serverBuild';

rstest.mock('@modern-js/server-utils', () => ({ compile: rstest.fn() }));

describe('server build compilation policy', () => {
  it.each([
    false,
    true,
  ])('forwards current exclusions when configured: %s', async configured => {
    const appDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'modern-server-build-'),
    );
    const serverDir = path.join(appDirectory, 'server');
    const sharedDir = path.join(appDirectory, 'shared');
    const distDirectory = path.join(appDirectory, 'dist');
    let context: {
      appDirectory: string;
      distDirectory: string;
      metaName: string;
      moduleType: 'commonjs';
      serverCompileExcludedFiles?: string[];
    } = {
      appDirectory,
      distDirectory,
      metaName: 'modern-js',
      moduleType: 'commonjs',
    };
    let afterBuild: (() => Promise<void>) | undefined;
    const api = {
      getAppContext: () => context,
      getNormalizedConfig: () => ({ server: {}, source: { alias: {} } }),
      onAfterBuild: (callback: () => Promise<void>) => {
        afterBuild = callback;
      },
    };

    try {
      await mkdir(serverDir);
      await mkdir(sharedDir);
      await writeFile(path.join(serverDir, 'cache.ts'), 'export default {};\n');
      await writeFile(path.join(appDirectory, 'tsconfig.json'), '{}');
      rstest.mocked(compile).mockReset();
      rstest.mocked(compile).mockResolvedValue(undefined);
      serverBuildPlugin().setup!(api as never);

      // Policy can be supplied by another plugin after this plugin's setup.
      const excludeFiles = configured
        ? [path.join(appDirectory, 'src/client.d.ts')]
        : undefined;
      context = { ...context, serverCompileExcludedFiles: excludeFiles };
      await afterBuild!();

      expect(compile).toHaveBeenCalledTimes(1);
      expect(compile).toHaveBeenCalledWith(
        appDirectory,
        { server: {}, alias: {} },
        {
          sourceDirs: [serverDir, sharedDir],
          distDir: distDirectory,
          tsconfigPath: path.join(appDirectory, 'tsconfig.json'),
          moduleType: 'commonjs',
          excludeFiles,
        },
      );
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });
});
