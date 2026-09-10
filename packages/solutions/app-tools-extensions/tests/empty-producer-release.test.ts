import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createUltramodernBuildArtifact,
  DELIVERY_UNIT_DEPLOY_PROFILE,
  DELIVERY_UNIT_KIND,
  DELIVERY_UNIT_SCHEMA_VERSION,
} from '@modern-js/backend-federation-contracts';
import * as sourceFramework from '../src/release-envelope/framework-output';

const roots: string[] = [];
const client = 'static/js/index.js';
const ssr = 'bundles/main.js';
const api = 'api/index.js';
const publicPath = 'https://assets.example.test/app/';
const deliveryUnit = {
  appId: 'catalog',
  buildMarker: '0123456789abcdef',
  deployProfile: DELIVERY_UNIT_DEPLOY_PROFILE,
  kind: DELIVERY_UNIT_KIND,
  packageName: '@test/catalog',
  schemaVersion: DELIVERY_UNIT_SCHEMA_VERSION,
  sourceRevision: 'a'.repeat(40),
  unitId: 'test/catalog',
  version: '1.0.0',
};

async function fixture(framework: typeof sourceFramework) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-mf-release-'));
  roots.push(root);
  const put = async (name: string, contents: string) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), contents);
  };
  const json = (name: string, value: unknown) =>
    put(name, JSON.stringify(value));
  const manifest = {
    exposes: [],
    remotes: [],
    metaData: {
      publicPath,
      remoteEntry: { name: '', path: '', type: 'global' },
    },
  };
  await json(
    'ultramodern-build.json',
    createUltramodernBuildArtifact(deliveryUnit),
  );
  await json('backend-mf-manifest.json', {
    backendFederation: { deliveryUnit, versionBoundary: { deliveryUnit } },
  });
  await json('mf-manifest.json', manifest);
  const routes = (assets: unknown[]) =>
    json('routes-manifest.json', {
      routeAssets: { index: { assets } },
    });
  await routes([`${publicPath}${client}`]);
  await json('route.json', { routes: [{ bundle: ssr }] });
  await json('package.json', { type: 'module' });
  for (const name of [client, ssr, api, 'index.js', 'backendRemoteEntry.cjs']) {
    await put(name, 'console.log("compiled fixture");');
  }
  const emit = () =>
    framework.emitFrameworkMicroVerticalReleaseEnvelope({
      apiOnly: false,
      distDirectory: root,
      target: 'node',
    });
  return { root, put, json, manifest, routes, emit };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(root => fs.rm(root, { force: true, recursive: true })),
  );
});

