/**
 * Federation can bundle a runtime subpath separately from its shared root.
 * Share React context identity across those copies, leaving request values to
 * React's providers. Public and internal contexts retain separate identities.
 */
export function getRuntimeReactContext<T>(
  kind: 'public' | 'internal',
  create: () => T,
): T {
  const key = Symbol.for(`@modern-js/runtime:react-context:v1:${kind}`);
  const contexts = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  contexts[key] ??= create();
  return contexts[key] as T;
}
