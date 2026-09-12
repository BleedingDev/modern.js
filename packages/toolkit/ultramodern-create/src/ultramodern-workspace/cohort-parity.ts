import fs from 'node:fs';
import path from 'node:path';
import { RELEASE_COHORT_PROJECTION_PATH } from '../ultramodern-release-cohort';

export interface ReleaseCohortParityInputs {
  /** Root of the generated workspace being validated. */
  workspaceRoot: string;
  /** Root of the installed `@modern-js/ultramodern-create` package. */
  createPackageRoot: string;
  /**
   * `true` when the workspace consumes a published cohort
   * (`packageSource.strategy === 'install'`): the installed create package must
   * then ship a readable projection, and its absence fails validation instead
   * of silently disabling the gate. A local-source workspace has no
   * authenticated projection to compare against and is not judged.
   */
  requireTemplate: boolean;
}

export interface ReleaseCohortParityProblem {
  /** Dotted JSON paths whose values differ, e.g. `source.commit`. */
  differences: string[];
  message: string;
}

const TEMPLATE_PROJECTION = path.join(
  'template-workspace',
  RELEASE_COHORT_PROJECTION_PATH,
);

type JsonRead =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'missing' | 'malformed' };

const readJson = (file: string): JsonRead => {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { ok: false, reason: 'missing' };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Dotted paths at which two JSON documents differ, deepest record first. */
export const jsonDifferences = (
  expected: unknown,
  actual: unknown,
  prefix = '',
): string[] => {
  if (isRecord(expected) && isRecord(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys]
      .sort()
      .flatMap(key =>
        jsonDifferences(
          expected[key],
          actual[key],
          prefix ? `${prefix}.${key}` : key,
        ),
      );
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return [`${prefix}.length`];
    }
    return expected.flatMap((item, index) =>
      jsonDifferences(item, actual[index], `${prefix}[${index}]`),
    );
  }
  return JSON.stringify(expected) === JSON.stringify(actual) ? [] : [prefix];
};

/**
 * The release cohort projection is authenticated: the publish lane writes it
 * into the create package's template with the exact source revision the
 * cohort was published from. A workspace adopting a cohort by bumping version
 * strings keeps the previous projection's `source.commit` and misreports the
 * cohort's provenance; nothing later in the build reads that field, so the
 * drift is otherwise silent. Name the difference here and the template to copy.
 */
export const checkReleaseCohortParity = ({
  workspaceRoot,
  createPackageRoot,
  requireTemplate,
}: ReleaseCohortParityInputs): ReleaseCohortParityProblem | undefined => {
  const templateFile = path.join(createPackageRoot, TEMPLATE_PROJECTION);
  const workspaceFile = path.join(
    workspaceRoot,
    RELEASE_COHORT_PROJECTION_PATH,
  );
  const expected = readJson(templateFile);
  if (!expected.ok) {
    if (!requireTemplate) {
      // A local-source workspace: the create package is a source checkout and
      // ships no authenticated projection. Nothing to compare against.
      return undefined;
    }
    // An installed cohort without a readable projection cannot be trusted;
    // failing closed is the point of this gate.
    return {
      differences: [],
      message:
        `the installed @modern-js/ultramodern-create ships ${
          expected.reason === 'missing' ? 'no' : 'an unreadable'
        } release cohort projection at ${templateFile}, so the workspace's ` +
        `${RELEASE_COHORT_PROJECTION_PATH} cannot be authenticated. ` +
        'Reinstall the published cohort.',
    };
  }
  if (!fs.existsSync(workspaceFile)) {
    // A workspace without a projection is judged by the cohort reader.
    return undefined;
  }
  const actual = readJson(workspaceFile);
  const differences = jsonDifferences(
    expected.value,
    actual.ok ? actual.value : undefined,
  );
  if (differences.length === 0) {
    return undefined;
  }
  const shown = differences.slice(0, 8).join(', ');
  const more =
    differences.length > 8 ? ` and ${differences.length - 8} more` : '';
  return {
    differences,
    message:
      `${RELEASE_COHORT_PROJECTION_PATH} does not match the installed ` +
      `cohort's authenticated projection (differs at ${shown}${more}). ` +
      `Replace it with ${templateFile}.`,
  };
};

export const formatReleaseCohortParityReport = (
  problem: ReleaseCohortParityProblem,
): string =>
  [
    'Workspace release cohort projection is out of step with the installed @modern-js/ultramodern-create template:',
    `  - ${problem.message}`,
  ].join('\n');
