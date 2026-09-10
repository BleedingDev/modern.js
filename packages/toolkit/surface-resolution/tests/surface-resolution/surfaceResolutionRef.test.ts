import {
  formatSurfaceRef,
  type ParsedSurfaceRef,
  parseSurfaceRef,
  type SurfaceRefParseError,
} from '../../src/surface-resolution';

function expectError(input: string, error: SurfaceRefParseError) {
  expect(parseSurfaceRef(input)).toEqual({ ok: false, error });
}

const validReferences: Array<[string, ParsedSurfaceRef]> = [
  ['acme/checkout#cart', { unitId: 'acme/checkout', surfaceId: 'cart' }],
  [
    'acme/checkout#cart@v2',
    { unitId: 'acme/checkout', surfaceId: 'cart', major: 2 },
  ],
  ['checkout#cart@v10', { unitId: 'checkout', surfaceId: 'cart', major: 10 }],
  [
    'Acme-2/check_out.v1#Cart_2.x-y',
    { unitId: 'Acme-2/check_out.v1', surfaceId: 'Cart_2.x-y' },
  ],
];

describe('parseSurfaceRef', () => {
  it.each(validReferences)('parses and formats %s', (input, ref) => {
    expect(parseSurfaceRef(input)).toEqual({ ok: true, ref });
    expect(formatSurfaceRef(ref)).toBe(input);
  });

  it('rejects empty input', () => {
    expectError('', { code: 'empty' });
  });

  it('rejects missing and multiple separators', () => {
    expectError('acme/checkout', { code: 'missing-surface-separator' });
    expectError('acme#checkout#cart', { code: 'multiple-surface-separators' });
  });

  it('rejects empty and invalid unit ids', () => {
    expectError('#cart', { code: 'empty-unit-id' });
    expectError('acme//checkout#cart', {
      code: 'invalid-unit-id',
      segment: '',
    });
    expectError('acme/check out#cart', {
      code: 'invalid-unit-id',
      segment: 'check out',
    });
    expectError('/checkout#cart', { code: 'invalid-unit-id', segment: '' });
  });

  it('rejects empty and invalid surface ids', () => {
    expectError('acme#', { code: 'empty-surface-id' });
    expectError('acme#cart/extra', { code: 'invalid-surface-id' });
    expectError('acme#cart cart', { code: 'invalid-surface-id' });
  });

  it('rejects malformed majors', () => {
    expectError('acme#cart@', { code: 'empty-major' });
    expectError('acme#cart@2', { code: 'invalid-major', value: '2' });
    expectError('acme#cart@v0', { code: 'invalid-major', value: 'v0' });
    expectError('acme#cart@v01', { code: 'invalid-major', value: 'v01' });
    expectError('acme#cart@vx', { code: 'invalid-major', value: 'vx' });
    expectError('acme#cart@v1.2', { code: 'invalid-major', value: 'v1.2' });
  });

  it('rejects majors outside the safe-integer range', () => {
    const tooBig = '9007199254740993';
    expect(parseSurfaceRef(`acme#cart@v${tooBig}`)).toMatchObject({
      ok: false,
      error: { code: 'invalid-major' },
    });
  });
});

describe('formatSurfaceRef', () => {
  it('throws for invalid direct inputs with the shared invariant', () => {
    const invalid: Array<[ParsedSurfaceRef, string]> = [
      [{ unitId: '', surfaceId: 'cart' }, 'empty-unit-id'],
      [{ unitId: 'acme/', surfaceId: 'cart' }, 'invalid-unit-id'],
      [{ unitId: 'acme', surfaceId: '' }, 'empty-surface-id'],
      [{ unitId: 'acme', surfaceId: 'a/b' }, 'invalid-surface-id'],
      [{ unitId: 'acme', surfaceId: 'cart', major: 0 }, 'invalid-major'],
      [{ unitId: 'acme', surfaceId: 'cart', major: 1.5 }, 'invalid-major'],
      [
        {
          unitId: 'acme',
          surfaceId: 'cart',
          major: Number.MAX_SAFE_INTEGER + 2,
        },
        'invalid-major',
      ],
    ];
    for (const [ref, code] of invalid) {
      expect(() => formatSurfaceRef(ref)).toThrow(code);
    }
  });
});
