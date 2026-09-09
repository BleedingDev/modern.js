import { realpathSync } from 'node:fs';
import path from 'node:path';
import type { HttpMethodDecider } from '@modern-js/types';
import type { Rspack } from '@rsbuild/core';
import {
  bundleEffectWorkerRuntimeSource,
  generateEffectClientCode,
  generateEffectWorkerRuntimeWrapper,
  resolveEffectEntryFile,
} from './index';

export interface EffectBffLoaderOptions {
  prefix: string;
  appDir: string;
  apiDir: string;
  effectEntry: string;
  port: number;
  target: string;
  requestCreator?: string;
  requestId?: string;
  httpMethodDecider?: HttpMethodDecider;
  effectDataPlatformBatch?: {
    enabled?: boolean;
    endpoint?: string;
    flushIntervalMs?: number;
    maxBatchSize?: number;
    maxBatchBytes?: number;
    requestTimeoutMs?: number;
    allowedMethods?: string[];
  };
}

export default async function loader(
  this: Rspack.LoaderContext<EffectBffLoaderOptions>,
  source: string,
) {
  this.cacheable();
  delete require.cache[this.resourcePath];
  const callback = this.async();
  try {
    const options = this.getOptions();
    const entry = resolveEffectEntryFile(options);
    if (!entry || realpathSync(entry) !== realpathSync(this.resourcePath))
      throw new Error(
        `Unexpected Effect BFF loader resource: ${this.resourcePath}`,
      );
    const query = new URLSearchParams(this.resourceQuery);
    if (query.has('modern-bff-runtime-source')) {
      const { transform } = await import('@swc/core');
      const transformed = await transform(source, {
        filename: this.resourcePath,
        sourceMaps: false,
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: /\.[jt]sx$/.test(this.resourcePath),
          },
          target: 'es2024',
        },
        module: { type: 'es6' },
      });
      callback(
        undefined,
        await bundleEffectWorkerRuntimeSource(
          transformed.code,
          this.resourcePath,
          this,
        ),
      );
    } else if (query.has('modern-bff-runtime')) {
      callback(
        undefined,
        await generateEffectWorkerRuntimeWrapper(
          this,
          options,
          this.resourcePath,
        ),
      );
    } else {
      const code = await generateEffectClientCode({
        appDir: options.appDir,
        apiDir: options.apiDir,
        resourcePath: this.resourcePath,
        prefix: options.prefix,
        port: Number(options.port),
        target: options.target,
        requestId: options.requestId,
        requestCreator: options.requestCreator,
        httpMethodDecider: options.httpMethodDecider,
        dataPlatformBatch: options.effectDataPlatformBatch,
        onDependency: dependency => this.addDependency(dependency),
      });
      if (code === null)
        throw new Error(
          `Failed to generate Effect client for ${this.resourcePath}`,
        );
      callback(undefined, code);
    }
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
  }
}
