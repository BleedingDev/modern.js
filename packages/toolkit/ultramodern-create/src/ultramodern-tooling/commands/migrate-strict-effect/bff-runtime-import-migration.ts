import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { modernPackageSpecifier } from '../../../ultramodern-package-source';
import type { UltramodernReleaseCohort } from '../../../ultramodern-release-cohort';
import { ULTRAMODERN_PACKAGE_PINS } from '../../../ultramodern-workspace/policy';
import type { ResolvedPackageSource } from '../../../ultramodern-workspace/types';
import {
  listWorkspacePackageFiles,
  type MigrationIo,
  readJsonFile,
} from './io';

const native = '@modern-js/plugin-bff';
const effect = '@modern-js/bff-effect';
const lower = '@modern-js/plugin-bff-extensions';
const direct = new Map([
  [`${native}/effect-client`, `${effect}/effect-client`],
  [`${native}/effect-client-runtime`, `${effect}/effect-client-runtime`],
  [`${native}/data-platform`, `${effect}/data-platform`],
  [`${native}/effect-edge/dispatcher`, `${effect}/effect-edge`],
  [`${native}/hono-server`, `${native}/server`],
]);
const aggregate = new Set([
  `${native}/server`,
  `${native}/effect`,
  `${native}/effect-server`,
  `${native}/effect-edge`,
]);
const nodeOwners = new Map<string, string>();
function register(owner: string, names: string) {
  for (const name of names.split(/\s+/u).filter(Boolean))
    nodeOwners.set(name, owner);
}
register(
  `${effect}/effect`,
  `
  CreateEffectOperationContextOptions createEffectBffEdgeHandler createEffectBffTestHandler
  createEffectOperationContext createHttpApiHandler defineEffectBff defineEffectRpcBff
  dispatchEffectBffRequest EffectApiClientFromApi EffectApiPromiseClientFromApi
  EffectBffDefinition EffectBffHandlerFactory EffectBffOpenApiConfig EffectBffRuntime
  EffectContext EffectDataPlatformBatchOptions EffectDataPlatformSelectionValidationOptions
  EffectDataPlatformValidationOptions EffectRequestValidator EffectRpcBffDefinition
  EffectRpcBffHandlerFactory EffectRpcBffHandlerOptions EffectRpcRuntimeLayer
  EffectRpcSerialization EffectRuntimeLayer EffectRuntimeRequirements OpenTelemetry
  runWithEffectContext useEffectContext useOperationContext
`,
);
register(
  `${lower}/backend-federation`,
  `
  BACKEND_FEDERATION_CONTRACT_VERSION BACKEND_FEDERATION_EFFECT_EXPOSE
  BACKEND_FEDERATION_MANIFEST_FILE BACKEND_FEDERATION_NODE_ADAPTER_VERSION
  BackendFederatedEffectApiModule BackendFederationEntryExports BackendFederationExpectedIdentity
  BackendFederationIdentityIssue BackendFederationIdentityLoadOptions BackendFederationLoadEntryPluginOptions
  BackendFederationRemote BackendFederationRuntimeOptions createBackendFederationLoadEntryPlugin
  createBackendFederationRuntime validateExpectedBackendFederationIdentity
`,
);
register(`${lower}/backend-federation/node`, 'loadBackendFederatedEffectApi');
register(
  `${lower}/backend-federation-manifest`,
  `
  BackendFederationManifest BackendFederationManifestAdapterError BackendFederationManifestAdapterErrorCode
  BackendFederationManifestAdapterFallback BackendFederationManifestAdapterOptions
  BackendFederationManifestFetchResponse BackendFederationVersionBoundaryExpectation
  loadBackendFederationManifest resolveBackendFederationRemoteFromManifest
`,
);
register(
  `${lower}/backend-federation-manifest/node`,
  'loadBackendFederatedEffectApiFromManifest',
);
const namespaces = new Set(['Config', 'Effect', 'Layer', 'Option', 'Schema']);
for (const name of namespaces) nodeOwners.set(name, `effect/${name}`);
register(
  'effect/unstable/http',
  `
  Cookies Etag FetchHttpClient FindMyWay Headers HttpBody HttpClient HttpClientError
  HttpClientRequest HttpClientResponse HttpEffect HttpIncomingMessage HttpMethod HttpMiddleware
  HttpPlatform HttpRouter HttpServer HttpServerError HttpServerRequest HttpServerRespondable
  HttpServerResponse HttpStaticServer HttpStatus HttpTraceContext Multipart MultipartParser Template Url UrlParams
`,
);
register(
  'effect/unstable/httpapi',
  `
  HttpApi HttpApiBuilder HttpApiClient HttpApiEndpoint HttpApiError HttpApiGroup HttpApiMiddleware
  HttpApiScalar HttpApiSchema HttpApiSecurity HttpApiSwagger HttpApiTest OpenApi
`,
);
register(
  'effect/unstable/rpc',
  `
  Rpc RpcClient RpcClientError RpcGroup RpcMessage RpcMiddleware RpcSchema RpcSerialization RpcServer RpcTest RpcWorker Utils
`,
);
const edgeFederation = new Set([
  ...[...nodeOwners]
    .filter(
      ([, owner]) =>
        owner.startsWith(`${lower}/backend-federation`) &&
        !owner.includes('manifest'),
    )
    .map(([name]) => name),
  'BackendFederationEdgeLoadEntryPlugin',
  'BackendFederationEdgeLoadEntryPluginOptions',
  'BackendFederationEdgeRemote',
  'BackendFederationEdgeRuntime',
  'BackendFederationEdgeRuntimeOptions',
  'EdgeBackendFederationLoadOptions',
  'EdgeBackendFederationIdentityLoadOptions',
]);
const edgeOnly = new Set([
  'EffectBffEdgeDispatchOptions',
  'EffectBffEdgeHandlerOptions',
  'createEffectBffEdgeDispatcher',
  'createEffectBffEdgeDispatcherFactory',
]);
const ambiguousNativeNames = new Set(['Headers', 'HttpMethod']);
const packageName = (specifier: string) =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
const conflict = (file: string, reason: string): never => {
  throw new Error(
    `BFF runtime migration conflict: ${file}: ${reason}; consumer files were not changed.`,
  );
};

