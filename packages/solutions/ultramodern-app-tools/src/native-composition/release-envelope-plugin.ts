import type { AppTools, CliPlugin } from '@modern-js/app-tools';
import { resolveDeployTarget } from '@modern-js/app-tools-extensions/deploy-output/target';
import { createUltramodernReleaseEnvelopePlugin } from '@modern-js/app-tools-extensions/release-envelope/plugin';

export const ultramodernReleaseEnvelopePlugin = (): CliPlugin<AppTools> =>
  createUltramodernReleaseEnvelopePlugin({ resolveDeployTarget });
