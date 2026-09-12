import { defineConfig } from '@modern-js/app-tools';
import { bffPlugin } from '@modern-js/plugin-bff-build-extensions';
import { tanstackRouterPlugin } from '@modern-js/plugin-tanstack';
import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';
import { moduleFederationPlugin } from '@module-federation/modern-js-v3';

const hostPort = Number(process.env.MF_HOST_PORT ?? 3011);
const hostOrigin = process.env.MF_HOST_ORIGIN ?? `http://localhost:${hostPort}`;

export default defineConfig({
  tools: {
    // TEMPORARY CI DIAGNOSTIC - remove before merge: name the files that
    // trigger every rebuild, so the CI run says what keeps this app compiling.
    rspack: (_config, { appendPlugins }) => {
      appendPlugins({
        apply(compiler: any) {
          compiler.hooks.watchRun.tap('mf-diagnostic', (c: any) => {
            const modified = [...(c.modifiedFiles ?? [])].slice(0, 12);
            const removed = [...(c.removedFiles ?? [])].slice(0, 12);
            console.log(
              `[mf-diagnostic watchRun host ${new Date().toISOString()}] modified=${JSON.stringify(modified)} removed=${JSON.stringify(removed)}`,
            );
          });
        },
      });
    },
    devServer: {
      headers: {
        'Access-Control-Allow-Headers':
          'Accept, Authorization, Content-Type, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Origin': hostOrigin,
      },
    },
  },
  server: {
    port: hostPort,
    ssr: {
      mode: 'stream',
      moduleFederationAppSSR: true,
    },
  },
  output: {
    polyfill: 'off',
    disableTsChecker: true,
    minify: false,
  },
  performance: {
    buildCache: false,
  },
  bff: {
    prefix: '/host-api',
    runtimeFramework: 'effect',
    effect: {
      entry: './api/effect/index',
      openapi: {
        path: '/openapi.json',
      },
    },
  },
  plugins: [
    ultramodernAppTools(),
    tanstackRouterPlugin(),
    bffPlugin(),
    moduleFederationPlugin(),
  ],
});
