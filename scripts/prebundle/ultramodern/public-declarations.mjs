import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const vendor = fileURLToPath(new URL('./vendor/inquirer/', import.meta.url));

function declarationFiles(root) {
  return readdirSync(root, { recursive: true })
    .filter(file => file.endsWith('.d.ts'))
    .map(file => join(root, file));
}

function rewrite(file, transform) {
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (before !== after) writeFileSync(file, after);
}

function modulePath(file, target) {
  const path = relative(dirname(file), target).replaceAll('\\', '/');
  return path.startsWith('.') ? path : `./${path}`;
}

/** Repair declaration production without replacing any bundled runtime implementation. */
export function emitUtilsDeclarations(compiled, resolvePackage) {
  // Chokidar 3 is an EventEmitter wrapper, not a native fs.FSWatcher. Its runtime
  // has neither ref nor unref; declaring those methods would invent an API.
  rewrite(join(compiled, 'chokidar/types/index.d.ts'), text =>
    text.replace('extends EventEmitter implements fs.FSWatcher', 'extends EventEmitter'));
  // These empty ES5 compatibility augmentations conflict with modern WeakKey.
  // Node 26 supplies all four collection interfaces, including symbol weak keys.
  rewrite(join(compiled, 'lodash/index.d.ts'), text =>
    text.replace(/\/\/ Backward compatibility with --target es5\s+declare global \{[\s\S]*?\n\}/, ''));
  rewrite(join(compiled, 'upath/upath.d.ts'), text =>
    text.replace(/export module (posix|win32)\b/g, 'export namespace $1'));

  const glob = join(compiled, 'fast-glob');
  for (const file of declarationFiles(glob)) {
    rewrite(file, text => text.replace(/(['"])(?:\.\.\/)+@nodelib\/(fs\.(?:walk|scandir|stat))\1/g,
      (_, quote, name) => `${quote}${modulePath(file, join(glob, '@nodelib', name, 'out/index'))}${quote}`));
  }

  const inquirer = join(compiled, 'inquirer');
  // dts-packer omitted side-effect imports, which declare the concrete prompt
  // classes. Restore the matching v8 modules, not incompatible v9/v14 typings.
  cpSync(vendor, inquirer, { recursive: true });
  const rxjs = resolvePackage('rxjs');
  const rxjsTypes = join(inquirer, 'rxjs');
  mkdirSync(rxjsTypes, { recursive: true });
  cpSync(join(rxjs, 'dist/types'), rxjsTypes, {
    recursive: true,
    filter: file => !file.endsWith('.map'),
  });
  cpSync(join(rxjs, 'LICENSE.txt'), join(rxjsTypes, 'LICENSE.txt'));
  for (const file of declarationFiles(inquirer)) {
    rewrite(file, text => text.replace(/(['"])(rxjs|through)\1/g,
      (_, quote, name) => `${quote}${modulePath(file, join(inquirer, name))}${quote}`));
  }
}

/** Keep Builder's optional Sass configuration graph on the actual Rspack/Sass implementation. */
export function emitBuilderDeclarations(types, resolvePackage) {
  const plugin = resolvePackage('@rsbuild/plugin-sass');
  const target = join(types, 'sass');
  mkdirSync(target, { recursive: true });
  cpSync(join(plugin, 'dist/types.d.ts'), join(target, 'index.d.ts'));
  cpSync(join(plugin, 'compiled/sass-loader/index.d.ts'), join(target, 'loader.d.ts'));
  cpSync(join(plugin, 'LICENSE'), join(target, 'LICENSE'));
  rewrite(join(target, 'index.d.ts'), text =>
    text.replace('../compiled/sass-loader/index.js', './loader.js'));
  rewrite(join(target, 'loader.d.ts'), text => text
    .replace("import * as Sass from 'sass';", "import * as Sass from 'sass-embedded';")
    .replace("import Webpack from 'webpack';", "import type { Rspack } from '@rsbuild/core';")
    .replaceAll('Webpack.loader.LoaderContext', 'Rspack.LoaderContext'));
  for (const file of declarationFiles(types)) {
    if (file.startsWith(`${target}/`)) continue;
    rewrite(file, text => text
      .replace(/import type \{ SvgDefaultExport \} from ['"]@rsbuild\/plugin-svgr['"];?/g,
        "type SvgDefaultExport = 'component' | 'url';")
      .replace(/(['"])@rsbuild\/plugin-sass\1/g,
        (_, quote) => `${quote}${modulePath(file, join(target, 'index.js'))}${quote}`));
  }
}

function packageResolver(packageRoot) {
  const require = createRequire(join(packageRoot, 'package.json'));
  return name => {
    let root = dirname(require.resolve(name));
    // Skip RxJS's dist/cjs format marker and find the actual package identity.
    while (true) {
      const manifest = join(root, 'package.json');
      if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) return root;
      const parent = dirname(root);
      if (parent === root) throw new Error(`Cannot locate declaration dependency ${name}`);
      root = parent;
    }
  };
}

export function publicDeclarationsPlugin(kind) {
  return {
    name: `ultramodern:${kind}-public-declarations`,
    setup(api) {
      api.onAfterBuild(() => {
        const root = api.context.rootPath;
        const resolver = packageResolver(root);
        if (kind === 'utils') emitUtilsDeclarations(resolve(root, 'dist/compiled'), resolver);
        else if (kind === 'builder') emitBuilderDeclarations(resolve(root, 'dist/types'), resolver);
        else throw new Error(`Unknown declaration producer: ${kind}`);
      });
    },
  };
}
