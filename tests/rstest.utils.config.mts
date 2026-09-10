import { withTestPreset } from '@scripts/rstest-config';

export default withTestPreset({
  root: __dirname,
  include: ['utils/*.test.ts'],
  testEnvironment: 'node',
  globals: true,
});
