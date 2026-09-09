import { resolveRouterProvider } from '@modern-js/runtime-extensions/router-provider';
import '../../src/runtime/register';

describe("'@modern-js/plugin-tanstack/runtime' import side effects", () => {
  it('registers the tanstack router provider', () => {
    expect(typeof resolveRouterProvider('tanstack')).toBe('function');
  });
});
