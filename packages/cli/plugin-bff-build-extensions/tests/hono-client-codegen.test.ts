import { createRequire } from 'node:module';
import {
  type APIHandlerInfo,
  ApiRouter,
  generateClient,
} from '@modern-js/bff-core';
import {
  buildOperationContractMap,
  type OperationContractSource,
  serializeOperationSchemas,
} from '@modern-js/server-runtime-extensions/bff-policy/node';
import { fs } from '@modern-js/utils';
import { build } from 'esbuild';
import path from 'path';

const PWD = path.resolve(__dirname, './fixtures/hono-client-codegen/api');
const fixtureRequire = createRequire(import.meta.url);

async function executeGeneratedClient(
  code: string,
  options: { configure?: boolean; realRuntime?: boolean } = {},
) {
  const result = await build({
    bundle: true,
    format: 'cjs',
    platform: 'node',
    stdin: {
      contents: code,
      resolveDir: __dirname,
      sourcefile: 'generated-bff-client.mjs',
    },
    write: false,
    plugins: [
      {
        name: 'generated-client-runtime',
        setup(buildApi) {
          buildApi.onResolve({ filter: /.*/ }, args => {
            if (args.kind === 'entry-point') {
              return undefined;
            }
            if (
              args.path === '@modern-js/plugin-bff-extensions/producer-runtime'
            ) {
              return { path: fixtureRequire.resolve(args.path) };
            }
            if (
              options.realRuntime &&
              args.path === '@modern-js/runtime-extensions/request-policy'
            ) {
              return {
                path: fixtureRequire.resolve(args.path),
                external: true,
              };
            }
            return { namespace: 'request-runtime', path: args.path };
          });
          buildApi.onLoad(
            { filter: /.*/, namespace: 'request-runtime' },
            () => ({
              contents: [
                'export const createRequest = (...args) => ({ kind: "request", args });',
                'export const createUploader = options => ({ kind: "uploader", options });',
                ...(options.configure === false
                  ? []
                  : ['export const configure = options => options;']),
                'export const fetch = (...args) => ({ kind: "fetch", args });',
              ].join('\n'),
              loader: 'js',
            }),
          );
        },
      },
    ],
  });
  const output = result.outputFiles[0]?.text;
  if (!output) {
    throw new Error('generated BFF client bundle was empty');
  }
  const moduleRecord: { exports: Record<string, any> } = { exports: {} };
  const evaluate = new Function('module', 'exports', 'require', output);
  evaluate(moduleRecord, moduleRecord.exports, fixtureRequire);
  return moduleRecord.exports;
}

type FixtureClientOptions = {
  prefix: string;
  resourcePath: string;
  target?: 'bundle' | 'server';
  requestId?: string;
  domain?: string;
  fetcher?: string;
  requestCreator?: string;
};

async function generateFixtureSource(options: FixtureClientOptions) {
  const source = await fs.readFile(options.resourcePath, 'utf-8');
  const result = await generateClient({
    appDir: path.resolve(__dirname, './fixtures/hono-client-codegen'),
    prefix: options.prefix,
    port: 3000,
    resourcePath: options.resourcePath,
    source,
    apiDir: PWD,
    lambdaDir: path.join(PWD, './lambda'),
    clientCodegenPlugin: require.resolve(
      '@modern-js/plugin-bff-build-extensions/hono-client-codegen',
    ),
    ...(options.target ? { target: options.target } : {}),
    ...(options.requestId ? { requestId: options.requestId } : {}),
    ...(options.domain ? { domain: options.domain } : {}),
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.requestCreator
      ? { requestCreator: options.requestCreator }
      : {}),
  });
  if (!result.isOk) {
    throw new Error(String(result.value));
  }
  return result.value;
}

async function generateFixtureClient(options: FixtureClientOptions) {
  return executeGeneratedClient(await generateFixtureSource(options));
}

