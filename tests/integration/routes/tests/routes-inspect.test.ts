import os from 'node:os';
import { fs } from '@modern-js/utils';
import path from 'path';
import { runModernCommand } from '../../../utils/modernTestUtils';

const sourceAppDir = path.resolve(__dirname, '../');
let appDir = '';

const shouldCopyFixturePath = (sourcePath: string) => {
  const relativePath = path.relative(sourceAppDir, sourcePath);
  const pathSegments = relativePath.split(path.sep);

  return !pathSegments.some(segment =>
    ['.modern-js', 'dist', 'node_modules'].includes(segment),
  );
};

const findRouteByPath = (routes: any[], targetPath: string): any => {
  for (const route of routes) {
    if (route.path === targetPath) {
      return route;
    }
    if (route.children && route.children.length > 0) {
      const found = findRouteByPath(route.children, targetPath);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

describe('routes inspect report', () => {
  beforeAll(async () => {
    appDir = await fs.mkdtemp(path.join(os.tmpdir(), 'modern-routes-inspect-'));
    await fs.copy(sourceAppDir, appDir, {
      filter: shouldCopyFixturePath,
    });
    await fs.ensureSymlink(
      path.join(sourceAppDir, 'node_modules'),
      path.join(appDir, 'node_modules'),
      'dir',
    );

    const distDir = path.join(appDir, './dist');
    if (await fs.pathExists(distDir)) {
      await fs.remove(distDir);
    }

    const result = await runModernCommand(['routes'], {
      cwd: appDir,
      stdout: true,
      stderr: true,
    });
    expect(result.code, result.stderr).toBe(0);
  });

  afterAll(async () => {
    if (appDir) {
      await fs.remove(appDir);
    }
  });

  test('should generate correct routes inspect report', async () => {
    const reportPath = path.join(appDir, './dist/routes-inspect.json');

    expect(await fs.pathExists(reportPath)).toBeTruthy();

    const report = await fs.readJSON(reportPath);

    expect(report).toHaveProperty('four');
    expect(report).toHaveProperty('three');
    expect(report.four).toHaveProperty('routes');
    expect(report.three).toHaveProperty('routes');

    const fourRoutes = report.four.routes;
    const fourRoot = fourRoutes[0];
    const fourChildren = fourRoot.children!;

    const dynamicRoute = findRouteByPath(fourChildren, ':id');
    expect(dynamicRoute).toBeDefined();
    expect(dynamicRoute?.params).toEqual(['id']);

    const optionalRoute = findRouteByPath(fourChildren, 'act/:bid?');
    expect(optionalRoute).toBeDefined();
    expect(optionalRoute?.params).toEqual(['bid?']);
  });
});
