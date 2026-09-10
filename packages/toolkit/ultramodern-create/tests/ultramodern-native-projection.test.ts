import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import { buildSync } from 'esbuild';

import { runValidate } from '../src/ultramodern-tooling/commands/validate';
import { normalizeWorkspaceInputs } from '../src/ultramodern-tooling/config';
import {
  addUltramodernShell,
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
import { createAppRuntimeConfig } from '../src/ultramodern-workspace/app-files';
import { createDeliveryUnitRecord } from '../src/ultramodern-workspace/delivery-unit';
import {
  createVerticalDescriptor,
  shellApp,
} from '../src/ultramodern-workspace/descriptors';
import { createAppPublicLocaleMessages } from '../src/ultramodern-workspace/locales';
import {
  createUltramodernBuildArtifactJson,
  createUltramodernBuildModule,
} from '../src/ultramodern-workspace/module-federation/reexport-module';
import {
  createPackagedWorkspaceValidationScript,
  createWorkspaceValidationScript,
} from '../src/ultramodern-workspace/workspace-scripts';

const identity = {
  ...createDeliveryUnitRecord('native-proof', shellApp),
  appId: 'authored-app',
  unitId: 'authored-unit',
  packageName: '@authored/package',
  version: '9.2.7',
  buildMarker: 'authored-build',
  sourceRevision: 'authored-revision',
  deployProfile: 'authored-profile',
  extra: { retained: true },
};

test.each([
  'shell',
  'full-stack',
  'api-only',
  'ui-only',
  'horizontal-remote',
])('%s normalization retains complete identity and raw metadata', shape => {
  const raw = {
    schemaVersion: 1,
    workspace: { packageScope: 'native-proof' },
    features: { tailwind: true },
    extra: { values: ['unchanged'] },
    topology: {
      apps: [
        {
          id: shape === 'shell' ? shellApp.id : 'catalog',
          kind: shape === 'shell' ? 'shell' : 'vertical',
          path: 'custom/nested/app',
          deliveryUnit: identity,
          surfaceProfile: shape === 'horizontal-remote' ? 'ui-only' : shape,
          deliveryUnitKind: shape === 'horizontal-remote' ? shape : undefined,
          moduleFederation: { name: 'authored', verticalRefs: [] },
        },
      ],
    },
  };
  const before = JSON.stringify(raw);
  const normalized = normalizeWorkspaceInputs('/unused', { config: raw });
  expect(normalized.apps[0]?.deliveryUnit).toEqual(identity);
  expect(normalized.apps[0]?.verticalRefs).toEqual([]);
  expect(JSON.stringify(raw)).toBe(before);
  const artifact = JSON.parse(
    createUltramodernBuildArtifactJson('native-proof', normalized.apps[0]!),
  );
  expect(artifact.deliveryUnit).toMatchObject(identity);
  expect(artifact.surfaces.ui).toMatchObject(identity);
  expect(artifact.surfaces.api).toMatchObject(identity);
});

test('native validator wrapper is stable across release and topology data', () => {
  const source = createWorkspaceValidationScript('before', true);
  expect(source).toBe(createWorkspaceValidationScript('after', false, []));
  expect(source).toContain("['ultramodern', 'validate'");
  expect(source).not.toContain('workspaceValidationContract');
  expect(createPackagedWorkspaceValidationScript('before', true)).toContain(
    'const workspaceValidationContract =',
  );
});

test('native JSON identity entry bundles for browser and Node and keeps compiler readers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-identity-'));
  try {
    const app = { ...shellApp, deliveryUnit: identity };
    const source = createUltramodernBuildModule('native-proof', app);
    fs.writeFileSync(
      path.join(root, 'ultramodern-build.json'),
      createUltramodernBuildArtifactJson('native-proof', app),
    );
    fs.writeFileSync(path.join(root, 'ultramodern-build.ts'), source);
    for (const platform of ['browser', 'node'] as const) {
      const output = buildSync({
        entryPoints: [path.join(root, 'ultramodern-build.ts')],
        bundle: true,
        platform,
        format: 'esm',
        write: false,
        external: ['@modern-js/runtime-extensions/build-identity'],
      }).outputFiles[0]!.text;
      expect(output).toContain('authored-build');
      expect(output).toContain('buildMarker: () => ULTRAMODERN_BUILD_MARKER');
    }
    expect(source).toBe(
      createUltramodernBuildModule('other', {
        ...app,
        deliveryUnit: { ...identity, version: '10.0.0' },
      }),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('add-shell preserves authored scripts and config while adding a native shell', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-add-shell-'));
  const workspaceRoot = path.join(root, 'workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'native-proof',
      modernVersion: '3.8.3',
      packageSource: { strategy: 'workspace' },
    });
    const packagePath = path.join(workspaceRoot, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    manifest.scripts['consumer:check'] = 'echo authored';
    manifest.scripts.build = 'echo authored-build';
    manifest.extra = { retained: true };
    fs.writeFileSync(packagePath, JSON.stringify(manifest, null, 2));
    const authored = {
      'tsconfig.json':
        '{"references":[],"compilerOptions":{"strict":true},"extra":"authored"}\n',
      'zerops.yaml': 'authored: deployment\n',
      'apps/shell-super-app/modern.config.ts':
        'export default { authored: true };\n',
    };
    for (const [relative, source] of Object.entries(authored))
      fs.writeFileSync(path.join(workspaceRoot, relative), source);
    addUltramodernShell({
      workspaceRoot,
      name: 'admin',
      modernVersion: '3.8.3',
    });
    const next = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(next.scripts['consumer:check']).toBe('echo authored');
    expect(next.scripts.build).toBe('echo authored-build');
    expect(next.extra).toEqual(manifest.extra);
    for (const [relative, source] of Object.entries(authored))
      expect(fs.readFileSync(path.join(workspaceRoot, relative), 'utf8')).toBe(
        source,
      );
    expect(
      fs.readFileSync(
        path.join(workspaceRoot, 'scripts/validate-ultramodern-workspace.mts'),
        'utf8',
      ),
    ).not.toContain('const workspaceValidationContract');
    expect(
      fs.existsSync(
        path.join(
          workspaceRoot,
          'apps/shell-admin/shared/ultramodern-build.json',
        ),
      ),
    ).toBe(true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packaged validator validates a fresh native workspace without invoking its wrapper', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-validator-'));
  const workspaceRoot = path.join(root, 'workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'native-proof',
      modernVersion: '3.8.3',
      packageSource: { strategy: 'workspace' },
    });
    const shellPackage = JSON.parse(
      fs.readFileSync(
        path.join(workspaceRoot, shellApp.directory, 'package.json'),
        'utf8',
      ),
    );
    expect(shellPackage.dependencies['@modern-js/boundary-debugger']).toBe(
      'workspace:*',
    );
    const shellRuntime = fs.readFileSync(
      path.join(workspaceRoot, shellApp.directory, 'src/modern.runtime.ts'),
      'utf8',
    );
    expect(shellPackage.dependencies['@modern-js/federation-runtime']).toBe(
      'workspace:*',
    );
    expect(
      shellPackage.devDependencies['@modern-js/ultramodern-app-tools'],
    ).toBe('workspace:*');
    expect(
      shellPackage.devDependencies['@modern-js/app-tools-extensions'],
    ).toBe('workspace:*');
    const modernConfig = fs.readFileSync(
      path.join(workspaceRoot, shellApp.directory, 'modern.config.ts'),
      'utf8',
    );
    expect(modernConfig).toContain("from '@modern-js/ultramodern-app-tools'");
    expect(modernConfig).toContain('ultramodernAppTools()');
    expect(modernConfig).not.toContain('ultramodernReleaseEnvelopePlugin()');
    expect(modernConfig).toContain(
      "from '@modern-js/app-tools-extensions/config'",
    );
    expect(shellRuntime).toContain("from '@modern-js/boundary-debugger'");
    expect(shellRuntime).not.toContain(
      '@modern-js/runtime-extensions/boundary-debugger',
    );
    expect(runValidate({ workspaceRoot, invocationCwd: workspaceRoot })).toBe(
      0,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('native i18next nested resources resolve every generated locale key', async () => {
  const requireI18n = createRequire(
    path.resolve(__dirname, '../../../runtime/plugin-i18n/package.json'),
  );
  const { createInstance } = requireI18n('i18next');
  const collectMessages = (
    value: unknown,
    prefix = '',
  ): Array<[string, string]> =>
    typeof value === 'string'
      ? [[prefix, value]]
      : Object.entries(value as Record<string, unknown>).flatMap(
          ([key, child]) =>
            collectMessages(child, prefix ? `${prefix}.${key}` : key),
        );
  for (const app of [shellApp, createVerticalDescriptor('catalog', 3021)]) {
    const resources = Object.fromEntries(
      ['en', 'cs'].map(language => [
        language,
        { app: createAppPublicLocaleMessages(app, language as 'en' | 'cs') },
      ]),
    );
    const i18n = createInstance();
    await i18n.init({
      resources,
      defaultNS: 'app',
      lng: 'en',
      interpolation: { escapeValue: false },
    });
    for (const language of ['en', 'cs']) {
      for (const [key, expected] of collectMessages(resources[language].app)) {
        expect(i18n.t(key, { lng: language })).toBe(expected);
      }
    }
    const source = createAppRuntimeConfig(app, 'native-proof');
    expect(source).not.toContain('flattenLocaleResource');
    expect(source).toContain(']: csResource');
  }
});

test.each([
  'full-stack',
  'api-only',
  'ui-only',
  'horizontal-remote',
] as const)('%s generated workspace validates with packaged tools and declares native providers', shape => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-shape-'));
  const workspaceRoot = path.join(root, 'workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'native-proof',
      modernVersion: '3.8.3',
      packageSource: { strategy: 'workspace' },
    });
    addUltramodernVertical({
      workspaceRoot,
      name: 'catalog',
      modernVersion: '3.8.3',
      ...(shape === 'horizontal-remote'
        ? { horizontalRemote: true }
        : { preset: shape }),
    });
    expect(runValidate({ workspaceRoot, invocationCwd: workspaceRoot })).toBe(
      0,
    );
    const sharedManifest = JSON.parse(
      fs.readFileSync(
        path.join(workspaceRoot, 'packages/shared-contracts/package.json'),
        'utf8',
      ),
    );
    expect(sharedManifest.dependencies['@modern-js/runtime-extensions']).toBe(
      'workspace:*',
    );
    expect(sharedManifest.dependencies['@modern-js/bff-effect']).toBe(
      'workspace:*',
    );
    expect(
      fs.readFileSync(
        path.join(workspaceRoot, 'packages/shared-contracts/src/index.ts'),
        'utf8',
      ),
    ).not.toContain('new CustomEvent');
    expect(
      fs.readFileSync(
        path.join(
          workspaceRoot,
          'packages/shared-contracts/src/effect-bff-runtime.ts',
        ),
        'utf8',
      ),
    ).not.toContain('HttpApiBuilder.layer');
    expect(
      fs.readFileSync(
        path.join(workspaceRoot, 'scripts/materialize-zerops-runtime.mjs'),
        'utf8',
      ),
    ).toContain('zerops-materialize');
    expect(
      fs.readFileSync(
        path.join(workspaceRoot, 'scripts/proof-workerd-ssr.mts'),
        'utf8',
      ),
    ).not.toContain('Miniflare');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
