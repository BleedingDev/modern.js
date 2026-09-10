---
'@modern-js/ultramodern-create': patch
---

Default generated TanStack workspaces no longer depend on `react-router`. Module Federation now runs `@module-federation/bridge-react`'s router-free base entry via `bridge.enableBridgeRouter: false`, with TanStack Router as the application router. React Router support remains dependency-driven: declaring `react-router` (or `react-router-dom`) as a direct dependency of an app marks it a React Router consumer, so the generator emit `enableBridgeRouter: true` for that app's federation config and the workspace validator accepts it. The workspace validator requires the correct value for each app.
