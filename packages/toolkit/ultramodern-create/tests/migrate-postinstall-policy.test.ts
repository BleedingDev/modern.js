import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateGeneratedPackageScripts } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort';
import { generateUltramodernWorkspace } from '../src/ultramodern-workspace';

const bootstrap = 'node ./scripts/bootstrap-agent-skills.mts --postinstall';

test('migration removes historical install formatting', () => {
  const postinstall = `${bootstrap} && oxfmt .`;
  const packageJson = {
    scripts: {
      postinstall,
      format: 'oxfmt .',
      'format:check': 'oxfmt --check .',
    },
  };
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
  });

  assert.equal(packageJson.scripts.postinstall, bootstrap);
  assert.equal(packageJson.scripts.format, 'oxfmt .');
  assert.equal(packageJson.scripts['format:check'], 'oxfmt --check .');
  assert.equal(
    updateGeneratedPackageScripts(packageJson, {
      relativePackageFile: 'package.json',
    }),
    false,
  );
});

test('migration preserves custom postinstall order and formatter options', () => {
  const packageJson = {
    scripts: {
      postinstall: `node before.cjs && oxfmt . '!repos/**' && node between.cjs && ${bootstrap} && oxfmt ./generated --config custom.ts && node after.cjs`,
    },
  };
  const preserved: string[] = [];
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
    onPreserveScript: name => preserved.push(name),
  });

  assert.equal(
    packageJson.scripts.postinstall,
    `node before.cjs && node between.cjs && ${bootstrap} && oxfmt ./generated --config custom.ts && node after.cjs`,
  );
  assert.ok(preserved.includes('postinstall'));
});

test('migration preserves unowned postinstall', () => {
  const postinstall = 'node custom-bootstrap.cjs && oxfmt .';
  const packageJson = { scripts: { postinstall } };
  const preserved: string[] = [];
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
    onPreserveScript: name => preserved.push(name),
  });

  assert.equal(packageJson.scripts.postinstall, postinstall);
  assert.ok(preserved.includes('postinstall'));
});

test('migration preserves quoted and escaped custom arguments', () => {
  const custom = 'node custom.cjs "literal && oxfmt . && argument"';
  const packageJson = {
    scripts: { postinstall: `${custom} && ${bootstrap} && oxfmt .` },
  };
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
  });
  assert.equal(packageJson.scripts.postinstall, `${custom} && ${bootstrap}`);
});

const opaquePostinstallCommands = [
  `node custom.cjs "$(echo '&& ${bootstrap} &&')" && oxfmt .`,
  `node custom.cjs \`echo '&& ${bootstrap} &&'\` && oxfmt .`,
  `node custom.cjs | ${bootstrap} && oxfmt .`,
  `${bootstrap} > bootstrap.log && oxfmt .`,
  `node custom.cjs # && ${bootstrap} && oxfmt .`,
];

test('migration preserves opaque shell code byte-for-byte', () => {
  const postinstall = opaquePostinstallCommands[0]!;
  const packageJson = { scripts: { postinstall } };
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
  });
  assert.equal(packageJson.scripts.postinstall, postinstall);
});

test('generated validator accepts flat custom hooks and rejects quoted or opaque bootstrap claims', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-postinstall-contract-'),
  );
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'postinstall-contract',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    const packagePath = path.join(root, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scenarios = [
      { command: bootstrap, valid: true },
      {
        command: `node before.cjs "literal && argument" && ${bootstrap} && node after.cjs`,
        valid: true,
      },
      { command: `node custom.cjs "&& ${bootstrap} &&"`, valid: false },
      { command: bootstrap.replace('--postinstall', '--check'), valid: false },
      ...opaquePostinstallCommands.map(command => ({ command, valid: false })),
    ];
    for (const scenario of scenarios) {
      packageJson.scripts.postinstall = scenario.command;
      fs.writeFileSync(packagePath, JSON.stringify(packageJson));
      const result = spawnSync(
        process.execPath,
        ['scripts/validate-ultramodern-workspace.mts'],
        { cwd: root, encoding: 'utf8' },
      );
      if (scenario.valid) {
        assert.equal(result.status, 0, result.stderr);
      } else {
        assert.notEqual(result.status, 0, scenario.command);
        assert.match(result.stderr, /Root postinstall must run/u);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
