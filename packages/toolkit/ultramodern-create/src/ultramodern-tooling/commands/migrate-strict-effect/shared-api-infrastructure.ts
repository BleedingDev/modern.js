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
const baselineExport = "export * from './microvertical-api-baseline.ts';";

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

  const indexPath = path.join(io.workspaceRoot, directory, 'src/index.ts');
  const index = fs.existsSync(indexPath)
    ? fs.readFileSync(indexPath, 'utf8')
    : readFileTemplate('packages/shared-contracts-index.ts');
  if (!index.endsWith(`\n${baselineExport}\n`)) {
    // Star exports fill absent names without replacing existing explicit exports.
    // Use write, not writeGenerated, to retain every byte of consumer source.
    io.write(
      indexPath,
      `${index}${index.endsWith('\n') ? '' : '\n'}\n${baselineExport}\n`,
    );
  }
  writeJsonFile(io, manifestPath, manifest);
}
