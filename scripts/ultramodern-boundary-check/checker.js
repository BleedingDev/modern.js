const fs = require('fs');
const path = require('path');

const { extractImportSpecifiers } = require('../boundary-guards/validator');
const { createProcessEnv, runCommand } = require('../lib/process-kit');
const { resolveCommitSha, resolveRepositoryTopLevel } = require('./divergence');

const DEFAULT_BASE_REF = '8a744c1b3178d1e85d4113f29e8837ff94079fb3';
const DEFAULT_ALLOWLIST_PATH = path.join(__dirname, 'allowlist.json');
const SOURCE_FILE_PATTERN =
  /^packages\/.+\/src\/.+\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const ALLOWLIST_SCHEMA_VERSION = 1;

const DEFAULT_DENYLIST = Object.freeze([
  '@modern-js/plugin-tanstack',
  '@modern-js/plugin-i18n',
  'create-request',
  'backend-federation',
  'runtime-extensions',
  'data-platform',
  'ultramodern',
  'micro-vertical',
  'superapp',
  'delivery-unit',
]);

const toPosixPath = value => value.split(path.sep).join('/');

const runGit = ({ rootDir, args, allowFailure = false }) => {
  const env = createProcessEnv(
    Object.fromEntries(
      Object.keys(process.env)
        .filter(key => key.toUpperCase().startsWith('GIT_'))
        .map(key => [key, undefined]),
    ),
  );
  const result = runCommand('git', ['--literal-pathspecs', ...args], {
    env,
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const status = result.processStatus;

  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error.message}`);
  }
  if (!allowFailure && status !== 0) {
    const stderr = result.stderr.trim();
    const suffix = stderr ? `: ${stderr}` : '';
    throw new Error(`git ${args.join(' ')} failed${suffix}`);
  }

  return {
    ...result,
    status,
  };
};

const normalizeViolation = violation => ({
  file: toPosixPath(violation.file),
  specifier: violation.specifier,
});

const violationKey = violation =>
  `${violation.file}\u0000${violation.specifier}`;

const sortViolationRecords = violations =>
  [...violations].sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.specifier.localeCompare(right.specifier),
  );

const listPackageSourceFiles = (rootDir, headRef) => {
  const result = runGit({
    rootDir,
    args: headRef
      ? ['ls-tree', '-r', '--name-only', '-z', headRef, '--', 'packages']
      : ['ls-files', '-z', '--', 'packages'],
  });

  return result.stdout
    .split('\0')
    .filter(Boolean)
    .map(toPosixPath)
    .filter(file => SOURCE_FILE_PATTERN.test(file))
    .filter(file => headRef || fs.existsSync(path.join(rootDir, file)))
    .sort();
};

const pathExistsAtRef = ({ rootDir, baseRef, file }) => {
  const result = runGit({
    rootDir,
    args: ['cat-file', '-e', `${baseRef}:${file}`],
    allowFailure: true,
  });

  return result.status === 0;
};

const listUpstreamOwnedPackageSourceFiles = ({
  rootDir,
  baseRef = DEFAULT_BASE_REF,
  files,
  headRef,
}) => {
  const resolvedBase = resolveCommitSha({ rootDir, ref: baseRef });
  if (!resolvedBase) {
    throw new Error(
      `Import ownership base ${String(baseRef)} does not resolve to a commit.`,
    );
  }
  const candidateFiles = files ?? listPackageSourceFiles(rootDir, headRef);
  const ownedFiles = new Set(listPackageSourceFiles(rootDir, resolvedBase));
  return candidateFiles.filter(file => ownedFiles.has(file));
};

const findDenylistMatches = ({ specifier, denylist = DEFAULT_DENYLIST }) => {
  const normalizedSpecifier = specifier.toLowerCase();

  return denylist.filter(marker =>
    normalizedSpecifier.includes(marker.toLowerCase()),
  );
};

const scanUpstreamOwnedForkImports = ({
  rootDir = process.cwd(),
  baseRef = DEFAULT_BASE_REF,
  denylist = DEFAULT_DENYLIST,
  files,
  headRef,
} = {}) => {
  rootDir = resolveRepositoryTopLevel({ rootDir });
  const targetRef = headRef ?? 'HEAD';
  const resolvedHead = resolveCommitSha({ rootDir, ref: targetRef });
  if (!resolvedHead) {
    throw new Error(
      `Import target ${String(targetRef)} does not resolve to a commit.`,
    );
  }
  const resolvedBase = resolveCommitSha({ rootDir, ref: baseRef });
  if (!resolvedBase) {
    throw new Error(
      `Import ownership base ${String(baseRef)} does not resolve to a commit.`,
    );
  }
  runGit({
    rootDir,
    args: ['merge-base', '--is-ancestor', resolvedBase, resolvedHead],
  });
  const upstreamOwnedFiles = listUpstreamOwnedPackageSourceFiles({
    rootDir,
    baseRef: resolvedBase,
    files,
    headRef: headRef === undefined ? undefined : resolvedHead,
  });
  const violations = [];

  upstreamOwnedFiles.forEach(file => {
    const content =
      headRef === undefined
        ? fs.readFileSync(path.join(rootDir, file), 'utf8')
        : runGit({ rootDir, args: ['show', `${resolvedHead}:${file}`] }).stdout;
    const specifiers = [...new Set(extractImportSpecifiers(content))];

    specifiers.forEach(specifier => {
      const markers = findDenylistMatches({ specifier, denylist });
      if (markers.length === 0) {
        return;
      }

      violations.push({
        file,
        specifier,
        markers,
      });
    });
  });

  return {
    baseRef: resolvedBase,
    headRef: headRef === undefined ? null : resolvedHead,
    scannedFiles: upstreamOwnedFiles.length,
    violations: sortViolationRecords(violations),
  };
};

const createAllowlistSnapshot = ({
  baseRef = DEFAULT_BASE_REF,
  denylist = DEFAULT_DENYLIST,
  violations,
}) => ({
  schemaVersion: ALLOWLIST_SCHEMA_VERSION,
  baseRef,
  migrationGoal:
    'Shrink this list as UltraModern-only imports move out of upstream-owned files.',
  denylist: [...denylist],
  violations: sortViolationRecords(violations).map(normalizeViolation),
});

const readAllowlist = allowlistPath => {
  if (!fs.existsSync(allowlistPath)) {
    throw new Error(`Allowlist does not exist: ${allowlistPath}`);
  }

  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));

  if (allowlist.schemaVersion !== ALLOWLIST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported allowlist schemaVersion ${String(
        allowlist.schemaVersion,
      )}; expected ${String(ALLOWLIST_SCHEMA_VERSION)}`,
    );
  }

  if (!Array.isArray(allowlist.violations)) {
    throw new Error('Allowlist violations must be an array');
  }

  return {
    ...allowlist,
    violations: sortViolationRecords(
      allowlist.violations.map(normalizeViolation),
    ),
  };
};

