import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('performance configuration validation never claims runtime performance', () => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'performance-configuration-validation-'),
  );
  const configDirectory = path.join(workspaceRoot, '.modernjs');
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(configDirectory, 'ultramodern.json'),
    `${JSON.stringify({
      topology: {
        apps: [{ id: 'shell-super-app', kind: 'shell' }],
      },
    })}\n`,
  );

  try {
    const scriptPath = path.resolve(
      __dirname,
      '../templates/workspace-scripts/ultramodern-performance-readiness.mjs',
    );
    const stdout = execFileSync(process.execPath, [scriptPath], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });
    assert.match(stdout, /performance configuration validation reported/u);
    const report = JSON.parse(
      fs.readFileSync(
        path.join(
          workspaceRoot,
          '.codex/reports/performance-readiness/ultramodern-performance-readiness.json',
        ),
        'utf8',
      ),
    );
    assert.equal(report.result, 'configuration-valid');
    assert.deepEqual(report.runtimeMeasurement, {
      performed: false,
      reason: 'static-source-and-configuration-validation-only',
    });
    assert.ok(report.apps.length > 0);

    const runtimeSourcePath = path.join(
      workspaceRoot,
      'apps/shell-super-app/src/modern.runtime.ts',
    );
    fs.mkdirSync(path.dirname(runtimeSourcePath), { recursive: true });
    fs.writeFileSync(
      runtimeSourcePath,
      "window.addEventListener('unload', () => undefined);\n",
    );
    assert.throws(
      () =>
        execFileSync(process.execPath, [scriptPath], {
          cwd: workspaceRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      /bfcache static configuration invariant failed/u,
    );

    const readinessConfigPath = path.join(
      workspaceRoot,
      'scripts/ultramodern-performance-readiness.config.mjs',
    );
    fs.mkdirSync(path.dirname(readinessConfigPath), { recursive: true });
    fs.writeFileSync(
      readinessConfigPath,
      "export default { failOn: 'never' };\n",
    );
    execFileSync(process.execPath, [scriptPath], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });
    const invalidReport = JSON.parse(
      fs.readFileSync(
        path.join(
          workspaceRoot,
          '.codex/reports/performance-readiness/ultramodern-performance-readiness.json',
        ),
        'utf8',
      ),
    );
    assert.equal(invalidReport.result, 'configuration-invalid');
    assert.equal(
      invalidReport.apps[0].signals.find(signal => signal.id === 'bfcache')
        .status,
      'configuration-invalid',
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
