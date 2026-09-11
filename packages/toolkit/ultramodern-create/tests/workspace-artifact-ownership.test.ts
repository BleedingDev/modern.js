import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import {
  preserveConsumerWorkspaceArtifacts,
  recognizesReleaseCohortRead,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership';

test('generated contract data can refresh without treating authored behavior as generated', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-artifact-ownership-'));
  try {
    const relativePath = 'scripts/check.mts';
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath));
    const canonical =
      "const workspaceValidationContract = {version: 'new'};\nconsole.log(workspaceValidationContract);\n";
    const variants = [
      { source: canonical.replace("'new'", "'old'"), protected: false },
      {
        source: `${canonical}console.log('consumer authorization');\n`,
        protected: true,
      },
      {
        source: canonical.replace("'new'", 'getConsumerPolicy()'),
        protected: true,
      },
      {
        source: canonical.replace("{version: 'new'}", '{...consumerPolicy}'),
        protected: true,
      },
      { source: 'invalid consumer source {', protected: true },
    ];
    for (const variant of variants) {
      fs.writeFileSync(filePath, variant.source);
      const guarded = preserveConsumerWorkspaceArtifacts(
        createMigrationIo(root, false),
        [
          {
            relativePath,
            content: canonical,
            generatedDataBinding: 'workspaceValidationContract',
          },
        ],
      );
      assert.equal(guarded.preservedPaths.has(relativePath), variant.protected);
      guarded.io.write(filePath, canonical);
      assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        variant.protected ? variant.source : canonical,
      );
      if (variant.protected) {
        assert.equal(guarded.io.remove(filePath), false);
        assert.equal(fs.readFileSync(filePath, 'utf8'), variant.source);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('preserved validators extract literal cohort data once, including renamed bindings and legacy paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-authored-cohort-'));
  const oldCohort = {
    aliases: { '@modern-js/runtime': '@bleedingdev/modern-js-runtime' },
    packages: [
      {
        sourceName: '@modern-js/runtime',
        targetName: '@bleedingdev/modern-js-runtime',
        version: '3.9.0-ultramodern.2',
      },
    ],
    release: { tag: 'latest', version: '3.9.0-ultramodern.2' },
    schema: 'bleedingdev.ultramodern.release-cohort',
    schemaVersion: 1,
    source: { commit: 'old-source', repository: 'BleedingDev/ultramodern.js' },
  };
  const nextCohort = {
    ...oldCohort,
    packages: oldCohort.packages.map(member => ({
      ...member,
      version: '3.9.0-ultramodern.4',
    })),
    release: { ...oldCohort.release, version: '3.9.0-ultramodern.4' },
    source: { ...oldCohort.source, commit: 'new-source' },
  };
  const prefix =
    "// Authored validator: keep this exact program.\nconst retainedPolicy = 'consumer authorization';\nconst renamedContractDefinition = {kind: 'modernjs.ultramodern-workspace-validation-contract', policy: retainedPolicy, cohort: {releaseCohort: ";
  const suffix =
    "}};\nthrow new Error('The migration must never execute this source');\n";
  const source = prefix + JSON.stringify(oldCohort) + suffix;
  const nativeImport =
    "import ultramodernReleaseCohortDocument from '../.modernjs/release-cohort.json' with { type: 'json' };\n";
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    const legacyRelativePath = 'scripts/validate-ultramodern-workspace.mjs';
    const legacyFilePath = path.join(root, legacyRelativePath);
    fs.writeFileSync(legacyFilePath, source);
    const legacyIo = createMigrationIo(root, false);
    const legacyGuarded = preserveConsumerWorkspaceArtifacts(legacyIo, [
      {
        relativePath: 'scripts/validate-ultramodern-workspace.mts',
        legacyPath: legacyRelativePath,
        generatedDataBinding: 'workspaceValidationContract',
        content: 'const workspaceValidationContract = {};\n',
      },
    ]);
    assert.equal(legacyGuarded.preservedPaths.has(legacyRelativePath), true);
    legacyGuarded.refreshReleaseCohort(nextCohort);
    const legacyExpected =
      nativeImport + prefix + 'ultramodernReleaseCohortDocument' + suffix;
    assert.equal(recognizesReleaseCohortRead(legacyExpected), true);
    assert.equal(fs.readFileSync(legacyFilePath, 'utf8'), legacyExpected);
    legacyGuarded.refreshReleaseCohort(nextCohort);
    assert.equal(fs.readFileSync(legacyFilePath, 'utf8'), legacyExpected);
    fs.writeFileSync(legacyFilePath, source);
    assert.throws(
      () =>
        legacyIo.transaction(() => {
          legacyGuarded.refreshReleaseCohort(nextCohort);
          throw new Error('later migration failed');
        }),
      /later migration failed/,
    );
    assert.equal(fs.readFileSync(legacyFilePath, 'utf8'), source);
    fs.rmSync(legacyFilePath);
    const filePath = path.join(
      root,
      'scripts/validate-ultramodern-workspace.mts',
    );
    const factoredSource = `const versionPin = '${oldCohort.release.version}';\n${source.replaceAll(JSON.stringify(oldCohort.release.version), 'versionPin')}`;
    for (const hasOtherReader of [false, true]) {
      const otherReader = hasOtherReader ? '\nconsole.log(versionPin);\n' : '';
      fs.writeFileSync(filePath, factoredSource + otherReader);
      const guarded = preserveConsumerWorkspaceArtifacts(
        createMigrationIo(root, false),
        [
          {
            relativePath: 'scripts/validate-ultramodern-workspace.mts',
            generatedDataBinding: 'workspaceValidationContract',
            content: 'const workspaceValidationContract = {};\n',
          },
        ],
      );
      guarded.refreshReleaseCohort(nextCohort);
      const expected =
        nativeImport +
        (hasOtherReader
          ? `const versionPin = '${oldCohort.release.version}';\n`
          : '\n') +
        prefix +
        'ultramodernReleaseCohortDocument' +
        suffix +
        otherReader;
      assert.equal(fs.readFileSync(filePath, 'utf8'), expected);
      guarded.refreshReleaseCohort(nextCohort);
      assert.equal(fs.readFileSync(filePath, 'utf8'), expected);
    }
    const ambiguous = [
      source.replace(JSON.stringify(oldCohort), 'consumerReleasePolicy()'),
      'unparseable consumer source {',
    ];
    for (const variant of ambiguous) {
      fs.writeFileSync(filePath, variant);
      const guarded = preserveConsumerWorkspaceArtifacts(
        createMigrationIo(root, false),
        [
          {
            relativePath: 'scripts/validate-ultramodern-workspace.mts',
            generatedDataBinding: 'workspaceValidationContract',
            content: 'const workspaceValidationContract = {};\n',
          },
        ],
      );
      assert.throws(
        () => guarded.refreshReleaseCohort(nextCohort),
        /Workspace validator migration conflict/,
      );
      assert.equal(recognizesReleaseCohortRead(variant), false);
      assert.equal(fs.readFileSync(filePath, 'utf8'), variant);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Consumers generated by the earlier framework template carry an older
// readGeneratedContractView overlay pair. Migration must upgrade that pair in
// place, but must still refuse when the consumer authored inside it.
test('upgrades the historical validator overlay pair unless a consumer edited it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-historical-pair-'));
  try {
    const relativePath = 'scripts/validate-ultramodern-workspace.mts';
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath));
    const envelope = (version: string) =>
      `const workspaceValidationContract = { kind: 'modernjs.ultramodern-workspace-validation-contract', cohort: { version: '${version}' } };`;
    const historicalPair = `const readGeneratedContractView = config => {
  return synthesizeGeneratedContractFromCompact(config);
};
const generatedContract = readGeneratedContractView(ultramodernConfig);`;
    const currentPair = `const readGeneratedContractView = (config, overlay) => {
  return synthesizeGeneratedContractFromCompact({ ...config, overlay });
};
const generatedContract = readGeneratedContractView(ultramodernConfig, overlay);`;
    const tail = "assert(generatedContract.apps.length > 0, 'apps');\n";
    const current = `${envelope('new')}\n${currentPair}\n${tail}`;
    const historical = `${envelope('old')}\n${historicalPair}\n${tail}`;
    const authored = historical.replace(
      'return synthesize',
      '// authored policy\n  return synthesize',
    );
    for (const [source, preserved] of [
      [historical, false],
      [authored, true],
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
      assert.equal(guarded.preservedPaths.has(relativePath), preserved);
      guarded.io.write(filePath, current);
      assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        preserved ? source : current,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
