import path from 'node:path';
import { build } from 'esbuild';

/** Keep the worker implementation graph out of the API-to-client loader. */
export async function bundleEffectWorkerRuntimeSource(
  source: string,
  resourcePath: string,
  loader: { addDependency: (dependency: string) => void },
) {
  const result = await build({
    absWorkingDir: path.dirname(resourcePath),
    bundle: true,
    format: 'esm',
    metafile: true,
    packages: 'external',
    platform: 'neutral',
    stdin: {
      contents: source,
      loader: 'js',
      resolveDir: path.dirname(resourcePath),
      sourcefile: resourcePath,
    },
    target: 'es2024',
    write: false,
  });
  for (const dependency of Object.keys(result.metafile.inputs)) {
    if (dependency !== '<stdin>') {
      loader.addDependency(
        path.resolve(path.dirname(resourcePath), dependency),
      );
    }
  }
  return result.outputFiles[0].text;
}
