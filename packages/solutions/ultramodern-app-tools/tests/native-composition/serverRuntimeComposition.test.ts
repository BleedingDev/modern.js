import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCloudflarePreset } from '@modern-js/app-tools-extensions/cloudflare';
import { createPluginManager } from '@modern-js/plugin';
import {
  createContext,
  initAppContext,
  initPluginAPI,
} from '@modern-js/plugin/cli';
import { applyPlugins, type ProdServerOptions } from '@modern-js/prod-server';
import { createServerBase } from '@modern-js/server-core';
import { loadServerPlugins } from '@modern-js/server-core/node';
import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';
import { generateHandler } from '../../../app-tools/src/plugins/deploy/utils/generator';

const descriptorName = '@modern-js/ultramodern-app-tools/server-plugin';
const packageDirectory = path.resolve(__dirname, '../..');

async function createCliApi(appDirectory: string) {
  const pluginManager = createPluginManager();
  pluginManager.addPlugins([ultramodernAppTools()]);
  const plugins = pluginManager.getPlugins();
  const config = { output: {}, server: {} };
  const context = await createContext({
    appContext: initAppContext({
      packageName: 'server-composition-consumer',
      configFile: false,
      command: 'build',
      appDirectory,
      metaName: 'modern-js',
      plugins,
    }),
    config,
    normalizedConfig: config,
  });
  const api = initPluginAPI({ context, pluginManager });
  context.pluginAPI = api;
  for (const plugin of plugins) await plugin.setup?.(api);
  return api;
}

const linkComposer = (appDirectory: string) => {
  const scope = path.join(appDirectory, 'node_modules/@modern-js');
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(
    packageDirectory,
    path.join(scope, 'ultramodern-app-tools'),
    'dir',
  );
  fs.writeFileSync(
    path.join(appDirectory, 'package.json'),
    JSON.stringify({
      name: 'isolated-server-consumer',
      private: true,
      dependencies: { '@modern-js/ultramodern-app-tools': 'workspace:*' },
    }),
  );
};

describe('server runtime composition', () => {
  test('loads the public server subpath from an isolated and relocated consumer', async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'um-server-composition-'),
    );
    const originalDirectory = path.join(root, 'original');
    const appDirectory = path.join(root, 'relocated');
    let server: ReturnType<typeof createServerBase> | undefined;
    try {
      linkComposer(originalDirectory);
      const api = await createCliApi(originalDirectory);
      const result = await api
        .getHooks()
        ._internalServerPlugins.call({ plugins: [] });
      const descriptor = result.plugins.find(
        plugin => plugin.name === descriptorName,
      )!;
      expect(descriptor).toEqual({ name: descriptorName });
      const code = await generateHandler({
        template: 'p_genPluginImportsCode; module.exports = p_plugins;',
        appContext: {
          ...api.getAppContext(),
          appDirectory: originalDirectory,
          sharedDirectory: path.join(originalDirectory, 'shared'),
          apiDirectory: path.join(originalDirectory, 'api'),
          lambdaDirectory: path.join(originalDirectory, 'lambda'),
          serverPlugins: [descriptor],
        },
        config: { bff: {} } as Parameters<typeof generateHandler>[0]['config'],
      });
      fs.writeFileSync(
        path.join(originalDirectory, 'generated-server.cjs'),
        code,
      );
      fs.renameSync(originalDirectory, appDirectory);
      const require = createRequire(path.join(appDirectory, 'package.json'));
      // The test runner intercepts in-process resolution; use Node itself to
      // prove that the relocated consumer cannot import a transitive package.
      const isolatedResolution = execFileSync(
        process.execPath,
        [
          '-e',
          `const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const requireFromApp = createRequire(path.join(process.cwd(), 'package.json'));
assert.throws(
  () => requireFromApp.resolve('@modern-js/server-runtime-extensions/server-plugin'),
  { code: 'MODULE_NOT_FOUND' },
);`,
        ],
        {
          cwd: appDirectory,
          encoding: 'utf8',
          // Rstest adds its workspace to NODE_PATH; an isolated consumer has
          // only its declared dependency tree.
          env: { ...process.env, NODE_PATH: '' },
        },
      );
      expect(isolatedResolution).toBe('');
      const instances = await loadServerPlugins([descriptor], appDirectory);
      const generatedInstances = require('./generated-server.cjs');
      expect(
        generatedInstances.map((plugin: { name: string }) => plugin.name),
      ).toEqual(instances.map(plugin => plugin.name));
      expect(instances[0]!.name).toBe('@modern-js/ultramodern-server');

      const options = {
        pwd: appDirectory,
        appContext: { appDirectory, apiDirectory: '', lambdaDirectory: '' },
        config: {
          html: {},
          output: {},
          source: {},
          tools: {},
          server: { logger: false },
          bff: {},
          dev: {},
          security: {},
        },
        plugins: instances,
      } as ProdServerOptions;
      server = createServerBase(options);
      await applyPlugins(server, options);
      await server.init();
      const response = await server.request('/_modern/runtime/status', {}, {});
      expect(response.status).toBe(404);
    } finally {
      await server?.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('emits a working Cloudflare worker without importing Node server policies', async () => {
    const appDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'um-server-worker-'),
    );
    try {
      const distDirectory = path.join(appDirectory, 'dist');
      fs.mkdirSync(path.join(distDirectory, 'html/main'), { recursive: true });
      fs.writeFileSync(
        path.join(distDirectory, 'html/main/index.html'),
        '<main>worker response</main>',
      );
      fs.writeFileSync(
        path.join(distDirectory, 'route.json'),
        JSON.stringify({
          routes: [
            {
              entryName: 'main',
              entryPath: 'html/main/index.html',
              urlPath: '/',
              isSSR: false,
            },
          ],
        }),
      );
      const api = await createCliApi(appDirectory);
      const { plugins } = await api
        .getHooks()
        ._internalServerPlugins.call({ plugins: [] });
      expect(plugins.some(plugin => plugin.name === descriptorName)).toBe(true);
      const preset = createCloudflarePreset({
        appContext: {
          apiOnly: false,
          appDirectory,
          distDirectory,
          serverPlugins: plugins,
        },
        modernConfig: {},
        api: { isPluginExists: () => false },
      });
      await preset.prepare?.();
      await preset.writeOutput?.();
      await preset.genEntry?.();
      const entryPath = path.join(appDirectory, '.output/server/index.mjs');
      const worker = (await import(pathToFileURL(entryPath).href)).default;
      const response = await worker.fetch(
        new Request('https://worker.example/'),
        {
          ASSETS: {
            fetch: async () => new Response('<main>worker response</main>'),
          },
        },
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('worker response');
    } finally {
      fs.rmSync(appDirectory, { recursive: true, force: true });
    }
  });
});
