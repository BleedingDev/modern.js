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
    for (const extension of ['mts', 'mjs']) {
      const relativePath = `scripts/validate-ultramodern-workspace.${extension}`;
      const filePath = path.join(root, relativePath);
      fs.writeFileSync(filePath, source);
      const io = createMigrationIo(root, false);
      const guarded = preserveConsumerWorkspaceArtifacts(io, [
        {
          relativePath: 'scripts/validate-ultramodern-workspace.mts',
          legacyPath: 'scripts/validate-ultramodern-workspace.mjs',
          generatedDataBinding: 'workspaceValidationContract',
          content: 'const workspaceValidationContract = {};\n',
        },
      ]);
      assert.equal(guarded.preservedPaths.has(relativePath), true);
      guarded.refreshReleaseCohort(nextCohort);
      const expected =
        nativeImport + prefix + 'ultramodernReleaseCohortDocument' + suffix;
      assert.equal(recognizesReleaseCohortRead(expected), true);
      assert.equal(fs.readFileSync(filePath, 'utf8'), expected);
      guarded.refreshReleaseCohort(nextCohort);
      assert.equal(fs.readFileSync(filePath, 'utf8'), expected);
      fs.writeFileSync(filePath, source);
      assert.throws(
        () =>
          io.transaction(() => {
            guarded.refreshReleaseCohort(nextCohort);
            throw new Error('later migration failed');
          }),
        /later migration failed/,
      );
      assert.equal(fs.readFileSync(filePath, 'utf8'), source);
      fs.rmSync(filePath);
    }
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
      factoredSource.replace(
        `'${oldCohort.release.version}'`,
        'readConsumerVersion()',
      ),
      factoredSource.replace('const versionPin', 'let versionPin'),
      source.replace(JSON.stringify(oldCohort), 'consumerReleasePolicy()'),
      source.replace(
        JSON.stringify(oldCohort),
        `{...${JSON.stringify(oldCohort)}}`,
      ),
      source.replace('cohort: {', '...consumerPolicy, cohort: {'),
      source.replace('cohort: {', 'cohort: {}, cohort: {'),
      source.replace('releaseCohort: ', '[releaseKey]: '),
      source.replace(
        'modernjs.ultramodern-workspace-validation-contract',
        'consumer-policy',
      ),
      source.replace(
        'const renamedContractDefinition',
        'let renamedContractDefinition',
      ),
      source.replace('"schemaVersion":1', '"schemaVersion":2'),
      source +
        source
          .replaceAll('retainedPolicy', 'otherPolicy')
          .replaceAll('renamedContractDefinition', 'otherDefinition'),
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

test('native cohort recognition requires the contract use and JSON import together', () => {
  const source =
    "import data from '../.modernjs/release-cohort.json' with { type: 'json' };\n" +
    "const definition = { kind: 'modernjs.ultramodern-workspace-validation-contract', cohort: { releaseCohort: data } };\n";
  assert.equal(recognizesReleaseCohortRead(source), true);
  for (const variant of [
    source.replace('releaseCohort: data', 'releaseCohort: customData'),
    source.replace("with { type: 'json' }", ''),
    source.replace('import data', 'import * as data'),
    source.replace(
      "'../.modernjs/release-cohort.json'",
      "'../consumer-release.json'",
    ),
    source.replace('cohort: {', '...consumerPolicy, cohort: {'),
    source.replace('const definition', 'let definition'),
  ])
    assert.equal(recognizesReleaseCohortRead(variant), false);
});
