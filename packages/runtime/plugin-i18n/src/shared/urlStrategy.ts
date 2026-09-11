/** Per-plugin URL policy. Search and hash remain owned by native URL handling. */
export interface I18nUrlStrategy {
  localizePathname(
    pathname: string,
    language: string,
    languages: readonly string[],
  ): string;
  canonicalPathname(pathname: string, languages: readonly string[]): string;
  /** Adds exclusions; it cannot enable redirects excluded by native rules. */
  shouldSkipRedirect?(pathname: string, languages: readonly string[]): boolean;
}

/**
 * A URL strategy reaches the runtime through the generated runtime
 * registration, which carries plugin options as JSON. Functions do not survive
 * that, so a configured strategy can arrive as an empty object — which is
 * truthy and would make every call site throw. Anything that is not a complete
 * strategy is treated as absent, and the caller falls back to the built-in
 * language-prefix behaviour.
 */
export const asI18nUrlStrategy = (
  candidate: unknown,
): I18nUrlStrategy | undefined => {
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }
  const strategy = candidate as Partial<I18nUrlStrategy>;
  return typeof strategy.localizePathname === 'function' &&
    typeof strategy.canonicalPathname === 'function'
    ? (strategy as I18nUrlStrategy)
    : undefined;
};

/** `true` when a value was configured as a strategy but cannot be used as one. */
export const isUnusableI18nUrlStrategy = (candidate: unknown): boolean =>
  Boolean(candidate) &&
  typeof candidate === 'object' &&
  asI18nUrlStrategy(candidate) === undefined;
