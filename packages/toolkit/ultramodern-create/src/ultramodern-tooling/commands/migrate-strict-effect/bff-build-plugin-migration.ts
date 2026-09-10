import { parse } from '@babel/parser';

const buildPackage = '@modern-js/plugin-bff-build-extensions';

// Follow only static exported-config paths, never arbitrary callbacks or metadata.
function isSupportedForkConfig(parsed: ReturnType<typeof parse>): boolean {
  const imports = new Map<string, { source: string; name: string }>();
  const constants = new Map<string, any>();
  const declarations = new Set<number>();
  const resolvedReferences = new Map<string, Set<number>>();
  const exports: any[] = [];
  for (const statement of parsed.program.body) {
    if (
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type'
    ) {
      for (const specifier of statement.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type'
        )
          continue;
        imports.set(specifier.local.name, {
          source: statement.source.value,
          name:
            specifier.type === 'ImportNamespaceSpecifier'
              ? '*'
              : specifier.type === 'ImportDefaultSpecifier'
                ? 'default'
                : specifier.imported.type === 'Identifier'
                  ? specifier.imported.name
                  : specifier.imported.value,
        });
      }
    }
    const variables =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
    if (
      variables?.type === 'VariableDeclaration' &&
      variables.kind === 'const'
    ) {
      for (const declaration of variables.declarations) {
        if (declaration.id.type === 'Identifier' && declaration.init) {
          constants.set(declaration.id.name, declaration.init);
          declarations.add(declaration.id.start!);
        }
      }
    }
    if (statement.type === 'ExportDefaultDeclaration')
      exports.push(statement.declaration);
    if (statement.type === 'ExportNamedDeclaration' && !statement.source) {
      for (const specifier of statement.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          (specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value) === 'default'
        )
          exports.push(specifier.local);
      }
    }
  }
  const resolve = (value: any, seen = new Set<string>()): any => {
    if (
      [
        'TSAsExpression',
        'TSSatisfiesExpression',
        'TSNonNullExpression',
        'ParenthesizedExpression',
      ].includes(value?.type)
    )
      return resolve(value.expression, seen);
    if (
      value?.type !== 'Identifier' ||
      !constants.has(value.name) ||
      seen.has(value.name)
    )
      return value;
    seen.add(value.name);
    const references = resolvedReferences.get(value.name) ?? new Set<number>();
    references.add(value.start);
    resolvedReferences.set(value.name, references);
    return resolve(constants.get(value.name), seen);
  };
  const propertyName = (property: any): string | undefined =>
    !property.computed && property.key?.type === 'Identifier'
      ? property.key.name
      : property.key?.type === 'StringLiteral'
        ? property.key.value
        : undefined;
  const origin = (value: any) => {
    const callee = resolve(value);
    if (callee?.type === 'Identifier') return imports.get(callee.name);
    if (callee?.type === 'MemberExpression') {
      const object = resolve(callee.object);
      const imported =
        object?.type === 'Identifier' ? imports.get(object.name) : undefined;
      const name =
        !callee.computed && callee.property.type === 'Identifier'
          ? callee.property.name
          : callee.property.type === 'StringLiteral'
            ? callee.property.value
            : undefined;
      if (imported?.name === '*' && name) return { ...imported, name };
    }
    return undefined;
  };
  const objectMembers = (
    value: any,
    seen = new Set<any>(),
  ): Map<string, any> | undefined => {
    const object = resolve(value);
    if (object?.type !== 'ObjectExpression' || seen.has(object))
      return undefined;
    seen = new Set(seen).add(object);
    const members = new Map<string, any>();
    for (const property of object.properties) {
      if (property.type === 'SpreadElement') {
        const spread = objectMembers(property.argument, seen);
        if (!spread) return undefined;
        for (const [name, entry] of spread) members.set(name, entry);
      } else {
        const name = propertyName(property);
        if (!name) return undefined;
        members.set(name, property.value);
      }
    }
    return members;
  };
  const effectBff = (value: any) => {
    const runtime = resolve(objectMembers(value)?.get('runtimeFramework'));
    return runtime?.type === 'StringLiteral' && runtime.value === 'effect';
  };
  const inspect = (
    value: any,
    mode: 'config' | 'plugins',
    seen = new Set<any>(),
  ): boolean => {
    const node = resolve(value);
    if (!node || seen.has(node)) return false;
    seen = new Set(seen).add(node);
    if (node.type === 'CallExpression') {
      const imported = origin(node.callee);
      if (
        imported &&
        ((imported.source === '@modern-js/ultramodern-app-tools' &&
          ['ultramodernAppTools', 'presetUltramodern'].includes(
            imported.name,
          )) ||
          (imported.source === '@modern-js/app-tools' &&
            imported.name === 'presetUltramodern'))
      )
        return true;
      return (
        mode === 'config' &&
        imported?.source === '@modern-js/app-tools' &&
        imported.name === 'defineConfig' &&
        node.arguments.length === 1 &&
        inspect(node.arguments[0], 'config', seen)
      );
    }
    if (node.type === 'ArrayExpression' && mode === 'plugins')
      return node.elements.some((element: any) =>
        inspect(element, 'plugins', seen),
      );
    if (node.type !== 'ObjectExpression' || mode !== 'config') return false;
    const members = objectMembers(node);
    return Boolean(
      members &&
        (inspect(members.get('plugins'), 'plugins', seen) ||
          effectBff(members.get('bff'))),
    );
  };
  if (exports.length !== 1 || !inspect(exports[0], 'config')) return false;

  // Const bindings can still point at mutable arrays/objects. Any reference
  // outside the proven config path is a possible mutation or escape.
  let confined = true;
  const visit = (value: any, parent?: any, key?: string): void => {
    if (!confined || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, parent, key);
      return;
    }
    const references =
      value.type === 'Identifier'
        ? resolvedReferences.get(value.name)
        : undefined;
    if (
      references &&
      !references.has(value.start) &&
      !declarations.has(value.start)
    ) {
      const staticKey = key === 'key' && !parent?.computed;
      const staticProperty =
        key === 'property' &&
        !parent?.computed &&
        ['MemberExpression', 'OptionalMemberExpression'].includes(parent?.type);
      const exportName =
        key === 'exported' && parent?.type === 'ExportSpecifier';
      if (!staticKey && !staticProperty && !exportName) {
        confined = false;
        return;
      }
    }
    for (const [childKey, child] of Object.entries(value))
      visit(child, value, childKey);
  };
  visit(parsed.program);
  return confined;
}

