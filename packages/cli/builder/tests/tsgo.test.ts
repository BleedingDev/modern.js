import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from '@rstest/core';
import { type TsCheckerOptions, withTsgoDefaults } from '../src/shared/tsgo';

const temporaryRoots: string[] = [];

/** A vertical's on-disk shape: sources under `src/` and a BFF under `api/`. */
const createVerticalApp = (compilerOptions: Record<string, unknown>) => {
  const appDirectory = mkdtempSync(path.join(tmpdir(), 'tsgo-vertical-'));
  temporaryRoots.push(appDirectory);
  mkdirSync(path.join(appDirectory, 'src'), { recursive: true });
  mkdirSync(path.join(appDirectory, 'api'), { recursive: true });
  writeFileSync(
    path.join(appDirectory, 'src', 'index.ts'),
    'export const a = 1;\n',
  );
  writeFileSync(
    path.join(appDirectory, 'api', 'index.ts'),
    'export const b = 2;\n',
  );
  writeFileSync(
    path.join(appDirectory, 'tsconfig.json'),
    `${JSON.stringify({ compilerOptions, include: ['src', 'api'] }, null, 2)}\n`,
  );
  return appDirectory;
};

const readGeneratedCheckerConfig = (
  appDirectory: string,
  config: TsCheckerOptions,
) => {
  const generated = config.typescript?.configFile as string;
  expect(
    generated.startsWith(path.join(appDirectory, '.modern-js', 'tsgo')),
  ).toBe(true);
  return JSON.parse(readFileSync(generated, 'utf8')) as {
    extends: string;
    compilerOptions: Record<string, unknown>;
  };
};

const applyChain = (
  chain: ReturnType<typeof withTsgoDefaults>,
): TsCheckerOptions => {
  const entries = Array.isArray(chain) ? chain : [chain];
  let config = {} as TsCheckerOptions;
  for (const entry of entries) {
    if (typeof entry === 'function') {
      config = (entry as (input: TsCheckerOptions) => TsCheckerOptions)(
        config,
      ) as TsCheckerOptions;
      continue;
    }
    config = {
      ...config,
      ...(entry as TsCheckerOptions),
      typescript: {
        ...config.typescript,
        ...(entry as TsCheckerOptions).typescript,
      },
    };
  }
  return config;
};

