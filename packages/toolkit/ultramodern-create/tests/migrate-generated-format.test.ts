import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rstest } from '@rstest/core';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { updateGeneratedTypeScriptSurfaces } from '../src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-typescript';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { readUltramodernConfig } from '../src/ultramodern-tooling/config';
import { readFileTemplate } from '../src/ultramodern-workspace/fs-io';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace/index';
import { migratedWorkspaceScriptArtifacts } from '../src/ultramodern-workspace/workspace-scripts';
import {
  linkWorkspaceFormatterDependencies,
  snapshotWorkspace,
} from './helpers/workspace-kit';

const packageSource = { strategy: 'workspace' } as const;

function readFiles(workspaceRoot: string, relativePaths: readonly string[]) {
  return new Map(
    relativePaths.map(relativePath => [
      relativePath,
      fs.readFileSync(path.join(workspaceRoot, relativePath)),
    ]),
  );
}

function assertGeneratedFilesAreFormatted(
  workspaceRoot: string,
  relativePaths: readonly string[],
  mode: '--check' | '--write' = '--check',
) {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve(__dirname, '../node_modules/oxfmt/bin/oxfmt'),
      mode,
      '--no-error-on-unmatched-pattern',
      ...relativePaths,
    ],
    { cwd: workspaceRoot, encoding: 'utf-8' },
  );
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
}

