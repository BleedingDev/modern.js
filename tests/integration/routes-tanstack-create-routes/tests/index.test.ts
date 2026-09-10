import path from 'path';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
  acquireFixtureLock,
  type ReleaseFixtureLock,
} from '../../../utils/fixtureLock';
import {
  getPort,
  killApp,
  launchOptions,
  modernBuild,
  modernServe,
} from '../../../utils/modernTestUtils';
import { setSuiteTimeout } from '../../../utils/setSuiteTimeout';

setSuiteTimeout(1000 * 60 * 5);

const appDir = path.resolve(__dirname, '../');

describe('routes-tanstack-create-routes', () => {
  let appPort: number;
  let app: unknown;
  let browser: Browser;
  let page: Page;
  let releaseFixtureLock: ReleaseFixtureLock | undefined;
  const pageErrors: string[] = [];

  beforeAll(async () => {
    releaseFixtureLock = await acquireFixtureLock(appDir);
    await modernBuild(appDir);
    appPort = await getPort();
    app = await modernServe(appDir, appPort);
    browser = await puppeteer.launch(launchOptions as any);
    page = await browser.newPage();
    page.on('pageerror', error => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
  });

  afterAll(async () => {
    try {
      if (browser) {
        await browser.close();
      }
      if (app) {
        await killApp(app);
      }
    } finally {
      await releaseFixtureLock?.();
    }
  });

  test('supports createRoutes + modifyRoutes + onBeforeCreateRoutes', async () => {
    const modifiedRes = await fetch(`http://localhost:${appPort}/modified`, {
      headers: {
        Accept: 'text/html',
      },
    });
    expect(modifiedRes.status).toBe(200);
    expect(modifiedRes.headers.get('x-tanstack-before-create-routes')).toBe(
      '1',
    );
    const html = await modifiedRes.text();
    expect(html).toContain('modified:');
    expect(html).toContain('hooked');

    const originalRes = await fetch(`http://localhost:${appPort}/original`, {
      redirect: 'manual',
    });
    expect(originalRes.status).toBe(404);
  });

  test('navigates to rewritten route in browser', async () => {
    await page.goto(`http://localhost:${appPort}/`, {
      waitUntil: ['networkidle0'],
    });
    await page.waitForSelector('[data-testid="link-modified"]');
    const navigationCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    await Promise.all([
      page.click('[data-testid="link-modified"]'),
      page.waitForSelector('#page'),
    ]);

    const pageText = await page.$eval('#page', el => el.textContent);
    expect(pageText).toBe('modified:missing');
    expect(
      await page.evaluate(
        () => performance.getEntriesByType('navigation').length,
      ),
    ).toBe(navigationCount);
    expect(pageErrors).toEqual([]);
  });
});
