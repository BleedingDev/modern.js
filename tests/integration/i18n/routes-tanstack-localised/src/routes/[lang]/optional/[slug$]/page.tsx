import { useMatch } from '@modern-js/plugin-tanstack/runtime';
import type { OptionalData } from './page.data';

// `canonicaliseLocalisedRoutes` collapses every localised spelling back onto
// the canonical route identity before the tree reaches TanStack, and the
// localised URL is rewritten to the canonical path at the router's rewrite
// seam. The matched id is therefore always the canonical one, whichever
// spelling the browser shows. Match only that, with throwing semantics: if the
// localised identity ever survives into the router again, this page must fail
// rather than quietly accept either id and hide the regression.
export default function OptionalPage() {
  const match = useMatch({ from: '/$lang/optional/{-$slug}' });
  const data = match.loaderData as OptionalData;

  return (
    <div id="optional">
      optional:{data.language}:{data.slug}
    </div>
  );
}
