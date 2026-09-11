import { defineConfig } from '@rstest/core';

/**
 * Integration worker count.
 *
 * `INTEGRATION_MAX_WORKERS` lets a runner profile change be tried without a code
 * change; otherwise CI gets a fixed 2 and local runs keep full parallelism.
 */
function resolveMaxWorkers(): number | string {
  const override = process.env.INTEGRATION_MAX_WORKERS;
  if (override) {
    const parsed = Number(override);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
    return override;
  }

  return process.env.CI === 'true' ? 2 : '100%';
}

export default defineConfig({
  root: __dirname,
  include: ['integration/**/*.(spec|test).[jt]s?(x)'],
  exclude: ['integration/rstest/**'],
  globals: true,
  // Framework tests spawn many build/dev-server/puppeteer tasks; cap file-level
  // concurrency to avoid CI resource contention without changing assertions.
  //
  // The cap is a worker *count*, not a CPU percentage. `namespace-profile-testing`
  // is an 8 vCPU / 16 GB box, so the old `'50%'` resolved to 4 workers. A single
  // heavy file (routes-tanstack-mf, superapp-portfolio) holds an rstest worker
  // plus up to three `modern dev` servers plus a Chromium at once — 4-5 GB. Four
  // of those in flight exceeds 16 GB and the kernel OOM-kills the whole process
  // group, which is why the Test step died mid-suite with no rstest summary.
  // Two workers keeps the worst case inside the box; coverage is unchanged.
  pool: {
    maxWorkers: resolveMaxWorkers(),
  },
  retry: 1,
  testTimeout: 60_000,
  hookTimeout: 60_000,
  // Peak heap per test file, so a future OOM is diagnosable from the log rather
  // than only visible as an abrupt termination.
  logHeapUsage: process.env.CI === 'true',
});
