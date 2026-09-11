export const cloudflareWorkerSources = {
  main: `module.exports = { requestHandler: async (request, options) => new Response(JSON.stringify({
      pathname: new URL(request.url).pathname,
      entryName: options.resource.entryName,
      htmlTemplate: options.resource.htmlTemplate,
      routeAssetKeys: Object.keys(options.resource.routeManifest.routeAssets || {}),
      loadableName: options.resource.loadableStats.name
    }), { headers: { 'content-type': 'application/json' } }) };`,
  empty: 'module.exports = {};',
  html: `module.exports = { requestHandler: async () => new Response('<!doctype html><html><head><title>styled</title></head><body><header data-modern-boundary-id="explore" data-modern-mf-expose="./Header">Header</header><main data-modern-boundary-id="checkout" data-modern-mf-expose="./CartPage">Cart</main></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }) };`,
  bundleFallback: `module.exports = {
      requestHandler: async (request, options) => new Response(JSON.stringify({
        pathname: new URL(request.url).pathname,
        source: 'bundle-fallback',
        entryName: options.resource.entryName,
        htmlTemplate: options.resource.htmlTemplate
      }), { headers: { 'content-type': 'application/json' } })
    };`,
} as const;
