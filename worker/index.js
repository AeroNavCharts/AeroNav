const DRIVE_ID = /^[A-Za-z0-9_-]{20,80}$/;

const reply = (text, status) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/pdf\/([^/]+)$/);
    if (!match) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return reply('Method not allowed', 405);
    const id = match[1];
    if (!DRIVE_ID.test(id)) return reply('Not found', 404);

    const key = new Request(`${url.origin}/pdf/${id}`);
    const cached = await caches.default.match(key);
    if (cached) return cached;

    const listing = await env.ASSETS.fetch(new Request(`${url.origin}/js/data.js`));
    if (!listing.ok || !(await listing.text()).includes(`/d/${id}/`)) return reply('Not found', 404);

    const upstream = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download`);
    if (!upstream.ok) return reply('Document unavailable', 502);
    const body = await upstream.arrayBuffer();
    const head = String.fromCharCode(...new Uint8Array(body.slice(0, 5)));
    if (head !== '%PDF-') return reply('Not a PDF', 415);

    const response = new Response(body, {
      headers: {
        'content-type': 'application/pdf',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
    ctx.waitUntil(caches.default.put(key, response.clone()));
    return response;
  },
};
