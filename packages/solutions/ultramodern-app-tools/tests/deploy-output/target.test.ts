import { resolveDeployTarget as resolveExtensionDeployTarget } from '@modern-js/app-tools-extensions/deploy-output/target';
import {
  getSupportedDeployTargets,
  resolveDeployTarget,
} from '../../../app-tools/src/plugins/deploy';

describe('deploy target selection', () => {
  it('keeps native alias and release-envelope target selection aligned with deployment', () => {
    for (const config of [{}, { deploy: { target: 'cloudflare' } }]) {
      for (const env of ['', 'node', 'vercel']) {
        for (const provider of [
          '',
          'netlify',
          'vercel',
          'cloudflare',
          'cloudflare_pages',
          'cloudflare_workers',
          'github_actions',
        ]) {
          expect(resolveExtensionDeployTarget(config, env, provider)).toBe(
            resolveDeployTarget(config as any, env, provider),
          );
        }
      }
    }
  });

  it('registers cloudflare without removing existing targets', () => {
    expect(getSupportedDeployTargets()).toEqual([
      'node',
      'vercel',
      'netlify',
      'ghPages',
      'cloudflare',
    ]);
  });

  it('prefers typed config over environment and provider detection', () => {
    const target = resolveDeployTarget(
      {
        deploy: {
          target: 'cloudflare',
        },
      } as any,
      'vercel',
      'netlify',
    );

    expect(target).toBe('cloudflare');
  });

  it('preserves existing environment and provider fallback order', () => {
    expect(resolveDeployTarget({ deploy: {} } as any, 'vercel')).toBe('vercel');
    expect(
      resolveDeployTarget({ deploy: {} } as any, undefined, 'netlify'),
    ).toBe('netlify');
    expect(
      resolveDeployTarget({ deploy: {} } as any, undefined, 'cloudflare_pages'),
    ).toBe('cloudflare');
    expect(
      resolveDeployTarget({ deploy: {} } as any, undefined, 'cloudflare'),
    ).toBe('cloudflare');
    expect(
      resolveDeployTarget({ deploy: {} } as any, undefined, 'github_actions'),
    ).toBe('node');
    expect(resolveDeployTarget({ deploy: {} } as any, undefined, '')).toBe(
      'node',
    );
  });
});
