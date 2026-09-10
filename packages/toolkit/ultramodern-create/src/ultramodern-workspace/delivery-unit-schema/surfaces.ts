import type { WorkspaceApi, WorkspaceApp } from '../types';
import type {
  ApiProtocol,
  ApiSurfaceDescriptor,
  ComponentSurfaceDescriptor,
  RouteSurfaceDescriptor,
  SurfaceLocation,
} from './types';

const SEGMENT_UNSAFE = /[^A-Za-z0-9._-]+/g;
const SEGMENT_TRIM = /^-+|-+$/g;

/** Derive a canonical, SurfaceRef-valid `surfaceId` from an MF expose key. */
export function exposeSurfaceId(key: string): string {
  const trimmed = key.replace(/^\.\//, '');
  const cleaned = trimmed
    .replace(SEGMENT_UNSAFE, '-')
    .replace(SEGMENT_TRIM, '');
  return cleaned === '' ? 'surface' : cleaned;
}

/**
 * Map an expose onto a component-or-route surface.
 *
 * Route heuristic: an expose whose key or local module path mentions `route`
 * is a `route` surface; everything else is a `component`. The exposed local
 * module path (e.g. `./src/...`) is a build detail the canonical model
 * deliberately abstracts away, so it is dropped; the surface's single
 * `browser-mf` location points at the app's MF manifest (derived from
 * `app.port`, the development address for the browser bundle).
 */
export function exposeSurface(
  app: WorkspaceApp,
  key: string,
  value: string,
): ComponentSurfaceDescriptor | RouteSurfaceDescriptor {
  const isRoute = /route/i.test(key) || /route/i.test(value);
  const location: SurfaceLocation = {
    platform: 'browser-mf',
    manifestUrl: `http://localhost:${app.port}/mf-manifest.json`,
  };
  const common = {
    surfaceId: exposeSurfaceId(key),
    locations: [location],
  };
  return isRoute
    ? { kind: 'route', ...common }
    : { kind: 'component', ...common };
}

/** Build the API surface from its declared protocol and concrete transport mount. */
export function apiSurface(
  api: WorkspaceApi,
  protocol: ApiProtocol,
  address = api.prefix,
): ApiSurfaceDescriptor {
  return {
    kind: 'api',
    surfaceId: api.stem,
    protocol,
    locations: [{ platform: 'http', address }],
  };
}
