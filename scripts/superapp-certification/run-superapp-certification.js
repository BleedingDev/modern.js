#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { parseCliArgs } = require('../lib/cli-kit');
const { repoRoot, writeJsonFile } = require('../lib/fs-kit');
const { runCommand, runCommandList } = require('../lib/process-kit');

const defaultRunId = new Date().toISOString().replace(/[:.]/g, '-');

function parseArgs(argv) {
  const options = parseCliArgs(argv, {
    defaults: {
      profile: process.env.SUPERAPP_CERTIFICATION_PROFILE || 'smoke',
      outDir:
        process.env.SUPERAPP_CERTIFICATION_OUT_DIR ||
        path.join('.modern', 'superapp-certification', defaultRunId),
      dryRun: false,
      continueOnError: false,
      skipUpstreamDrift: false,
      driftOnly: false,
      driftBase: process.env.SUPERAPP_CERTIFICATION_DRIFT_BASE || 'origin/main',
      driftRemote: process.env.SUPERAPP_CERTIFICATION_DRIFT_REMOTE || 'origin',
      driftBranch: process.env.SUPERAPP_CERTIFICATION_DRIFT_BRANCH || 'main',
    },
    ignoreTerminator: true,
    options: {
      profile: { requiredValue: false },
      'out-dir': {
        key: 'outDir',
        requiredValue: false,
      },
      'dry-run': {
        key: 'dryRun',
        type: 'boolean',
      },
      'continue-on-error': {
        key: 'continueOnError',
        type: 'boolean',
      },
      'skip-upstream-drift': {
        key: 'skipUpstreamDrift',
        type: 'boolean',
      },
      'drift-only': {
        key: 'driftOnly',
        type: 'boolean',
      },
      'drift-base': {
        key: 'driftBase',
        requiredValue: false,
      },
      'drift-remote': {
        key: 'driftRemote',
        requiredValue: false,
      },
      'drift-branch': {
        key: 'driftBranch',
        requiredValue: false,
      },
    },
  });

  if (!['smoke', 'release', 'nightly'].includes(options.profile)) {
    throw new Error(
      `Invalid --profile "${options.profile}". Use smoke, release, or nightly.`,
    );
  }

  options.outDir = path.resolve(repoRoot, options.outDir);
  return options;
}

function command(id, commandName, args, options = {}) {
  return {
    id,
    command: commandName,
    args,
    label: options.label || [commandName, ...args].join(' '),
    cwd: options.cwd || repoRoot,
    env: options.env || {},
    profile: options.profile || 'smoke',
  };
}

function artifactDir(outDir, name) {
  return path.join(outDir, 'artifacts', name);
}

function certificationCommands(profile, outDir) {
  const rstestArgs = ['exec', 'rstest', 'run', '-c', 'rstest.config.mts'];
  // Keep the profile option as a compatibility label for existing callers,
  // but run one real generated-app acceptance path for every profile. The
  // former portfolio smoke/security/stress/chaos/nightly selections either
  // exercised deleted suites or only asserted fixture-authored metadata.
  return [
    command(
      'superapp-mf-certification',
      'pnpm',
      [
        ...rstestArgs,
        'integration/routes-tanstack-mf/test/deploy-certification.test.ts',
      ],
      {
        cwd: path.join(repoRoot, 'tests'),
        env: {
          SUPERAPP_MF_CERTIFICATION: '1',
          SUPERAPP_MF_CERTIFICATION_ARTIFACT_DIR: artifactDir(
            outDir,
            'mf-certification',
          ),
        },
        profile,
      },
    ),
  ];
}

function runCommands(commands, options) {
  return runCommandList(commands, {
    continueOnError: options.continueOnError,
    dryRun: options.dryRun,
    onCommandStart: item => {
      console.log(`\n[superapp-certification] ${item.id}`);
    },
  });
}

