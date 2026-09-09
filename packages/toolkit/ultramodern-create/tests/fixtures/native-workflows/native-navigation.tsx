// Standalone native code-route example, not a replacement generated route tree.
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';

const rootRoute = createRootRoute({ component: Outlet });
const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$lang/catalog',
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
  component: Catalog,
});

function Catalog() {
  const { lang } = catalogRoute.useParams();
  const { q } = catalogRoute.useSearch();
  const navigate = useNavigate({ from: '/$lang/catalog' });

  return (
    <>
      <Link to="/$lang/catalog" params={{ lang }} search={{ q: 'plough' }}>
        Find ploughs
      </Link>
      <p>Filter: {q}</p>
      <button type="button" onClick={() => navigate({ search: { q: '' } })}>
        Clear filter
      </button>
    </>
  );
}

export const router = createRouter({
  routeTree: rootRoute.addChildren([catalogRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
