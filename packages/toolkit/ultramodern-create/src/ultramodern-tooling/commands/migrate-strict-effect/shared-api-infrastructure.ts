import fs from 'node:fs';
import path from 'node:path';
import { readFileTemplate } from '../../../ultramodern-workspace/fs-io';
import {
  createSharedPackage,
  createSharedPackageTsConfig,
} from '../../../ultramodern-workspace/package-json';
import type { ResolvedPackageSource } from '../../../ultramodern-workspace/types';
import { type MigrationIo, readJsonFile, writeJsonFile } from './io';

const directory = 'packages/shared-contracts';

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object; resolve it before migration.`);
  }
  return value as Record<string, unknown>;
}

/** Add infrastructure only: existing contracts and business handlers stay owned by the consumer. */
export function ensureSharedApiInfrastructure(
  io: MigrationIo,
  scope: string,
  packageSource: ResolvedPackageSource,
) {
  for (const relativePath of [
    'packages',
    directory,
    `${directory}/package.json`,
    `${directory}/src`,
    `${directory}/src/index.ts`,
  ]) {
    if (
      fs
        .lstatSync(path.join(io.workspaceRoot, relativePath), {
          throwIfNoEntry: false,
        })
        ?.isSymbolicLink()
    ) {
      throw new Error(
        `Shared API migration cannot write through a symbolic link: ${relativePath}`,
      );
    }
  }
  const manifestPath = path.join(io.workspaceRoot, directory, 'package.json');
  const defaults = createSharedPackage(
    scope,
    'shared-contracts',
    'Shared workspace contracts',
    packageSource,
  ) as Record<string, unknown>;
  const manifest = fs.existsSync(manifestPath)
    ? record(readJsonFile(manifestPath), `${directory}/package.json`)
    : defaults;
  const exports =
    manifest.exports === undefined
      ? {}
      : typeof manifest.exports === 'string'
        ? { '.': manifest.exports }
        : record(manifest.exports, `${directory}/package.json exports`);
  if (
    Object.keys(exports).some(key => !key.startsWith('.')) ||
    (exports['.'] !== undefined && exports['.'] !== './src/index.ts')
  ) {
    throw new Error(
      `${directory}/package.json exports must expose ./src/index.ts at "." ` +
        'before adding shared API infrastructure; consumer exports were not overwritten.',
    );
  }
  for (const [subpath, target] of Object.entries(
    record(defaults.exports, 'Shared contract exports'),
  )) {
    if (exports[subpath] !== undefined && exports[subpath] !== target) {
      throw new Error(
        `${directory}/package.json ${subpath} must expose ${String(target)}; consumer exports were not overwritten.`,
      );
    }
  }
  const dependencies = record(
    manifest.dependencies ?? {},
    `${directory}/package.json dependencies`,
  );
  manifest.exports = {
    ...record(defaults.exports, 'Shared contract exports'),
    ...exports,
  };
  manifest.dependencies = {
    ...record(defaults.dependencies, 'Shared contract dependencies'),
    ...dependencies,
  };

  const writeMissing = (relativePath: string, content: string) => {
    const filePath = path.join(io.workspaceRoot, directory, relativePath);
    // lstat also preserves dangling links: migration must not take ownership of them.
    if (fs.lstatSync(filePath, { throwIfNoEntry: false }) === undefined) {
      io.writeGenerated(filePath, content);
    }
  };
  writeMissing(
    'src/effect-bff-runtime.ts',
    readFileTemplate('packages/effect-bff-runtime.ts'),
  );
  writeMissing(
    'src/microvertical-api-baseline.ts',
    readFileTemplate('packages/microvertical-api-baseline.ts'),
  );
  writeMissing(
    'tsconfig.json',
    `${JSON.stringify(createSharedPackageTsConfig(directory), null, 2)}\n`,
  );

  // A new public subpath must not expand the consumer root barrel's module graph.
  // Even its formatting is consumer-owned; only create an index when absent.
  writeMissing(
    'src/index.ts',
    readFileTemplate('packages/shared-contracts-index.ts'),
  );
  writeJsonFile(io, manifestPath, manifest);
}