describe('fork Hono client code generation', () => {
  test('executes generated requests for dynamic route handlers', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/[id]/origin/foo.ts',
    );
    const client = await generateFixtureClient({
      prefix: '/api',
      resourcePath,
    });

    expect(client.get.kind).toBe('request');
    // Upstream contract: createRequest takes exactly one options object.
    expect(client.get.args).toHaveLength(1);
    expect(client.get.args[0]).toEqual({
      path: '/api/:id/origin/foo',
      method: 'GET',
      port: 3000,
      httpMethodDecider: 'functionName',
      operationContext: expect.objectContaining({
        method: 'GET',
        operationId: 'get',
        routePath: '/api/:id/origin/foo',
        operationVersion: 1,
      }),
    });
    expect(client.post.args[0].method).toBe('POST');
    expect(client.operationManifest.operations).toHaveLength(2);
  });

  test('passes a single options object to a custom request creator', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/[id]/origin/foo.ts',
    );
    const client = await generateFixtureClient({
      prefix: '/api',
      resourcePath,
      requestCreator: 'custom-request-runtime',
    });

    for (const handler of [client.get, client.post]) {
      expect(handler.args).toHaveLength(1);
      expect(typeof handler.args[0]).toBe('object');
      expect(handler.args[0]).not.toBeNull();
      expect(Array.isArray(handler.args[0])).toBe(false);
    }
  });

  test('emits the configured bff domain for data requests', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/[id]/origin/foo.ts',
    );
    const client = await generateFixtureClient({
      prefix: '/api',
      resourcePath,
      target: 'bundle',
      requestId: 'producer-app',
      domain: 'https://bff.example.com',
    });

    expect(client.get.args).toHaveLength(1);
    expect(client.get.args[0]).toMatchObject({
      path: '/api/:id/origin/foo',
      method: 'GET',
      port: 3000,
      httpMethodDecider: 'functionName',
      domain: 'https://bff.example.com',
      requestId: 'producer-app',
    });
  });

  test('omits the domain option when no bff domain is configured', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/[id]/origin/foo.ts',
    );
    const client = await generateFixtureClient({
      prefix: '/api',
      resourcePath,
    });

    expect(client.get.args).toHaveLength(1);
    expect(client.get.args[0]).not.toHaveProperty('domain');
    expect(client.post.args[0]).not.toHaveProperty('domain');
  });

  test('passes the imported fetcher through the options object', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/[id]/origin/foo.ts',
    );
    const client = await generateFixtureClient({
      prefix: '/api',
      resourcePath,
      fetcher: 'custom-fetcher',
    });

    expect(client.get.args).toHaveLength(1);
    // `fetch` is emitted as a shorthand property bound to the identifier
    // imported from the configured fetcher module.
    expect(client.get.args[0].fetch).toBeInstanceOf(Function);
    expect(client.get.args[0].fetch('ping')).toEqual({
      kind: 'fetch',
      args: ['ping'],
    });
  });

  test('emits the raw port expression for the server target', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/[id]/origin/foo.ts',
    );
    const source = await generateFixtureSource({
      prefix: '/api',
      resourcePath,
      target: 'server',
      domain: 'https://bff.example.com',
    });

    const previousPort = process.env.PORT;
    try {
      process.env.PORT = '4567';
      const client = await executeGeneratedClient(source);
      expect(client.get.args[0].port).toBe('4567');
      expect(client.get.args[0].domain).toBe('https://bff.example.com');

      delete process.env.PORT;
      const fallbackClient = await executeGeneratedClient(source);
      expect(fallbackClient.get.args[0].port).toBe(3000);
    } finally {
      if (previousPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = previousPort;
      }
    }
  });

  test('executes generated default, method-named, and custom handlers', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/normal/origin/index.ts',
    );
    const client = await generateFixtureClient({ prefix: '/', resourcePath });

    expect(client.default.kind).toBe('request');
    expect(client.default.args[0]).toMatchObject({
      path: '/normal/origin',
      method: 'GET',
    });
    expect(client.DELETE.args[0]).toMatchObject({
      path: '/normal/origin',
      method: 'DELETE',
    });
    expect(client.putRepo.args[0]).toMatchObject({
      path: '/put-repo',
      method: 'PUT',
    });
    expect(
      client.operationManifest.operations.map((entry: any) => entry.name),
    ).toEqual(['DELETE', 'default', 'putRepo']);
  });

  test('executes cross-project client manifests and secure bootstrap', async () => {
    const resourcePath = path.resolve(
      __dirname,
      './fixtures/hono-client-codegen/api/lambda/normal/origin/index.ts',
    );
    const client = await generateFixtureClient({
      prefix: '/',
      resourcePath,
      target: 'bundle',
      requestId: 'producer-app',
    });

    expect(client.operationVersion).toBe(1);
    expect(client.operationSchemaHash).toHaveLength(64);
    expect(client.operationManifest).toMatchObject({
      operationVersion: 1,
      schemaHash: client.operationSchemaHash,
      operations: expect.arrayContaining([
        expect.objectContaining({
          httpMethod: 'GET',
          name: 'default',
          routePath: '/normal/origin',
        }),
      ]),
    });
    expect(client.initProducerClient()).toEqual({
      requestId: 'producer-app',
      requireEnvelope: true,
      identityBinding: {
        enabled: true,
        strict: true,
      },
      operationContract: {
        enabled: true,
        strict: true,
        requireSchemaHash: true,
        requireOperationVersion: true,
      },
    });
  });

  describe('upload operators', () => {
    const UPLOAD_PWD = PWD;
    const uploadResourcePath = path.resolve(UPLOAD_PWD, 'lambda/upload.ts');

    const generateUploadClient = async (requestId?: string) => {
      const source = await fs.readFile(uploadResourcePath, 'utf-8');
      const result = await generateClient({
        appDir: path.resolve(__dirname, './fixtures/hono-client-codegen'),
        prefix: '/api',
        port: 3000,
        resourcePath: uploadResourcePath,
        source,
        apiDir: UPLOAD_PWD,
        lambdaDir: path.join(UPLOAD_PWD, 'lambda'),
        clientCodegenPlugin: require.resolve(
          '@modern-js/plugin-bff-build-extensions/hono-client-codegen',
        ),
        ...(requestId ? { target: 'bundle', requestId } : {}),
      });
      if (!result.isOk) {
        throw new Error(String(result.value));
      }
      return executeGeneratedClient(result.value);
    };

    test('executes uploader and request handlers through their runtime contracts', async () => {
      const client = await generateUploadClient();

      expect(client.upload).toEqual({
        kind: 'uploader',
        options: { path: '/api/upload' },
      });
      expect(client.get.kind).toBe('request');
      expect(client.get.args[0]).toMatchObject({ path: '/api', method: 'GET' });
    });

    test('executes producer upload clients with operation context', async () => {
      const client = await generateUploadClient('producer-app');

      expect(client.upload).toMatchObject({
        kind: 'uploader',
        options: {
          path: '/api/upload',
          requestId: 'producer-app',
          operationContext: {
            operationId: 'upload',
            routePath: '/api/upload',
            method: 'POST',
            operationVersion: 1,
          },
        },
      });
      expect(client.upload.options.operationContext.schemaHash).toHaveLength(
        64,
      );
    });
  });
});

