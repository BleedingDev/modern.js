import assert from 'node:assert/strict';
import { createNeutralOwnership } from '../src/ultramodern-workspace/descriptors';
import type { OwnerAttribution } from '../src/ultramodern-workspace/types';
import { resolveOwnerAttribution } from '../src/ultramodern-workspace/types';

test('owner attribution defaults to the neutral team owner (G3)', () => {
  const ownership = createNeutralOwnership('checkout');
  assert.equal(ownership.owner, undefined);
  assert.deepEqual(resolveOwnerAttribution(ownership), {
    kind: 'team',
    id: 'super-app-platform',
  });
});

test('explicit owner attribution is passed through when a caller opts in (G3)', () => {
  const attribution: OwnerAttribution = {
    kind: 'agent-team',
    id: 'checkout-agents',
    contact: '#checkout-agents',
  };
  const ownership = {
    ...createNeutralOwnership('checkout'),
    owner: attribution,
  };
  assert.deepEqual(resolveOwnerAttribution(ownership), attribution);
});
