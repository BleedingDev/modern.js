import { readFileSync } from 'fs';
import path from 'path';
import { modernBuild } from '../../../utils/modernTestUtils';

describe('custom template', () => {
  test(`should allow to custom template by html.template option`, async () => {
    const appDir = path.resolve(__dirname, '..');

    await modernBuild(appDir);

    const html = readFileSync(
      path.resolve(appDir, `dist/html/index/index.html`),
      'utf8',
    );
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/iu)?.[1];
    const viewportTag = html
      .match(/<meta\b[^>]*>/giu)
      ?.find(tag => /\bname=["']viewport["']/iu.test(tag));
    const viewport = viewportTag?.match(/\bcontent=["']([^"']*)["']/iu)?.[1];
    const rootContent = html.match(
      /<div\b[^>]*\bid=["']root["'][^>]*>([\s\S]*?)<\/div>/iu,
    )?.[1];

    expect(title).toBe('Hello World');
    expect(viewport).toContain('viewport-fit=cover');
    expect(rootContent).toMatch(/^\s*$/u);
  });
});
