import { describe, expect, test } from '@rstest/core';
import { type TsCheckerOptions, withTsgoDefaults } from '../src/shared/tsgo';

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

  test('opting out of tsgo hands the classic checker the untouched config', () => {
    const config = applyChain(
      withTsgoDefaults({ typescript: { tsgo: false } }, process.cwd()),
    );

    expect(config.typescript?.tsgo).toBe(false);
    // The classic TypeScript checker still understands `baseUrl`, so the
    // override is only applied on the tsgo lane.
    expect(config.typescript?.configOverwrite).toBeUndefined();
  });
});