describe('canonical Hono policy generation', () => {
  const resourcePath = path.resolve(PWD, 'lambda/normal/origin/index.ts');

  test('preserves native callable identities and all reflected input schema slots in emitted hashes', async () => {
    const router = new ApiRouter({
      appDir: path.resolve(PWD, '..'),
      apiDir: PWD,
      lambdaDir: path.join(PWD, 'lambda'),
      prefix: '/',
    });
    const handlers = await router.getSingleModuleHandlers(resourcePath);
    expect(handlers).toBeDefined();
    const typedHandler = handlers!.find(info => info.name === 'putRepo')!;
    const canonicalCallable: NonNullable<OperationContractSource['handler']> =
      typedHandler.handler;
    const nativeCallable: APIHandlerInfo['handler'] = canonicalCallable;
    expect(nativeCallable).toBe(typedHandler.handler);
    expect(Object.keys(serializeOperationSchemas(nativeCallable)!)).toEqual([
      'DATA',
      'QUERY',
      'PARAMS',
      'HEADERS',
    ]);
    const contracts = buildOperationContractMap({
      handlers: handlers!,
      requestId: 'producer-app',
      operationVersion: 1,
    });
    const client = await generateFixtureClient({
      prefix: '/',
      resourcePath,
      requestId: 'producer-app',
    });
    expect(client.putRepo.args[0].operationContext.schemaHash).toBe(
      contracts['PUT:/put-repo'].schemaHash,
    );
    expect(
      client.operationManifest.operations.find(
        (entry: any) => entry.name === 'putRepo',
      ).schemaHash,
    ).toBe(contracts['PUT:/put-repo'].schemaHash);
    const uploadHandlers = await router.getSingleModuleHandlers(
      path.join(PWD, 'lambda/upload.ts'),
    );
    const upload = uploadHandlers!.find(info => info.name === 'upload')!;
    expect(Object.keys(serializeOperationSchemas(upload.handler)!)).toEqual([
      'Files',
    ]);
  });

  test('uses the canonical default for requests and bootstrap, preserving nested caller overrides', async () => {
    const source = await generateFixtureSource({
      prefix: '/',
      resourcePath,
      requestId: 'producer-app',
    });
    expect(
      source.match(/from "@modern-js\/runtime-extensions\/request-policy"/g),
    ).toHaveLength(2);
    expect(source).not.toContain('@modern-js/plugin-bff/client');
    const client = await executeGeneratedClient(source);
    expect(
      client.initProducerClient({
        requireEnvelope: false,
        identityBinding: { strict: false },
        operationContract: { requireOperationVersion: false },
      }),
    ).toEqual({
      requestId: 'producer-app',
      requireEnvelope: false,
      identityBinding: { enabled: true, strict: false },
      operationContract: {
        enabled: true,
        strict: true,
        requireSchemaHash: true,
        requireOperationVersion: false,
      },
    });
  });

  test('retains explicit custom creators and their missing-configure diagnostic', async () => {
    const source = await generateFixtureSource({
      prefix: '/',
      resourcePath,
      requestId: 'producer-app',
      requestCreator: 'custom-runtime',
    });
    expect(source.match(/from "custom-runtime"/g)).toHaveLength(2);
    expect(source).not.toContain(
      'from "@modern-js/runtime-extensions/request-policy"',
    );
    const warning = rstest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const client = await executeGeneratedClient(source, { configure: false });
      expect(client.initProducerClient()).toBeUndefined();
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('does not expose configure()'),
      );
    } finally {
      warning.mockRestore();
    }
  });

  test('bootstrap configures the actual same policy client that generated requests use', async () => {
    const producerId = `hono-codegen-shared-runtime-${Date.now()}`;
    const source = await generateFixtureSource({
      prefix: '/api',
      resourcePath: path.join(PWD, 'lambda/[id]/origin/foo.ts'),
      requestId: producerId,
    });
    const client = await executeGeneratedClient(source, { realRuntime: true });
    expect(() => client.get('item')).toThrow();
    const request = rstest.fn(
      async (url: string, options: { headers: Record<string, string> }) => ({
        url,
        options,
      }),
    );
    client.initProducerClient({
      setDomain: () => 'https://producer.example',
      request,
    });
    await client.get('item');
    expect(request).toHaveBeenCalledTimes(1);
    const headers = request.mock.calls[0]?.[1].headers;
    expect(headers).toMatchObject({
      'x-modernjs-bff-envelope': expect.any(String),
      'x-operation-id': expect.any(String),
      'x-modernjs-bff-operation-context': expect.any(String),
    });
  });
});