function runGit(args, options = {}) {
  const result = runCommand('git', args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
  return {
    ...result,
    status: result.processStatus,
  };
}

function cleanupWorktree(worktreeDir) {
  if (fs.existsSync(worktreeDir)) {
    runGit(['merge', '--abort'], { cwd: worktreeDir });
  }
  runGit(['worktree', 'remove', '--force', worktreeDir]);
}

function runMergeConflictCheck(options) {
  const startedAt = Date.now();
  const worktreeDir = path.join(
    options.outDir,
    'merge-conflict-check-worktree',
  );
  const result = {
    check: 'merge-conflict-detection',
    description:
      'Fetches the configured upstream ref and checks whether a textual merge is conflict-free; it does not build or run the merged source.',
    status: 'skipped',
    base: options.driftBase,
    remote: options.driftRemote,
    branch: options.driftBranch,
    worktreeDir,
    conflicts: [],
    commandResults: [],
    durationMs: 0,
  };

  if (options.skipUpstreamDrift) {
    result.reason = 'skip-merge-conflict-check';
    return result;
  }

  if (options.dryRun) {
    result.status = 'planned';
    result.reason = 'dry-run';
    return result;
  }

  fs.mkdirSync(options.outDir, { recursive: true });
  cleanupWorktree(worktreeDir);

  const fetch = runGit(['fetch', options.driftRemote, options.driftBranch], {
    stdio: 'inherit',
  });
  if (fetch.status !== 0) {
    return {
      ...result,
      status: 'failed',
      reason: 'fetch-failed',
      durationMs: Date.now() - startedAt,
    };
  }

  const add = runGit(['worktree', 'add', '--detach', worktreeDir, 'HEAD'], {
    stdio: 'inherit',
  });
  if (add.status !== 0) {
    return {
      ...result,
      status: 'failed',
      reason: 'worktree-add-failed',
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    const merge = runGit(
      ['merge', '--no-commit', '--no-ff', options.driftBase],
      {
        cwd: worktreeDir,
        stdio: 'inherit',
      },
    );
    if (merge.status !== 0) {
      const conflicts = runGit(['diff', '--name-only', '--diff-filter=U'], {
        cwd: worktreeDir,
      });
      return {
        ...result,
        status: 'conflict',
        conflicts: conflicts.stdout.trim().split('\n').filter(Boolean),
        durationMs: Date.now() - startedAt,
      };
    }

    result.status = 'merged';
    return {
      ...result,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    cleanupWorktree(worktreeDir);
  }
}

function createQualification(
  options,
  commands,
  commandResults,
  mergeConflictCheck,
) {
  const failedCommandCount = commandResults.filter(
    item => item.exitCode !== 0,
  ).length;
  const executedCommandCount = commandResults.filter(
    item => item.status !== 'planned',
  ).length;
  const skippedCommandCount = Math.max(
    commands.length - executedCommandCount,
    0,
  );
  const reasons = [];

  if (options.dryRun) {
    reasons.push('dry-run');
  }
  if (options.driftOnly) {
    reasons.push('merge-conflict-check-only');
  }
  if (commands.length === 0 && !options.driftOnly) {
    reasons.push('no-certification-command');
  }
  if (!options.dryRun && executedCommandCount < commands.length) {
    reasons.push('required-command-not-executed');
  }
  if (failedCommandCount > 0) {
    reasons.push('certification-command-failed');
  }
  if (
    ['failed', 'conflict', 'gate-failed'].includes(mergeConflictCheck.status)
  ) {
    reasons.push('merge-conflict-check-failed');
  }

  return {
    qualified: reasons.length === 0,
    status: reasons.length === 0 ? 'qualified' : 'unqualified',
    commandCount: commands.length,
    executedCommandCount,
    skippedCommandCount,
    failedCommandCount,
    reasons,
  };
}

function writeSummary(options, commands, commandResults, mergeConflictCheck) {
  fs.mkdirSync(options.outDir, { recursive: true });
  const failedCommandCount = commandResults.filter(
    item => item.exitCode !== 0,
  ).length;
  const hasMergeConflictCheckFailure = [
    'failed',
    'conflict',
    'gate-failed',
  ].includes(mergeConflictCheck.status);
  const status =
    hasMergeConflictCheckFailure || failedCommandCount > 0
      ? 'failed'
      : options.dryRun
        ? 'planned'
        : options.driftOnly
          ? 'skipped'
          : 'passed';
  const qualification = createQualification(
    options,
    commands,
    commandResults,
    mergeConflictCheck,
  );
  const summary = {
    schemaVersion: 1,
    suite: 'superapp-certification',
    generatedAt: new Date().toISOString(),
    profile: options.profile,
    status,
    qualified: qualification.qualified,
    qualification,
    dryRun: options.dryRun,
    driftOnly: options.driftOnly,
    commandCount: commands.length,
    skippedCommandCount: qualification.skippedCommandCount,
    failedCommandCount,
    commands: commandResults,
    // Keep the historical field so the readiness report can continue to
    // project this evidence, while the payload identifies its real scope.
    upstreamDrift: mergeConflictCheck,
    mergeConflictCheck,
  };
  const summaryPath = path.join(options.outDir, 'summary.json');
  writeJsonFile(summaryPath, summary, { atomic: false });
  console.log(`\n[superapp-certification] summary: ${summaryPath}`);
  return summary;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const commands = options.driftOnly
    ? []
    : certificationCommands(options.profile, options.outDir);
  const commandResults = runCommands(commands, options);
  const mergeConflictCheck = runMergeConflictCheck(options);
  const summary = writeSummary(
    options,
    commands,
    commandResults,
    mergeConflictCheck,
  );
  const hasCommandFailure = summary.failedCommandCount > 0;
  const hasMergeConflictCheckFailure = [
    'failed',
    'conflict',
    'gate-failed',
  ].includes(mergeConflictCheck.status);

  if (hasCommandFailure || hasMergeConflictCheckFailure) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  certificationCommands,
  parseArgs,
};
