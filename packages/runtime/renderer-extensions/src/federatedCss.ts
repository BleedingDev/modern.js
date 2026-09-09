import type { SSRHtmlFormatting } from '@modern-js/plugin/runtime';
import { escapeHtmlAttribute } from '@modern-js/runtime-extensions';

export const createFederatedCssLinks = (
  assets: string[] | undefined,
  options: {
    template: string;
    attributes?: Readonly<Record<string, unknown>>;
    existingAssets?: Iterable<string>;
  },
  { attributesToString, hasStylesheetLink }: SSRHtmlFormatting,
) => {
  if (assets === undefined || assets.length === 0) {
    return '';
  }

  const seen = new Set(options.existingAssets || []);
  const attributes = attributesToString(
    Object.fromEntries(
      Object.entries(options.attributes || {}).filter(
        ([name]) => !['href', 'rel'].includes(name.toLowerCase()),
      ),
    ),
  );
  const links: string[] = [];

  for (const asset of assets) {
    const href = escapeHtmlAttribute(asset);
    if (
      asset === '' ||
      seen.has(asset) ||
      hasStylesheetLink(options.template, asset) ||
      hasStylesheetLink(options.template, href)
    ) {
      continue;
    }

    seen.add(asset);
    links.push(`<link${attributes} href="${href}" rel="stylesheet" />`);
  }

  return links.join('');
};
