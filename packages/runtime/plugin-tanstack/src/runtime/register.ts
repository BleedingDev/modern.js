import {
  type RouterProviderFactory,
  type RouterProviderPlugin,
} from '@modern-js/runtime-extensions/router-provider';
import { tanstackRouterPlugin } from './plugin';

// TanStack runtime plugin types its API against its own hook registry,
// while the provider contract is typed against the built-in router hook
// registry from @modern-js/runtime. The two are runtime-compatible (the
// built-in router plugin registers the hooks and forwards its API to the
// resolved provider), but nominally distinct, so keep an explicit adapter
// cast as the single boundary.
export const tanstackRouterProviderFactory: RouterProviderFactory =
  userConfig =>
    tanstackRouterPlugin(userConfig) as unknown as RouterProviderPlugin;
