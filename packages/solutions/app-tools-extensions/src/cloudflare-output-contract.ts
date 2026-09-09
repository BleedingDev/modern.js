export const CLOUDFLARE_WORKER_ENTRY = 'server/index.mjs';
export const CLOUDFLARE_WORKER_MANIFEST = 'server/modern-worker-manifest.json';
export const CLOUDFLARE_WRANGLER_CONFIG_FILE = 'wrangler.json';
export const CLOUDFLARE_OUTPUT_PACKAGE_FILE = 'package.json';
export const CLOUDFLARE_WORKER_PACKAGE_FILE = 'worker/package.json';
export const CLOUDFLARE_ASSETS_BINDING = 'ASSETS';
export const CLOUDFLARE_PUBLIC_ASSETS_DIRECTORY = 'public';
export const CLOUDFLARE_WORKER_BUNDLE_DIRECTORY = 'worker';
export const CLOUDFLARE_RUNTIME_TYPE = 'cloudflare-module-worker';
export const CLOUDFLARE_OUTPUT_PACKAGE_TYPE = 'module';
export const CLOUDFLARE_WORKER_PACKAGE_TYPE = 'commonjs';
export const CLOUDFLARE_WORKER_BUNDLE_FORMAT = 'commonjs';
export const CLOUDFLARE_WORKER_NODE_BUILTINS = [
  'async_hooks',
  'buffer',
  'crypto',
  'dns',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'module',
  'net',
  'os',
  'path',
  'process',
  'stream',
  'string_decoder',
  'tls',
  'url',
  'util',
  'util/types',
  'zlib',
] as const;
// Platform imports available with the default 2026-06-02 nodejs_compat target.
// Import availability does not imply support for every Node API operation.
export const CLOUDFLARE_WORKER_PLATFORM_MODULES = [
  'cloudflare:sockets',
] as const;
export const CLOUDFLARE_REQUIRED_COMPATIBILITY_FLAGS = [
  'nodejs_compat',
  'global_fetch_strictly_public',
] as const;
