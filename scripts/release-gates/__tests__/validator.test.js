const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runGateCommands,
  validateEvidence,
  validateProfileShape,
  writeGateSnapshot,
} = require('../validator');

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'modern-release-gates-'));

const removeDir = directory => {
  fs.rmSync(directory, { recursive: true, force: true });
};

test('validateProfileShape rejects shell-string gate commands', () => {
  const profile = {
    schemaVersion: 1,
    evidence: {
      requiredFiles: [],
      requiredMetadataFields: [],
    },
    gateCommands: ['pnpm test'],
  };

  assert.throws(
    () => validateProfileShape(profile),
    /gateCommands\[0\] must be a command object/,
  );
});

test('validateEvidence checks receipt metadata without reviewer prose certification', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'architecture-evidence.md'),
      'commit_sha: sha\nworkflow_run_url: local\n',
    );
    fs.writeFileSync(
      path.join(dir, 'validation-evidence.md'),
      'commit_sha: sha\nworkflow_run_url: local\n',
    );
    fs.writeFileSync(
      path.join(dir, 'test-evidence.md'),
      'commit_sha: sha\nworkflow_run_url: local\n',
    );
    fs.writeFileSync(
      path.join(dir, 'review-evidence.md'),
      'commit_sha: sha\nworkflow_run_url: local\n',
    );

    const report = validateEvidence({
      evidenceDir: dir,
      requiredFiles: [
        'architecture-evidence.md',
        'validation-evidence.md',
        'test-evidence.md',
        'review-evidence.md',
      ],
      requiredMetadataFields: ['commit_sha', 'workflow_run_url'],
      minimumReviewers: 2,
      allowMissingEvidence: false,
      allowLocalEvidenceMetadata: true,
    });

    assert.equal(report.validatedFiles.length, 4);
    assert.equal(report.skippedFiles.length, 0);
  } finally {
    removeDir(dir);
  }
});

test('validateEvidence rejects dirty commit metadata when CI evidence is required', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'architecture-evidence.md'),
      [
        'commit_sha: 123abc-dirty',
        'workflow_run_url: https://github.com/BleedingDev/ultramodern.js/actions/runs/123456789',
        '',
      ].join('\n'),
    );

    assert.throws(
      () =>
        validateEvidence({
          evidenceDir: dir,
          requiredFiles: ['architecture-evidence.md'],
          requiredMetadataFields: ['commit_sha', 'workflow_run_url'],
          allowMissingEvidence: false,
          requireCiBackedMetadata: true,
        }),
      /commit_sha.*dirty/i,
    );
  } finally {
    removeDir(dir);
  }
});

test('validateEvidence rejects local workflow URLs when CI evidence is required', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'architecture-evidence.md'),
      [
        'commit_sha: 123abc',
        'workflow_run_url: local://release-gates/manual-fixture',
        '',
      ].join('\n'),
    );

    assert.throws(
      () =>
        validateEvidence({
          evidenceDir: dir,
          requiredFiles: ['architecture-evidence.md'],
          requiredMetadataFields: ['commit_sha', 'workflow_run_url'],
          allowMissingEvidence: false,
          requireCiBackedMetadata: true,
        }),
      /workflow_run_url.*local/i,
    );
  } finally {
    removeDir(dir);
  }
});

test('validateEvidence rejects placeholder metadata values', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'architecture-evidence.md'),
      'commit_sha: TBD\nworkflow_run_url: local://manual\n',
    );

    assert.throws(
      () =>
        validateEvidence({
          evidenceDir: dir,
          requiredFiles: ['architecture-evidence.md'],
          requiredMetadataFields: ['commit_sha', 'workflow_run_url'],
          allowMissingEvidence: false,
        }),
      /placeholder value/,
    );
  } finally {
    removeDir(dir);
  }
});

test('runGateCommands throws on failing command', () => {
  assert.throws(
    () =>
      runGateCommands({
        commands: [
          {
            command: process.execPath,
            args: ['-e', 'process.exit(2)'],
          },
        ],
      }),
    /exit code 2/,
  );
});

test('writeGateSnapshot persists and merges gate records', () => {
  const dir = makeTempDir();
  try {
    const snapshotPath = path.join(dir, 'contract-gates.json');
    const first = writeGateSnapshot({
      snapshotPath,
      gateName: 'release-candidate-contract-gates',
      passed: true,
      summary: { validatedEvidenceFiles: 4 },
      profilePath: 'scripts/release-gates/rc-contract-profile.json',
      timestamp: 1700000000000,
    });
    assert.equal(first.passed, true);

    const second = writeGateSnapshot({
      snapshotPath,
      gateName: 'module-onboarding-certification-gates',
      passed: false,
      reason: 'gate command failed',
      summary: { error: 'gate command failed' },
      profilePath: 'scripts/release-gates/module-certification-profile.json',
      timestamp: 1700000001000,
    });
    assert.equal(second.passed, false);

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.updatedAt, 1700000001000);
    assert.equal(
      snapshot.gates['release-candidate-contract-gates'].passed,
      true,
    );
    assert.equal(
      snapshot.gates['module-onboarding-certification-gates'].passed,
      false,
    );
    assert.match(
      snapshot.gates['module-onboarding-certification-gates'].reason,
      /gate command failed/,
    );
  } finally {
    removeDir(dir);
  }
});
