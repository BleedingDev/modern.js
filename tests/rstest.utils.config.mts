import { withTestPreset } from '@scripts/rstest-config';

// NOTE: this config's `include` glob currently matches only
// tests/utils/compatRequireBuilt.fork.test.ts. The shared rstest preset sets
// passWithNoTests:false, and the "test:utils" script (tests/package.json,
// reached via the "test" chain) plus the "Test - Published package surfaces"
// CI step (.github/workflows/integration-test-Linux.yml) do not override it.
// If that file is ever removed, either add a replacement under utils/*.test.ts
// or retire this config + the "test:utils" script + the CI step together so
// the glob is never left empty.
export default withTestPreset({
  root: __dirname,
  include: ['utils/*.test.ts'],
  testEnvironment: 'node',
  globals: true,
});
