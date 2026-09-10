import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildFixtureOnce } from '../../../utils/fixtureBuild';
import {
  getPort,
  killApp,
  modernBuild,
  modernServe,
} from '../../../utils/modernTestUtils';
import { setSuiteTimeout } from '../../../utils/setSuiteTimeout';
import {
  captureBrowserRuntimeDiagnostics,
  createBrowserRuntimeArtifactPaths,
  finishBrowserRuntimeArtifacts,
  startBrowserRuntimeTrace,
} from './browserRuntimeArtifacts';

setSuiteTimeout(1000 * 60 * 10);

type Browser = any;
type BrowserContext = any;
type BrowserType = any;
type Page = any;
type ModerateHttpLoadOperation = 'bootstrap' | 'security-probe' | 'workflow';
type ModerateHttpLoadSample = {
  endedAt: number;
  error?: string;
  ok: boolean;
  operation: ModerateHttpLoadOperation;
  startedAt: number;
  status?: number;
};
type ModerateHttpLoadSummary = {
  completedDuringSmoke: number;
  errors: string[];
  operationCounts: Record<ModerateHttpLoadOperation, number>;
  requestCount: number;
  statusCounts: Record<string, number>;
  unexpectedErrorCount: number;
};

const requireFromRstestBrowserFixture = createRequire(
  path.resolve(__dirname, '../../rstest/basic-app-rstest-browser/package.json'),
);
const { chromium }: { chromium: BrowserType } =
  requireFromRstestBrowserFixture('playwright');

const appDir = path.resolve(__dirname, '../');
const host = 'http://localhost';
const defaultViewport = { width: 1440, height: 960 };

async function resetPortfolio(port: number) {
  const response = await fetch(`${host}:${port}/bff-api/effect/reset`, {
    method: 'POST',
  });
  expect(response.status).toBe(200);
}

async function getByTestIdText(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element: HTMLElement) => {
    return element.textContent ?? '';
  });
}

async function expectByTestIdText(
  page: Page,
  testId: string,
  expected: string,
) {
  await page.waitForFunction(
    ({ expected, testId }: { expected: string; testId: string }) =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent ===
      expected,
    { expected, testId },
  );
  await expect(getByTestIdText(page, testId)).resolves.toBe(expected);
}

async function expectByTestIdTextContaining(
  page: Page,
  testId: string,
  expected: string,
) {
  await page.waitForFunction(
    ({ expected, testId }: { expected: string; testId: string }) =>
      document
        .querySelector(`[data-testid="${testId}"]`)
        ?.textContent?.includes(expected),
    { expected, testId },
  );
  await expect(getByTestIdText(page, testId)).resolves.toContain(expected);
}

function createDeferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function incrementCounter(counter: Record<string, number>, key: string) {
  counter[key] = (counter[key] ?? 0) + 1;
}

function summarizeModerateHttpLoad(
  samples: ModerateHttpLoadSample[],
  input: { smokeEndedAt?: number; smokeStartedAt?: number } = {},
): ModerateHttpLoadSummary {
  const operationCounts: Record<ModerateHttpLoadOperation, number> = {
    bootstrap: 0,
    'security-probe': 0,
    workflow: 0,
  };
  const statusCounts: Record<string, number> = {};
  const errors: string[] = [];
  let completedDuringSmoke = 0;

  for (const sample of samples) {
    operationCounts[sample.operation] += 1;
    if (sample.status !== undefined) {
      incrementCounter(statusCounts, String(sample.status));
    }
    if (
      input.smokeStartedAt !== undefined &&
      input.smokeEndedAt !== undefined &&
      sample.startedAt <= input.smokeEndedAt &&
      sample.endedAt >= input.smokeStartedAt
    ) {
      completedDuringSmoke += 1;
    }
    if (!sample.ok) {
      errors.push(
        `${sample.operation}:${sample.status ?? 'network'}:${sample.error ?? 'unknown error'}`,
      );
    }
  }

  return {
    completedDuringSmoke,
    errors,
    operationCounts,
    requestCount: samples.length,
    statusCounts,
    unexpectedErrorCount: errors.length,
  };
}

