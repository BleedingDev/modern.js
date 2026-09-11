import fs from 'node:fs';
import path from 'node:path';
import { ULTRAMODERN_WORKSPACE_POLICY } from './policy';

export interface PatchParityInputs {
  /** Root of the generated workspace being validated. */
  workspaceRoot: string;
  /** Root of the installed `@modern-js/ultramodern-create` package. */
  createPackageRoot: string;
}

export interface PatchParityProblem {
  /** `patches/<file>` relative to the workspace root. */
  patchFile: string;
  kind: 'missing' | 'stale' | 'unregistered' | 'misregistered';
  message: string;
}

const TEMPLATE_PATCH_DIRECTORY = path.join('template-workspace', 'patches');
const WORKSPACE_PATCH_DIRECTORY = 'patches';

const readFileOrUndefined = (file: string): Buffer | undefined => {
  try {
    return fs.readFileSync(file);
  } catch {
    return undefined;
  }
};

const patchFileName = (policyPath: string) =>
  policyPath.replace(/^patches\//u, '');

/**
 * Patches every generated workspace must carry and register. They are listed
 * in the workspace policy, so the expected set is known without reading the
 * template directory.
 */
export const requiredPatchFiles = (): string[] =>
  ULTRAMODERN_WORKSPACE_POLICY.pnpm.patchedDependencies.required.map(policy =>
    patchFileName(policy.path),
  );

/**
 * Patches a workspace carries only when it uses the dependency they repair.
 * Their absence is not a defect; a copy that has drifted from the template is.
 */
export const conditionalPatchFiles = (): string[] =>
  ULTRAMODERN_WORKSPACE_POLICY.pnpm.patchedDependencies.conditional.map(
    policy => patchFileName(policy.path),
  );

/** Every patch the cohort owns, required or conditional. */
export const cohortOwnedPatchFiles = (): string[] => [
  ...requiredPatchFiles(),
  ...conditionalPatchFiles(),
];

/** Parse `patchedDependencies` out of a workspace's `pnpm-workspace.yaml`. */
export const readPatchedDependencies = (
  workspaceRoot: string,
): Record<string, string> => {
  const file = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  const contents = readFileOrUndefined(file)?.toString('utf8');
  if (contents === undefined) {
    return {};
  }
  const registered: Record<string, string> = {};
  let inside = false;
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.replace(/\r$/u, '');
    if (/^patchedDependencies:\s*$/u.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^\S/u.test(line)) {
      inside = false;
    }
    if (!inside) {
      continue;
    }
    const entry = /^\s+(?:'([^']+)'|"([^"]+)"|([^:\s]+))\s*:\s*(.+?)\s*$/u.exec(
      line,
    );
    if (entry) {
      const name = entry[1] ?? entry[2] ?? entry[3];
      const target = entry[4].replace(/^['"]|['"]$/gu, '');
      registered[name] = target;
    }
  }
  return registered;
};

/**
 * Compare a workspace's checked-in patches against the ones shipped by the
 * installed create package.
 *
 * A workspace that carries a patch from an older cohort keeps applying it, and
 * the mismatch only surfaces much later as an opaque failure inside the build
 * the patch was meant to repair. Comparing the bytes here names the file and
 * the exact template to copy instead.
 */
export const checkPatchParity = ({
  workspaceRoot,
  createPackageRoot,
}: PatchParityInputs): PatchParityProblem[] => {
  const templateDirectory = path.join(
    createPackageRoot,
    TEMPLATE_PATCH_DIRECTORY,
  );
  const workspaceDirectory = path.join(
    workspaceRoot,
    WORKSPACE_PATCH_DIRECTORY,
  );
  if (!fs.existsSync(templateDirectory)) {
    return [];
  }

  const templatePatchFiles = new Set(
    fs.readdirSync(templateDirectory).filter(entry => entry.endsWith('.patch')),
  );
  const required = requiredPatchFiles().filter(patchFile =>
    templatePatchFiles.has(patchFile),
  );
  const conditional = conditionalPatchFiles().filter(patchFile =>
    templatePatchFiles.has(patchFile),
  );
  const cohortOwned = new Set([...required, ...conditional]);
  const registered = readPatchedDependencies(workspaceRoot);
  const registeredTargets = new Set(Object.values(registered));
  const problems: PatchParityProblem[] = [];

  const compare = (patchFile: string, mustBePresent: boolean) => {
    const templateFile = path.join(templateDirectory, patchFile);
    const workspaceFile = path.join(workspaceDirectory, patchFile);
    const expected = readFileOrUndefined(templateFile);
    const actual = readFileOrUndefined(workspaceFile);
    if (expected === undefined) {
      return;
    }

    if (actual === undefined) {
      if (mustBePresent) {
        problems.push({
          patchFile,
          kind: 'missing',
          message:
            `patches/${patchFile} is missing from the workspace. ` +
            `Copy it from ${templateFile}.`,
        });
      }
      return;
    }

    if (!expected.equals(actual)) {
      problems.push({
        patchFile,
        kind: 'stale',
        message:
          `patches/${patchFile} does not match the cohort's patch. ` +
          `Replace it with ${templateFile}.`,
      });
    }

    const target = `${WORKSPACE_PATCH_DIRECTORY}/${patchFile}`;
    if (mustBePresent && !registeredTargets.has(target)) {
      problems.push({
        patchFile,
        kind: 'unregistered',
        message:
          `patches/${patchFile} is not registered under ` +
          '`patchedDependencies` in pnpm-workspace.yaml, so pnpm never ' +
          `applies it. Add an entry pointing at ${target}.`,
      });
    }
  };

  for (const patchFile of required) {
    compare(patchFile, true);
  }
  // A conditional patch is only carried by a workspace that uses the
  // dependency it repairs, so only a drifted copy is a defect.
  for (const patchFile of conditional) {
    compare(patchFile, false);
  }

  for (const [name, target] of Object.entries(registered)) {
    const patchFile = target.replace(/^patches\//u, '');
    if (
      cohortOwned.has(patchFile) &&
      !fs.existsSync(path.join(workspaceDirectory, patchFile))
    ) {
      problems.push({
        patchFile,
        kind: 'misregistered',
        message:
          `pnpm-workspace.yaml registers ${name} against ${target}, but that ` +
          `file does not exist. Copy it from ` +
          `${path.join(templateDirectory, patchFile)}.`,
      });
    }
  }

  return problems;
};

/** A single message naming every stale, missing or unregistered patch. */
export const formatPatchParityReport = (
  problems: readonly PatchParityProblem[],
): string =>
  [
    'Workspace patches are out of step with the installed ' +
      '@modern-js/ultramodern-create template:',
    ...problems.map(problem => `  - ${problem.message}`),
  ].join('\n');
