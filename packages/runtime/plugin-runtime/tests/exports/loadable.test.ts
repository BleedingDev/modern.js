import * as loadableDependency from '@loadable/component';
import loadable, { lazy, loadableReady } from '../../src/exports/loadable';

describe('runtime loadable export', () => {
  test('imports the real dependency and creates callable loadable components', () => {
    expect(typeof loadableDependency.default).toBe('function');
    expect(typeof loadable).toBe('function');
    expect(typeof lazy).toBe('function');
    expect(typeof loadableReady).toBe('function');

    const loader = () => Promise.resolve({ default: () => null });
    const component = (loadable as any)(loader);
    const lazyComponent = (lazy as any)(loader);

    expect(component).toMatchObject({ render: expect.any(Function) });
    expect(lazyComponent).toMatchObject({ render: expect.any(Function) });
  });
});
