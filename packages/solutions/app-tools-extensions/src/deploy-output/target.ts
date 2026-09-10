import { provider } from 'std-env';

export interface DeployOutputConfig {
  deploy?: { target?: string };
}

const providerDeployTargets: Partial<Record<string, string>> = {
  vercel: 'vercel',
  netlify: 'netlify',
  cloudflare: 'cloudflare',
  cloudflare_pages: 'cloudflare',
  cloudflare_workers: 'cloudflare',
};

export const resolveDeployTarget = (
  config: DeployOutputConfig,
  envDeployTarget = process.env.MODERNJS_DEPLOY,
  detectedProvider = provider,
): string =>
  config.deploy?.target ||
  envDeployTarget ||
  (detectedProvider ? providerDeployTargets[detectedProvider] : undefined) ||
  'node';
