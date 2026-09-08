import {
  isAsExpression,
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNumericLiteral,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isSpreadAssignment,
  isStringLiteralLikeNode,
  isVariableStatement,
  NodeFlags,
  SyntaxKind,
} from '@typescript/native/unstable/ast';
import type {
  CallExpression,
  Expression,
  Node,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  VariableDeclaration,
} from '@typescript/native/unstable/ast';
import { API as TypeScriptApi } from '@typescript/native/unstable/sync';

const camelCaseStem = (stem: string): string =>
  stem.replaceAll(/-(?<letter>[a-z0-9])/gu, (_match, letter: string) =>
    letter.toUpperCase(),
  );

const pascalCaseStem = (stem: string): string => {
  const camelStem = camelCaseStem(stem);
  return `${camelStem.slice(0, 1).toUpperCase()}${camelStem.slice(1)}`;
};

const identifierName = (node: Node | undefined): string | undefined =>
  node !== undefined && isIdentifier(node) ? node.text : undefined;

const propertyName = (node: Node | undefined): string | undefined => {
  if (
    node !== undefined &&
    (isIdentifier(node) ||
      isStringLiteralLikeNode(node) ||
      isNumericLiteral(node))
  ) {
    return node.text;
  }
  return undefined;
};

const accessPath = (node: Expression): readonly string[] | undefined => {
  if (isIdentifier(node)) {
    return [node.text];
  }
  if (isPropertyAccessExpression(node)) {
    const parent = accessPath(node.expression);
    return parent === undefined ? undefined : [...parent, node.name.text];
  }
  return undefined;
};

const isAccessPath = (
  node: Expression,
  expected: readonly string[],
): boolean => accessPath(node)?.join('.') === expected.join('.');

