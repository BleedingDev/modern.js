import type { URL } from 'node:url';
import {
  builderPluginAdapterPrecompress,
  type PrecompressConfig,
} from '@modern-js/app-tools-extensions/build-config/precompress/plugin';
import {
  type CloudflareDeployConfig,
  getBuildConfigEnvironment,
  type ResolveEffectTsgoCompilerOptions,
  resolveEffectTsgoCompiler,
  withBuildConfigEnvironment,
} from '@modern-js/app-tools-extensions/config';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

const compilerOriginContract: Expect<
  Equal<ResolveEffectTsgoCompilerOptions['from'], string | URL>
> = true;
const compilerPath: string = resolveEffectTsgoCompiler({
  from: import.meta.url,
});
const environmentValue: string | undefined = getBuildConfigEnvironment(
  'PUBLIC_SURFACE_CONSUMER',
);
const configure = withBuildConfigEnvironment(
  'PUBLIC_SURFACE_CONSUMER',
  'enabled',
  config => config,
);
const configured = configure({ plugins: [] });

void compilerOriginContract;
void compilerPath;
void environmentValue;
void configured;

const cloudflareConfig: CloudflareDeployConfig = {
  worker: { name: 'public-config-consumer', compatibilityDate: '2026-09-09' },
};
void cloudflareConfig;

const precompressConfig: PrecompressConfig = {
  gzip: { threshold: 2048 },
  brotli: false,
};
const precompressPlugin = builderPluginAdapterPrecompress(precompressConfig);
void precompressPlugin;
