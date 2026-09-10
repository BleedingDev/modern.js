import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rstest } from '@rstest/core';
import puppeteer from 'puppeteer';
import { materializeGeneratedWorkspaceDependencies } from '../../../utils/generatedWorkspaceDependencies';
import {
  getPort,
  killApp,
  launchOptions,
  modernBuild,
  modernServe,
} from '../../../utils/modernTestUtils';

const repoRoot = path.resolve(__dirname, '../../../../');
const createBin = path.resolve(
  repoRoot,
  'packages/toolkit/ultramodern-create/bin/run.js',
);
const frameworkVersionEnv = 'ULTRAMODERN_CREATE_FRAMEWORK_VERSION';
const testFrameworkVersion = '3.2.0-ultramodern.108';
const generatedBuildPackages = [
  '@modern-js/app-tools',
  '@modern-js/plugin-bff',
  '@modern-js/plugin-i18n',
  '@modern-js/plugin-tanstack',
  '@modern-js/runtime',
  '@modern-js/runtime-extensions',
];
const shellAppPath = 'apps/shell-super-app';

function runCreate(cwd: string, args: string[]) {
  execFileSync(process.execPath, [createBin, ...args], {
    cwd,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      [frameworkVersionEnv]: testFrameworkVersion,
    },
    stdio: 'pipe',
  });
}

async function buildAndReadShellBackground(
  workspaceDir: string,
  expectedBackground: string,
) {
  const appDir = path.join(workspaceDir, shellAppPath);
  const buildResult = await modernBuild(appDir, [], {
    ensureWorkspacePackages: generatedBuildPackages,
    stdout: false,
    stderr: false,
  });
  expect(buildResult.code).toBe(0);

  const port = await getPort();
  const server = await modernServe(appDir, port, {
    ensureWorkspacePackages: generatedBuildPackages,
  });
  const browser = await puppeteer.launch(launchOptions as any);
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/en/`, {
      waitUntil: 'networkidle0',
    });
    const background = await page.$eval(
      'main',
      element => getComputedStyle(element).backgroundColor,
    );
    expect(background).toBe(expectedBackground);
  } finally {
    await page.close();
    await browser.close();
    await killApp(server);
  }
}

describe('create-tailwind', () => {
  let tempRoot = '';

  beforeAll(() => {
    rstest.setConfig({
      testTimeout: 1000 * 60 * 5,
      hookTimeout: 1000 * 60 * 5,
    });
    tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'modern-create-tailwind-'),
    );
  });

  afterAll(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('builds Tailwind-enabled and opt-out generated shells', async () => {
    const withTailwindDir = path.join(tempRoot, 'with-tailwind');
    const withoutTailwindDir = path.join(tempRoot, 'without-tailwind');
    const generatedDirs = [withTailwindDir, withoutTailwindDir];
    // A failed generated build can leave its destination behind before the
    // runner retries the test.  Keep each attempt independent of those
    // partial outputs so the generator reaches the actual build assertion.
    for (const generatedDir of generatedDirs) {
      fs.rmSync(generatedDir, { recursive: true, force: true });
    }

    try {
      runCreate(tempRoot, ['with-tailwind', '--lang', 'en']);
      runCreate(tempRoot, [
        'without-tailwind',
        '--no-tailwind',
        '--lang',
        'en',
      ]);

      const cleanupDependencies: Array<() => void> = [];
      try {
        cleanupDependencies.push(
          materializeGeneratedWorkspaceDependencies(withTailwindDir),
        );
        cleanupDependencies.push(
          materializeGeneratedWorkspaceDependencies(withoutTailwindDir),
        );
        await buildAndReadShellBackground(
          withTailwindDir,
          'rgb(241, 234, 220)',
        );
        await buildAndReadShellBackground(
          withoutTailwindDir,
          'rgba(0, 0, 0, 0)',
        );
      } finally {
        for (const cleanup of cleanupDependencies.reverse()) {
          cleanup();
        }
      }
    } finally {
      for (const generatedDir of generatedDirs) {
        fs.rmSync(generatedDir, { recursive: true, force: true });
      }
    }
  });
});
