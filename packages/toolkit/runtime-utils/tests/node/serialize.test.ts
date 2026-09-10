import { rstest } from '@rstest/core';

describe('serializeJson', () => {
  beforeEach(() => {
    rstest.resetModules();
  });

  it('does not generate random values while the module is initialized', async () => {
    const getRandomValues = rstest.spyOn(globalThis.crypto, 'getRandomValues');

    await import('../../src/node/serialize');

    expect(getRandomValues).not.toHaveBeenCalled();
    getRandomValues.mockRestore();
  });

  it('serializes JSON safely and preserves the undefined literal contract', async () => {
    const { serializeJson } = await import('../../src/node/serialize');
    const payload = { value: '</script>\u2028\u2029' };
    const serialized = serializeJson(payload);

    expect(serialized).not.toContain('</script>');
    expect(JSON.parse(serialized)).toEqual(payload);
    expect(serializeJson(undefined)).toBe('undefined');
  });
});
