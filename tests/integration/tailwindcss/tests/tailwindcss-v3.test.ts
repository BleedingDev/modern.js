import path from 'path';
import { fixtures, launchAppWithPage } from './utils';

rstest.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

describe('use tailwindcss v3', () => {
  const appDir = path.resolve(fixtures, 'tailwindcss-v3');

  test(`should show style by use tailwindcss theme`, async () => {
    const { page, clear } = await launchAppWithPage(appDir);
    try {
      const primaryColorElement = await page.waitForSelector('.bg-primary');
      const backgroundColor = await page.evaluate(element => {
        const style = window.getComputedStyle(element);
        return style.backgroundColor;
      }, primaryColorElement);

      expect(backgroundColor).toMatch(/rgb\(0, 0, 255\)|#0000ff|blue/i);

      const macroElement = await page.waitForSelector(
        '[data-testid="tailwind-v3-macro"]',
      );
      const macroStyle = await page.evaluate(element => {
        const style = window.getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          height: style.height,
          width: style.width,
        };
      }, macroElement);

      expect(macroStyle).toEqual({
        backgroundColor: 'rgb(253, 224, 71)',
        height: '50px',
        width: '200px',
      });
    } finally {
      await clear();
    }
  });
});
