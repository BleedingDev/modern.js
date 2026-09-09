import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVerticalDescriptor } from '../src/ultramodern-workspace/descriptors';
import { createShellDescriptor } from '../src/ultramodern-workspace/shells';
import { writeApp } from '../src/ultramodern-workspace/write-app';

for (const selected of [[], ['catalog']]) {
  test(`additional shell with UI selection ${JSON.stringify(selected)} retains all API dependencies and clients`, () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'um-shell-api-inventory-'),
    );
    try {
      const shell = {
        ...createShellDescriptor('admin', 3120),
        verticalRefs: selected,
      };
      const remotes = [
        createVerticalDescriptor('orders', 3101),
        createVerticalDescriptor('catalog', 3102, { apiProtocol: 'rpc' }),
        createVerticalDescriptor('design', 3103, { preset: 'ui-only' }),
      ];
      writeApp(
        root,
        'inventory-proof',
        shell,
        { strategy: 'workspace', modernPackageVersion: '3.8.3' },
        false,
        remotes,
      );
      const read = (file: string) =>
        fs.readFileSync(path.join(root, shell.directory, file), 'utf8');
      const manifest = JSON.parse(read('package.json'));
      expect(manifest.dependencies['@inventory-proof/orders']).toBe(
        'workspace:*',
      );
      expect(manifest.dependencies['@inventory-proof/catalog']).toBe(
        'workspace:*',
      );
      expect(manifest.dependencies['@inventory-proof/design']).toBeUndefined();
      const clients = read('src/api/vertical-clients.ts');
      expect(clients).toContain("from '@inventory-proof/orders/api/client'");
      expect(clients).toContain(
        "from '@inventory-proof/catalog/api/rpc-client'",
      );
      expect(clients).not.toContain('@inventory-proof/design');
      const federation = read('module-federation.config.ts');
      expect(federation).not.toContain('verticalOrders');
      expect(federation).not.toContain('verticalDesign');
      expect(federation.includes('verticalCatalog')).toBe(
        selected.includes('catalog'),
      );
      expect(Object.keys(manifest['zephyr:dependencies'])).toHaveLength(
        selected.length,
      );
      expect(read('src/routes/vertical-components.tsx')).not.toContain(
        '@inventory-proof/orders',
      );
      expect(shell.verticalRefs).toEqual(selected);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
