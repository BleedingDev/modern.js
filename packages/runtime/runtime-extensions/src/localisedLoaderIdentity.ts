interface RouteNode {
  id?: string;
  children?: RouteNode[];
  modernLocalisedRoute?: { id?: string };
}

/** Map a source loader ID only to its own alias already matched by the router. */
export function resolveLocalisedLoaderRouteId(
  routes: RouteNode[],
  requestedId: string,
  matchedIds: (string | undefined)[] = [],
): string {
  if (matchedIds.includes(requestedId)) return requestedId;
  const matched = new Set(matchedIds);
  const visit = (nodes: RouteNode[]): string | undefined => {
    for (const route of nodes) {
      if (
        route.id &&
        matched.has(route.id) &&
        route.modernLocalisedRoute?.id === requestedId
      ) {
        return route.id;
      }
      const child = route.children && visit(route.children);
      if (child) return child;
    }
    return undefined;
  };
  return visit(routes) ?? requestedId;
}
