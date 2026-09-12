import { useMatch } from '@modern-js/plugin-tanstack/runtime';
import type { OptionalData } from './page.data';

// `canonicaliseLocalisedRoutes` collapses every localised spelling back onto
// the canonical route identity before the tree reaches TanStack, and the
// localised URL is rewritten to the canonical path at the router's rewrite
// seam. The matched route id is therefore always the canonical one, whichever
// spelling the browser shows, so ask for both rather than assuming a winner.
const useOptionalLoaderData = () => {
  const canonicalMatch = useMatch({
    from: '/$lang/optional/{-$slug}',
    shouldThrow: false,
  });
  const localisedMatch = useMatch({
    from: '/$lang/volitelne/{-$slug}',
    shouldThrow: false,
  });

  return (canonicalMatch?.loaderData ||
    localisedMatch?.loaderData) as OptionalData;
};

export default function OptionalPage() {
  const data = useOptionalLoaderData();

  return (
    <div id="optional">
      optional:{data.language}:{data.slug}
    </div>
  );
}
