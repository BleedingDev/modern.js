const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ensureBoolean,
  ensureFileExists,
  ensureInteger,
  ensureNonEmptyStringArray,
  ensureNonPlaceholderString,
  ensureObject,
  ensurePositiveInteger,
  ensureString,
  ensureStringArray,
  ensureUniqueIds,
  escapeRegExp,
  isPlaceholderValue,
} = require('../validation-kit');

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'validation-kit-'));

test('ensureFileExists supports custom labels', () => {
  assert.throws(
    () => ensureFileExists('/nonexistent/file'),
    /Required file does not exist: \/nonexistent\/file/,
  );
  assert.throws(
    () => ensureFileExists('/nonexistent/file', { label: 'File' }),
    /^Error: File does not exist: \/nonexistent\/file$/,
  );
  assert.doesNotThrow(() => ensureFileExists(__filename));
});

test('primitive guards enforce validator input boundaries', () => {
  assert.doesNotThrow(() => ensureObject({}, 'ctx'));
  assert.throws(() => ensureObject([], 'ctx'), /ctx must be an object/);
  assert.throws(() => ensureObject(null, 'ctx'), /ctx must be an object/);

  assert.doesNotThrow(() => ensureString('x', 'ctx'));
  assert.throws(
    () => ensureString('  ', 'ctx'),
    /ctx must be a non-empty string/,
  );

  assert.doesNotThrow(() => ensureBoolean(false, 'ctx'));
  assert.throws(() => ensureBoolean('true', 'ctx'), /ctx must be a boolean/);

  assert.doesNotThrow(() => ensureInteger(0, 'ctx'));
  assert.throws(
    () => ensureInteger(-1, 'ctx'),
    /ctx must be a non-negative integer/,
  );

  assert.doesNotThrow(() => ensurePositiveInteger(1, 'ctx'));
  assert.throws(
    () => ensurePositiveInteger(0, 'ctx'),
    /ctx must be a positive integer/,
  );
});

test('array guards preserve optional and required collection semantics', () => {
  assert.doesNotThrow(() => ensureStringArray([], 'ctx'));
  assert.doesNotThrow(() => ensureStringArray(['a'], 'ctx'));
  assert.throws(() => ensureStringArray('a', 'ctx'), /ctx must be an array/);
  assert.throws(
    () => ensureStringArray(['a', ''], 'ctx'),
    /ctx must contain non-empty string values/,
  );
  assert.doesNotThrow(() => ensureNonEmptyStringArray(['a'], 'ctx'));
  assert.throws(
    () => ensureNonEmptyStringArray([], 'ctx'),
    /ctx must not be empty/,
  );
  assert.throws(
    () => ensureNonEmptyStringArray(['a', ' '], 'ctx'),
    /ctx\[1\] must be a non-empty string/,
  );
});

test('ensureUniqueIds rejects duplicate and missing ids', () => {
  assert.doesNotThrow(() =>
    ensureUniqueIds([{ id: 'a' }, { id: 'b' }], 'ctx'),
  );
  assert.throws(
    () => ensureUniqueIds([{ id: 'a' }, { id: 'a' }], 'ctx'),
    /ctx contains duplicate id "a"/,
  );
  assert.throws(
    () => ensureUniqueIds([{}], 'ctx'),
    /ctx\[0\].id must be a non-empty string/,
  );
});

test('placeholder validation rejects tokens used by gate metadata', () => {
  assert.equal(isPlaceholderValue(' TBD '), true);
  assert.equal(isPlaceholderValue('owner-team'), false);
  assert.throws(
    () => ensureNonPlaceholderString('TBD', 'ctx'),
    /placeholder value/,
  );
  assert.doesNotThrow(() => ensureNonPlaceholderString('real-value', 'ctx'));
});

test('escapeRegExp escapes regex metacharacters', () => {
  const pattern = new RegExp(escapeRegExp('a.b*c(d)'));
  assert.ok(pattern.test('a.b*c(d)'));
  assert.equal(pattern.test('aXbYc(d)'), false);
});