async function expectLoadResponseOk(
  port: number,
  operation: ModerateHttpLoadOperation,
  pathname: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${host}:${port}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(5000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${operation} ${response.status} ${text.slice(0, 200)}`);
  }
  return response.status;
}

async function runModerateHttpLoadOperation(
  port: number,
  operation: ModerateHttpLoadOperation,
  workerIndex: number,
) {
  if (operation === 'bootstrap') {
    return expectLoadResponseOk(port, operation, '/bff-api/effect/bootstrap');
  }

  if (operation === 'security-probe') {
    return expectLoadResponseOk(
      port,
      operation,
      '/bff-api/effect/security/probe',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer browser-runtime-load-secret',
          'content-type': 'application/json',
          origin: `${host}:${port}`,
          'x-csrf-token': 'superapp-valid-csrf',
          'x-tenant-id': 'security-root',
          'x-user-role': 'security-admin',
        },
        body: JSON.stringify({
          targetTenant: 'security-root',
          targetAppId: 'tenant-security',
          action: 'load-smoke-security-probe',
          requestId: `browser-runtime-security-${workerIndex}`,
          mutation: false,
        }),
      },
    );
  }

  return expectLoadResponseOk(
    port,
    operation,
    '/bff-api/effect/apps/mobility-marketplace/workflow',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'load-smoke-workflow',
        actor: `browser.load.${workerIndex}`,
        requestId: `browser-runtime-workflow-${workerIndex}`,
      }),
    },
  );
}

function startModerateHttpLoad(port: number) {
  const concurrency = 6;
  const maxRunUntil = Date.now() + 1000 * 60;
  const operations: ModerateHttpLoadOperation[] = [
    'bootstrap',
    'workflow',
    'security-probe',
  ];
  const ready = createDeferred();
  const samples: ModerateHttpLoadSample[] = [];
  let readyResolved = false;
  let stopRequested = false;

  const recordSample = (sample: ModerateHttpLoadSample) => {
    samples.push(sample);
    if (!readyResolved && samples.length >= concurrency) {
      readyResolved = true;
      ready.resolve();
    }
  };

  const workers = Array.from(
    { length: concurrency },
    async (_, workerIndex) => {
      let iteration = 0;
      while (!stopRequested && Date.now() < maxRunUntil) {
        const operation =
          operations[(workerIndex + iteration) % operations.length];
        const startedAt = Date.now();
        try {
          const status = await runModerateHttpLoadOperation(
            port,
            operation,
            workerIndex,
          );
          recordSample({
            endedAt: Date.now(),
            ok: true,
            operation,
            startedAt,
            status,
          });
        } catch (error) {
          recordSample({
            endedAt: Date.now(),
            error: error instanceof Error ? error.message : String(error),
            ok: false,
            operation,
            startedAt,
          });
        }
        iteration += 1;
        await sleep(35 + workerIndex * 5);
      }
    },
  );

  return {
    ready: ready.promise,
    stop: async (
      input: { smokeEndedAt?: number; smokeStartedAt?: number } = {},
    ) => {
      stopRequested = true;
      await Promise.all(workers);
      return summarizeModerateHttpLoad(samples, input);
    },
  };
}

async function expectNoVisibleCrashState(page: Page) {
  const crashState = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const shell = document.querySelector('[data-testid="portfolio-shell"]');
    return {
      bodyTextLength: bodyText.trim().length,
      crashText: bodyText.match(
        /Application error|Unhandled Runtime Error|Hydration failed|Minified React error|Cannot read properties|Something went wrong|500 Internal Server Error|404 Not Found/i,
      )?.[0],
      shellVisible: Boolean(shell),
      visibleErrorTexts: Array.from(
        document.querySelectorAll(
          '[role="alert"], [data-testid*="error"], .error',
        ),
      )
        .map(element => element.textContent?.trim() ?? '')
        .filter(Boolean),
    };
  });

  expect(crashState.bodyTextLength).toBeGreaterThan(100);
  expect(crashState.crashText).toBeUndefined();
  expect(crashState.shellVisible).toBe(true);
  expect(crashState.visibleErrorTexts).toEqual([]);
}

async function expectPortfolioHome(page: Page) {
  await page.getByTestId('portfolio-page').waitFor();
  await page.getByTestId('pilot-command-center').waitFor();
  await expectByTestIdText(page, 'route-kind', 'portfolio-command-center');
  await expectByTestIdTextContaining(
    page,
    'shell-mode',
    'tanstack-effect-superapp-portfolio',
  );
  await expectByTestIdText(page, 'summary-apps', 'apps:5');
  expect(new URL(page.url()).pathname).toBe('/');
}

async function createRuntimePage(browser: Browser, testId: string) {
  const artifactPaths = createBrowserRuntimeArtifactPaths(testId);
  const context: BrowserContext = await browser.newContext({
    viewport: defaultViewport,
  });
  await startBrowserRuntimeTrace(context);
  const page = await context.newPage();
  const diagnostics = captureBrowserRuntimeDiagnostics(page);
  return { ...artifactPaths, context, diagnostics, page, testId };
}

async function finishRuntimePage(
  runtimePage: Awaited<ReturnType<typeof createRuntimePage>>,
  failed: boolean,
) {
  try {
    await finishBrowserRuntimeArtifacts({
      artifactDir: runtimePage.artifactDir,
      context: runtimePage.context,
      diagnostics: runtimePage.diagnostics,
      failed,
      page: runtimePage.page,
      testId: runtimePage.testId,
      videoDir: runtimePage.videoDir,
    });
  } finally {
    await runtimePage.context.close();
  }
}

async function writeModerateHttpLoadSummary(
  artifactDir: string,
  summary: ModerateHttpLoadSummary,
) {
  await writeFile(
    path.join(artifactDir, 'moderate-http-load-summary.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        suite: 'superapp-portfolio-browser-runtime',
        testId: 'route-mutation-under-moderate-load',
        ...summary,
      },
      null,
      2,
    )}\n`,
  );
}

