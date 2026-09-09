import type { UltramodernPerformanceReadinessSignalId } from '@modern-js/runtime-extensions/workspace-events';
export * from '@modern-js/runtime-extensions/workspace-events';

export type UltramodernPublicSitemapChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface UltramodernPublicSitemapEntry {
  /**
   * Params used to expand every localized route pattern, for example
   * { slug: 'platform-story' } for /talks/:slug.
   */
  params: Record<string, string | number | boolean>;
  /**
   * Per-locale overrides when translated URLs use translated params.
   */
  localeParams?: Partial<
    Record<'en' | 'cs', Record<string, string | number | boolean>>
  >;
  draft?: boolean;
  indexable?: boolean;
  lastModified?: string;
  changeFrequency?: UltramodernPublicSitemapChangeFrequency;
  priority?: number;
}

export interface UltramodernPerformanceReadinessDiagnosticsConfig {
  /**
   * Default-on. Set to false only for an explicit local or CI fast path.
   */
  enabled?: boolean;
  /**
   * Diagnostics may fail objective generated/framework invariants, or never
   * fail and only emit the deterministic report.
   */
  failOn?: 'framework-invariant' | 'never';
  reportPath?: string;
  signals?: Partial<
    Record<
      UltramodernPerformanceReadinessSignalId,
      {
        enabled?: boolean;
      }
    >
  >;
}

export const ultramodernWorkspaceContract = {
  ownership: 'topology/ownership.json',
  performanceReadiness: {
    defaultOn: true,
    optOut: 'scripts/ultramodern-performance-readiness.config.mjs#enabled=false',
    report:
      '.codex/reports/performance-readiness/ultramodern-performance-readiness.json',
    signals: [
      'bfcache',
      'core-web-vitals-rum',
      'duplicate-prefetch-warmup',
      'cache-policy-sanity',
      'save-data-behavior',
      'cloudflare-ssr-cache-hints',
    ],
  },
  preset: 'presetUltramodern',
  topology: 'topology/reference-topology.json',
} as const;
