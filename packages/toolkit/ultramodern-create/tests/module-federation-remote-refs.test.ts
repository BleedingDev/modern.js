import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
import {
  createVerticalDescriptor,
  shellApp,
} from '../src/ultramodern-workspace/descriptors';
import {
  createModuleFederationRemotesConfig,
  createModuleFederationRemoteUrlHelpers,
} from '../src/ultramodern-workspace/module-federation';

function evaluateGeneratedRemoteManifestUrl(
  helpers: string,
  env: Record<string, string | undefined>,
) {
  const executableHelpers = transformSync(
    `${helpers}
module.exports = createRemoteManifestUrl({
  manifestEnv: 'VERTICAL_CATALOG_MF_MANIFEST',
  mfName: 'verticalCatalog',
  port: 4101,
  publicUrlEnv: 'VERTICAL_CATALOG_PUBLIC_URL',
  workerName: 'tractor-store-catalog',
});`,
    { format: 'cjs', loader: 'ts', target: 'node20' },
  ).code;
  const module = { exports: undefined as unknown };
  vm.runInNewContext(executableHelpers, {
    module,
    exports: module.exports,
    require(specifier: string) {
      assert.equal(specifier, '@modern-js/app-tools-extensions/config');
      return {
        getBuildConfigEnvironment: (name: string) => env[name],
      };
    },
  });

  return module.exports;
}

test('module federation remote refs fail closed when a configured vertical is missing', () => {
  const shellHost = {
    ...shellApp,
    verticalRefs: ['catalog'],
  };

  assert.throws(
    () => createModuleFederationRemotesConfig('tractor-store', shellHost, []),
    /Unknown remote vertical reference catalog for shell-super-app/,
  );
});

test('module federation remote refs treat blank Cloudflare workers subdomain as missing', () => {
  const catalog = createVerticalDescriptor('catalog', { port: 4101 });
  const shellHost = {
    ...shellApp,
    verticalRefs: [catalog.id],
  };
  const helpers = createModuleFederationRemoteUrlHelpers(shellHost, [catalog]);

  assert.throws(
    () =>
      evaluateGeneratedRemoteManifestUrl(helpers, {
        MODERNJS_DEPLOY: 'cloudflare',
        ULTRAMODERN_CLOUDFLARE_REQUIRE_PUBLIC_URLS: 'true',
        ULTRAMODERN_CLOUDFLARE_WORKERS_DEV_SUBDOMAIN: '   ',
      }),
    /Cloudflare deploy needs VERTICAL_CATALOG_PUBLIC_URL, VERTICAL_CATALOG_MF_MANIFEST, or ULTRAMODERN_CLOUDFLARE_WORKERS_DEV_SUBDOMAIN for remote verticalCatalog/u,
  );
});

test('generated federation modules import i18n specifiers that really resolve', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-mf-i18n-'));
  const workspaceDir = path.join(tempRoot, 'workspace');
  // Resolve through plugin-i18n itself so its package export map decides,
  // exactly as a consumer bundler would.
  const resolveAsConsumer = createRequire(
    path.resolve(__dirname, '../../../runtime/plugin-i18n/consumer-probe.cjs'),
  );
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceDir,
      packageName: 'mf-i18n-resolve-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });
    const specifiers = new Set<string>();
    for (const relativePath of [
      'src/federation-entry.tsx',
      'src/components/catalog-widget.tsx',
    ]) {
      const source = fs.readFileSync(
        path.join(workspaceDir, 'verticals/catalog', relativePath),
        'utf-8',
      );
      for (const match of source.matchAll(
        /from '(@modern-js\/plugin-i18n[^']*)'/gu,
      )) {
        specifiers.add(match[1]);
      }
    }
    assert.ok(specifiers.size > 0, 'exposed modules must consume plugin-i18n');
    for (const specifier of specifiers) {
      assert.doesNotThrow(
        () => resolveAsConsumer.resolve(specifier),
        `${specifier} must resolve from the plugin-i18n export map`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
