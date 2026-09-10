import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { updateGeneratedPackageScripts } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort';
import { preserveConsumerWorkspaceArtifacts } from '../src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership';
import { generateUltramodernWorkspace } from '../src/ultramodern-workspace';
import { createPackagedWorkspaceValidationScript } from '../src/ultramodern-workspace/workspace-scripts';

const bootstrap = 'node ./scripts/bootstrap-agent-skills.mts --postinstall';

test.each([
  `${bootstrap} && oxfmt .`,
  `oxfmt . && ${bootstrap}`,
  "oxfmt . '!repos/**' && node ./scripts/bootstrap-agent-skills.mjs --postinstall",
])('migration removes historical install formatting: %s', postinstall => {
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

test.each([
  'oxfmt .',
  'node custom-bootstrap.cjs && oxfmt .',
  'node ./scripts/bootstrap-agent-skills.mts --check && oxfmt .',
])('migration preserves unowned postinstall: %s', postinstall => {
  const packageJson = { scripts: { postinstall } };
  const preserved: string[] = [];
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
    onPreserveScript: name => preserved.push(name),
  });

  assert.equal(packageJson.scripts.postinstall, postinstall);
  assert.ok(preserved.includes('postinstall'));
});

test('migration leaves preserved authored bootstrap scripts intact', () => {
  const postinstall =
    'node ./scripts/bootstrap-agent-skills.mjs --postinstall && oxfmt .';
  const packageJson = { scripts: { postinstall } };
  updateGeneratedPackageScripts(packageJson, {
    relativePackageFile: 'package.json',
    preservedArtifacts: new Set(['scripts/bootstrap-agent-skills.mjs']),
  });

  assert.equal(packageJson.scripts.postinstall, postinstall);
});

test.each([
  'node custom.cjs "literal && oxfmt . && argument"',
  "node custom.cjs 'literal && argument'",
  'node custom.cjs "escaped \\" quote && argument"',
  'node custom.cjs escaped\\&\\&argument',
])('migration preserves quoted and escaped custom arguments: %s', custom => {
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

test.each(
  opaquePostinstallCommands,
)('migration preserves opaque shell code byte-for-byte: %s', postinstall => {
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

test('historical postinstall assertions migrate only in otherwise canonical validators', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-postinstall-ownership-'),
  );
  try {
    const relativePath = 'scripts/validate-ultramodern-workspace.mts';
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath));
    // Historical ownership compares validator implementations; current generated
    // workspace entrypoints only delegate to the installed package.
    const current = createPackagedWorkspaceValidationScript(
      'postinstall-owned',
      true,
    );
    const start = current.indexOf(
      'const postinstall = rootPackage.scripts?.postinstall;',
    );
    const end = current.indexOf(
      "assert(rootPackage.scripts?.['agents:refs:install']",
      start,
    );
    assert.ok(start >= 0 && end > start);
    const historicalAssertion =
      "assert(rootPackage.scripts?.postinstall === 'node ./scripts/bootstrap-agent-skills.mts --postinstall && oxfmt .', 'Root postinstall must run the default-on Codex skills bootstrap, format installed skills through the cross-platform ignore configuration, and leave reference repository installs explicit');\n";
    const historical =
      current.slice(0, start) + historicalAssertion + current.slice(end);
    for (const [source, retained] of [
      [historical, false],
      [historical + '\nthrow new Error("consumer policy");\n', true],
      [
        historical.replace('--postinstall && oxfmt .', '--check && oxfmt .'),
        true,
      ],
    ] as const) {
      fs.writeFileSync(filePath, source);
      const guarded = preserveConsumerWorkspaceArtifacts(
        createMigrationIo(root, false),
        [
          {
            relativePath,
            content: current,
            generatedDataBinding: 'workspaceValidationContract',
          },
        ],
      );
      assert.equal(guarded.preservedPaths.has(relativePath), retained);
      guarded.io.write(filePath, current);
      assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        retained ? source : current,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
