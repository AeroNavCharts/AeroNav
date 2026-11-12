import { assetVersion, versioned } from '../lib/assets.js';

const precache = [
  '/',
  '/app',
  '/academy',
  '/donate',
  versioned('/css/home.css'),
  versioned('/css/app.css'),
  versioned('/js/data.js'),
  versioned('/js/scratchpad.js'),
  versioned('/js/chart-viewer.js'),
  versioned('/js/ownship.js'),
  versioned('/js/install.js'),
  versioned('/js/scripts.js'),
  versioned('/js/site-nav.js'),
  versioned('/js/hero-draw.js'),
  '/assets/logo-mark.webp',
  '/assets/logo-wordmark.webp',
  '/assets/logo-full.webp',
  '/assets/icons/icon-192.png',
  '/manifest.webmanifest',
];

const source = `const SHELL = 'aeronav-shell-${assetVersion}';
const RUNTIME = 'aeronav-runtime';
const CHARTS = 'aeronav-charts';
const CHART_LIMIT = 120;
const CHART_HOST = 'lh3.googleusercontent.com';
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('aeronav-shell-') && key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const store = async (cacheName, key, response) => {
  if (!response || !response.ok || response.redirected) return;
  const cache = await caches.open(cacheName);
  await cache.put(key, response);
};

const trim = async (cacheName, limit) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
};

const pageFirst = async (request) => {
  try {
    const response = await fetch(request);
    store(SHELL, request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || (await caches.match('/app')) || (await caches.match('/')) || Response.error();
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  store(SHELL, request, response.clone());
  return response;
};

const refresh = (event, request, cacheName, load) => {
  const update = load().then(async (response) => {
    await store(cacheName, request, response.clone());
    if (cacheName === CHARTS) await trim(CHARTS, CHART_LIMIT);
    return response;
  });
  event.waitUntil(update.catch(() => undefined));
  return caches.match(request).then((cached) => cached || update);
};

const loadChart = (request) =>
  fetch(request.url, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(request));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js') return;
    if (request.mode === 'navigate') {
      event.respondWith(pageFirst(request));
      return;
    }
    if (url.searchParams.has('v')) {
      event.respondWith(cacheFirst(request));
      return;
    }
    event.respondWith(refresh(event, request, SHELL, () => fetch(request)));
    return;
  }

  if (url.hostname === CHART_HOST) {
    event.respondWith(refresh(event, request, CHARTS, () => loadChart(request)));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(refresh(event, request, RUNTIME, () => fetch(request)));
  }
});
`;

export const GET = () =>
  new Response(source, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
