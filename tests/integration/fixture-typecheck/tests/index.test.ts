import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { setSuiteTimeout } from '../../../utils/setSuiteTimeout';

setSuiteTimeout(1000 * 60 * 4);

const testsRoot = path.resolve(__dirname, '../../..');

function resolveTsgoBin() {
  const pkgPath = require.resolve('@typescript/native-preview/package.json');
  const pkgDir = path.dirname(pkgPath);
  const pkg = require(pkgPath) as {
    bin?:
      | string
      | {
          tsgo?: string;
        };
  };
  const binEntry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.tsgo;
  return path.resolve(pkgDir, binEntry ?? 'bin/tsgo.js');
}

const tsgoBin = resolveTsgoBin();

const fixtureTypechecks = [
  {
    name: 'routes-tanstack-mf remote',
    cwd: 'integration/routes-tanstack-mf/mf-remote',
    tsconfig: 'tsconfig.typecheck.json',
  },
  {
    name: 'routes-tanstack-mf remote 2',
    cwd: 'integration/routes-tanstack-mf/mf-remote-2',
    tsconfig: 'tsconfig.typecheck.json',
  },
  {
    name: 'bff-effect',
    cwd: 'integration/bff-effect',
    tsconfig: 'tsconfig.json',
  },
  {
    name: 'superapp-portfolio',
    cwd: 'integration/superapp-portfolio',
    tsconfig: 'tsconfig.json',
  },
  {
    name: 'deploy-server',
    cwd: 'integration/deploy-server',
    tsconfig: 'tsconfig.typecheck.json',
  },
  {
    name: 'backend context type contract',
    cwd: 'integration/bff-effect',
    tsconfig: 'tsconfig.backend-context.json',
  },
] as const;

function runFixtureTypecheck(fixture: (typeof fixtureTypechecks)[number]) {
  try {
    execFileSync(
      process.execPath,
      [tsgoBin, '--noEmit', '-p', fixture.tsconfig],
      {
        cwd: path.join(testsRoot, fixture.cwd),
        stdio: 'pipe',
      },
    );
  } catch (error: unknown) {
    const maybeError = error as { stdout?: unknown; stderr?: unknown };
    const stdout =
      typeof maybeError.stdout === 'string'
        ? maybeError.stdout
        : maybeError.stdout
          ? String(maybeError.stdout)
          : '';
    const stderr =
      typeof maybeError.stderr === 'string'
        ? maybeError.stderr
        : maybeError.stderr
          ? String(maybeError.stderr)
          : '';
    throw new Error(`${fixture.name} typecheck failed:\n${stdout}\n${stderr}`);
  }
}

describe('fork fixture typechecks', () => {
  for (const fixture of fixtureTypechecks) {
    test(`${fixture.name} passes tsgo`, () => {
      runFixtureTypecheck(fixture);
    });
  }
});
