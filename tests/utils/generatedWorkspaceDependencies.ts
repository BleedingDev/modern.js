import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;
type DependencyField = (typeof dependencyFields)[number];
type PackageManifest = {
  name?: unknown;
  [field: string]: unknown;
};

type DependencyRecord = {
  field: DependencyField;
  manifestPath: string;
  specifier: string;
};

type PackageSource = {
  manifestPath: string;
  packageDir: string;
};

function readManifest(manifestPath: string): PackageManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest;
}

function collectManifestPaths(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const manifests: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (
        entry.name === '.git' ||
        entry.name === '.cache' ||
        entry.name === 'coverage' ||
        entry.name === 'dist' ||
        entry.name === 'node_modules'
      ) {
        continue;
      }

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name === 'package.json') {
        manifests.push(entryPath);
      }
    }
  };

  visit(root);
  return manifests;
}

function collectGeneratedPackageSources(workspaceDir: string) {
  const sources = new Map<string, PackageSource>();
  for (const parent of ['packages', 'apps', 'verticals']) {
    for (const manifestPath of collectManifestPaths(
      path.join(workspaceDir, parent),
    )) {
      const manifest = readManifest(manifestPath);
      if (typeof manifest.name !== 'string') {
        continue;
      }

      const packageDir = path.dirname(manifestPath);
      const previous = sources.get(manifest.name);
      if (previous && previous.packageDir !== packageDir) {
        throw new Error(
          `Generated workspace package ${manifest.name} has multiple sources: ` +
            `${previous.packageDir} and ${packageDir}.`,
        );
      }
      sources.set(manifest.name, { manifestPath, packageDir });
    }
  }
  return sources;
}

function collectLocalModernPackageSources() {
  const sources = new Map<string, PackageSource>();
  for (const manifestPath of collectManifestPaths(
    path.join(repoRoot, 'packages'),
  )) {
    const manifest = readManifest(manifestPath);
    if (
      typeof manifest.name !== 'string' ||
      !manifest.name.startsWith('@modern-js/')
    ) {
      continue;
    }

    const packageDir = path.dirname(manifestPath);
    const previous = sources.get(manifest.name);
    if (previous && previous.packageDir !== packageDir) {
      throw new Error(
        `Local Modern package ${manifest.name} has multiple sources: ` +
          `${previous.packageDir} and ${packageDir}.`,
      );
    }
    sources.set(manifest.name, { manifestPath, packageDir });
  }
  return sources;
}

function collectDeclaredDependencies(workspaceDir: string) {
  const dependencies = new Map<string, DependencyRecord>();
  const manifestPaths = [
    path.join(workspaceDir, 'package.json'),
    ...['apps', 'verticals', 'packages'].flatMap(parent =>
      collectManifestPaths(path.join(workspaceDir, parent)),
    ),
  ].filter(manifestPath => fs.existsSync(manifestPath));

  for (const manifestPath of manifestPaths) {
    const manifest = readManifest(manifestPath);
    for (const field of dependencyFields) {
      const record = manifest[field];
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        continue;
      }

      for (const [name, rawSpecifier] of Object.entries(
        record as Record<string, unknown>,
      )) {
        if (typeof rawSpecifier !== 'string') {
          throw new Error(
            `Dependency ${name} in ${manifestPath} has a non-string ` +
              `${field} specifier.`,
          );
        }

        const previous = dependencies.get(name);
        if (previous && previous.specifier !== rawSpecifier) {
          throw new Error(
            `Conflicting direct dependency ${name}: ` +
              `${previous.specifier} (${previous.manifestPath} ` +
              `${previous.field}) versus ${rawSpecifier} ` +
              `(${manifestPath} ${field}).`,
          );
        }
        dependencies.set(name, {
          field,
          manifestPath,
          specifier: rawSpecifier,
        });
      }
    }
  }

  return dependencies;
}

