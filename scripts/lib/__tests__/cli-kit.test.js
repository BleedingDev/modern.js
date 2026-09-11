const assert = require('node:assert/strict');
const test = require('node:test');

const { parseCliArgs, rejectInlineOptionValues } = require('../cli-kit');

const parseSample = (argv, overrides = {}) =>
  parseCliArgs(argv, {
    defaults: {
      allowEmpty: false,
      entries: [],
      optional: 'default',
      required: undefined,
    },
    options: {
      'allow-empty': {
        key: 'allowEmpty',
        type: 'boolean',
      },
      entry: {
        key: 'entries',
        multiple: true,
        requiredValue: false,
      },
      optional: {
        requiredValue: false,
      },
      required: {},
    },
    ...overrides,
  });

test('parseCliArgs preserves booleans, repeated values, and inline values', () => {
  assert.deepEqual(
    parseSample([
      '--allow-empty',
      '--entry',
      'first',
      '--entry=second',
      '--optional',
      'value',
    ]),
    {
      allowEmpty: true,
      entries: ['first', 'second'],
      optional: 'value',
      required: undefined,
    },
  );
});

test('parseCliArgs rejects invalid option forms', () => {
  assert.throws(() => parseSample(['--allow-empty=false']));
  assert.throws(() => parseSample(['--required']));
  assert.throws(() => parseSample(['--bad']));
});

test('parseCliArgs keeps bare terminator behavior explicit per caller', () => {
  assert.throws(() => parseSample(['--']));
  assert.deepEqual(parseSample(['--', '--optional', 'value'], {
    ignoreTerminator: true,
  }), {
    allowEmpty: false,
    entries: [],
    optional: 'value',
    required: undefined,
  });
});

test('rejectInlineOptionValues rejects selected inline value options', () => {
  assert.throws(() =>
    rejectInlineOptionValues(['--out=file.json'], ['--out']),
  );
  assert.doesNotThrow(() =>
    rejectInlineOptionValues(['--other=file.json'], ['--out']),
  );
});
