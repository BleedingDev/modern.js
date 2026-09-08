import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript/unstable/ast';
import { createVirtualFileSystem } from 'typescript/unstable/fs';
import { API, type Checker } from 'typescript/unstable/sync';

const edge = '@modern-js/plugin-bff/effect-edge';
const sharedRuntime = /^@[^/]+\/shared-contracts\/server\/effect-bff-runtime$/u;
const failure =
  'Generated API entries must export defineEffectBff(...) or the server-only shared Effect BFF assembly helper with an explicitly composed handler Layer and an unshadowed executable root; entries must implement handlers through HttpApiBuilder.group.';

/** A bounded, owner-local source resolver; never executes application modules. */
export interface EffectApiSource {
  readonly id: string;
  readonly source: string;
  readonly resolveImport?: (specifier: string) => EffectApiSource | undefined;
}
export type EffectApiImportResolver = (
  specifier: string,
) => EffectApiSource | undefined;

export function createEffectApiImportResolver(
  filename: string,
): EffectApiImportResolver {
  const owner = path.resolve(path.dirname(filename), '..');
  const resolve =
    (from: string): EffectApiImportResolver =>
    specifier => {
      if (!specifier.startsWith('.')) return undefined;
      const target = path.resolve(path.dirname(from), specifier);
      if (!target.startsWith(`${owner}${path.sep}`)) return undefined;
      for (const candidate of [target, `${target}.ts`, `${target}.mts`]) {
        try {
          const real = fs.realpathSync(candidate);
          if (
            !real.startsWith(`${fs.realpathSync(owner)}${path.sep}`) ||
            fs.statSync(real).size > 1_000_000
          )
            return undefined;
          return {
            id: real,
            source: fs.readFileSync(real, 'utf8'),
            resolveImport: resolve(real),
          };
        } catch {
          /* Missing imports fail closed when their implementation is needed. */
        }
      }
      return undefined;
    };
  return resolve(filename);
}

