/**
 * The mapped-URL policy moved to `../shared` so the client runtime can derive
 * the same policy the server does — SSR and a hydrated `<Link>` have to agree
 * on the mapping or client navigation targets a path the server will not serve.
 * Re-exported here to keep the server-side import path stable.
 */
export {
  createMappedUrlStrategy,
  resolveMappedUrlStrategy,
} from '../shared/mappedUrlStrategy';