const unwrapExpression = (expression: Expression): Expression => {
  let current = expression;
  while (
    isAsExpression(current) ||
    isParenthesizedExpression(current) ||
    isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

const stringLiteral = (
  expression: Expression | undefined,
): string | undefined => {
  if (expression === undefined) {
    return undefined;
  }
  const unwrapped = unwrapExpression(expression);
  return isStringLiteralLikeNode(unwrapped) ? unwrapped.text : undefined;
};

const numericLiteral = (
  expression: Expression | undefined,
): number | undefined => {
  if (expression === undefined) {
    return undefined;
  }
  const unwrapped = unwrapExpression(expression);
  return isNumericLiteral(unwrapped) ? Number(unwrapped.text) : undefined;
};

const callExpression = (
  expression: Expression | undefined,
  callee: readonly string[],
): CallExpression | undefined => {
  if (expression === undefined) {
    return undefined;
  }
  const unwrapped = unwrapExpression(expression);
  return isCallExpression(unwrapped) &&
    isAccessPath(unwrapped.expression, callee)
    ? unwrapped
    : undefined;
};

const exportedConst = (
  sourceFile: SourceFile,
  name: string,
): VariableDeclaration | undefined => {
  for (const statement of sourceFile.statements) {
    if (
      !isVariableStatement(statement) ||
      !(
        statement.modifiers?.some(
          modifier => modifier.kind === SyntaxKind.ExportKeyword,
        ) ?? false
      ) ||
      statement.declarationList.flags !== NodeFlags.Const
    ) {
      continue;
    }
    const declarations = statement.declarationList.declarations.filter(
      declaration => identifierName(declaration.name) === name,
    );
    if (declarations.length === 1) {
      return declarations[0];
    }
  }
  return undefined;
};

const localConst = (
  sourceFile: SourceFile,
  name: string,
): VariableDeclaration | undefined => {
  for (const statement of sourceFile.statements) {
    if (
      !isVariableStatement(statement) ||
      statement.declarationList.flags !== NodeFlags.Const
    ) {
      continue;
    }
    const declarations = statement.declarationList.declarations.filter(
      declaration => identifierName(declaration.name) === name,
    );
    if (declarations.length === 1) {
      return declarations[0];
    }
  }
  return undefined;
};

const objectLiteral = (
  expression: Expression | undefined,
): ObjectLiteralExpression | undefined => {
  if (expression === undefined) {
    return undefined;
  }
  const unwrapped = unwrapExpression(expression);
  return isObjectLiteralExpression(unwrapped) ? unwrapped : undefined;
};

const propertyAssignments = (
  properties: readonly ObjectLiteralElementLike[],
): ReadonlyMap<string, PropertyAssignment> | undefined => {
  const assignments = new Map<string, PropertyAssignment>();
  for (const property of properties) {
    if (!isPropertyAssignment(property)) {
      return undefined;
    }
    const name = propertyName(property.name);
    if (name === undefined || assignments.has(name)) {
      return undefined;
    }
    assignments.set(name, property);
  }
  return assignments;
};

const exactCall = (
  expression: Expression | undefined,
  callee: readonly string[],
  argumentCount: number,
): CallExpression | undefined => {
  const call = callExpression(expression, callee);
  return call?.arguments.length === argumentCount ? call : undefined;
};

interface SharedSchemaObject {
  readonly assignments: ReadonlyMap<string, PropertyAssignment>;
  readonly identity: boolean;
}

const sharedSchemaObject = (
  declaration: VariableDeclaration | undefined,
  sharedSchemaName: string,
  protectedFields: readonly string[],
): SharedSchemaObject | undefined => {
  if (declaration?.initializer === undefined) {
    return undefined;
  }
  const initializer = unwrapExpression(declaration.initializer);
  if (isIdentifier(initializer) && initializer.text === sharedSchemaName) {
    return { assignments: new Map(), identity: true };
  }
  const struct = exactCall(initializer, ['Schema', 'Struct'], 1);
  const schemaObject = objectLiteral(struct?.arguments[0]);
  if (schemaObject === undefined) {
    return undefined;
  }
  const spreads = schemaObject.properties.filter(isSpreadAssignment);
  const assignments = propertyAssignments(
    schemaObject.properties.filter(property => !isSpreadAssignment(property)),
  );
  if (
    spreads.length !== 1 ||
    !spreads.every(spread =>
      isAccessPath(spread.expression, [sharedSchemaName, 'fields']),
    ) ||
    assignments === undefined ||
    protectedFields.some(field => assignments.has(field))
  ) {
    return undefined;
  }
  return { assignments, identity: false };
};

interface DirectCallChain {
  readonly base: CallExpression;
  readonly methods: readonly {
    readonly arguments: readonly Expression[];
    readonly name: string;
  }[];
}

const directCallChain = (
  expression: Expression | undefined,
): DirectCallChain | undefined => {
  if (expression === undefined) {
    return undefined;
  }
  let current = unwrapExpression(expression);
  const methods: {
    readonly arguments: readonly Expression[];
    readonly name: string;
  }[] = [];
  while (
    isCallExpression(current) &&
    isPropertyAccessExpression(current.expression) &&
    !isIdentifier(current.expression.expression)
  ) {
    methods.unshift({
      arguments: current.arguments,
      name: current.expression.name.text,
    });
    current = unwrapExpression(current.expression.expression);
  }
  if (!isCallExpression(current)) {
    return undefined;
  }
  return { base: current, methods };
};

const brandedStringSchemaIsExact = (
  declaration: VariableDeclaration | undefined,
  brand: string,
): boolean => {
  const initializer = declaration?.initializer;
  if (initializer === undefined) {
    return false;
  }
  const pipeCall = unwrapExpression(initializer);
  if (
    !isCallExpression(pipeCall) ||
    !isPropertyAccessExpression(pipeCall.expression) ||
    pipeCall.expression.name.text !== 'pipe' ||
    !isAccessPath(pipeCall.expression.expression, ['Schema', 'String']) ||
    pipeCall.arguments.length !== 1
  ) {
    return false;
  }
  const brandCall = exactCall(pipeCall.arguments[0], ['Schema', 'brand'], 1);
  return stringLiteral(brandCall?.arguments[0]) === brand;
};

const importedRuntimeNames = (
  statement: Node,
  expectedPackage: string,
): readonly string[] => {
  if (
    !isImportDeclaration(statement) ||
    stringLiteral(statement.moduleSpecifier) !== expectedPackage
  ) {
    return [];
  }
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  if (
    clause?.phaseModifier === SyntaxKind.TypeKeyword ||
    bindings === undefined ||
    !isNamedImports(bindings)
  ) {
    return [];
  }
  return bindings.elements
    .filter(
      element => !element.isTypeOnly && element.propertyName === undefined,
    )
    .map(element => element.name.text);
};

const importsExactBindings = (
  sourceFile: SourceFile,
  expectedPackage: string,
  expectedBindings: readonly string[],
): boolean => {
  const names = new Set(
    sourceFile.statements.flatMap(statement =>
      importedRuntimeNames(statement, expectedPackage),
    ),
  );
  return expectedBindings.every(name => names.has(name));
};

const importsSharedBaselinePrimitives = (
  sourceFile: SourceFile,
  expectedPackage: string,
): boolean =>
  importsExactBindings(sourceFile, expectedPackage, [
    'MicroVerticalBuildMarkerSchema',
    'MicroVerticalReadinessSchema',
    'createMicroVerticalOperationContext',
  ]);

const singleAddedArgument = (
  expression: Expression | undefined,
  factory: readonly string[],
  names: readonly string[],
): Expression | undefined => {
  const chain = directCallChain(expression);
  if (chain === undefined || !isAccessPath(chain.base.expression, factory)) {
    return undefined;
  }
  const [method] = chain.methods;
  if (
    chain.base.arguments.length !== 1 ||
    !names.includes(stringLiteral(chain.base.arguments[0]) ?? '') ||
    chain.methods.length !== 1 ||
    method?.name !== 'add' ||
    method.arguments.length !== 1
  ) {
    return undefined;
  }
  return method.arguments[0];
};

const foundationIsExact = (
  declaration: VariableDeclaration | undefined,
  stem: string,
  readinessSchemaName: string,
): boolean => {
  const group = singleAddedArgument(
    declaration?.initializer,
    ['HttpApi', 'make'],
    [
      `${pascalCaseStem(stem)}FoundationApi`,
      `${pascalCaseStem(stem)}ApiFoundation`,
    ],
  );
  const endpointExpression = singleAddedArgument(
    group,
    ['HttpApiGroup', 'make'],
    ['foundation'],
  );
  const endpoint = exactCall(
    endpointExpression,
    ['HttpApiEndpoint', 'get'],
    3,
  );
  const endpointOptions = objectLiteral(endpoint?.arguments[2]);
  const endpointProperties =
    endpointOptions === undefined
      ? undefined
      : propertyAssignments(endpointOptions.properties);
  return (
    endpoint !== undefined &&
    stringLiteral(endpoint.arguments[0]) === 'readiness' &&
    stringLiteral(endpoint.arguments[1]) === `/${stem}/readiness` &&
    endpointProperties?.size === 1 &&
    identifierName(endpointProperties.get('success')?.initializer) ===
      readinessSchemaName
  );
};

const rootComposesFoundation = (
  sourceFile: SourceFile,
  declaration: VariableDeclaration | undefined,
  stem: string,
  foundationName: string,
): boolean => {
  const chain = directCallChain(declaration?.initializer);
  const first = chain?.methods[0];
  return (
    chain !== undefined &&
    isAccessPath(chain.base.expression, ['HttpApi', 'make']) &&
    chain.base.arguments.length === 1 &&
    stringLiteral(chain.base.arguments[0]) === `${pascalCaseStem(stem)}Api` &&
    chain.methods.length > 0 &&
    chain.methods.every(
      (method, index) =>
        method.arguments.length === 1 &&
        (method.name === 'add' ||
          method.name === 'addHttpApi' ||
          (index === chain.methods.length - 1 &&
            method.name === 'pipe' &&
            identifierName(method.arguments[0]) === 'identity' &&
            importsExactBindings(sourceFile, 'effect', ['identity']))),
    ) &&
    first?.name === 'addHttpApi' &&
    identifierName(first.arguments[0]) === foundationName
  );
};

const operationContextFields = (property: PropertyAssignment) => {
  const constructorCall = exactCall(
    property.initializer,
    ['createMicroVerticalOperationContext'],
    1,
  );
  const input = objectLiteral(constructorCall?.arguments[0]);
  return input === undefined
    ? undefined
    : propertyAssignments(input.properties);
};

const operationContextIdentity = (
  property: PropertyAssignment,
):
  | {
      readonly method: string;
      readonly operationId: string;
      readonly routePath: string;
    }
  | undefined => {
  const fields = operationContextFields(property);
  const method = stringLiteral(fields?.get('method')?.initializer);
  const operationId = stringLiteral(fields?.get('operationId')?.initializer);
  const routePath = stringLiteral(fields?.get('routePath')?.initializer);
  if (
    fields?.size !== 3 ||
    method === undefined ||
    operationId === undefined ||
    routePath === undefined
  ) {
    return undefined;
  }
  return { method, operationId, routePath };
};

const operationContextIsConstructed = (
  property: PropertyAssignment,
  stem: string,
  propertyKey: string,
): boolean => {
  const identity = operationContextIdentity(property);
  if (identity === undefined) {
    return false;
  }
  const { method, operationId, routePath } = identity;
  if (
    !/^[A-Z]+$/u.test(method) ||
    !/^\/(?!.*(?:^|\/)\.\.?\/)[^\s?#]*$/u.test(routePath)
  ) {
    return false;
  }
  const apiName = `${pascalCaseStem(stem)}Api`;
  const generatedOperation = new Map([
    ['addCartItem', ['POST', `/${stem}/cart/items`]],
    ['clearCart', ['POST', `/${stem}/cart/clear`]],
    ['create', ['POST', `/${stem}`]],
    ['get', ['GET', `/${stem}/:id`]],
    ['getCart', ['GET', `/${stem}/cart`]],
    ['list', ['GET', `/${stem}`]],
    ['readiness', ['GET', `/${stem}/readiness`]],
    ['removeCartItem', ['POST', `/${stem}/cart/remove`]],
  ]).get(propertyKey);
  const requestedOperation = [method, routePath];
  const matchesGenerated =
    generatedOperation?.every(
      (value, index) => value === requestedOperation[index],
    ) === true;
  if (propertyKey === 'readiness' && !matchesGenerated) {
    return false;
  }
  return (
    operationId === `${apiName}:${routePath}` ||
    (operationId === `${apiName}:${camelCaseStem(stem)}:${propertyKey}` &&
      matchesGenerated)
  );
};

const operationMapIsConnected = (
  declaration: VariableDeclaration | undefined,
  stem: string,
): boolean => {
  const map = objectLiteral(declaration?.initializer);
  const properties =
    map === undefined ? undefined : propertyAssignments(map.properties);
  return (
    properties !== undefined &&
    properties.has('readiness') &&
    [...properties].every(([key, property]) =>
      operationContextIsConstructed(property, stem, key),
    )
  );
};

const constAssertionObject = (
  declaration: VariableDeclaration | undefined,
): ObjectLiteralExpression | undefined => {
  const initializer = declaration?.initializer;
  if (
    initializer === undefined ||
    !isAsExpression(initializer) ||
    initializer.type.getText() !== 'const'
  ) {
    return undefined;
  }
  return objectLiteral(initializer.expression);
};

const metadataIsExact = (
  declaration: VariableDeclaration | undefined,
  expectation: MicroVerticalApiBaselineExpectation,
): boolean => {
  const object = constAssertionObject(declaration);
  const fields =
    object === undefined ? undefined : propertyAssignments(object.properties);
  const expectedFields = [
    ['apiPrefix', expectation.apiPrefix],
    ['basePath', expectation.basePath],
    ['ownerId', expectation.ownerId],
    ['readinessPath', expectation.readinessPath],
    ...Object.entries(expectation.additionalPaths),
  ] as const;
  return (
    fields !== undefined &&
    fields.size === new Map(expectedFields).size &&
    [...expectedFields].every(
      ([field, value]) =>
        stringLiteral(fields.get(field)?.initializer) === value,
    )
  );
};

const markerSchemaIsShared = (
  sourceFile: SourceFile,
  declaration: VariableDeclaration | undefined,
): boolean => {
  const schema = sharedSchemaObject(
    declaration,
    'MicroVerticalBuildMarkerSchema',
    [
      'build',
      'buildMarker',
      'deployProfile',
      'packageName',
      'sourceRevision',
      'surface',
      'version',
    ],
  );
  if (schema === undefined || schema.identity) {
    return schema?.identity === true;
  }
  const brandedField = (
    property: PropertyAssignment,
    brand: string,
  ): boolean =>
    identifierName(property.initializer) === `${brand}Schema` &&
    brandedStringSchemaIsExact(
      localConst(sourceFile, `${brand}Schema`),
      brand,
    );
  const validators = new Map<
    string,
    (property: PropertyAssignment) => boolean
  >([
    ['appId', property => brandedField(property, 'AppId')],
    ['unitId', property => brandedField(property, 'UnitId')],
    [
      'kind',
      property =>
        stringLiteral(
          exactCall(property.initializer, ['Schema', 'Literal'], 1)
            ?.arguments[0],
        ) === 'microvertical-delivery-unit',
    ],
    [
      'schemaVersion',
      property =>
        numericLiteral(
          exactCall(property.initializer, ['Schema', 'Literal'], 1)
            ?.arguments[0],
        ) === 1,
    ],
  ]);
  return [...schema.assignments].every(
    ([field, property]) => validators.get(field)?.(property) === true,
  );
};

const readinessSchemaIsShared = (
  declaration: VariableDeclaration | undefined,
  markerSchemaName: string,
  ownerMarkerIsIdentity: boolean,
): boolean => {
  const schema = sharedSchemaObject(
    declaration,
    'MicroVerticalReadinessSchema',
    ['checks', 'status', 'versionSkew'],
  );
  return (
    schema !== undefined &&
    ((schema.identity && ownerMarkerIsIdentity) ||
      (schema.assignments.size === 1 &&
        identifierName(schema.assignments.get('marker')?.initializer) ===
          markerSchemaName))
  );
};

const declarationIsIdentifier = (
  declaration: VariableDeclaration | undefined,
  identifier: string,
): boolean =>
  declaration?.initializer !== undefined &&
  identifierName(unwrapExpression(declaration.initializer)) === identifier;

const validateParsedContract = (
  sourceFile: SourceFile,
  stem: string,
  expectation: MicroVerticalApiBaselineExpectation,
): string | undefined => {
  const exportStem = camelCaseStem(stem);
  const foundationName = `${exportStem}FoundationApi`;
  const markerSchemaName = `${exportStem}MarkerSchema`;
  const readinessSchemaName = `${exportStem}ReadinessSchema`;
  const markerDeclaration = exportedConst(sourceFile, markerSchemaName);
  if (
    !importsExactBindings(sourceFile, expectation.effectClientPackage, [
      'HttpApi',
      'HttpApiEndpoint',
      'HttpApiGroup',
      'Schema',
    ])
  ) {
    return 'MicroVertical root contract must import exact Effect API primitives from the framework client package';
  }
  if (
    !importsSharedBaselinePrimitives(
      sourceFile,
      expectation.sharedContractsPackage,
    )
  ) {
    return 'MicroVertical root contract must import exact baseline primitives from the shared contracts package';
  }
  if (!markerSchemaIsShared(sourceFile, markerDeclaration)) {
    return 'MicroVertical root contract must consume the shared build marker schema without overriding shared fields';
  }
  if (
    !readinessSchemaIsShared(
      exportedConst(sourceFile, readinessSchemaName),
      markerSchemaName,
      declarationIsIdentifier(
        markerDeclaration,
        'MicroVerticalBuildMarkerSchema',
      ),
    )
  ) {
    return 'MicroVertical readiness schema must consume the shared readiness schema without overriding shared fields';
  }
  if (
    !foundationIsExact(
      exportedConst(sourceFile, foundationName),
      stem,
      readinessSchemaName,
    )
  ) {
    return 'MicroVertical readiness foundation API must directly compose its exact readiness endpoint and foundation identity';
  }
  if (
    !rootComposesFoundation(
      sourceFile,
      exportedConst(sourceFile, `${exportStem}Api`),
      stem,
      foundationName,
    )
  ) {
    return 'MicroVertical root API must explicitly compose its readiness foundation API';
  }
  if (
    !operationMapIsConnected(
      exportedConst(sourceFile, `${exportStem}OperationContexts`),
      stem,
    )
  ) {
    return 'MicroVertical operation map must construct every operation with the shared context constructor';
  }
  if (
    !metadataIsExact(
      exportedConst(sourceFile, `${exportStem}ApiContract`),
      expectation,
    )
  ) {
    return 'MicroVertical root contract must keep exact owner and API path metadata without forbidden fields';
  }
  return undefined;
};

const parseAndValidate = (
  stem: string,
  filePath: string,
  expectation: MicroVerticalApiBaselineExpectation,
): string | undefined => {
  const compiler = new TypeScriptApi();
  try {
    const snapshot = compiler.updateSnapshot({ openFiles: [filePath] });
    const project = snapshot.getDefaultProjectForFile(filePath);
    const sourceFile = project?.program.getSourceFile(filePath);
    if (
      sourceFile === undefined ||
      (project?.program.getSyntacticDiagnostics(filePath).length ?? 1) > 0 ||
      (project?.program.getBindDiagnostics(filePath).length ?? 1) > 0
    ) {
      return 'MicroVertical root contract must be valid TypeScript syntax';
    }
    return validateParsedContract(sourceFile, stem, expectation);
  } finally {
    compiler.close();
  }
};

export interface MicroVerticalApiBaselineExpectation {
  readonly additionalPaths: Readonly<Record<string, string>>;
  readonly apiPrefix: string;
  readonly basePath: string;
  readonly effectClientPackage: string;
  readonly ownerId: string;
  readonly readinessPath: string;
  readonly sharedContractsPackage: string;
}

export interface MicroVerticalTopologyEntry {
  readonly api?: { readonly readiness?: { readonly endpoint?: string } };
  readonly id: string;
  readonly path?: string;
}

export const configuredMicroVerticalApiStem = (
  verticalPath: string,
  verticals: readonly MicroVerticalTopologyEntry[],
): string | undefined => {
  const topologyVertical = verticals.find(
    vertical =>
      (vertical.path ?? `verticals/${vertical.id}`) === verticalPath,
  );
  const endpoint = topologyVertical?.api?.readiness?.endpoint;
  return endpoint?.match(/^\/(?<stem>[a-z0-9]+(?:-[a-z0-9]+)*)\/readiness$/u)
    ?.groups?.stem;
};

export const microVerticalApiBaselineViolation = (
  stem: string,
  filePath: string,
  expectation: MicroVerticalApiBaselineExpectation,
): string | undefined => parseAndValidate(stem, filePath, expectation);
