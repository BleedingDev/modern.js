import { DELIVERY_UNIT_DEPLOY_PROFILE } from '@modern-js/backend-federation-contracts';
import {
  createDeliveryUnitRecord,
  deliveryUnitContractBlock,
} from '../src/ultramodern-workspace/delivery-unit';
import {
  createUltramodernBuildArtifactJson,
  createUltramodernBuildModule,
} from '../src/ultramodern-workspace/module-federation/reexport-module';
import {
  createShellDescriptor,
  resolveConfiguredAdditionalShells,
} from '../src/ultramodern-workspace/shells';

const original = createShellDescriptor('admin', 3120);
const recorded = {
  ...createDeliveryUnitRecord('identity-proof', original),
  buildMarker: 'preserved-build-marker',
  sourceRevision: 'preserved-source-revision',
};

function configuredShell(deliveryUnit: object, id = original.id) {
  return resolveConfiguredAdditionalShells({
    shells: [
      {
        id,
        name: 'admin',
        package: '@identity-proof/shell-admin',
        path: 'apps/shell-admin',
        port: 3120,
        verticalRefs: [],
        deliveryUnit,
      },
    ],
  })[0];
}

test.each([
  'shell-admin',
  'configured-admin-host',
])('parsed compact shell contract restores required build fields from %s without minting identity', id => {
  const compact = deliveryUnitContractBlock(recorded);
  expect(Object.hasOwn(compact, 'appId')).toBe(false);
  expect(Object.hasOwn(compact, 'deployProfile')).toBe(false);
  const shell = configuredShell(compact, id);
  const artifact = JSON.parse(
    createUltramodernBuildArtifactJson('identity-proof', shell),
  );
  for (const identity of [
    artifact.deliveryUnit,
    artifact.surfaces.api,
    artifact.surfaces.ui,
  ]) {
    expect(identity.appId).toBe(id);
    expect(identity.deployProfile).toBe(DELIVERY_UNIT_DEPLOY_PROFILE);
    expect(identity.buildMarker).toBe(recorded.buildMarker);
    expect(identity.sourceRevision).toBe(recorded.sourceRevision);
    expect(identity.unitId).toBe(recorded.unitId);
    expect(identity.packageName).toBe(recorded.packageName);
  }
  const module = createUltramodernBuildModule('identity-proof', shell);
  expect(module).toContain(
    "import buildArtifact = require('./ultramodern-build.json')",
  );
  expect(module).toContain('resolveUltramodernBuildArtifact(buildArtifact,');
  expect(module).not.toContain(recorded.buildMarker);
  expect(shell.deliveryUnit).toEqual(compact);
});

test('explicit complete configured record fields stay authoritative', () => {
  const explicit = {
    ...recorded,
    appId: 'explicit-record-id',
    deployProfile: 'explicit-profile',
  };
  const shell = configuredShell(explicit, 'configured-admin-host');
  const artifact = JSON.parse(
    createUltramodernBuildArtifactJson('identity-proof', shell),
  );
  for (const identity of [
    artifact.deliveryUnit,
    artifact.surfaces.api,
    artifact.surfaces.ui,
  ]) {
    expect(identity).toMatchObject(explicit);
  }
  expect(shell.id).toBe('configured-admin-host');
  expect(shell.deliveryUnit).toEqual(explicit);
});
