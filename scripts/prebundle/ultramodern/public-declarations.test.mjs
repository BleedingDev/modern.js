import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { publicDeclarationsPlugin } from './public-declarations.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const installedRoot = dirname(realpathSync(join(root, 'node_modules')));
const store = join(installedRoot, 'node_modules/.pnpm');
const temp = mkdtempSync(join(process.env.TMPDIR ?? root, 'public-declarations-'));
const modules = join(temp, 'node_modules');
const manifest = file => JSON.parse(readFileSync(file, 'utf8'));
const packages = new Map();
const declared = new Set();

function discover(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (!item.isDirectory() || ['node_modules', 'dist', 'compiled', '.git'].includes(item.name)) continue;
    const child = join(directory, item.name);
    if (existsSync(join(child, 'package.json'))) packages.set(manifest(join(child, 'package.json')).name, child);
    else discover(child);
  }
}
function link(name, target) {
  const dest = join(modules, name);
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  symlinkSync(target, dest, 'dir');
}
function installed(name, version) {
  const folder = readdirSync(store).find(entry => entry.startsWith(`${name.replace('/', '+')}@${version}`));
  assert.ok(folder, `Existing dependency required: ${name}@${version}`);
  return join(store, folder, 'node_modules', name);
}
function stage(name) {
  if (declared.has(name)) return;
  declared.add(name);
  const source = packages.get(name);
  assert.ok(source, `Missing built framework package ${name}`);
  const dest = join(modules, name);
  cpSync(source, dest, { recursive: true, filter(file) {
    const part = file.slice(source.length).split('/');
    if (part.some(item => ['node_modules', '.git', 'tests', 'docs', 'doc_build'].includes(item))) return false;
    return statSync(file).isDirectory() || /(?:\.d\.[cm]?ts|package\.json)$/.test(file);
  } });
  const workingSource = join(root, source.slice(installedRoot.length));
  const pkg = manifest(join(workingSource, 'package.json'));
  if (pkg.publishConfig?.types) pkg.types = pkg.publishConfig.types;
  writeFileSync(join(dest, 'package.json'), JSON.stringify(pkg));
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    if (packages.has(dep)) stage(dep);
    else if (existsSync(join(workingSource, 'node_modules', dep))) link(dep, realpathSync(join(workingSource, 'node_modules', dep)));
    else if (existsSync(join(source, 'node_modules', dep))) link(dep, realpathSync(join(source, 'node_modules', dep)));
  }
}
function compile(file) {
  const result = spawnSync(join(root, 'node_modules/.bin/tsgo'), [
    '--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'esnext',
    '--types', 'node', '--typeRoots', join(modules, '@types'), file,
  ], { cwd: temp, encoding: 'utf8', timeout: 120000 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
const positive = `import { chokidar, fastGlob, inquirer, lodash, upath } from '@modern-js/utils';
import { defineConfig } from '@modern-js/app-tools';
const watcher = chokidar.watch('src/**/*.ts');
watcher.add(['src/**/*.tsx']).unwatch('src/generated/**');
const closed: Promise<void> = watcher.close();
const paths: Promise<string[]> = fastGlob('**/*.ts');
const entries = fastGlob.sync('**/*.ts', { objectMode: true });
const entryPath: string = entries[0].path;
const answer: Promise<{ name: string }> = inquirer.prompt<{ name: string }>({ type: 'input', name: 'name' });
const prompt = new inquirer.ui.Prompt({}, {});
const values: string[] = lodash.map([{ name: 'yes' }], item => item.name);
const weak = new WeakMap<symbol, string>();
weak.set(Symbol(), 'valid modern weak key');
const normalized: string = upath.win32.normalize('a/b');
defineConfig({ tools: { sass: { api: 'modern', sassOptions: { style: 'compressed' }, additionalData: (content, context) => String(content) + context.resourcePath } }, output: { svgDefaultExport: 'component' } });
defineConfig({ tools: { sass: { api: 'legacy', sassOptions: { outputStyle: 'compressed', includePaths: ['src'] } } }, output: { svgDefaultExport: 'url' } });
`;
try {
  discover(join(installedRoot, 'packages'));
  mkdirSync(modules, { recursive: true });
  stage('@modern-js/utils');
  stage('@modern-js/app-tools');
  link('@types/node', installed('@types/node', '26.4.1'));
  link('sass-embedded', installed('sass-embedded', '1.100.0'));
  link('type-fest', installed('type-fest', '5.9.0'));
  // These plugins have a real Webpack type peer. Reuse an existing installation;
  // aliasing it to Rspack would invent WebpackError/loader namespace members.
  link('webpack', process.argv[2] ?? installed('webpack', '5.'));
  for (const [name, version] of [['@rsbuild/plugin-css-minimizer', '2.0.1'], ['css-minimizer-webpack-plugin', '8.0.0'], ['compression-webpack-plugin', '12.0.0']]) {
    const from = installed(name, version);
    const target = join(modules, name);
    rmSync(target, { force: true });
    cpSync(from, target, { recursive: true, filter: path => statSync(path).isDirectory() || /(?:\.d\.[cm]?ts|package\.json)$/.test(path) });
    for (const dep of Object.keys(manifest(join(from, 'package.json')).dependencies ?? {})) {
      const dependency = join(from.slice(0, from.lastIndexOf('/node_modules/')), 'node_modules', dep);
      if (existsSync(dependency)) link(dep, realpathSync(dependency));
    }
  }
  const utils = join(modules, '@modern-js/utils/dist/compiled');
  // Current producer input, not a stale published cohort or hand-edited output.
  cpSync(join(root, 'packages/toolkit/utils/compiled'), utils, { recursive: true });
  const file = join(temp, 'positive.ts');
  writeFileSync(file, positive);
  const baseline = compile(file);
  console.log('BASELINE', baseline.status, baseline.output);
  assert.notEqual(baseline.status, 0);
  for (const diagnostic of ['TS2420', 'TS2307', 'TS2882', 'TS2428', 'TS1540']) assert.ok(baseline.output.includes(diagnostic), diagnostic);
  link('rxjs', installed('rxjs', '7.8.2'));
  for (const kind of ['utils', 'builder']) {
    let emit;
    publicDeclarationsPlugin(kind).setup({
      context: { rootPath: join(modules, `@modern-js/${kind}`) },
      onAfterBuild(handler) { emit = handler; },
    });
    emit();
    // A rebuild must be idempotent, with identical public declarations.
    const output = join(modules, `@modern-js/${kind}/dist`);
    const files = readdirSync(output, { recursive: true }).filter(name => name.endsWith('.d.ts'));
    const before = files.map(name => readFileSync(join(output, name), 'utf8'));
    emit();
    assert.deepEqual(files.map(name => readFileSync(join(output, name), 'utf8')), before);
  }
  const runtimeFiles = readdirSync(utils, { recursive: true }).filter(name => /\.[cm]?js$/.test(name));
  for (const name of runtimeFiles) assert.deepEqual(readFileSync(join(utils, name)), readFileSync(join(root, 'packages/toolkit/utils/compiled', name)), `Runtime changed: ${name}`);
  const require = createRequire(join(temp, 'runtime.cjs'));
  const watcher = require(join(utils, 'chokidar/index.js')).watch([], { persistent: false });
  assert.equal('ref' in watcher, false);
  assert.equal('unref' in watcher, false);
  await watcher.close();
  const result = compile(file);
  console.log('RUNTIME', runtimeFiles.length, 'unchanged modules; watcher wrapper has no ref/unref');
  console.log('UPDATED', result.status, result.output);
  assert.equal(result.status, 0, result.output);
  const negative = join(temp, 'negative.ts');
  writeFileSync(negative, `import { chokidar, fastGlob, inquirer, upath } from '@modern-js/utils';
import { defineConfig } from '@modern-js/app-tools';
chokidar.watch('src').ref();
fastGlob.sync('src', { objectMode: 'yes' });
inquirer.prompt<{ name: string }>({ type: 'input', name: 'name' }).then(value => { const invalid: number = value.name; });
upath.win32.normalize(42);
defineConfig({ tools: { sass: { api: 'invalid' } }, output: { svgDefaultExport: 'invalid' } });
`);
  const rejected = compile(negative);
  console.log('NEGATIVE', rejected.status, rejected.output);
  assert.notEqual(rejected.status, 0);
  for (const line of [3, 4, 5, 6, 7]) assert.match(rejected.output, new RegExp(`negative.ts\\(${line},`));
  console.log('Public Utils/AppTools strict TypeScript 7 + Node 26 declaration cone passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
