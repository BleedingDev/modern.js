import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ultramodernSandpackFiles } from '@modern-js/ultramodern-sandpack-profile';
import { type Browser, chromium } from 'playwright';
import processKit from '../../../scripts/lib/process-kit.js';

const fixtureRoots: string[] = [];
const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const { killChild } = processKit;

async function listFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? listFiles(root, absolutePath)
        : [path.relative(root, absolutePath)];
    }),
  );
  return files.flat();
}

async function materializeBuildFixture() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'ultramodern-sandpack-build-'),
  );
  fixtureRoots.push(root);

  for (const [relativePath, source] of Object.entries(
    ultramodernSandpackFiles,
  )) {
    const outputPath = path.join(root, relativePath.replace(/^\//u, ''));
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, source, 'utf8');
  }

  const manifest = JSON.parse(ultramodernSandpackFiles['/package.json']);
  const profileRequire = createRequire(import.meta.url);
  // Consumer visibility is exactly the generated manifest, with built public exports.
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })) {
    const searchPaths = profileRequire.resolve.paths(name) ?? [];
    let packageDirectory: string | undefined;
    for (const directory of searchPaths) {
      try {
        const candidate = path.join(directory, name);
        const candidateManifest = JSON.parse(
          await readFile(path.join(candidate, 'package.json'), 'utf8'),
        );
        if (candidateManifest.name === name) {
          packageDirectory = await realpath(candidate);
          break;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    assert.ok(packageDirectory, `Missing built fixture dependency ${name}`);
    const destination = path.join(root, 'node_modules', name);
    await mkdir(path.dirname(destination), { recursive: true });
    await symlink(packageDirectory, destination, 'dir');
  }
  return root;
}

after(async () => {
  await Promise.all(
    fixtureRoots.map(root => rm(root, { force: true, recursive: true })),
  );
});

test('the materialized profile builds and switches native i18n in the browser', async () => {
  const fixtureRoot = await materializeBuildFixture();
  const modernCli = path.join(
    repositoryRoot,
    'packages/solutions/app-tools/bin/modern.js',
  );
  const cliMetadata = await lstat(modernCli);
  assert.equal(cliMetadata.isFile(), true);

  const result = spawnSync(process.execPath, [modernCli, 'build'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    timeout: 180_000,
  });

  assert.equal(
    result.status,
    0,
    `modern build failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  const distRoot = path.join(fixtureRoot, 'dist');
  const emittedFiles = await listFiles(distRoot);
  const htmlPath = emittedFiles.find(file => file.endsWith('.html'));
  assert.ok(htmlPath, `build emitted no HTML: ${emittedFiles.join(', ')}`);
  assert.ok(
    emittedFiles.some(file => /\.(?:js|mjs)$/u.test(file)),
    `build emitted no JavaScript: ${emittedFiles.join(', ')}`,
  );

  const html = await readFile(path.join(distRoot, htmlPath), 'utf8');
  assert.match(html, /<script\b/u);

  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close(error => (error ? reject(error) : resolve())),
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [modernCli, 'serve'], {
    cwd: fixtureRoot,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PORT: String(port),
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  const collect = (chunk: Buffer) => {
    serverOutput = (serverOutput + chunk.toString()).slice(-32_768);
  };
  server.stdout.on('data', collect);
  server.stderr.on('data', collect);
  server.on('error', error => {
    serverOutput += error.message;
  });
  const exited = new Promise<void>(resolve =>
    server.once('close', () => resolve()),
  );
  const running = () => server.exitCode === null && server.signalCode === null;
  let browser: Browser | undefined;
  const pageErrors: string[] = [];
  try {
    const deadline = Date.now() + 30_000;
    for (;;) {
      assert.ok(
        running(),
        `modern serve exited before readiness: ${serverOutput}`,
      );
      assert.ok(
        Date.now() < deadline,
        `modern serve did not become ready: ${serverOutput}`,
      );
      let ready = false;
      try {
        const response = await fetch(baseUrl, {
          signal: AbortSignal.timeout(1_000),
        });
        ready = response.ok;
        await response.arrayBuffer();
      } catch {
        /* The owned server is still starting. */
      }
      if (ready) break;
      await delay(50);
    }
    browser = await chromium.launch();
    const page = await browser.newPage({ locale: 'en-US' });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(baseUrl);
    // CSR installs native Helmet attributes only after the i18n provider mounts.
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(
      await page.getByRole('heading', { level: 1 }).textContent(),
      'Build a fast, typed UltraModern.js application. [en]',
    );
    await page
      .getByRole('combobox', { name: 'Language', exact: true })
      .selectOption('cs');
    await page.waitForFunction(() => document.documentElement.lang === 'cs');
    await page
      .getByRole('combobox', { name: 'Jazyk', exact: true })
      .waitFor({ state: 'visible' });
    assert.equal(
      await page.getByRole('heading', { level: 1 }).textContent(),
      'Vytvořte rychlou a typově bezpečnou UltraModern.js aplikaci. [cs]',
    );
    assert.deepEqual(pageErrors, []);
  } catch (cause) {
    throw new Error(
      `Sandpack browser proof failed\npage errors: ${pageErrors.join('\n')}\nserver: ${serverOutput}`,
      { cause },
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      if (running()) killChild(server, 'SIGTERM');
      await Promise.race([exited, delay(5_000, undefined, { ref: false })]);
      if (running()) killChild(server, 'SIGKILL');
      await exited;
    }
  }
});
