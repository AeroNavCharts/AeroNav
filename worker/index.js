const CHART_ROUTE = /^\/chart-file\/([A-Za-z0-9_-]{10,80})$/;
const MAX_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const match = url.pathname.match(CHART_ROUTE);
    if (!match) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const upstream = await fetch(`https://drive.usercontent.google.com/download?id=${match[1]}&export=download`);
    if (!upstream.ok) return new Response('Chart not found', { status: 404 });

    const body = await upstream.arrayBuffer();
    const head = new Uint8Array(body.slice(0, 4));
    const isPdf = PDF_MAGIC.every((byte, i) => head[i] === byte);
    if (!isPdf || body.byteLength > MAX_BYTES) {
      return new Response('Unsupported chart file', { status: 415 });
    }

    const response = new Response(body, {
      headers: {
        'content-type': 'application/pdf',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