/** Move only static build imports; preserve consumer programs and runtime subpaths. */
export function migrateBffBuildPluginImports(source: string): string {
  try {
    const parsed = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      tokens: true,
    });
    if (!isSupportedForkConfig(parsed)) return source;
    const edits: Array<{ start: number; end: number; content: string }> = [];
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    for (const statement of parsed.program.body) {
      if (
        statement.type !== 'ImportDeclaration' ||
        statement.importKind === 'type' ||
        !['@modern-js/plugin-bff', '@modern-js/plugin-bff/cli'].includes(
          statement.source.value,
        )
      )
        continue;
      const moved = statement.specifiers.filter(
        specifier =>
          specifier.type !== 'ImportSpecifier' ||
          (specifier.importKind !== 'type' &&
            ['bffPlugin', 'default'].includes(
              specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : specifier.imported.value,
            )),
      );
      if (moved.length === 0) continue;
      if (moved.length === statement.specifiers.length) {
        edits.push({
          start: statement.source.start! + 1,
          end: statement.source.end! - 1,
          content: buildPackage,
        });
        continue;
      }

      // Split mixed imports so unrelated native exports and their comments survive.
      const prefixes: string[] = [];
      const named: string[] = [];
      const commas = new Set<number>();
      for (const specifier of moved) {
        const text = source.slice(specifier.start!, specifier.end!);
        (specifier.type === 'ImportSpecifier' ? named : prefixes).push(text);
        edits.push({
          start: specifier.start!,
          end: specifier.end!,
          content: '',
        });
        const index = statement.specifiers.indexOf(specifier);
        const next = statement.specifiers[index + 1];
        const previous = statement.specifiers[index - 1];
        const comma = parsed.tokens?.find(
          token =>
            token.type.label === ',' &&
            (next
              ? token.start >= specifier.end! && token.end <= next.start!
              : previous &&
                token.start >= previous.end! &&
                token.end <= specifier.start!),
        );
        if (comma) commas.add(comma.start);
      }
      for (const start of commas)
        edits.push({ start, end: start + 1, content: '' });
      if (named.length) prefixes.push(`{ ${named.join(', ')} }`);
      const quote = source[statement.source.start!];
      edits.push({
        start: statement.start!,
        end: statement.start!,
        content: `import ${prefixes.join(', ')} from ${quote}${buildPackage}${quote};${newline}`,
      });
    }
    for (const edit of edits.toSorted(
      (left, right) => right.start - left.start,
    )) {
      source =
        source.slice(0, edit.start) + edit.content + source.slice(edit.end);
    }
    return source;
  } catch {
    // A malformed consumer program cannot establish import ownership.
    return source;
  }
}
