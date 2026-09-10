/**
 * we use `pathname.replace(/\/+$/, '')` to remove the '/' with end.
 *
 * examples:
 *
 * pathname1: '/api', pathname2: '/api/',
 * pathname1 as same as pathname2
 *
 * pathname3: '/', the nomalizeResult also as '/'
 */
export function normalizePathname(pathname: string): string {
  const normalized = '/' + pathname.replace(/^\/+|\/+$/g, '');

  if (normalized === '/') {
    return normalized;
  }

  return normalized;
}

/** Split a relative target without decoding or normalizing its suffix. */
export const splitUrlTarget = (
  target: string,
): { pathname: string; search: string; hash: string } => {
  const hashIndex = target.indexOf('#');
  const hash = hashIndex >= 0 ? target.slice(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const searchIndex = beforeHash.indexOf('?');
  const search = searchIndex >= 0 ? beforeHash.slice(searchIndex) : '';
  const pathname =
    searchIndex >= 0 ? beforeHash.slice(0, searchIndex) : beforeHash;

  return { pathname, search, hash };
};
