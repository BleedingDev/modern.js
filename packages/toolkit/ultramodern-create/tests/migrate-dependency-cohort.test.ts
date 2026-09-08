import assert from 'node:assert/strict';
import { updateModernDependencies } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort';

test('migration updates declared extension packages throughout the authenticated cohort', () => {
  const source = {
    strategy: 'install' as const,
    modernPackageVersion: '3.9.0-ultramodern.4',
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  const cohort = {
    packages: [
      {
        sourceName: '@modern-js/app-tools-extensions',
        targetName: '@bleedingdev/modern-js-app-tools-extensions',
        version: source.modernPackageVersion,
      },
    ],
  };
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const manifest = {
      [section]: {
        '@modern-js/app-tools-extensions':
          'npm:@bleedingdev/modern-js-app-tools-extensions@3.9.0-ultramodern.2',
        '@bleedingdev/modern-js-app-tools-extensions': '3.9.0-ultramodern.2',
        '@modern-js/codesmith': '2.6.9',
        'consumer-tool': '1.2.3',
      },
    };
    assert.equal(updateModernDependencies(manifest, source, cohort), true);
    assert.deepEqual(manifest[section], {
      '@modern-js/app-tools-extensions':
        'npm:@bleedingdev/modern-js-app-tools-extensions@3.9.0-ultramodern.4',
      '@bleedingdev/modern-js-app-tools-extensions': '3.9.0-ultramodern.4',
      '@modern-js/codesmith': '2.6.9',
      'consumer-tool': '1.2.3',
    });
    assert.equal(updateModernDependencies(manifest, source, cohort), false);
  }
});
