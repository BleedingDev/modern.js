import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Hono-only consumers do not install the optional `effect` peers; the built
// `./hono` entry must load (ESM and CJS) without ever resolving them.
test('built Hono entry loads without optional Effect peers', () => {
  const script = `
    import { createRequire, registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (/^(effect|@effect\\/opentelemetry)(\\/|$)/.test(specifier)) throw new Error('built Hono surface resolved optional peer: ' + specifier);
      return next(specifier, context);
    } });
    await import('@modern-js/plugin-bff-extensions/hono');
    createRequire(import.meta.url)('@modern-js/plugin-bff-extensions/hono');
  `;
  const cwd = path.resolve(__dirname, '..');
  const args = ['--input-type=module', '-e', script];
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr || result.stdout).toBe(0);
});