describe('empty MF producer', () => {
  const framework = sourceFramework;

  test('retains complete build and Node staged release evidence', async () => {
    const f = await fixture(framework);
    const envelope = await f.emit();
    expect(envelope?.surfaces.uiClient).toContain(client);
    expect(envelope?.surfaces.ssr).toEqual([ssr]);
    expect(envelope?.surfaces.apiBackend).toEqual([api]);
    await framework.verifyBuildOutputReleaseEnvelope(f.root, 'node');
    const staged = await framework.emitNodeStagedReleaseEnvelope({
      distDirectory: f.root,
      outputDirectory: f.root,
    });
    expect(staged?.surfaces.uiClient).toContain(client);
    await framework.verifyNodeReleaseEnvelopeStaging({
      outputDirectory: f.root,
    });
    await f.put(client, 'console.log("tampered");');
    await expect(
      framework.verifyBuildOutputReleaseEnvelope(f.root, 'node'),
    ).rejects.toThrow(/digest|hash|size/iu);
  });

  test('binds route assets under the final Cloudflare public directory', async () => {
    const f = await fixture(framework);
    await f.put('worker/main.js', 'export const render = () => "catalog";');
    await f.put(
      'worker/__modern_bff_effect.js',
      'export const handler = () => "api";',
    );
    await f.json('route.json', { routes: [{ worker: 'worker/main.js' }] });
    await framework.emitFrameworkMicroVerticalReleaseEnvelope({
      apiOnly: false,
      distDirectory: f.root,
      target: 'cloudflare',
    });
    const outputDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'empty-mf-cloudflare-'),
    );
    roots.push(outputDirectory);
    for (const [from, to] of [
      ['static', 'public/static'],
      ['mf-manifest.json', 'public/mf-manifest.json'],
      ['routes-manifest.json', 'public/routes-manifest.json'],
      ['backend-mf-manifest.json', 'public/backend-mf-manifest.json'],
      ['backendRemoteEntry.cjs', 'public/backendRemoteEntry.cjs'],
      ['worker', 'worker'],
      ['route.json', 'server/route.json'],
    ]) {
      await fs.mkdir(path.dirname(path.join(outputDirectory, to)), {
        recursive: true,
      });
      await fs.cp(path.join(f.root, from), path.join(outputDirectory, to), {
        recursive: true,
      });
    }
    for (const name of [
      'server/modern-worker-manifest.json',
      'wrangler.json',
      'package.json',
      'worker/package.json',
    ]) {
      await fs.writeFile(path.join(outputDirectory, name), '{}');
    }
    await fs.writeFile(
      path.join(outputDirectory, 'server/index.mjs'),
      'export default {};',
    );
    const envelope = await framework.emitCloudflareStagedReleaseEnvelope({
      distDirectory: f.root,
      outputDirectory,
    });
    expect(envelope?.surfaces.uiClient).toContain(`public/${client}`);
    await framework.verifyCloudflareReleaseEnvelopeStaging(outputDirectory);
    await fs.writeFile(
      path.join(outputDirectory, 'public', client),
      'tampered',
    );
    await expect(
      framework.verifyCloudflareReleaseEnvelopeStaging(outputDirectory),
    ).rejects.toThrow(/digest|hash|size/iu);
  });

  test('binds auto and root-relative publicPath route assets', async () => {
    for (const [base, reference] of [
      ['auto', `/${client}`],
      ['/app/', `/app/${client}`],
      ['/', client],
    ]) {
      const f = await fixture(framework);
      f.manifest.metaData.publicPath = base;
      await f.json('mf-manifest.json', f.manifest);
      await f.routes([reference]);
      expect((await f.emit())?.surfaces.uiClient).toContain(client);
    }
  });

  test('rejects undeclared, foreign, traversing, missing, and nonbrowser assets', async () => {
    for (const reference of [
      `https://foreign.example.test/app/${client}`,
      `${publicPath}../app/${client}`,
      `${publicPath}%2e%2e/app/${client}`,
      `${publicPath}static\\js/index.js`,
      `${publicPath}static%5cjs/index.js`,
      `${publicPath}static/js/missing.js`,
      `${publicPath}${api}`,
      `${publicPath}${ssr}`,
      `${publicPath}${client}?forged=true`,
      `${publicPath}${client}#forged`,
      `//assets.example.test/app/${client}`,
    ]) {
      const f = await fixture(framework);
      await f.routes([reference]);
      await expect(f.emit()).rejects.toThrow(
        /UI\/client manifest references no compiled execution module/u,
      );
      // One legitimate asset must not hide another invalid declaration.
      await f.routes([`${publicPath}${client}`, reference]);
      await expect(f.emit()).rejects.toThrow(
        /UI\/client manifest references no compiled execution module/u,
      );
    }
    const f = await fixture(framework);
    await f.routes([]);
    await expect(f.emit()).rejects.toThrow(/no compiled execution module/u);
    await fs.rm(path.join(f.root, 'routes-manifest.json'));
    await expect(f.emit()).rejects.toThrow(/ENOENT/u);
  });

  test('rejects browser-named symlinks to server bytes', async () => {
    const f = await fixture(framework);
    await fs.rm(path.join(f.root, client));
    await fs.symlink(path.join(f.root, api), path.join(f.root, client));
    await expect(f.emit()).rejects.toThrow(/no compiled execution module/u);
  });

  test('requires proven empty exposes, remotes, and a native empty remote entry', async () => {
    const f = await fixture(framework);
    for (const manifest of [
      { ...f.manifest, exposes: [{ name: './Page' }] },
      { ...f.manifest, remotes: [{ name: 'shell' }] },
      { metaData: f.manifest.metaData, remotes: [] },
      { metaData: f.manifest.metaData, exposes: [] },
      {
        ...f.manifest,
        metaData: {
          ...f.manifest.metaData,
          remoteEntry: { name: '', path: '' },
        },
      },
    ]) {
      await f.json('mf-manifest.json', manifest);
      await expect(f.emit()).rejects.toThrow(
        /UI\/client manifest references no compiled execution module/u,
      );
    }
  });

  test('rejects a mixed delivery-unit identity in empty producer output', async () => {
    const f = await fixture(framework);
    await f.json('backend-mf-manifest.json', {
      backendFederation: {
        deliveryUnit: { ...deliveryUnit, sourceRevision: 'b'.repeat(40) },
      },
    });
    await expect(f.emit()).rejects.toThrow(/must match/u);
  });
});