const writeAllowlist = ({
  rootDir = process.cwd(),
  baseRef = DEFAULT_BASE_REF,
  allowlistPath = DEFAULT_ALLOWLIST_PATH,
  denylist = DEFAULT_DENYLIST,
  files,
} = {}) => {
  const report = scanUpstreamOwnedForkImports({
    rootDir,
    baseRef,
    denylist,
    files,
  });
  const snapshot = createAllowlistSnapshot({
    baseRef,
    denylist,
    violations: report.violations,
  });

  fs.mkdirSync(path.dirname(allowlistPath), { recursive: true });
  fs.writeFileSync(
    allowlistPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );

  return {
    ...report,
    allowlistPath,
  };
};

const diffViolations = ({ currentViolations, allowlistViolations }) => {
  const currentByKey = new Map(
    currentViolations.map(violation => [violationKey(violation), violation]),
  );
  const allowlistByKey = new Map(
    allowlistViolations.map(violation => [violationKey(violation), violation]),
  );

  return {
    added: sortViolationRecords(
      [...currentByKey.entries()]
        .filter(([key]) => !allowlistByKey.has(key))
        .map(([, violation]) => violation),
    ),
    removed: sortViolationRecords(
      [...allowlistByKey.entries()]
        .filter(([key]) => !currentByKey.has(key))
        .map(([, violation]) => violation),
    ),
  };
};

const checkForkImportBoundary = ({
  rootDir = process.cwd(),
  baseRef = DEFAULT_BASE_REF,
  allowlistPath = DEFAULT_ALLOWLIST_PATH,
  denylist = DEFAULT_DENYLIST,
  files,
  headRef,
} = {}) => {
  const current = scanUpstreamOwnedForkImports({
    rootDir,
    baseRef,
    denylist,
    files,
    headRef,
  });
  const allowlist = readAllowlist(allowlistPath);
  const recordedBase = resolveCommitSha({ rootDir, ref: allowlist.baseRef });
  if (!recordedBase || recordedBase !== current.baseRef) {
    throw new Error(
      'Import allowlist ownership base does not match the measured base.',
    );
  }
  const diff = diffViolations({
    currentViolations: current.violations,
    allowlistViolations: allowlist.violations,
  });

  return {
    baseRef: current.baseRef,
    headRef: current.headRef,
    allowlistPath,
    scannedFiles: current.scannedFiles,
    currentViolations: current.violations,
    allowlistViolations: allowlist.violations,
    added: diff.added,
    removed: diff.removed,
    ok: current.violations.length === 0,
  };
};

const formatViolation = violation => {
  const markers = violation.markers?.length
    ? ` [${violation.markers.join(', ')}]`
    : '';

  return `- ${violation.file} -> ${violation.specifier}${markers}`;
};

const formatBoundaryReport = report => {
  const lines = [
    `[ultramodern-boundary] checked ${String(
      report.scannedFiles,
    )} upstream-owned packages/**/src files at ${report.baseRef}; target=${report.headRef ?? 'worktree'}`,
    `[ultramodern-boundary] current=${String(
      report.currentViolations.length,
    )} allowlist=${String(report.allowlistViolations.length)} added=${String(
      report.added.length,
    )} removed=${String(report.removed.length)}`,
  ];

  if (report.currentViolations.length > 0) {
    lines.push(
      '',
      'Current upstream-owned imports of fork-only code (allowances do not permit edges):',
      ...report.currentViolations.map(formatViolation),
    );
  }

  if (report.removed.length > 0) {
    lines.push(
      '',
      'Allowlist entries no longer observed; shrink the snapshot when migrating:',
      ...report.removed.map(formatViolation),
    );
  }

  if (report.currentViolations.length === 0) {
    lines.push('', 'No current upstream-owned imports of fork-only code.');
  }

  return lines.join('\n');
};

module.exports = {
  ALLOWLIST_SCHEMA_VERSION,
  DEFAULT_ALLOWLIST_PATH,
  DEFAULT_BASE_REF,
  DEFAULT_DENYLIST,
  SOURCE_FILE_PATTERN,
  checkForkImportBoundary,
  createAllowlistSnapshot,
  diffViolations,
  findDenylistMatches,
  formatBoundaryReport,
  formatViolation,
  listPackageSourceFiles,
  listUpstreamOwnedPackageSourceFiles,
  pathExistsAtRef,
  readAllowlist,
  scanUpstreamOwnedForkImports,
  writeAllowlist,
};