function linkPackage(
  packageRoot: string,
  packageName: string,
  sourceDir: string,
) {
  const packagePath = path.join(packageRoot, 'node_modules', packageName);
  fs.mkdirSync(path.dirname(packagePath), { recursive: true });

  let existing: fs.Stats | undefined;
  try {
    existing = fs.lstatSync(packagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  if (existing) {
    if (!existing.isSymbolicLink()) {
      throw new Error(
        `Cannot replace generated dependency ${packageName} at ${packagePath}; ` +
          'the path is not a symbolic link.',
      );
    }
    const linkedSource = fs.realpathSync(packagePath);
    if (linkedSource !== fs.realpathSync(sourceDir)) {
      throw new Error(
        `Generated dependency ${packageName} at ${packagePath} points to ` +
          `${linkedSource}, expected ${sourceDir}.`,
      );
    }
    return;
  }

  fs.symlinkSync(sourceDir, packagePath, 'dir');
}

function linkInstalledNodeModules(workspaceDir: string, installedPath: string) {
  const workspaceNodeModules = path.join(workspaceDir, 'node_modules');
  let existing: fs.Stats | undefined;
  try {
    existing = fs.lstatSync(workspaceNodeModules);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  if (existing) {
    if (!existing.isSymbolicLink()) {
      throw new Error(
        `Cannot materialize generated dependencies at ${workspaceNodeModules}; ` +
          'the existing path is not a symbolic link.',
      );
    }
    fs.unlinkSync(workspaceNodeModules);
  }

  fs.symlinkSync(installedPath, workspaceNodeModules, 'dir');
  return workspaceNodeModules;
}

function removeWorkspaceNodeModules(workspaceNodeModules: string) {
  try {
    if (fs.lstatSync(workspaceNodeModules).isSymbolicLink()) {
      fs.unlinkSync(workspaceNodeModules);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function installDependencies(
  workspaceDir: string,
  dependencies: Map<string, DependencyRecord>,
  localPackageNames: Set<string>,
) {
  const externalDependencies = Object.fromEntries(
    [...dependencies.entries()]
      .filter(([name]) => !localPackageNames.has(name))
      .map(([name, record]) => [name, record.specifier])
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  for (const [name, specifier] of Object.entries(externalDependencies)) {
    if (specifier.startsWith('workspace:')) {
      throw new Error(
        `Generated workspace dependency ${name} uses ${specifier}, but no ` +
          'generated local package provides that name.',
      );
    }
  }

  const installRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'modern-generated-workspace-deps-'),
  );
  try {
    fs.writeFileSync(
      path.join(installRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: 'modern-generated-workspace-dependencies',
          private: true,
          version: '0.0.0',
          dependencies: externalDependencies,
        },
        null,
        2,
      )}\n`,
    );
    execFileSync('pnpm', ['install', '--ignore-workspace'], {
      cwd: installRoot,
      env: { ...process.env, CI: 'true' },
      stdio: 'pipe',
    });
    const workspaceNodeModules = linkInstalledNodeModules(
      workspaceDir,
      path.join(installRoot, 'node_modules'),
    );
    return { installRoot, workspaceNodeModules };
  } catch (error) {
    fs.rmSync(installRoot, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Install the generated workspace's third-party dependencies outside the
 * repository workspace and link local first-party artifacts into each app.
 * The returned cleanup must run after every build/serve attempt.
 */
export function materializeGeneratedWorkspaceDependencies(
  workspaceDir: string,
): () => void {
  const generatedPackages = collectGeneratedPackageSources(workspaceDir);
  const localPackages = collectLocalModernPackageSources();
  const dependencies = collectDeclaredDependencies(workspaceDir);
  const packageSources = new Map(localPackages);
  for (const [name, source] of generatedPackages) {
    packageSources.set(name, source);
  }

  const materialized = installDependencies(
    workspaceDir,
    dependencies,
    new Set(packageSources.keys()),
  );

  try {
    const generatedPackageDirectories = [
      ...collectManifestPaths(path.join(workspaceDir, 'apps')),
      ...collectManifestPaths(path.join(workspaceDir, 'verticals')),
      ...collectManifestPaths(path.join(workspaceDir, 'packages')),
    ].map(manifestPath => path.dirname(manifestPath));
    for (const packageDirectory of generatedPackageDirectories) {
      for (const [packageName, source] of packageSources) {
        linkPackage(packageDirectory, packageName, source.packageDir);
      }
    }
  } catch (error) {
    removeWorkspaceNodeModules(materialized.workspaceNodeModules);
    fs.rmSync(materialized.installRoot, { recursive: true, force: true });
    throw error;
  }

  let cleaned = false;
  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    removeWorkspaceNodeModules(materialized.workspaceNodeModules);
    fs.rmSync(materialized.installRoot, { recursive: true, force: true });
  };
}
