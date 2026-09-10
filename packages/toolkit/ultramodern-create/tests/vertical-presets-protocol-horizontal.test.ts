import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  AddUltramodernVerticalOptions,
  UltramodernGenerationResult,
} from '../src/ultramodern-workspace';
import { addUltramodernVertical } from '../src/ultramodern-workspace';
import { createWorkspace } from './helpers/workspace-kit';

const MODERN_VERSION = '3.2.1';

function withWorkspace(
  fn: (workspaceDir: string) => void,
  prefix = 'um-preset-',
) {
  const { tempRoot, workspaceDir } = createWorkspace('preset-workspace', {
    tempPrefix: prefix,
  });
  try {
    fn(workspaceDir);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function add(
  workspaceDir: string,
  name: string,
  extra: Partial<AddUltramodernVerticalOptions> = {},
): UltramodernGenerationResult {
  return addUltramodernVertical({
    workspaceRoot: workspaceDir,
    name,
    modernVersion: MODERN_VERSION,
    ...extra,
  });
}

function verticalPaths(result: UltramodernGenerationResult, name: string) {
  const prefix = `verticals/${name}/`;
  return new Set(
    result.createdPaths
      .filter(relativePath => relativePath.startsWith(prefix))
      .map(relativePath => relativePath.slice(prefix.length)),
  );
}

function assertWorkspaceValid(workspaceDir: string) {
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-ultramodern-workspace.mts'],
    { cwd: workspaceDir, encoding: 'utf-8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test('api-only and ui-only presets keep their distinct generated surfaces', () => {
  withWorkspace(dir => {
    const apiResult = add(dir, 'headless', { preset: 'api-only' });
    const apiFiles = verticalPaths(apiResult, 'headless');
    assert.ok(apiFiles.has('api/index.ts'));
    assert.ok(apiFiles.has('shared/api.ts'));
    assert.ok(!apiFiles.has('src/routes/layout.tsx'));
    assert.ok(!apiFiles.has('module-federation.config.ts'));
    assert.deepEqual(
      apiResult.deliveryUnits
        ?.find(unit => unit.unitId.endsWith('/headless'))
        ?.surfaces.map(surface => surface.kind),
      ['api'],
    );

    const uiResult = add(dir, 'presentational', { preset: 'ui-only' });
    const uiFiles = verticalPaths(uiResult, 'presentational');
    assert.ok(uiFiles.has('src/routes/layout.tsx'));
    assert.ok(uiFiles.has('src/federation-entry.tsx'));
    assert.ok(!uiFiles.has('shared/api.ts'));
    assert.ok(!uiFiles.has('api/index.ts'));
    assert.ok(
      uiResult.deliveryUnits
        ?.find(unit => unit.unitId.endsWith('/presentational'))
        ?.surfaces.every(surface => surface.kind !== 'api'),
    );
  });
});

test('topology rehydration preserves protocol, profile and delivery-unit identity', () => {
  withWorkspace(dir => {
    add(dir, 'catalog', { apiProtocol: 'rpc' });
    add(dir, 'design-system', { horizontalRemote: true });

    const topologyPath = path.join(dir, 'topology/reference-topology.json');
    const compactPath = path.join(dir, '.modernjs/ultramodern.json');
    const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf-8'));
    const compact = JSON.parse(fs.readFileSync(compactPath, 'utf-8'));
    const topologyEntry = (id: string) =>
      topology.verticals.find((entry: any) => entry.id === id);
    const compactEntry = (id: string) =>
      compact.topology.apps.find((entry: any) => entry.id === id);

    assert.equal(topologyEntry('catalog').api.protocol, 'rpc');
    assert.equal(
      topologyEntry('design-system').deliveryUnitKind,
      'horizontal-remote',
    );
    assert.equal(compactEntry('catalog').api.protocol, 'rpc');
    assert.ok(topologyEntry('catalog').deliveryUnit);
    assert.ok(compactEntry('catalog').deliveryUnit);

    topologyEntry('catalog').api.protocol = 'rest';
    compactEntry('catalog').api.protocol = 'rest';
    fs.writeFileSync(topologyPath, `${JSON.stringify(topology, null, 2)}\n`);
    fs.writeFileSync(compactPath, `${JSON.stringify(compact, null, 2)}\n`);
    add(dir, 'rest-preserved');

    const rehydratedTopology = JSON.parse(
      fs.readFileSync(topologyPath, 'utf-8'),
    );
    const rehydratedCompact = JSON.parse(fs.readFileSync(compactPath, 'utf-8'));
    assert.equal(
      rehydratedTopology.verticals.find((entry: any) => entry.id === 'catalog')
        .api.protocol,
      'rest',
    );
    assert.equal(
      rehydratedCompact.topology.apps.find(
        (entry: any) => entry.id === 'catalog',
      ).api.protocol,
      'rest',
    );
  });
});

test('rpc protocol emits its contract and routes metadata without a REST surface', () => {
  withWorkspace(dir => {
    const result = add(dir, 'catalog', { apiProtocol: 'rpc' });
    const files = verticalPaths(result, 'catalog');
    assert.ok(files.has('shared/rpc.ts'));
    assert.ok(files.has('src/api/catalog-rpc-client.ts'));
    assert.ok(!files.has('shared/api.ts'));
    assert.ok(!files.has('src/api/catalog-client.ts'));

    const overlay = JSON.parse(
      fs.readFileSync(
        path.join(dir, 'topology/local-overlays/development.json'),
        'utf-8',
      ),
    );
    const rpcUrl = `http://localhost:${result.assignedPorts.catalog}/catalog-api/rpc`;
    assert.equal(overlay.apis.catalog, rpcUrl);
    const topology = JSON.parse(
      fs.readFileSync(
        path.join(dir, 'topology/reference-topology.json'),
        'utf-8',
      ),
    );
    assert.equal(
      topology.verticals.find((entry: any) => entry.id === 'catalog').api
        .protocol,
      'rpc',
    );
    assertWorkspaceValid(dir);
  });
});

test('public Cloudflare proof sends the declared RPC request and reports evidence', async () => {
  const proofModule = await import(
    pathToFileURL(
      path.resolve(
        __dirname,
        '../templates/workspace-scripts/ultramodern-cloudflare-proof.mjs',
      ),
    ).href
  );
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'catalog-cloudflare-proof',
        result: { items: [{ id: 'starter-catalog' }] },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    const evidence = await proofModule.validateApp(
      {
        id: 'catalog',
        deploy: {
          cloudflare: {
            routes: { rpc: '/catalog-api/rpc' },
            jsonSmokeChecks: [
              {
                id: 'catalog-rpc-smoke',
                method: 'POST',
                route: '/catalog-api/rpc',
                body: {
                  jsonrpc: '2.0',
                  id: 'catalog-cloudflare-proof',
                  method: 'list',
                  params: { limit: 1 },
                },
                expect: {
                  id: 'catalog-cloudflare-proof',
                  'result.items.0.id': 'starter-catalog',
                },
              },
            ],
          },
        },
      },
      'https://catalog.example',
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://catalog.example/catalog-api/rpc');
    assert.equal(requests[0].init?.method, 'POST');
    assert.match(String(requests[0].init?.body), /catalog-cloudflare-proof/u);
    assert.ok(evidence.assertions.length > 0);
    assert.ok(
      evidence.assertions.every(({ status }: any) => status === 'pass'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated api-only RPC entry serves the JSON-RPC probe', () => {
  withWorkspace(dir => {
    add(dir, 'catalog', { preset: 'api-only', apiProtocol: 'rpc' });
    fs.symlinkSync(
      path.resolve(__dirname, '../../../../node_modules/.pnpm/node_modules'),
      path.join(dir, 'node_modules'),
      'dir',
    );
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(
          path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
        ).href,
        '--input-type=module',
        '--eval',
        `const loaded = await import('./api/index.ts');
const runtime = loaded.default?.default ?? loaded.default;
const webHandler = runtime.createHandler();
try {
  const response = await webHandler.handler(new Request('https://catalog.example/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'catalog-cloudflare-proof', method: 'list', params: { limit: 1 } }),
  }));
  process.stdout.write('\\n__RESULT__' + JSON.stringify({ status: response.status, body: await response.json() }));
} finally {
  await webHandler.dispose();
}`,
      ],
      { cwd: path.join(dir, 'verticals/catalog'), encoding: 'utf-8' },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(
      JSON.parse(result.stdout.split('__RESULT__').at(-1) ?? ''),
      {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: 'catalog-cloudflare-proof',
          result: {
            items: [
              {
                id: 'starter-catalog',
                title: 'Wire a real catalog source here',
              },
            ],
          },
        },
      },
    );
  });
});

test('horizontal remote is components-only and retains delivery-unit identity', () => {
  withWorkspace(dir => {
    const result = add(dir, 'design-system', { horizontalRemote: true });
    const files = verticalPaths(result, 'design-system');
    assert.ok(files.has('src/federation-entry.tsx'));
    assert.ok(files.has('module-federation.config.ts'));
    assert.ok(!files.has('shared/api.ts'));
    assert.ok(!files.has('api/index.ts'));

    const topology = JSON.parse(
      fs.readFileSync(
        path.join(dir, 'topology/reference-topology.json'),
        'utf-8',
      ),
    );
    const entry = topology.verticals.find(
      (item: any) => item.id === 'design-system',
    );
    assert.equal(entry.kind, 'vertical');
    assert.equal(entry.deliveryUnitKind, 'horizontal-remote');
    const unit = result.deliveryUnits?.find(item =>
      item.unitId.endsWith('/design-system'),
    );
    assert.equal(unit?.kind, 'horizontal-remote');
    assert.ok(unit && unit.surfaces.every(surface => surface.kind !== 'api'));
  });
});
