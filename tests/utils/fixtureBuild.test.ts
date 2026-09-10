import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildFixtureOnce } from './fixtureBuild';

async function removeFixture(fixtureDir: string) {
  const digest = crypto
    .createHash('sha1')
    .update(`${path.resolve(fixtureDir)}:dist`)
    .digest('hex');
  await fs.rm(path.join(os.tmpdir(), `modernjs-fixture-build-${digest}.json`), {
    force: true,
  });
  await fs.rm(fixtureDir, { recursive: true, force: true });
}

describe('fixture build cache', () => {
  test('records generated inputs after a successful build', async () => {
    const fixtureDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'modernjs-fixture-generated-input-test-'),
    );
    const outputPath = path.join(fixtureDir, 'dist');
    const generatedPath = path.join(fixtureDir, 'src', 'router.gen.ts');
    let buildCount = 0;

    try {
      const build = async () => {
        buildCount += 1;
        await fs.mkdir(path.dirname(generatedPath), { recursive: true });
        await fs.writeFile(generatedPath, 'export const route = "/";\n');
        await fs.mkdir(outputPath, { recursive: true });
        return { code: 0 };
      };

      await buildFixtureOnce(fixtureDir, {
        inputs: ['src'],
        cacheKey: 'generated-input-test',
        build,
      });
      await buildFixtureOnce(fixtureDir, {
        inputs: ['src'],
        cacheKey: 'generated-input-test',
        build,
      });

      expect(buildCount).toBe(1);
    } finally {
      await removeFixture(fixtureDir);
    }
  });

  test('does not keep a valid marker after an invalidating failed rebuild', async () => {
    const fixtureDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'modernjs-fixture-build-test-'),
    );
    const outputDir = 'dist';
    const outputPath = path.join(fixtureDir, outputDir);
    const inputPath = path.join(fixtureDir, 'input.txt');
    const builds: string[] = [];

    try {
      await fs.writeFile(inputPath, 'v1');

      await buildFixtureOnce(fixtureDir, {
        inputs: ['input.txt'],
        outputDir,
        cacheKey: 'fixture-cache-test',
        build: async () => {
          builds.push('success');
          await fs.mkdir(outputPath, { recursive: true });
          return { code: 0 };
        },
      });

      await fs.rm(outputPath, { recursive: true, force: true });
      await buildFixtureOnce(fixtureDir, {
        inputs: ['input.txt'],
        outputDir,
        cacheKey: 'fixture-cache-test',
        build: async () => {
          builds.push('failed');
          await fs.mkdir(outputPath, { recursive: true });
          return { code: 1 };
        },
      });

      await buildFixtureOnce(fixtureDir, {
        inputs: ['input.txt'],
        outputDir,
        cacheKey: 'fixture-cache-test',
        build: async () => {
          builds.push('recovered');
          return { code: 0 };
        },
      });

      await buildFixtureOnce(fixtureDir, {
        inputs: ['input.txt'],
        outputDir,
        cacheKey: 'fixture-cache-test-next',
        build: async () => {
          builds.push('cache-key-changed');
          return { code: 0 };
        },
      });

      expect(builds).toEqual([
        'success',
        'failed',
        'recovered',
        'cache-key-changed',
      ]);
    } finally {
      await removeFixture(fixtureDir);
    }
  });
});