/** Proves binding identity and an exported composition, not the occurrence of names. */
export function strictEffectRuntimeTopologyViolation(
  source: string,
  resolveImport?: EffectApiImportResolver,
): string | undefined {
  const compilers: API[] = [];
  const checkers = new Map<ts.SourceFile, Checker>();
  const modules = new Map<
    string,
    { file: ts.SourceFile; resolve?: EffectApiImportResolver }
  >();
  const load = (input: EffectApiSource): ts.SourceFile => {
    const existing = modules.get(input.id);
    if (existing) return existing.file;
    if (modules.size >= 64 || input.source.length > 1_000_000)
      throw new Error('API source budget exceeded');
    const virtual = createVirtualFileSystem({ [input.id]: input.source });
    const compiler = new API({
      fs: {
        ...virtual,
        readFile: name => virtual.readFile?.(name) ?? null,
        getAccessibleEntries: name =>
          virtual.getAccessibleEntries?.(name) ?? {
            files: [],
            directories: [],
          },
      },
    });
    compilers.push(compiler);
    const snapshot = compiler.updateSnapshot({ openFiles: [input.id] });
    const project = snapshot.getDefaultProjectForFile(input.id);
    const file = project?.program.getSourceFile(input.id);
    if (
      !project ||
      !file ||
      project.program.getSyntacticDiagnostics(input.id).length ||
      project.program.getBindDiagnostics(input.id).length
    )
      throw new Error('Invalid API syntax');
    checkers.set(file, project.checker);
    modules.set(input.id, { file, resolve: input.resolveImport });
    return file;
  };
  try {
    const file = load({ id: '/entry.ts', source, resolveImport });
    const checker = (node: ts.Node): Checker =>
      checkers.get(node.getSourceFile())!;
    const unwrap = (node: ts.Expression): ts.Expression => {
      while (
        ts.isParenthesizedExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isAssertionExpression(node) ||
        ts.isNonNullExpression(node)
      )
        node = node.expression;
      return node;
    };
    const declaration = (node: ts.Expression): ts.Node | undefined => {
      node = unwrap(node);
      const symbol = ts.isIdentifier(node)
        ? ts.isShorthandPropertyAssignment(node.parent)
          ? checker(node).getShorthandAssignmentValueSymbol(node.parent)
          : checker(node).getSymbolAtLocation(node)
        : undefined;
      const declarations = symbol?.declarations;
      return declarations?.length === 1 ? declarations[0].resolve() : undefined;
    };
    const imported = (node: ts.Expression) => {
      const decl = declaration(node);
      if (!decl || !ts.isImportSpecifier(decl) || decl.isTypeOnly)
        return undefined;
      const clause = decl.parent.parent;
      if (
        !ts.isImportClause(clause) ||
        clause.phaseModifier === ts.SyntaxKind.TypeKeyword
      )
        return undefined;
      const statement = clause.parent;
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLikeNode(statement.moduleSpecifier)
      )
        return undefined;
      return {
        name: (decl.propertyName ?? decl.name).text,
        specifier: statement.moduleSpecifier.text,
        decl,
      };
    };
    const native = (
      node: ts.Expression,
      name: string,
      sources = [edge],
    ): boolean => {
      const binding = imported(node);
      return binding?.name === name && sources.includes(binding.specifier);
    };
    const method = (
      node: ts.Expression,
      namespace: string,
      member: string,
      sources = [edge],
    ): boolean => {
      node = unwrap(node);
      return (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === member &&
        native(node.expression, namespace, sources)
      );
    };
    const initialized = (node: ts.Expression): ts.Expression | undefined => {
      const decl = declaration(node);
      return decl &&
        ts.isVariableDeclaration(decl) &&
        ts.isVariableDeclarationList(decl.parent) &&
        (decl.parent.flags & ts.NodeFlags.Const) !== 0
        ? decl.initializer
        : undefined;
    };
    const moduleFor = (node: ts.Expression) => {
      const binding = imported(node);
      if (!binding) return undefined;
      const resolver = modules.get(node.getSourceFile().fileName)?.resolve;
      const input = resolver?.(binding.specifier);
      return input ? { file: load(input), name: binding.name } : undefined;
    };
    const exported = (
      file: ts.SourceFile,
      name: string,
    ): ts.Expression | undefined => {
      for (const statement of file.statements) {
        if (
          ts.isVariableStatement(statement) &&
          statement.modifiers?.some(
            modifier => modifier.kind === ts.SyntaxKind.ExportKeyword,
          )
        ) {
          for (const decl of statement.declarationList.declarations)
            if (ts.isIdentifier(decl.name) && decl.name.text === name)
              return decl.name;
        }
        if (
          ts.isExportDeclaration(statement) &&
          !statement.moduleSpecifier &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          const specifier = statement.exportClause.elements.find(
            element => element.name.text === name && !element.isTypeOnly,
          );
          if (specifier) return specifier.propertyName ?? specifier.name;
        }
      }
      return undefined;
    };
    const externalValue = (node: ts.Expression): ts.Expression | undefined => {
      const module = moduleFor(node);
      return module ? exported(module.file, module.name) : undefined;
    };
    const apiIdentity = (
      node: ts.Expression,
      seen = new Set<ts.Node>(),
    ): string | undefined => {
      node = unwrap(node);
      if (seen.has(node)) return undefined;
      seen.add(node);
      const binding = imported(node);
      if (binding) {
        if (!binding.specifier.startsWith('.')) return undefined;
        const module = moduleFor(node);
        const value = module && exported(module.file, module.name);
        if (value) return apiIdentity(value, seen);
        // Missing exports remain TypeScript's diagnostic; preserve the named import's
        // identity here rather than conflating it with another contract binding.
        if (
          module &&
          /(?:^|\/)shared\/(?:api|rpc)\.ts$/u.test(binding.specifier)
        )
          return `${module.file.fileName}:import:${binding.name}`;
        if (
          !modules.get(node.getSourceFile().fileName)?.resolve &&
          /(?:^|\/)shared\/(?:api|rpc)\.ts$/u.test(binding.specifier)
        )
          return `${binding.specifier}:${binding.name}`;
        return undefined;
      }
      const init = initialized(node);
      if (init && ts.isIdentifier(unwrap(init))) return apiIdentity(init, seen);
      const decl = declaration(node);
      return decl ? `${decl.getSourceFile().fileName}:${decl.pos}` : undefined;
    };
    const properties = (
      node: ts.Expression,
    ): Map<string, ts.Expression> | undefined => {
      node = unwrap(node);
      if (!ts.isObjectLiteralExpression(node)) return undefined;
      const result = new Map<string, ts.Expression>();
      for (const prop of node.properties) {
        if (
          (!ts.isPropertyAssignment(prop) &&
            !ts.isShorthandPropertyAssignment(prop)) ||
          !ts.isIdentifier(prop.name) ||
          result.has(prop.name.text)
        )
          return undefined;
        result.set(
          prop.name.text,
          ts.isPropertyAssignment(prop) ? prop.initializer : prop.name,
        );
      }
      return result;
    };
    const active = new Set<ts.Node>();
    const guarded = (
      node: ts.Expression,
      check: (node: ts.Expression) => boolean,
    ): boolean => {
      node = unwrap(node);
      if (active.has(node) || active.size > 128) return false;
      active.add(node);
      try {
        return check(node);
      } finally {
        active.delete(node);
      }
    };
    const layerSources = [edge, 'effect'];
    const pipe = (
      node: ts.CallExpression,
      check: (node: ts.Expression) => boolean,
    ): boolean =>
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'pipe' &&
      check(node.expression.expression) &&
      node.arguments.every(
        argument =>
          method(argument, 'Layer', 'orDie', layerSources) ||
          (ts.isCallExpression(argument) &&
            method(argument.expression, 'Layer', 'provide', layerSources) &&
            argument.arguments.length > 0),
      );
    const handled = (node: ts.Expression): boolean => {
      node = unwrap(node);
      if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node))
        return false;
      const parameter = node.parameters[0];
      if (!parameter || !ts.isIdentifier(parameter.name)) return false;
      const body = ts.isBlock(node.body)
        ? node.body.statements.length === 1 &&
          ts.isReturnStatement(node.body.statements[0])
          ? node.body.statements[0].expression
          : undefined
        : node.body;
      const chain = (value: ts.Expression, count = 0): boolean => {
        value = unwrap(value);
        if (ts.isIdentifier(value))
          return count > 0 && declaration(value) === parameter;
        return (
          ts.isCallExpression(value) &&
          ts.isPropertyAccessExpression(value.expression) &&
          ['handle', 'handleRaw'].includes(value.expression.name.text) &&
          value.arguments.length === 2 &&
          chain(value.expression.expression, count + 1)
        );
      };
      return body !== undefined && chain(body);
    };
    const handlers = (node: ts.Expression, api: string): boolean =>
      guarded(node, node => {
        const init = initialized(node) ?? externalValue(node);
        if (init) return handlers(init, api);
        if (!ts.isCallExpression(node)) return false;
        if (pipe(node, value => handlers(value, api))) return true;
        if (method(node.expression, 'Layer', 'mergeAll', layerSources))
          return (
            node.arguments.length > 0 &&
            node.arguments.every(argument => handlers(argument, api))
          );
        return (
          method(node.expression, 'HttpApiBuilder', 'group') &&
          node.arguments.length === 3 &&
          apiIdentity(node.arguments[0]) === api &&
          handled(node.arguments[2])
        );
      });
    const transport = (node: ts.Expression): boolean =>
      guarded(node, node => {
        const init = initialized(node);
        if (init) return transport(init);
        if (!ts.isCallExpression(node))
          return method(node, 'Layer', 'empty', layerSources);
        return (
          pipe(node, transport) ||
          method(node.expression, 'HttpRouter', 'cors') ||
          (method(node.expression, 'Layer', 'mergeAll', layerSources) &&
            node.arguments.length > 0 &&
            node.arguments.every(transport))
        );
      });
    const directLayer = (node: ts.Expression, api: string): boolean =>
      guarded(node, node => {
        const init = initialized(node);
        if (init) return directLayer(init, api);
        if (
          !ts.isCallExpression(node) ||
          !ts.isPropertyAccessExpression(node.expression) ||
          node.expression.name.text !== 'pipe'
        )
          return false;
        const base = unwrap(node.expression.expression);
        return (
          ts.isCallExpression(base) &&
          method(base.expression, 'HttpApiBuilder', 'layer') &&
          base.arguments.length === 1 &&
          apiIdentity(base.arguments[0]) === api &&
          node.arguments.length > 0 &&
          node.arguments.every(
            argument =>
              ts.isCallExpression(argument) &&
              method(argument.expression, 'Layer', 'provide', layerSources) &&
              argument.arguments.length === 1 &&
              handlers(argument.arguments[0], api),
          )
        );
      });
    const rpc = (values: Map<string, ts.Expression>): boolean => {
      const api = values.get('api');
      const apiLayer = values.get('layer');
      const apiInit = api && (initialized(api) ?? unwrap(api));
      if (
        !apiInit ||
        !ts.isCallExpression(apiInit) ||
        !method(apiInit.expression, 'HttpApi', 'make') ||
        apiInit.arguments.length !== 1 ||
        !apiLayer ||
        !transport(apiLayer)
      )
        return false;
      const config = values.get('rpc');
      const fields = config && properties(config);
      const route = fields?.get('path');
      const serialization = fields?.get('serialization');
      if (
        !route ||
        !ts.isStringLiteralLikeNode(route) ||
        route.text !== '/rpc' ||
        !serialization ||
        !ts.isStringLiteralLikeNode(serialization) ||
        serialization.text !== 'json'
      )
        return false;
      const group = fields?.get('group');
      const layer = fields?.get('layer');
      const binding = group && imported(group);
      if (
        !group ||
        !layer ||
        !binding ||
        binding.specifier !== '../shared/rpc.ts'
      )
        return false;
      const groupValue = externalValue(group);
      const groupInit = groupValue && initialized(groupValue);
      if (
        !groupInit ||
        !ts.isCallExpression(groupInit) ||
        !method(groupInit.expression, 'RpcGroup', 'make', [
          'effect/unstable/rpc',
          '@modern-js/plugin-bff/effect-client',
        ])
      )
        return false;
      const layerInit = initialized(layer) ?? unwrap(layer);
      if (
        !ts.isCallExpression(layerInit) ||
        !ts.isPropertyAccessExpression(layerInit.expression) ||
        layerInit.expression.name.text !== 'toLayer' ||
        apiIdentity(layerInit.expression.expression) !== apiIdentity(group) ||
        layerInit.arguments.length !== 1
      )
        return false;
      const implementation = unwrap(layerInit.arguments[0]);
      if (
        !ts.isCallExpression(implementation) ||
        !ts.isPropertyAccessExpression(implementation.expression) ||
        implementation.expression.name.text !== 'of' ||
        apiIdentity(implementation.expression.expression) !==
          apiIdentity(group) ||
        implementation.arguments.length !== 1
      )
        return false;
      const entries = properties(implementation.arguments[0]);
      return (
        !!entries?.size &&
        [...entries.values()].every(
          value => ts.isArrowFunction(value) || ts.isFunctionExpression(value),
        )
      );
    };
    const runtime = (node: ts.Expression): boolean =>
      guarded(node, node => {
        const init = initialized(node);
        if (init) return runtime(init);
        if (!ts.isCallExpression(node)) return false;
        const binding = imported(node.expression);
        if (
          (binding?.name === 'defineEffectBff' && binding.specifier === edge) ||
          (binding?.name === 'assembleEffectBffRuntime' &&
            sharedRuntime.test(binding.specifier))
        ) {
          if (node.arguments.length !== 1) return false;
          const values = properties(node.arguments[0]);
          if (!values) return false;
          if (binding.name === 'defineEffectBff' && values.has('rpc'))
            return rpc(values);
          const api = values.get('api');
          const apiBinding = api && imported(api);
          if (
            !api ||
            !apiBinding ||
            apiBinding.specifier !== '../shared/api.ts'
          )
            return false;
          const identity = apiIdentity(api);
          if (!identity) return false;
          const layer = values.get(
            binding.name === 'defineEffectBff' ? 'layer' : 'handlers',
          );
          const extra = values.get('transport');
          return (
            layer !== undefined &&
            (binding.name === 'defineEffectBff'
              ? directLayer(layer, identity)
              : handlers(layer, identity)) &&
            (!extra || transport(extra))
          );
        }
        // Only zero-argument straight-line factories prove all return paths. No dead branches.
        const decl = declaration(node.expression);
        const factory =
          decl && ts.isFunctionDeclaration(decl)
            ? decl
            : initialized(node.expression);
        if (
          !factory ||
          (!ts.isFunctionDeclaration(factory) &&
            !ts.isArrowFunction(factory) &&
            !ts.isFunctionExpression(factory)) ||
          factory.parameters.length ||
          node.arguments.length ||
          !factory.body
        )
          return false;
        if (!ts.isBlock(factory.body)) return runtime(factory.body);
        const statements = factory.body.statements;
        const last = statements.at(-1);
        return (
          statements.slice(0, -1).every(ts.isVariableStatement) &&
          !!last &&
          ts.isReturnStatement(last) &&
          !!last.expression &&
          runtime(last.expression)
        );
      });
    const root = file.statements.find(ts.isExportAssignment);
    return root && !root.isExportEquals && runtime(root.expression)
      ? undefined
      : failure;
  } catch {
    return failure;
  } finally {
    for (const compiler of compilers) compiler.close();
  }
}
