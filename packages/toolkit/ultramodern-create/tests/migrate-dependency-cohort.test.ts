import assert from 'node:assert/strict';
import { parseUltramodernReleaseCohort } from '../src/ultramodern-release-cohort';
import { updateSameContractDependencies } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort';
import {
  assertSameContractDelta,
  prepareSameContractUpdate,
  replaceJsonStringLeaves,
  replaceReleaseAgeSelectors,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/same-contract';

function cohort(version: string) {
  return parseUltramodernReleaseCohort({
    schema: 'bleedingdev.ultramodern.release-cohort',
    schemaVersion: 1,
    source: {
      commit: `commit-${version}`,
      repository: 'https://github.com/BleedingDev/ultramodern.js',
    },
    release: { tag: version, version },
    aliases: { '@modern-js/runtime': '@bleedingdev/modern-js-runtime' },
    packages: [
      {
        sourceName: '@modern-js/runtime',
        targetName: '@bleedingdev/modern-js-runtime',
        version,
      },
    ],
  });
}

test('same-contract dependency update cannot add a runtime extension or rename creator', () => {
  const source = cohort('3.9.0-ultramodern.3');
  const target = cohort('3.9.0-ultramodern.4');
  const manifest = {
    scripts: { custom: 'keep me' },
    dependencies: {
      '@modern-js/runtime':
        'npm:@bleedingdev/modern-js-runtime@3.9.0-ultramodern.3',
      '@modern-js/create': 'consumer-owned',
      consumer: '^1.2.3',
    },
  };
  assert.deepEqual(updateSameContractDependencies(manifest, source, target), [
    {
      section: 'dependencies',
      name: '@modern-js/runtime',
      value: 'npm:@bleedingdev/modern-js-runtime@3.9.0-ultramodern.4',
    },
  ]);
  assert.deepEqual(manifest, {
    scripts: { custom: 'keep me' },
    dependencies: {
      '@modern-js/runtime':
        'npm:@bleedingdev/modern-js-runtime@3.9.0-ultramodern.4',
      '@modern-js/create': 'consumer-owned',
      consumer: '^1.2.3',
    },
  });
});

test('same-contract rejects a declaration that does not match the authenticated source', () => {
  assert.throws(
    () =>
      updateSameContractDependencies(
        { dependencies: { '@modern-js/runtime': '^3.9.0' } },
        cohort('3.9.0-ultramodern.3'),
        cohort('3.9.0-ultramodern.4'),
      ),
    /authenticated source cohort/,
  );
});

test('JSON release edits preserve every unrelated byte and reject duplicate ownership', () => {
  const original =
    '{\r\n\t"scripts" : {"keep":"old"}, "dependencies": {"@modern-js/runtime" : "old"}, "unknown": ["old",1]\r\n}\r\n';
  const expected = original.replace(
    '"@modern-js/runtime" : "old"',
    '"@modern-js/runtime" : "new"',
  );
  assert.equal(
    replaceJsonStringLeaves(original, [
      { keys: ['dependencies', '@modern-js/runtime'], value: 'new' },
    ]),
    expected,
  );
  assert.throws(
    () =>
      replaceJsonStringLeaves('{"x":"old","x":"old"}', [
        { keys: ['x'], value: 'new' },
      ]),
    /duplicate JSON property/,
  );
});

test('net delta rejects a target subprocess changing consumer source or unprepared JSON', () => {
  const plan = {
    classification: 'same-contract' as const,
    reason: '',
    writes: [{ path: 'package.json', content: 'prepared' }],
    manifests: ['package.json'],
    coherentLock: false,
  };
  const file = (content: string) => ({
    content: Buffer.from(content),
    mode: 0o644,
  });
  assert.throws(
    () =>
      assertSameContractDelta(plan, [
        {
          relativePath: 'src/main.ts',
          before: file('before'),
          after: file('after'),
        },
      ]),
    /unapproved change/,
  );
  assert.throws(
    () =>
      assertSameContractDelta(plan, [
        {
          relativePath: 'package.json',
          before: file('before'),
          after: file('unprepared'),
        },
      ]),
    /unapproved change/,
  );
  assert.doesNotThrow(() =>
    assertSameContractDelta(plan, [
      {
        relativePath: 'package.json',
        before: file('before'),
        after: file('prepared'),
      },
    ]),
  );
});

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { yaml } from '@modern-js/utils';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { updateGeneratedPnpmWorkspacePolicy } from '../src/ultramodern-tooling/commands/migrate-strict-effect/pnpm-policy';
import { runWorkspaceTransaction } from '../src/ultramodern-workspace/add-vertical/transaction';
import {
  createWorkspace,
  linkWorkspaceFormatterDependencies,
  snapshotWorkspace,
} from './helpers/workspace-kit';

test('release-age YAML edits touch only authenticated sequence scalar values', () => {
  const source = cohort('3.9.0-ultramodern.5');
  const target = cohort('3.9.0-ultramodern.6');
  const selector = '@bleedingdev/modern-js-runtime@3.9.0-ultramodern.5';
  const input = `# ${selector}\r\nminimumReleaseAgeExclude: ["${selector}", 'consumer@1.2.3'] # keep\r\nconsumer: '${selector}'\r\n`;
  const expected = input.replace(
    `"${selector}"`,
    '"@bleedingdev/modern-js-runtime@3.9.0-ultramodern.6"',
  );
  assert.equal(replaceReleaseAgeSelectors(input, source, target), expected);
  assert.equal(replaceReleaseAgeSelectors(expected, target, target), expected);
  for (const invalid of [
    `minimumReleaseAgeExclude: ['consumer@1.2.3']`,
    `minimumReleaseAgeExclude: ['${selector}', '${selector}']`,
    `shared: &selectors ['${selector}']\nminimumReleaseAgeExclude: *selectors`,
    `minimumReleaseAgeExclude: [&selector '${selector}']\nconsumer: *selector`,
  ])
    assert.throws(
      () => replaceReleaseAgeSelectors(invalid, source, target),
      /Release-age/,
    );
});

function setupNativeCohortWorkspace(name: string) {
  const { tempRoot, workspaceDir } = createWorkspace(name);
  const validatorPath = path.join(
    workspaceDir,
    'scripts/validate-ultramodern-workspace.mts',
  );
  linkWorkspaceFormatterDependencies(workspaceDir);
  const nativePaths = Object.keys(snapshotWorkspace(workspaceDir)).filter(
    file =>
      file === 'scripts/validate-ultramodern-workspace.mts' ||
      file.endsWith('/shared/ultramodern-build.ts'),
  );
  const formatted = spawnSync(
    process.execPath,
    [
      path.resolve(__dirname, '../node_modules/oxfmt/bin/oxfmt'),
      '--write',
      ...nativePaths,
    ],
    { cwd: workspaceDir, encoding: 'utf8' },
  );
  assert.equal(formatted.status, 0, `${formatted.stdout}\n${formatted.stderr}`);

  const source = cohort('3.9.0-ultramodern.5');
  const target = cohort('3.9.0-ultramodern.6');
  const packageSource = {
    strategy: 'install' as const,
    modernPackageVersion: source.release.version,
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  const compactPath = path.join(workspaceDir, '.modernjs/ultramodern.json');
  const raw = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
  raw.packageSource = packageSource;
  fs.writeFileSync(compactPath, JSON.stringify(raw, null, 2) + '\n');
  const rootPath = path.join(workspaceDir, 'package.json');
  const root = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
  root.modernjs.packageSource = {
    strategy: 'install',
    config: './.modernjs/ultramodern.json',
  };
  fs.writeFileSync(rootPath, JSON.stringify(root, null, 2) + '\n');
  fs.writeFileSync(
    path.join(workspaceDir, '.modernjs/release-cohort.json'),
    JSON.stringify(source, null, 2) + '\n',
  );
  for (const [relative, content] of Object.entries(
    snapshotWorkspace(workspaceDir),
  )) {
    if (!relative.endsWith('package.json')) continue;
    const manifest = JSON.parse(content);
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      if (manifest[section]?.['@modern-js/runtime']) {
        manifest[section]['@modern-js/runtime'] =
          `npm:@bleedingdev/modern-js-runtime@${source.release.version}`;
      }
    }
    fs.writeFileSync(
      path.join(workspaceDir, relative),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
  updateGeneratedPnpmWorkspacePolicy(
    createMigrationIo(workspaceDir, false),
    packageSource,
    { releaseCohort: source },
  );
  const policyPath = path.join(workspaceDir, 'pnpm-workspace.yaml');
  const originalPolicy = fs.readFileSync(policyPath, 'utf8');
  const comment =
    '# authored policy comment: @bleedingdev/modern-js-runtime@3.9.0-ultramodern.5\r\n';
  fs.writeFileSync(
    policyPath,
    comment + originalPolicy.replaceAll('\n', '\r\n'),
  );
  const before = snapshotWorkspace(workspaceDir);
  const prepareStaged = (installedSource: typeof source) =>
    runWorkspaceTransaction(workspaceDir, stage => {
      assert.notEqual(stage, workspaceDir);
      assert.equal(fs.existsSync(path.join(stage, 'node_modules')), false);
      assert.equal(
        fs.readFileSync(path.join(stage, 'oxfmt.config.ts'), 'utf8'),
        fs.readFileSync(path.join(workspaceDir, 'oxfmt.config.ts'), 'utf8'),
      );
      return prepareSameContractUpdate(
        createMigrationIo(stage, false, workspaceDir),
        JSON.parse(
          fs.readFileSync(
            path.join(stage, '.modernjs/ultramodern.json'),
            'utf8',
          ),
        ),
        { ...packageSource, modernPackageVersion: target.release.version },
        target,
        installedSource,
      );
    });
  return {
    tempRoot,
    workspaceDir,
    validatorPath,
    source,
    target,
    packageSource,
    before,
    originalPolicy,
    comment,
    policyPath,
    raw,
    prepareStaged,
  };
}

test('native same-contract classifier accepts only exact cohort policy advancement and repeats without writes', () => {
  const ctx = setupNativeCohortWorkspace('cohort-policy');
  try {
    const plan = ctx.prepareStaged(ctx.source);
    assert.equal(plan.classification, 'same-contract', plan.reason);
    assert.deepEqual(snapshotWorkspace(ctx.workspaceDir), ctx.before);
    const write = plan.writes.find(item => item.path === 'pnpm-workspace.yaml');
    assert.ok(write);
    assert.deepEqual(write.pointers, ['/minimumReleaseAgeExclude']);
    assert.equal(
      write.content,
      ctx.comment +
        ctx.originalPolicy
          .replace(
            '@bleedingdev/modern-js-runtime@3.9.0-ultramodern.5',
            '@bleedingdev/modern-js-runtime@3.9.0-ultramodern.6',
          )
          .replaceAll('\n', '\r\n'),
    );
    assert.ok(
      plan.writes.every(item => !/\.(?:[cm]?[jt]sx?)$/.test(item.path)),
    );

    for (const item of plan.writes)
      fs.writeFileSync(path.join(ctx.workspaceDir, item.path), item.content);
    const repeated = ctx.prepareStaged(ctx.target);
    assert.equal(repeated.classification, 'same-contract', repeated.reason);
    assert.deepEqual(repeated.writes, []);
  } finally {
    fs.rmSync(ctx.tempRoot, { recursive: true, force: true });
  }
});

test('native same-contract classifier falls back to historical migration when the policy shape is incompatible or the validator is authored', () => {
  const ctx = setupNativeCohortWorkspace('cohort-policy-ownership');
  try {
    const plan = ctx.prepareStaged(ctx.source);
    assert.equal(plan.classification, 'same-contract', plan.reason);

    const alteredPolicy = yaml.load(
      ctx.before['pnpm-workspace.yaml'],
    ) as Record<string, unknown>;
    delete alteredPolicy.trustPolicy;
    fs.writeFileSync(ctx.policyPath, yaml.dump(alteredPolicy));
    const incompatible = prepareSameContractUpdate(
      createMigrationIo(ctx.workspaceDir, true),
      ctx.raw,
      {
        ...ctx.packageSource,
        modernPackageVersion: ctx.target.release.version,
      },
      ctx.target,
      ctx.source,
    );
    assert.equal(incompatible.classification, 'historical-migration');
    fs.writeFileSync(ctx.policyPath, ctx.before['pnpm-workspace.yaml']);
    assert.throws(
      () =>
        prepareSameContractUpdate(
          createMigrationIo(ctx.workspaceDir, true),
          ctx.raw,
          {
            ...ctx.packageSource,
            modernPackageVersion: ctx.target.release.version,
          },
          ctx.target,
          ctx.target,
        ),
      /installed source cohort/,
    );

    for (const item of plan.writes)
      fs.writeFileSync(path.join(ctx.workspaceDir, item.path), item.content);
    const authoredValidator =
      fs.readFileSync(ctx.validatorPath, 'utf8') +
      "\nexport const consumerValidationPolicy = 'keep';\n";
    fs.writeFileSync(ctx.validatorPath, authoredValidator);
    const authoredBefore = snapshotWorkspace(ctx.workspaceDir);
    const authoredPlan = ctx.prepareStaged(ctx.target);
    assert.equal(authoredPlan.classification, 'historical-migration');
    assert.match(authoredPlan.reason, /validator/);
    assert.deepEqual(snapshotWorkspace(ctx.workspaceDir), authoredBefore);

    const file = (content: string) => ({
      content: Buffer.from(content),
      mode: 0o644,
    });
    const write = plan.writes.find(
      item => item.path === 'pnpm-workspace.yaml',
    )!;
    assert.throws(
      () =>
        assertSameContractDelta(plan, [
          {
            relativePath: 'pnpm-workspace.yaml',
            before: file(ctx.before['pnpm-workspace.yaml']),
            after: file(write.content + 'trustPolicy: off\n'),
          },
        ]),
      /unapproved change/,
    );
  } finally {
    fs.rmSync(ctx.tempRoot, { recursive: true, force: true });
  }
});