/** Only module syntax is rewritten; strings, comments, and handler bodies retain their bytes. */
export function migrateBffRuntimeSource(source: string, file = 'source.ts') {
  const dependencies = new Set<string>();
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(source, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    if (!source.includes(native)) return { source, dependencies };
    return conflict(
      file,
      'cannot parse source containing a native BFF reference',
    );
  }
  type Binding = { initializer?: any; scope: Scope; factory?: boolean };
  type Scope = {
    parent?: Scope;
    bindings: Map<string, Binding>;
    function: boolean;
  };
  const scopes = new WeakMap<object, Scope>();
  const rootScope: Scope = { bindings: new Map(), function: true };
  const children = (node: any, visit: (child: any) => void) => {
    for (const [key, value] of Object.entries(node)) {
      if (
        [
          'loc',
          'comments',
          'leadingComments',
          'trailingComments',
          'innerComments',
        ].includes(key)
      )
        continue;
      for (const child of Array.isArray(value) ? value : [value])
        if (child && typeof child === 'object' && 'type' in child) visit(child);
    }
  };
  const bindPattern = (pattern: any, scope: Scope, initializer?: any) => {
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      scope.bindings.set(pattern.name, { scope, initializer });
    } else if (pattern.type === 'RestElement')
      bindPattern(pattern.argument, scope);
    else if (pattern.type === 'AssignmentPattern')
      bindPattern(pattern.left, scope);
    else if (pattern.type === 'ArrayPattern')
      for (const element of pattern.elements) bindPattern(element, scope);
    else if (pattern.type === 'ObjectPattern')
      for (const property of pattern.properties)
        bindPattern(
          property.type === 'RestElement' ? property.argument : property.value,
          scope,
        );
  };
  // Bind the entire lexical scope before inspecting references, including shadows
  // declared later in a block. Only immutable string expressions are evaluated.
  const indexScopes = (node: any, parent: Scope, functionBody = false) => {
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration')
      bindPattern(node.id, parent);
    const isFunction =
      /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ObjectMethod|ClassMethod|ClassPrivateMethod)$/u.test(
        node.type,
      );
    const createsScope =
      isFunction ||
      /^(?:BlockStatement|CatchClause|ForStatement|ForInStatement|ForOfStatement|SwitchStatement|ClassDeclaration|ClassExpression|StaticBlock|TSModuleBlock)$/u.test(
        node.type,
      );
    const scope: Scope = createsScope
      ? {
          parent,
          bindings: new Map(),
          function:
            isFunction ||
            functionBody ||
            node.type === 'StaticBlock' ||
            node.type === 'TSModuleBlock',
        }
      : parent;
    scopes.set(node, scope);
    if (isFunction) {
      bindPattern(node.id, scope);
      for (const parameter of node.params) bindPattern(parameter, scope);
    }
    if (node.type === 'ClassExpression' || node.type === 'ClassDeclaration')
      bindPattern(node.id, scope);
    if (node.type === 'CatchClause') bindPattern(node.param, scope);
    if (node.type === 'VariableDeclaration') {
      let owner = scope;
      while (node.kind === 'var' && !owner.function && owner.parent)
        owner = owner.parent;
      for (const declaration of node.declarations)
        bindPattern(
          declaration.id,
          owner,
          node.kind === 'const' && declaration.id.type === 'Identifier'
            ? declaration.init
            : undefined,
        );
    }
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) {
        bindPattern(specifier.local, scope);
        const binding = scope.bindings.get(specifier.local.name)!;
        binding.factory =
          ['node:module', 'module'].includes(node.source.value) &&
          node.importKind !== 'type' &&
          specifier.importKind !== 'type' &&
          specifier.type === 'ImportSpecifier' &&
          (specifier.imported.name ?? specifier.imported.value) ===
            'createRequire';
      }
    }
    children(node, child =>
      indexScopes(
        child,
        node.type === 'SwitchStatement' && child === node.discriminant
          ? parent
          : scope,
        isFunction && child === node.body,
      ),
    );
  };
  indexScopes(parsed.program, rootScope);
  const lookup = (node: any): Binding | undefined => {
    for (let scope = scopes.get(node); scope; scope = scope.parent)
      if (scope.bindings.has(node.name)) return scope.bindings.get(node.name);
    return undefined;
  };
  const unwrap = (node: any): any => {
    while (
      node &&
      [
        'TSAsExpression',
        'TSTypeAssertion',
        'TSNonNullExpression',
        'TSSatisfiesExpression',
        'ParenthesizedExpression',
      ].includes(node.type)
    )
      node = node.expression;
    return node;
  };
  const loaderKind = (
    expression: any,
    seen = new Set<Binding>(),
  ): 'factory' | 'require' | undefined => {
    const node = unwrap(expression);
    if (!node || seen.size >= 64) return undefined;
    if (node.type === 'Identifier') {
      const binding = lookup(node);
      if (!binding) return node.name === 'require' ? 'require' : undefined;
      if (binding.factory) return 'factory';
      if (seen.has(binding)) return undefined;
      return loaderKind(binding.initializer, new Set([...seen, binding]));
    }
    if (
      node.type === 'CallExpression' &&
      loaderKind(node.callee, seen) === 'factory'
    )
      return 'require';
    return undefined;
  };
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const staticSources = new Set<number>();
  for (const statement of parsed.program.body) {
    if (
      ![
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
      ].includes(statement.type)
    )
      continue;
    const declaration = statement as any;
    const module = declaration.source?.value;
    if (!direct.has(module) && !aggregate.has(module)) continue;
    staticSources.add(declaration.source.start);
    const replacement = direct.get(module);
    if (replacement) {
      edits.push({
        start: declaration.source.start + 1,
        end: declaration.source.end - 1,
        text: replacement,
      });
      dependencies.add(packageName(replacement));
      continue;
    }
    if (
      !declaration.specifiers?.length ||
      declaration.specifiers.some(
        (item: any) =>
          !['ImportSpecifier', 'ExportSpecifier'].includes(item.type),
      )
    ) {
      return conflict(
        file,
        `ambiguous aggregate import/export from ${module}; select explicit named owners`,
      );
    }
    if (
      declaration.attributes?.length ||
      declaration.assertions?.length ||
      declaration.phase
    )
      return conflict(file, `unsupported module attributes on ${module}`);
    const nameOf = (specifier: any) => {
      const imported = specifier.imported ?? specifier.local;
      return imported.name ?? imported.value;
    };
    const names = declaration.specifiers.map(nameOf) as string[];
    const hasEffectName = names.some(
      name => nodeOwners.has(name) && !ambiguousNativeNames.has(name),
    );
    const hasNativeName = names.some(name => !nodeOwners.has(name));
    const targets = declaration.specifiers.map((specifier: any) => {
      const name = nameOf(specifier);
      let owner = nodeOwners.get(name);
      const edge = module === `${native}/effect-edge`;
      if (edge) {
        owner = edgeFederation.has(name)
          ? `${lower}/backend-federation/edge`
          : (owner && !owner.startsWith(lower)) || edgeOnly.has(name)
            ? `${effect}/effect-edge`
            : undefined;
      } else if (module === `${native}/server`) {
        if (ambiguousNativeNames.has(name)) {
          if (hasEffectName === hasNativeName)
            return conflict(
              file,
              `ambiguous ${name} from native /server; select its Hono or Effect owner`,
            );
          if (hasNativeName) owner = module;
        } else if (!owner) owner = module;
      }
      if (!owner)
        return conflict(file, `unknown named export ${name} from ${module}`);
      return {
        specifier,
        owner,
        namespace: !edge && namespaces.has(name) && owner !== module,
      };
    });
    if (targets.every((target: any) => target.owner === module)) continue;
    for (const target of targets) dependencies.add(packageName(target.owner));
    const first = targets[0];
    if (
      targets.every(
        (target: any) => target.owner === first.owner && !target.namespace,
      )
    ) {
      edits.push({
        start: declaration.source.start + 1,
        end: declaration.source.end - 1,
        text: first.owner,
      });
      continue;
    }
    const retainedRanges = targets
      .filter((target: any) => !target.namespace)
      .map((target: any) => target.specifier);
    const comments = (parsed.comments ?? []).filter(
      comment =>
        comment.start! >= declaration.start &&
        comment.end! <= declaration.end &&
        !retainedRanges.some(
          (range: any) =>
            comment.start! >= range.start && comment.end! <= range.end,
        ),
    );
    const prefix = comments
      .map(comment => source.slice(comment.start!, comment.end!))
      .join(newline);
    const quote = source[declaration.source.start];
    const isImport = declaration.type === 'ImportDeclaration';
    const keyword = isImport ? 'import' : 'export';
    const lines: string[] = [];
    const groups = new Map<string, string[]>();
    for (const target of targets) {
      const specifier = target.specifier;
      if (target.namespace) {
        const binding = isImport ? specifier.local : specifier.exported;
        if (binding.type !== 'Identifier')
          return conflict(file, 'namespace export alias must be an identifier');
        const typeOnly =
          declaration.importKind === 'type' ||
          declaration.exportKind === 'type' ||
          specifier.importKind === 'type' ||
          specifier.exportKind === 'type';
        lines.push(
          `${keyword}${typeOnly ? ' type' : ''} * as ${binding.name} from ${quote}${target.owner}${quote};`,
        );
      } else {
        const group = groups.get(target.owner) ?? [];
        group.push(source.slice(specifier.start, specifier.end));
        groups.set(target.owner, group);
      }
    }
    for (const [owner, specifiers] of groups) {
      const typeOnly =
        declaration.importKind === 'type' || declaration.exportKind === 'type';
      lines.push(
        `${keyword}${typeOnly ? ' type' : ''} { ${specifiers.join(', ')} } from ${quote}${owner}${quote};`,
      );
    }
    edits.push({
      start: declaration.start,
      end: declaration.end,
      text: (prefix ? prefix + newline : '') + lines.join(newline),
    });
  }
  const unknownString = '\0';
  const stringExpression = (
    expression: any,
    seen = new Set<Binding>(),
    depth = 0,
  ): string | undefined => {
    const node = unwrap(expression);
    if (!node || depth >= 64) return undefined;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'Identifier') {
      const binding = lookup(node);
      if (!binding || seen.has(binding)) return undefined;
      return stringExpression(
        binding.initializer,
        new Set([...seen, binding]),
        depth + 1,
      );
    }
    let value: string | undefined;
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      value =
        (stringExpression(node.left, seen, depth + 1) ?? unknownString) +
        (stringExpression(node.right, seen, depth + 1) ?? unknownString);
    }
    if (node.type === 'TemplateLiteral') {
      value = node.quasis
        .map(
          (quasi: any, index: number) =>
            (quasi.value.cooked ?? quasi.value.raw) +
            (index < node.expressions.length
              ? (stringExpression(node.expressions[index], seen, depth + 1) ??
                unknownString)
              : ''),
        )
        .join('');
    }
    return value && value.length > 4096
      ? value.slice(0, 4096) + unknownString
      : value;
  };
  const retiredReference = (node: any): string | undefined => {
    const value = stringExpression(node);
    if (!value) return undefined;
    if (direct.has(value) || aggregate.has(value)) return value;
    if (!value.includes(unknownString) || !value.includes(native))
      return undefined;
    const pattern = new RegExp(
      `^${value
        .split(unknownString)
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('[\\s\\S]*')}$`,
      'u',
    );
    return [...direct.keys(), ...aggregate].find(module =>
      pattern.test(module),
    );
  };
  const inspect = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const node = value as any;
    const argument =
      node.type === 'ImportExpression'
        ? node.source
        : node.type === 'TSImportType'
          ? (node.source ?? node.argument)
          : node.type === 'CallExpression' &&
              (node.callee?.type === 'Import' ||
                loaderKind(node.callee) === 'require' ||
                (node.callee?.property?.name === 'resolve' &&
                  loaderKind(node.callee?.object) === 'require'))
            ? node.arguments?.[0]
            : undefined;
    const retired = retiredReference(argument);
    if (retired && !staticSources.has(argument.start)) {
      conflict(
        file,
        `dynamic or require reference to ${retired} needs explicit owner migration`,
      );
    }
    for (const [key, child] of Object.entries(node))
      if (
        ![
          'loc',
          'comments',
          'leadingComments',
          'trailingComments',
          'innerComments',
        ].includes(key)
      ) {
        if (Array.isArray(child)) child.forEach(inspect);
        else inspect(child);
      }
  };
  inspect(parsed.program);
  let migrated = source;
  for (const edit of edits.sort((left, right) => right.start - left.start))
    migrated =
      migrated.slice(0, edit.start) + edit.text + migrated.slice(edit.end);
  return { source: migrated, dependencies };
}

