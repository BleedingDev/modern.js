import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { generateEffectClient } from '@modern-js/plugin-bff-extensions/client-generator';
import { createOperationContractHash } from '@modern-js/server-runtime-extensions/bff-policy/node';

const execFileAsync = promisify(execFile);

const createFixtureApp = async () => {
  const appDir = await fs.promises.mkdtemp(
    path.join(__dirname, '.tmp-effect-client-'),
  );
  const fixtureScope = path.join(appDir, 'node_modules', '@modern-js');
  await fs.promises.mkdir(fixtureScope, { recursive: true });
  await fs.promises.symlink(
    path.resolve(__dirname, '../../../server/bff-effect'),
    path.join(fixtureScope, 'bff-effect'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const apiDir = path.join(appDir, 'api');
  const effectDir = path.join(apiDir, 'effect');
  await fs.promises.mkdir(effectDir, { recursive: true });

  await fs.promises.writeFile(
    path.join(appDir, 'package.json'),
    JSON.stringify({ name: 'test-effect-app', version: '2.1.0' }, null, 2),
  );

  const resourcePath = path.join(effectDir, 'index.js');
  await fs.promises.writeFile(
    resourcePath,
    `const {
      HttpApi,
      HttpApiEndpoint,
      HttpApiGroup,
      Layer,
      Schema,
    } = require('@modern-js/bff-effect/effect-client');

const api = HttpApi.make('CodegenTestApi').add(
  HttpApiGroup.make('greetings').add(
    HttpApiEndpoint.get('ping', '/ping', {
      success: Schema.Struct({
        ok: Schema.Boolean,
      }),
    }),
  ),
);

    module.exports = { api, layer: Layer.empty };
    `,
  );

  return { appDir, apiDir, resourcePath };
};

async function typecheckGeneratedDeclaration(
  appDir: string,
  declaration: string,
) {
  const fixtureDir = path.join(appDir, 'declaration-contract');
  await fs.promises.mkdir(fixtureDir, { recursive: true });
  await fs.promises.writeFile(path.join(fixtureDir, 'index.d.ts'), declaration);
  await fs.promises.writeFile(
    path.join(fixtureDir, 'consumer.ts'),
    [
      "import { client, createEffectRequestContext, operationManifest } from './index';",
      "const response: Promise<unknown> = client.greetings.ping({ name: 'Ada' });",
      'const endpoint: string = operationManifest.greetings.ping.endpoint;',
      "const context = createEffectRequestContext({ locale: 'cs' });",
      'void response;',
      'void endpoint;',
      'void context;',
    ].join('\n'),
  );
  await fs.promises.writeFile(
    path.join(fixtureDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'Preserve',
          moduleResolution: 'Bundler',
          noEmit: true,
          noUnusedLocals: true,
          strict: true,
          target: 'ESNext',
          types: [],
        },
        include: ['*.ts', '*.d.ts'],
      },
      null,
      2,
    ),
  );
  try {
    await execFileAsync(
      process.platform === 'win32' ? 'tsgo.cmd' : 'tsgo',
      ['-p', 'tsconfig.json'],
      {
        cwd: fixtureDir,
        shell: process.platform === 'win32',
      },
    );
  } catch (error) {
    const output = error as { stderr?: string; stdout?: string };
    throw new Error([output.stdout, output.stderr].filter(Boolean).join('\n'));
  }
}

describe('effect client generator data-platform integration', () => {
  test('renders batch configuration and a type-safe generated client contract', async () => {
    const { appDir, apiDir, resourcePath } = await createFixtureApp();

    try {
      const artifacts = await generateEffectClient({
        appDir,
        apiDir,
        resourcePath,
        prefix: '/api',
        port: 8080,
        target: 'bundle',
        dataPlatformBatch: {
          endpoint: '/_data/custom-batch',
          maxBatchSize: 12,
          maxBatchBytes: 8192,
          flushIntervalMs: 5,
          requestTimeoutMs: 4000,
          allowedMethods: ['GET'],
        },
      });
      if (!artifacts) {
        throw new Error('Effect client artifacts were not generated');
      }
      const expectedHash = createOperationContractHash(
        {
          name: 'ping',
          httpMethod: 'GET',
          routePath: '/api/ping',
        },
        'test-effect-app',
      );

      expect(artifacts.endpoints).toEqual([
        {
          apiId: 'CodegenTestApi',
          endpointName: 'ping',
          groupName: 'greetings',
          method: 'GET',
          routePath: '/api/ping',
        },
      ]);
      expect(artifacts.operationContracts['GET:/api/ping']).toMatchObject({
        operationVersion: 2,
        requestId: 'test-effect-app',
        routePath: '/api/ping',
        schemaHash: expectedHash,
      });
      expect(artifacts.code).toContain('"endpoint": "/api/_data/custom-batch"');
      expect(artifacts.code).toContain('"maxBatchSize": 12');
      expect(artifacts.code).toContain('"maxBatchBytes": 8192');
      expect(artifacts.code).toContain('"flushIntervalMs": 5');
      expect(artifacts.code).toContain('"requestTimeoutMs": 4000');
      await typecheckGeneratedDeclaration(appDir, artifacts.declaration);
    } finally {
      await fs.promises.rm(appDir, { recursive: true, force: true });
    }
  });
});
