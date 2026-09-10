import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { compatPlugin, createServerBase } from '@modern-js/server-core';
import { serverStaticPlugin } from '@modern-js/server-core/node';
import type { ServerRoute } from '@modern-js/types';
import staticServingExtensionsPlugin from '../../src/static-serving/plugin';
import { getDefaultAppContext, getDefaultConfig } from '../helpers';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true })));
});

it.each([
  ['*;q=0.8', 'br'],
  ['*;q=0.8, identity;q=0.9', null],
  ['*;q=0.8, identity;q=0', 'br'],
  ['br;q=0, *;q=0.8, identity;q=0', 'gzip'],
  ['br;q=0.2, gzip;q=1', 'gzip'],
  ['br;q=0.8', null],
  ['br;q=0.8, identity;q=0', 'br'],
  ['br;q=0, gzip;q=0, identity;q=0', 'denied'],
])('consumes native selected assets for %s', async (acceptEncoding, encoding) => {
  const pwd = await mkdtemp(
    path.join(os.tmpdir(), 'private-static-consumption-'),
  );
  roots.push(pwd);
  const original = Buffer.from('native response body');
  const br = brotliCompressSync(original);
  const gzip = gzipSync(original);
  for (const directory of ['static', 'public']) {
    const filename = path.join(pwd, directory, 'asset.txt');
    await mkdir(path.dirname(filename));
    await writeFile(filename, original);
    await writeFile(`${filename}.br`, br);
    await writeFile(`${filename}.gz`, gzip);
  }
  const server = createServerBase({
    config: getDefaultConfig(),
    appContext: getDefaultAppContext(),
    pwd,
    routes: [
      {
        urlPath: '/document',
        entryPath: 'public/asset.txt',
        isSSR: false,
        responseHeaders: { 'x-route': 'retained' },
      },
    ] as ServerRoute[],
  });
  server.addPlugins([
    compatPlugin(),
    staticServingExtensionsPlugin(),
    serverStaticPlugin(),
  ]);
  await server.init();
  for (const url of ['/static/asset.txt', '/document']) {
    const response = await server.request(url, {
      headers: { 'accept-encoding': acceptEncoding },
    });
    expect(response.headers.get('vary')).toContain('Accept-Encoding');
    if (encoding === 'denied') {
      expect(response.status).toBe(406);
      expect(await response.text()).toBe('');
      continue;
    }
    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBe(encoding);
    expect(response.headers.get('content-type')).toContain('text/plain');
    const expected =
      encoding === 'br' ? br : encoding === 'gzip' ? gzip : original;
    expect(Buffer.from(await response.arrayBuffer())).toEqual(expected);
    if (url === '/document') {
      expect(response.headers.get('x-route')).toBe('retained');
    } else {
      expect(response.headers.get('content-length')).toBe(
        String(expected.length),
      );
    }
  }
});
