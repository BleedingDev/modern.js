import {
  collectEffectEndpoints,
  toOperationContractSources,
} from '@modern-js/bff-effect/effect';
import {
  buildOperationContractMap,
  deriveOperationVersion,
} from '@modern-js/server-runtime-extensions/bff-policy/node';
import { fs, upath as path } from '@modern-js/utils';
import { getHttpApiRuntime, loadEffectApi } from './http-api-runtime';

function getPackageInfo(
  resourcePath: string,
  appDir: string,
  onDependency?: (dependency: string) => void,
): { name?: string; version?: string } {
  for (const startDir of [path.dirname(resourcePath), appDir]) {
    let current = path.resolve(startDir);
    for (let depth = 0; depth < 32; depth += 1) {
      const packageJsonPath = path.join(current, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        onDependency?.(packageJsonPath);
        try {
          const packageJson = fs.readJSONSync(packageJsonPath) as {
            name?: string;
            version?: string;
          };
          return { name: packageJson.name, version: packageJson.version };
        } catch {
          return {};
        }
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return {};
}

/** Derives server policy metadata without emitting or typing a client. */
export async function resolveEffectOperationContracts(options: {
  appDir: string;
  resourcePath: string;
  prefix: string;
  requestId?: string;
  onDependency?: (dependency: string) => void;
}) {
  const api = await loadEffectApi(options);
  if (api === null) {
    return null;
  }
  const runtime = await getHttpApiRuntime();
  const endpoints = collectEffectEndpoints(
    runtime.reflect,
    api,
    options.prefix,
  );
  const packageInfo = getPackageInfo(
    options.resourcePath,
    options.appDir,
    options.onDependency,
  );
  const requestId = options.requestId?.trim() || packageInfo.name || 'default';
  return buildOperationContractMap({
    handlers: toOperationContractSources(endpoints),
    requestId,
    operationVersion: deriveOperationVersion(packageInfo.version),
  });
}
