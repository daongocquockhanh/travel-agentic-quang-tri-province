/* Quảng Trị Travel Agent service worker (SYSTEM_DESIGN §8.1, §8.3).
 *
 * - Pages: network-first. The last 5 site pages, plus the map and chat
 *   shells, are kept for offline use; anything else falls back to /offline.
 * - /_next/static: cache-first (content-hashed, immutable).
 * - GET /api/sites*: network-first with cache fallback, so cached site
 *   pages can still load their data.
 * - Never cached: POST requests and /api/agent/* (chat, voice, TTS).
 *   The last chat thread is kept by the page itself in localStorage.
 */
const VERSION = "v1";
const SHELL = `qt-shell-${VERSION}`;
const PAGES = `qt-pages-${VERSION}`;
const STATIC = `qt-static-${VERSION}`;
const DATA = `qt-data-${VERSION}`;
const MAX_SITE_PAGES = 5;

const SHELL_URLS = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, PAGES, STATIC, DATA]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Keep only the most recently stored site pages. */
async function trimSitePages(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/site/"));
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_SITE_PAGES))) await cache.delete(req);
}

async function networkFirst(request, cacheName, { store }) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && store) {
      // Delete first so re-visits move to the end (most recent).
      await cache.delete(request);
      await cache.put(request, response.clone());
      if (cacheName === PAGES) await trimSitePages(cache);
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: cacheName === PAGES });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/agent/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/api/sites")) {
    event.respondWith(networkFirst(request, DATA, { store: true }));
    return;
  }

  if (request.mode === "navigate") {
    const p = url.pathname;
    const store = p.startsWith("/site/") || p === "/map" || p === "/chat" || p === "/";
    event.respondWith(
      networkFirst(request, PAGES, { store }).catch(async () => (await caches.match("/offline")) ?? Response.error()),
    );
  }
});
