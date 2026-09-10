import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { runOxlintRules } from '../src/cli/oxlint';

const require = createRequire(import.meta.url);
const withFixture = (run: (root: string) => void) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-oxlint-output-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

for (const fixture of [
  {
    name: 'technical locale branches',
    source:
      'export const select = locale => locale === "cs" ? "page" : "undefined";',
    diagnostic: undefined,
  },
  {
    name: 'visible locale branches',
    source:
      'export const select = locale => locale === "cs" ? "Český text" : "English copy";',
    diagnostic: /no-manual-locale-copy-branching/u,
  },
  {
    name: 'visible JSX attributes',
    source: 'export const View = () => <input placeholder="Visible copy" />;',
    diagnostic: /no-literal-visible-jsx-attributes/u,
  },
]) {
  test(`Oxlint preserves diagnostics for ${fixture.name}`, () =>
    withFixture(root => {
      fs.writeFileSync(path.join(root, 'src/fixture.tsx'), fixture.source);
      const result = runOxlintRules({
        cwd: root,
        targets: ['src'],
        rules: {
          'ultramodern/no-manual-locale-copy-branching': 'error',
          'ultramodern/no-literal-visible-jsx-attributes': 'error',
        },
      });
      const output = stripVTControlCharacters(result.stdout + result.stderr);
      if (fixture.diagnostic) {
        expect(result.exitCode).toBe(1);
        expect(output).toMatch(fixture.diagnostic);
        expect(output).toMatch(/fixture\.tsx:1:\d+/u);
        expect(output).not.toMatch(/Error running JS plugin/u);
      } else {
        expect(result.exitCode).toBe(0);
        expect(output).not.toMatch(/Error running JS plugin/u);
        expect(output).not.toMatch(
          /no-manual-locale-copy-branching|no-literal-visible-jsx-attributes/u,
        );
      }
    }));
}

test('Oxlint prints plugin crashes instead of an empty unix-format warning', () =>
  withFixture(root => {
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: '@modern-js/code-tools', type: 'module' }),
    );
    fs.copyFileSync(
      path.resolve(__dirname, '../src/cli/oxlint.ts'),
      path.join(root, 'src/oxlint.ts'),
    );
    fs.writeFileSync(
      path.join(root, 'src/fixture.tsx'),
      'export const value = 1;',
    );
    fs.writeFileSync(
      path.join(root, 'src/oxlint-plugin.ts'),
      `export default {
    meta: { name: 'ultramodern' }, rules: { crash: { meta: { schema: [] }, create() {
      return { Program() { throw new Error('deliberate-i18n-plugin-failure'); } };
    } } }
  };`,
    );
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.symlinkSync(
      path.dirname(require.resolve('oxlint/package.json')),
      path.join(root, 'node_modules/oxlint'),
      'dir',
    );
    const adapter = pathToFileURL(path.join(root, 'src/oxlint.ts')).href;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
    import { runOxlintRules, printOxlintOutput } from ${JSON.stringify(adapter)};
    const result = runOxlintRules({ cwd: ${JSON.stringify(root)}, targets: ['src/fixture.tsx'], rules: { 'ultramodern/crash': 'error' } });
    printOxlintOutput(result); process.exitCode = result.exitCode;
  `,
      ],
      { encoding: 'utf8' },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/Error running JS plugin/u);
    expect(output).toMatch(/deliberate-i18n-plugin-failure/u);
    expect(output).toMatch(/fixture\.tsx/u);
    expect(output).not.toMatch(/:0:0: {2}\[Warning\]/u);
  }));