/** Preflight source and target dependency provenance before staging any consumer write. */
export function migrateBffRuntimeImports(
  io: MigrationIo,
  packageSource: ResolvedPackageSource,
  releaseCohort?: Pick<UltramodernReleaseCohort, 'packages'>,
  scope: {
    appDirectories?: readonly string[];
    workspacePatterns?: readonly string[];
  } = {},
) {
  const manifestPaths = listWorkspacePackageFiles(io.workspaceRoot, scope);
  for (const file of manifestPaths) {
    const stat = fs.lstatSync(path.join(io.workspaceRoot, file));
    if (!stat.isFile() || stat.isSymbolicLink())
      conflict(file, 'package manifest must be a regular owned file');
  }
  const roots = new Set([
    'apps',
    'verticals',
    'packages',
    'scripts',
    'src',
    ...manifestPaths
      .filter(file => file !== 'package.json')
      .map(file => path.dirname(file)),
  ]);
  const excluded = new Set([
    'node_modules',
    '.git',
    '.nx',
    '.modernjs',
    '.modern-js',
    '.output',
    'dist',
    'coverage',
  ]);
  const files = new Set<string>();
  const visit = (directory: string, recurse: boolean) => {
    const absolute = path.join(io.workspaceRoot, directory);
    const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) conflict(directory, 'symbolic source directory');
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const relative = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        if (recurse || /\.[cm]?[jt]sx?$/u.test(entry.name))
          conflict(relative, 'symbolic source file');
      } else if (entry.isDirectory()) {
        if (recurse) visit(relative, true);
      } else if (/\.[cm]?[jt]sx?$/u.test(entry.name)) files.add(relative);
    }
  };
  visit('', false);
  for (const root of roots) visit(root, true);
  const edits = new Map<string, string>();
  const manifests = new Map<string, Record<string, any>>();
  for (const file of [...files].sort()) {
    const absolute = path.join(io.workspaceRoot, file);
    const source = fs.readFileSync(absolute, 'utf8');
    const migrated = migrateBffRuntimeSource(source, file);
    if (migrated.source === source) continue;
    edits.set(file, migrated.source);
    let owner = path.dirname(file);
    while (
      owner !== '.' &&
      !manifestPaths.includes(
        path.join(owner, 'package.json').split(path.sep).join('/'),
      )
    )
      owner = path.dirname(owner);
    const manifestFile =
      owner === '.' ? 'package.json' : path.join(owner, 'package.json');
    const manifest =
      manifests.get(manifestFile) ??
      readJsonFile(path.join(io.workspaceRoot, manifestFile));
    const dependencies =
      manifest.dependencies === undefined ? {} : manifest.dependencies;
    if (
      !dependencies ||
      typeof dependencies !== 'object' ||
      Array.isArray(dependencies)
    )
      conflict(manifestFile, 'dependencies must be an object');
    for (const dependency of migrated.dependencies) {
      if (dependency.startsWith('@modern-js/')) {
        if (
          releaseCohort &&
          !releaseCohort.packages.some(
            item =>
              item.sourceName === dependency &&
              item.version === packageSource.modernPackageVersion,
          )
        )
          conflict(
            manifestFile,
            `${dependency} is absent from the authenticated target cohort`,
          );
        dependencies[dependency] = modernPackageSpecifier(
          dependency,
          packageSource,
        );
      } else if (dependency === 'effect' && dependencies.effect === undefined) {
        const selected =
          manifest.peerDependencies?.effect ??
          manifest.optionalDependencies?.effect ??
          manifest.devDependencies?.effect;
        dependencies.effect =
          selected ?? ULTRAMODERN_PACKAGE_PINS.bffEffectDependencies.effect;
      }
    }
    manifest.dependencies = dependencies;
    manifests.set(manifestFile, manifest);
  }
  for (const [file, source] of edits)
    io.write(path.join(io.workspaceRoot, file), source);
  for (const [file, manifest] of manifests)
    io.write(
      path.join(io.workspaceRoot, file),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  if (edits.size)
    io.log(
      `BFF runtime: migrated ${edits.size} source files to their canonical package owners.`,
    );
}
