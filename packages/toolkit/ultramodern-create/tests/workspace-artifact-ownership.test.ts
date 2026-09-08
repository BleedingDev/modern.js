import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { preserveConsumerWorkspaceArtifacts } from '../src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership';

test('generated contract data can refresh without treating authored behavior as generated', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-artifact-ownership-'));
  try {
    const relativePath = 'scripts/check.mts';
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath));
    const canonical =
      "const workspaceValidationContract = {version: 'new'};\nconsole.log(workspaceValidationContract);\n";
    const variants = [
      { source: canonical.replace("'new'", "'old'"), protected: false },
      {
        source: `${canonical}console.log('consumer authorization');\n`,
        protected: true,
      },
      {
        source: canonical.replace("'new'", 'getConsumerPolicy()'),
        protected: true,
      },
      {
        source: canonical.replace("{version: 'new'}", '{...consumerPolicy}'),
        protected: true,
      },
      { source: 'invalid consumer source {', protected: true },
    ];
    for (const variant of variants) {
      fs.writeFileSync(filePath, variant.source);
      const guarded = preserveConsumerWorkspaceArtifacts(
        createMigrationIo(root, false),
        [
          {
            relativePath,
            content: canonical,
            generatedDataBinding: 'workspaceValidationContract',
          },
        ],
      );
      assert.equal(guarded.preservedPaths.has(relativePath), variant.protected);
      guarded.io.write(filePath, canonical);
      assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        variant.protected ? variant.source : canonical,
      );
      if (variant.protected) {
        assert.equal(guarded.io.remove(filePath), false);
        assert.equal(fs.readFileSync(filePath, 'utf8'), variant.source);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
