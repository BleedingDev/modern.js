import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import {
  acquireFixtureLocks,
  type ReleaseFixtureLock,
} from '../../../utils/fixtureLock';
import {
  getPort,
  killApp,
  launchOptions,
  modernBuild,
  modernServe,
} from '../../../utils/modernTestUtils';

rstest.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });
const root = path.resolve(__dirname, '..');
const producer = path.join(root, 'bff-api-app');
const clients = ['bff-client-app', 'bff-indep-client-app'];

describe.sequential('native Effect clients across packages', () => {
  let releaseLocks: ReleaseFixtureLock;
  let browser: Browser;
  let producerApp: Awaited<ReturnType<typeof modernServe>>;
  let producerOrigin: string;
  beforeAll(async () => {
    releaseLocks = await acquireFixtureLocks([
      producer,
      ...clients.map(name => path.join(root, name)),
    ]);
    expect(
      (await modernBuild(producer, [], { stdout: false, stderr: false })).code,
    ).toBe(0);
    const port = await getPort();
    producerOrigin = `http://127.0.0.1:${port}`;
    producerApp = await modernServe(producer, port, {});
    browser = await puppeteer.launch(launchOptions);
  });
  afterAll(async () => {
    await browser?.close();
    await killApp(producerApp);
    await releaseLocks?.();
  });

  test('ships the shared contract without generated client or runtime code', () => {
    expect(fs.existsSync(path.join(producer, 'dist-1/client'))).toBe(false);
    expect(fs.existsSync(path.join(producer, 'dist-1/runtime'))).toBe(false);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(producer, 'package.json'), 'utf8'),
    );
    expect(pkg.exports['./effect-contract']).toBe('./shared/effect/api.ts');
    expect(pkg.exports['./runtime']).toBeUndefined();
    expect(pkg.exports['./api/effect/index']).toBeUndefined();
  });

  for (const name of clients) {
    test(`inferred requests work through ${name === 'bff-client-app' ? 'the hosted API' : 'a separate API origin'}`, async () => {
      const appDir = path.join(root, name);
      const env = { MODERN_TEST_API_ORIGIN: producerOrigin };
      expect(
        (await modernBuild(appDir, [], { env, stdout: false, stderr: false }))
          .code,
      ).toBe(0);
      const port = await getPort();
      const app = await modernServe(appDir, port, { env });
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(String(error)));
      try {
        await page.goto(`http://localhost:${port}/effect`, {
          waitUntil: 'networkidle0',
        });
        await page.waitForFunction(() =>
          document
            .querySelector('.effect-context')
            ?.textContent?.startsWith('effect:cs-CZ:00-'),
        );
        expect(await page.$eval('.effect', el => el.textContent)).toBe(
          'effect:Hello get bff-api-app effect',
        );
        expect(
          await page.$eval('.effect-context', el => el.textContent),
        ).toMatch(/^effect:cs-CZ:00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
        expect(errors).toEqual([]);
        if (name === 'bff-client-app') {
          const denied = await fetch(
            `http://localhost:${port}/api-app/effect/hello`,
          );
          expect(denied.status).toBe(403);
          expect(await denied.json()).toMatchObject({
            code: 'BFF_CROSS_PROJECT_POLICY_DENIED',
          });
        }
      } finally {
        await page.close();
        await killApp(app);
      }
    });
  }
});
