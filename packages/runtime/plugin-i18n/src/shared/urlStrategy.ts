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