test('authentic .4 flattened-locale runtime migration passes native import sorting and preserves authored helper changes', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-historical-runtime-format-'),
  );
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'fixtures/migration-runtime-historical-4.json'),
      'utf8',
    ),
  ) as { files: Array<{ path: string; content: string }> };
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'historical-app',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    addUltramodernVertical({
      workspaceRoot: root,
      name: 'orders',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    linkWorkspaceFormatterDependencies(root);
    for (const file of fixture.files)
      fs.writeFileSync(path.join(root, file.path), file.content);
    const runtime = fixture.files[0]!;
    const runtimePath = path.join(root, runtime.path);
    const config = readUltramodernConfig(root);
    const run = () => {
      const io = createMigrationIo(root, false);
      io.transaction(() => updateGeneratedTypeScriptSurfaces(io, config));
    };
    assertGeneratedFilesAreFormatted(root, [runtime.path]);
    const native = spawnSync(
      process.execPath,
      [
        path.resolve(__dirname, '../node_modules/oxfmt/bin/oxfmt'),
        '--stdin-filepath',
        runtime.path,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        input: runtime.content.replace(
          '@modern-js/runtime/boundary-debugger',
          '@modern-js/boundary-debugger',
        ),
      },
    );
    assert.equal(native.status, 0, native.stderr);
    run();
    assertGeneratedFilesAreFormatted(root, [runtime.path]);
    assert.equal(fs.readFileSync(runtimePath, 'utf8'), native.stdout);
    run();
    assert.equal(fs.readFileSync(runtimePath, 'utf8'), native.stdout);
    const authored = runtime.content.replace(
      'return prefix.length > 0',
      'return prefix.length > 1',
    );
    assert.notEqual(authored, runtime.content);
    fs.writeFileSync(runtimePath, authored);
    run();
    assert.equal(
      fs.readFileSync(runtimePath, 'utf8'),
      authored.replace(
        '@modern-js/runtime/boundary-debugger',
        '@modern-js/boundary-debugger',
      ),
    );
    assert.equal(
      fs.readFileSync(path.join(root, 'oxfmt.config.ts'), 'utf8'),
      fixture.files[1]!.content,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('authentic .4 provider and API import migrations use the consumer formatter without reformatting authored API source', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-historical-import-format-'),
  );
  const workspaceRoot = path.join(tempRoot, 'historical-app');
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'fixtures/migration-format-historical-4.json'),
      'utf8',
    ),
  ) as { files: Array<{ path: string; content: string }> };
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'historical-app',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    addUltramodernVertical({
      workspaceRoot,
      name: 'orders',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    addUltramodernVertical({
      workspaceRoot,
      name: 'custom',
      preset: 'api-only',
      modernVersion: '3.2.1',
      packageSource,
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    for (const file of fixture.files) {
      fs.writeFileSync(path.join(workspaceRoot, file.path), file.content);
    }
    const sharedManifestPath = path.join(
      workspaceRoot,
      'packages/shared-contracts/package.json',
    );
    const sharedManifest = JSON.parse(
      fs.readFileSync(sharedManifestPath, 'utf8'),
    );
    sharedManifest.exports['./microvertical-api-baseline'] =
      './src/microvertical-api-baseline.ts';
    fs.writeFileSync(sharedManifestPath, JSON.stringify(sharedManifest));

    const authoredPath = 'verticals/custom/shared/api.ts';
    const originalApi = fs
      .readFileSync(path.join(workspaceRoot, authoredPath), 'utf8')
      .replaceAll(
        '@modern-js/bff-effect/microvertical-api',
        '@historical-app/shared-contracts/microvertical-api-baseline',
      )
      .replaceAll(
        '@modern-js/bff-effect/effect-client',
        '@modern-js/plugin-bff/effect-client',
      );
    const authoredApi = `${originalApi}\r\n// Authored API implementation and formatting.\r\nexport const customEndpoint =  "keep these bytes";\r\n`;
    fs.writeFileSync(path.join(workspaceRoot, authoredPath), authoredApi);

    const before = snapshotWorkspace(workspaceRoot);
    const output = rstest.spyOn(process.stdout, 'write').mockReturnValue(true);
    let dryOutput: string;
    try {
      assert.equal(
        await runUltramodernToolingCli(
          ['migrate-strict-effect', '--dry-run'],
          workspaceRoot,
        ),
        0,
      );
      dryOutput = output.mock.calls.map(call => String(call[0])).join('');
    } finally {
      output.mockRestore();
    }
    assert.deepEqual(snapshotWorkspace(workspaceRoot), before);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    const generatedPaths = fixture.files.slice(0, 4).map(file => file.path);
    assertGeneratedFilesAreFormatted(workspaceRoot, generatedPaths);
    assert.equal(
      fs.readFileSync(path.join(workspaceRoot, 'oxfmt.config.ts'), 'utf8'),
      before['oxfmt.config.ts'],
    );
    assert.equal(
      fs.readFileSync(path.join(workspaceRoot, authoredPath), 'utf8'),
      authoredApi
        .replaceAll(
          '@historical-app/shared-contracts/microvertical-api-baseline',
          '@modern-js/bff-effect/microvertical-api',
        )
        .replaceAll(
          '@modern-js/plugin-bff/effect-client',
          '@modern-js/bff-effect/effect-client',
        ),
    );
    const after = snapshotWorkspace(workspaceRoot);
    for (const file of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      if (before[file] === after[file]) continue;
      const verb = after[file] === undefined ? 'delete' : 'write';
      assert.ok(
        dryOutput.includes(`[dry-run] would ${verb} ${file}`),
        `Finalized dry-run omitted ${file}`,
      );
    }
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.deepEqual(snapshotWorkspace(workspaceRoot), after);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test.each([
  { printWidth: 80, singleQuote: false, trailingComma: 'none' },
  { printWidth: 120, singleQuote: true, trailingComma: 'all' },
  { printWidth: 160, singleQuote: false, trailingComma: 'es5' },
])('migrate preserves authored formatter settings %j and stays byte-idempotent', async formatterSettings => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-migrate-format-'));
  const workspaceRoot = path.join(tempRoot, 'format-workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'format-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    addUltramodernVertical({
      workspaceRoot,
      name: 'catalog',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });

    const fragmentPath =
      'verticals/catalog/src/routes/[lang]/_mf/fragment/widget/page.tsx';
    const historicalConfigPath = path.join(tempRoot, '.oxfmtrc.json');
    fs.writeFileSync(historicalConfigPath, JSON.stringify(formatterSettings));
    const historicalFormat = spawnSync(
      process.execPath,
      [
        path.resolve(__dirname, '../node_modules/oxfmt/bin/oxfmt'),
        '--config',
        historicalConfigPath,
        fragmentPath,
      ],
      { cwd: workspaceRoot, encoding: 'utf-8' },
    );
    assert.equal(historicalFormat.status, 0, historicalFormat.stderr);
    const fragmentSource = fs.readFileSync(
      path.join(workspaceRoot, fragmentPath),
      'utf-8',
    );

    const consumerProbePath = 'packages/format-probe.tsx';
    const consumerProbe = Buffer.from(
      'export const Probe = () => <div className="p-4 flex items-center">probe</div>;\n',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, consumerProbePath),
      consumerProbe,
    );
    const consumerConfigPath = path.join(workspaceRoot, 'oxfmt.config.ts');
    const consumerConfig = Buffer.from(
      `export default ${JSON.stringify(formatterSettings)};\n`,
    );
    fs.writeFileSync(consumerConfigPath, consumerConfig);
    // Establish the consumer's chosen style before testing which generated
    // transitions migration owns; unchanged authored configs stay untouched.
    assertGeneratedFilesAreFormatted(
      workspaceRoot,
      ['apps', 'verticals', 'packages', 'scripts'],
      '--write',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, consumerProbePath),
      consumerProbe,
    );

    const shellUiMarker = 'apps/shell-super-app/src/ultramodern-build.ts';
    fs.writeFileSync(
      path.join(workspaceRoot, shellUiMarker),
      "export { ultramodernUiMarker } from '../shared/ultramodern-build';\n",
    );
    const removedUiMarker = path.join(
      workspaceRoot,
      'verticals/catalog/src/ultramodern-build.ts',
    );
    fs.rmSync(removedUiMarker);
    fs.writeFileSync(
      path.join(workspaceRoot, 'verticals/catalog/src/routes/[lang]/page.tsx'),
      'export default function Page() { return <main>Consumer UI</main>; }\n',
    );
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );

    const generatedPaths = [
      ...new Set([
        ...migratedWorkspaceScriptArtifacts({
          shellOnly: false,
          hasBackendSurface: true,
        }).map(artifact => artifact.relativePath),
        'scripts/validate-ultramodern-workspace.mts',
        'zerops.yaml',
        'apps/shell-super-app/modern.config.ts',
        'apps/shell-super-app/module-federation.config.ts',
        'apps/shell-super-app/shared/ultramodern-build.ts',
        shellUiMarker,
        'apps/shell-super-app/src/routes/vertical-components.tsx',
        'apps/shell-super-app/src/routes/vertical-components.worker.tsx',
        'apps/shell-super-app/src/federated-components.tsx',
        'apps/shell-super-app/src/federated-components.worker.tsx',
        'verticals/catalog/modern.config.ts',
        'verticals/catalog/module-federation.config.ts',
        'verticals/catalog/backend-federation.config.ts',
        'verticals/catalog/shared/ultramodern-build.ts',
        'verticals/catalog/api/backend-federation.ts',
      ]),
    ].sort((left, right) => left.localeCompare(right));

    assert.equal(fs.existsSync(removedUiMarker), false);
    assert.match(
      fs.readFileSync(path.join(workspaceRoot, shellUiMarker), 'utf8'),
      /ultramodernUiMarker/u,
    );
    assert.match(
      fs.readFileSync(
        path.join(
          workspaceRoot,
          'apps/shell-super-app/shared/ultramodern-build.ts',
        ),
        'utf8',
      ),
      /export const ultramodernUiMarker/u,
    );
    assertGeneratedFilesAreFormatted(workspaceRoot, generatedPaths);
    assert.equal(
      fs.readFileSync(path.join(workspaceRoot, fragmentPath), 'utf-8'),
      fragmentSource,
    );
    assert.deepEqual(fs.readFileSync(consumerConfigPath), consumerConfig);
    assert.deepEqual(
      fs.readFileSync(path.join(workspaceRoot, consumerProbePath)),
      consumerProbe,
    );

    const firstMigration = readFiles(workspaceRoot, generatedPaths);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.deepEqual(readFiles(workspaceRoot, generatedPaths), firstMigration);
    assert.equal(
      fs.readFileSync(path.join(workspaceRoot, fragmentPath), 'utf-8'),
      fragmentSource,
    );
    assert.deepEqual(fs.readFileSync(consumerConfigPath), consumerConfig);
    assert.deepEqual(
      fs.readFileSync(path.join(workspaceRoot, consumerProbePath)),
      consumerProbe,
    );
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test.each([
  { source: 'export const = ;\n', config: undefined },
  {
    source: 'export const changed = true;\n',
    config: 'throw new Error("consumer formatter failed");\n',
  },
])('generated formatting failure rolls back the transaction %j', ({
  source,
  config,
}) => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-format-rollback-'),
  );
  const generatedPath = path.join(workspaceRoot, 'generated.ts');
  const original = Buffer.from('export const original = true;\n');
  try {
    fs.writeFileSync(generatedPath, original);
    if (config)
      fs.writeFileSync(path.join(workspaceRoot, 'oxfmt.config.ts'), config);
    const io = createMigrationIo(workspaceRoot, false);
    assert.throws(
      () =>
        io.transaction(() => {
          io.writeGenerated(generatedPath, source);
        }),
      /Failed to format generated UltraModern workspace output/u,
    );
    assert.deepEqual(fs.readFileSync(generatedPath), original);
    if (config)
      assert.equal(
        fs.readFileSync(path.join(workspaceRoot, 'oxfmt.config.ts'), 'utf8'),
        config,
      );
  } finally {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

test('dry-run reports finalized formatting with native consumer imports and nested settings', async () => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-native-format-preview-'),
  );
  const output = rstest.spyOn(process.stdout, 'write').mockReturnValue(true);
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'native-format-preview',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    const moduleDirectory = path.join(
      workspaceRoot,
      'node_modules/consumer-format-settings',
    );
    fs.mkdirSync(moduleDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(moduleDirectory, 'package.json'),
      JSON.stringify({
        name: 'consumer-format-settings',
        type: 'module',
        exports: './index.js',
      }),
    );
    fs.writeFileSync(
      path.join(moduleDirectory, 'index.js'),
      'export default { printWidth: 80, singleQuote: false, trailingComma: "none" };\n',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'oxfmt.config.ts'),
      'import settings from "consumer-format-settings";\nexport default settings;\n',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'scripts/.oxfmtrc.json'),
      JSON.stringify({
        printWidth: 160,
        singleQuote: true,
        trailingComma: 'none',
      }),
    );
    assertGeneratedFilesAreFormatted(
      workspaceRoot,
      ['apps', 'verticals', 'packages', 'scripts'],
      '--write',
    );
    const relativePath = 'scripts/ultramodern-performance-readiness.config.mjs';
    fs.writeFileSync(
      path.join(workspaceRoot, relativePath),
      readFileTemplate(
        'workspace-scripts/ultramodern-performance-readiness.config.mjs',
      ),
    );
    const authoredPath = 'packages/authored-format.ts';
    fs.writeFileSync(
      path.join(workspaceRoot, authoredPath),
      'export const authored =  { preserve: "spacing" };\n',
    );
    const allFiles = () =>
      readFiles(
        workspaceRoot,
        fs
          .readdirSync(workspaceRoot, { recursive: true })
          .filter(relative =>
            fs.lstatSync(path.join(workspaceRoot, relative)).isFile(),
          )
          .map(relative => relative.split(path.sep).join('/'))
          .sort(),
      );
    const before = allFiles();
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--dry-run'],
        workspaceRoot,
      ),
      0,
    );
    const preview = output.mock.calls.map(([chunk]) => String(chunk)).join('');
    assert.deepEqual(allFiles(), before);
    assert.ok(
      preview.includes(`[dry-run] would write ${relativePath}\n`),
      'Formatting-only writes must be reported after transaction finalization',
    );
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.notDeepEqual(
      fs.readFileSync(path.join(workspaceRoot, relativePath)),
      before.get(relativePath),
    );
    assertGeneratedFilesAreFormatted(workspaceRoot, [
      relativePath,
      'apps/shell-super-app/modern.config.ts',
    ]);
    for (const preserved of [
      'oxfmt.config.ts',
      'scripts/.oxfmtrc.json',
      authoredPath,
      'node_modules/consumer-format-settings/index.js',
    ]) {
      assert.deepEqual(
        fs.readFileSync(path.join(workspaceRoot, preserved)),
        before.get(preserved),
      );
    }
    const after = allFiles();
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      relative =>
        !before.get(relative)?.equals(after.get(relative) ?? Buffer.alloc(0)),
    );
    const planned = new Set(
      preview.split('\n').flatMap(line => {
        const match = /^\[dry-run\] would (?:write|delete) (.+)$/u.exec(line);
        return match ? [match[1]] : [];
      }),
    );
    assert.deepEqual(
      changed.filter(relative => !planned.has(relative)),
      [],
    );
  } finally {
    output.mockRestore();
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  }
});