describe('withTsgoDefaults', () => {
  test('neutralises the removed `baseUrl` option for the type checker', () => {
    // TypeScript 7 removed `baseUrl` (TS5102). Every project whose tsconfig
    // still sets it must keep building, so the checker gets an override that
    // blanks the option out.
    const config = applyChain(withTsgoDefaults(undefined, process.cwd()));

    expect(config.typescript?.configOverwrite?.compilerOptions).toMatchObject({
      baseUrl: null,
    });
  });

  test('keeps user tsChecker options and their own overrides', () => {
    const config = applyChain(
      withTsgoDefaults(
        {
          typescript: {
            memoryLimit: 4096,
            configOverwrite: { compilerOptions: { strict: true } },
          },
        },
        process.cwd(),
      ),
    );

    expect(config.typescript?.memoryLimit).toBe(4096);
    expect(config.typescript?.configOverwrite?.compilerOptions).toMatchObject({
      strict: true,
      baseUrl: null,
    });
  });

  test('drops `moduleResolution` when the project still asks for node10', () => {
    const config = applyChain(
      withTsgoDefaults(
        {
          typescript: {
            configOverwrite: { compilerOptions: { moduleResolution: 'node' } },
          },
        },
        process.cwd(),
      ),
    );

    expect(config.typescript?.configOverwrite?.compilerOptions).toMatchObject({
      baseUrl: null,
      moduleResolution: null,
    });
  });

  test('keeps rootDir at the app root for a composite vertical layout', () => {
    // The generated checker config lives in `.modern-js/tsgo/`. With
    // `composite` and no explicit `rootDir`, TypeScript would default the root
    // to that generated directory and reject every file under `src/` and
    // `api/` with TS6059.
    const appDirectory = createVerticalApp({ composite: true, baseUrl: '.' });
    const config = applyChain(
      withTsgoDefaults(
        { typescript: { configFile: 'tsconfig.json' } },
        appDirectory,
      ),
    );
    const generated = readGeneratedCheckerConfig(appDirectory, config);

    expect(generated.compilerOptions.rootDir).toBe(
      appDirectory.replaceAll(path.sep, '/'),
    );
    expect(generated.compilerOptions.baseUrl).toBeNull();
  });

  test('resolves an explicit relative rootDir against the project, not the generated config', () => {
    const appDirectory = createVerticalApp({ rootDir: '.', baseUrl: '.' });
    const config = applyChain(
      withTsgoDefaults(
        { typescript: { configFile: 'tsconfig.json' } },
        appDirectory,
      ),
    );
    const generated = readGeneratedCheckerConfig(appDirectory, config);

    // `.` next to the project config means the app root; inherited into
    // `.modern-js/tsgo/` it would otherwise mean the generated directory.
    expect(generated.compilerOptions.rootDir).toBe(
      appDirectory.replaceAll(path.sep, '/'),
    );
  });

  test('leaves rootDir unset for a non-composite project without one', () => {
    // TypeScript infers the root from the input files here, which is correct
    // and must not be overridden - an app may legitimately include sources
    // from outside its own directory.
    const appDirectory = createVerticalApp({ baseUrl: '.' });
    const config = applyChain(
      withTsgoDefaults(
        { typescript: { configFile: 'tsconfig.json' } },
        appDirectory,
      ),
    );
    const generated = readGeneratedCheckerConfig(appDirectory, config);

    expect('rootDir' in generated.compilerOptions).toBe(false);
  });

  test('restates project references so a referenced sibling stays a project boundary', () => {
    // `references` is the one top-level property TypeScript does not inherit
    // through `extends`. Dropping it pulls a referenced sibling's sources into
    // this program and checks them against this program's globals, instead of
    // redirecting to the sibling's own declarations.
    const appDirectory = createVerticalApp({ composite: true });
    writeFileSync(
      path.join(appDirectory, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: { composite: true },
          include: ['src', 'api'],
          references: [
            { path: '../checkout' },
            { path: '../../packages/shared' },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const config = applyChain(
      withTsgoDefaults(
        { typescript: { configFile: 'tsconfig.json' } },
        appDirectory,
      ),
    );
    const generated = readGeneratedCheckerConfig(appDirectory, config) as {
      references?: Array<{ path: string }>;
    };

    // Resolved against the project config, not the generated directory.
    expect(generated.references).toEqual([
      {
        path: path
          .resolve(appDirectory, '../checkout')
          .replaceAll(path.sep, '/'),
      },
      {
        path: path
          .resolve(appDirectory, '../../packages/shared')
          .replaceAll(path.sep, '/'),
      },
    ]);
  });

  test('omits references when the project declares none', () => {
    const appDirectory = createVerticalApp({ composite: true });
    const config = applyChain(
      withTsgoDefaults(
        { typescript: { configFile: 'tsconfig.json' } },
        appDirectory,
      ),
    );
    const generated = readGeneratedCheckerConfig(appDirectory, config);

    expect('references' in generated).toBe(false);
  });

  test('opting out of tsgo hands the classic checker the untouched config', () => {
    const config = applyChain(
      withTsgoDefaults({ typescript: { tsgo: false } }, process.cwd()),
    );

    expect(config.typescript?.tsgo).toBe(false);
    // The classic TypeScript checker still understands `baseUrl`, so the
    // override is only applied on the tsgo lane.
    expect(config.typescript?.configOverwrite).toBeUndefined();
  });

  afterEach(() => {
    while (temporaryRoots.length) {
      rmSync(temporaryRoots.pop()!, { force: true, recursive: true });
    }
  });
});
