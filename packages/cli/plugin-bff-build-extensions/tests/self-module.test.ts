import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from '@rstest/core';
import { resolveSelfModule } from '../src/self-module';

const packageRoot = path.resolve(__dirname, '..');

describe('resolving a file this package ships', () => {
  test('finds the sibling module without a self-reference by package name', () => {
    // Under pnpm's isolated layout the public specifier
    // `@modern-js/plugin-bff-build-extensions/hono-client-codegen` is anchored
    // in this package's own `.pnpm` directory and only resolves where the
    // workspace root hoists it.
    const resolved = resolveSelfModule('hono-client-codegen');

    expect(fs.existsSync(resolved)).toBe(true);
    expect(path.basename(resolved)).toMatch(/^hono-client-codegen\.[a-z]+$/);
    expect(resolved.startsWith(packageRoot)).toBe(true);
  });

  test('reports a module this package does not ship', () => {
    expect(() => resolveSelfModule('not-a-shipped-module')).toThrow();
  });
});
