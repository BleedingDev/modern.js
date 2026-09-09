import { normalizePathname, splitUrlTarget } from '../src/url';

describe('test ./src/url.ts', () => {
  it('should normalize path correctly', () => {
    let pathname = '/';

    expect(normalizePathname(pathname)).toBe('/');

    pathname = '/api';
    expect(normalizePathname(pathname)).toBe('/api');

    pathname = '/api/';
    expect(normalizePathname(pathname)).toBe('/api');

    pathname = '/a/b/c/d';
    expect(normalizePathname(pathname)).toBe('/a/b/c/d');

    pathname = '/a/b/c/d/';
    expect(normalizePathname(pathname)).toBe('/a/b/c/d');

    pathname = '//';
    expect(normalizePathname(pathname)).toBe('/');

    pathname = '/api//';
    expect(normalizePathname(pathname)).toBe('/api');
  });
});

describe('splitUrlTarget', () => {
  test('splits pathname, search and hash', () => {
    expect(splitUrlTarget('/talks?tag=x#abstract')).toEqual({
      pathname: '/talks',
      search: '?tag=x',
      hash: '#abstract',
    });
    expect(splitUrlTarget('/#work-with-me')).toEqual({
      pathname: '/',
      search: '',
      hash: '#work-with-me',
    });
    expect(splitUrlTarget('/talks')).toEqual({
      pathname: '/talks',
      search: '',
      hash: '#'.slice(1) === '' ? '' : '',
    });
    expect(splitUrlTarget('?q=1#x')).toEqual({
      pathname: '',
      search: '?q=1',
      hash: '#x',
    });
  });
});

test('hash contents do not become query parameters', () => {
  expect(splitUrlTarget('/a#x?y=2')).toEqual({
    pathname: '/a',
    search: '',
    hash: '#x?y=2',
  });
});