describe('superapp portfolio browser runtime coverage', () => {
  let port: number;
  let app: Awaited<ReturnType<typeof modernServe>> | undefined;
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (!existsSync(chromium.executablePath())) {
      throw new Error(
        'Playwright chromium executable is missing. Run playwright install before running superapp browser runtime coverage.',
      );
    }
    const build = await buildFixtureOnce(appDir, {
      build: () => modernBuild(appDir),
    });
    expect(build.code).toBe(0);
    port = await getPort();
    app = await modernServe(appDir, port, {
      cwd: appDir,
      stderr: false,
      stdout: false,
    });
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    await killApp(app);
  });

  test('keeps route mutation healthy under bounded concurrent HTTP load', async () => {
    await resetPortfolio(port);
    const moderateLoad = startModerateHttpLoad(port);
    await moderateLoad.ready;
    const runtimePage = await createRuntimePage(
      browser!,
      'route-mutation-under-moderate-load',
    );
    const { diagnostics, page } = runtimePage;
    let failed = false;
    let loadSummary: ModerateHttpLoadSummary | undefined;
    let smokeStartedAt: number | undefined;
    let smokeEndedAt: number | undefined;

    try {
      smokeStartedAt = Date.now();
      await page.goto(`${host}:${port}`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('portfolio-ready').waitFor();
      await page.waitForLoadState('networkidle');
      await expectPortfolioHome(page);
      await expectNoVisibleCrashState(page);

      await page.getByTestId('nav-mobility').click();
      await page.getByTestId('portfolio-app-page').waitFor();
      await page
        .getByRole('heading', { name: 'Mobility Marketplace' })
        .waitFor();
      await expectByTestIdText(page, 'app-route-kind', 'mobility');
      await page.getByTestId('run-workflow').click();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-testid="workflow-event"]')
          ?.textContent?.includes(':accepted'),
      );
      await expectNoVisibleCrashState(page);

      await page.getByTestId('nav-portfolio').click();
      await expectPortfolioHome(page);
      await expectNoVisibleCrashState(page);
      smokeEndedAt = Date.now();
      loadSummary = await moderateLoad.stop({ smokeEndedAt, smokeStartedAt });
      await writeModerateHttpLoadSummary(runtimePage.artifactDir, loadSummary);

      expect(loadSummary.requestCount).toBeGreaterThanOrEqual(12);
      expect(loadSummary.completedDuringSmoke).toBeGreaterThan(0);
      expect(loadSummary.unexpectedErrorCount).toBe(0);
      expect(loadSummary.operationCounts.bootstrap).toBeGreaterThan(0);
      expect(loadSummary.operationCounts.workflow).toBeGreaterThan(0);
      expect(loadSummary.operationCounts['security-probe']).toBeGreaterThan(0);
      expect(loadSummary.statusCounts['200']).toBe(loadSummary.requestCount);
      expect(diagnostics.brokenResources).toEqual([]);
      expect(diagnostics.hydrationWarnings).toEqual([]);
      expect(diagnostics.errors).toEqual([]);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!loadSummary) {
        smokeEndedAt ??= Date.now();
        loadSummary = await moderateLoad.stop({ smokeEndedAt, smokeStartedAt });
        await writeModerateHttpLoadSummary(
          runtimePage.artifactDir,
          loadSummary,
        );
      }
      await finishRuntimePage(runtimePage, failed);
    }
  });
});
