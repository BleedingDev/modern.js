import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { runStableTypeScript } from './stable-typescript';

export function evaluateBuildModule(
  source: string,
  globals: Record<string, string> = {},
) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-build-module-'));
  try {
    const sourcePath = path.join(tempRoot, 'ultramodern-build.ts');
    const outputRoot = path.join(tempRoot, 'dist');
    fs.writeFileSync(sourcePath, source);
    fs.copyFileSync(
      fileURLToPath(
        new URL(
          '../../../../runtime/runtime-extensions/src/buildIdentity.ts',
          import.meta.url,
        ),
      ),
      path.join(tempRoot, 'buildIdentity.ts'),
    );
    fs.writeFileSync(
      path.join(tempRoot, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'Node16',
          moduleResolution: 'Node16',
          outDir: outputRoot,
          strict: true,
          target: 'ES2022',
          paths: {
            '@modern-js/runtime-extensions/build-identity': [
              './buildIdentity.ts',
            ],
          },
        },
        include: ['*.ts'],
      }),
    );
    const compiled = runStableTypeScript(
      ['-p', tempRoot, '--pretty', 'false'],
      tempRoot,
    );
    assert.equal(compiled.status, 0, compiled.output);

    const runtimeModule = { exports: {} as Record<string, any> };
    vm.runInNewContext(
      fs.readFileSync(path.join(outputRoot, 'buildIdentity.js'), 'utf8'),
      { exports: runtimeModule.exports, module: runtimeModule },
    );
    const module = { exports: {} as Record<string, any> };
    vm.runInNewContext(
      fs.readFileSync(path.join(outputRoot, 'ultramodern-build.js'), 'utf8'),
      {
        ...globals,
        exports: module.exports,
        module,
        require: (specifier: string) => {
          assert.equal(
            specifier,
            '@modern-js/runtime-extensions/build-identity',
          );
          return runtimeModule.exports;
        },
      },
    );
    return module.exports;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
