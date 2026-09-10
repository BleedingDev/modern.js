const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { readJsonFile, writeJsonFile } = require('../fs-kit');

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fs-kit-'));

test('writeJsonFile writes atomic and direct JSON artifacts', () => {
  const dir = makeTempDir();
  try {
    const filePath = path.join(dir, 'nested', 'value.json');
    assert.equal(writeJsonFile(filePath, { answer: 42 }), filePath);
    assert.equal(
      fs.readFileSync(filePath, 'utf8'),
      `${JSON.stringify({ answer: 42 }, null, 2)}\n`,
    );
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);

    const directPath = path.join(dir, 'artifact.json');
    writeJsonFile(directPath, ['ok'], { atomic: false });
    assert.equal(fs.readFileSync(directPath, 'utf8'), '[\n  "ok"\n]\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readJsonFile parses JSON and adds path context to parse errors', () => {
  const dir = makeTempDir();
  try {
    const validPath = path.join(dir, 'value.json');
    fs.writeFileSync(validPath, '{"answer":42}\n');
    assert.deepEqual(readJsonFile(validPath), { answer: 42 });

    const filePath = path.join(dir, 'broken.json');
    fs.writeFileSync(filePath, '{"answer":');
    assert.throws(
      () => readJsonFile(filePath),
      error =>
        error.message.includes('Failed to parse JSON') &&
        error.message.includes(filePath),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
