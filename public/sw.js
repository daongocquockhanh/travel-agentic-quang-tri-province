/* Quảng Trị Travel Agent service worker (SYSTEM_DESIGN §8.1, §8.3).
 *
 * - Pages: network-first. The last 5 site pages, plus the map and chat
 *   shells, are kept for offline use; anything else falls back to /offline.
 * - /_next/static: cache-first (content-hashed, immutable).
 * - GET /api/sites*: network-first with cache fallback, so cached site
 *   pages can still load their data.
 * - Downloaded tours (lib/offline.ts): their pages, photo and narration
 *   sit in qt-downloads and are served when the network fails.
 * - Never cached: POST requests and /api/agent/* (chat, voice, TTS).
 *   The last chat thread is kept by the page itself in localStorage.
 */
const VERSION = "v2";
const SHELL = `qt-shell-${VERSION}`;
const PAGES = `qt-pages-${VERSION}`;
const STATIC = `qt-static-${VERSION}`;
const DATA = `qt-data-${VERSION}`;
// Downloaded tours (lib/offline.ts). Unversioned: a new worker must not drop them.
const DOWNLOADS = "qt-downloads";
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
  const keep = new Set([SHELL, PAGES, STATIC, DATA, DOWNLOADS]);
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
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_SITE_PAGES)))
    await cache.delete(req);
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
  // A downloaded tour's photo (Wikimedia Commons): serve the saved copy when there is one.
  if (url.hostname === "commons.wikimedia.org") {
    event.respondWith(
      caches
        .open(DOWNLOADS)
        .then((c) => c.match(request.url))
        .then((hit) => hit ?? fetch(request)),
    );
    return;
  }
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
    const store =
      p.startsWith("/site/") || p === "/map" || p === "/chat" || p === "/tours" || p === "/";
    event.respondWith(
      networkFirst(request, PAGES, { store }).catch(
        async () =>
          // Downloaded tours, then the offline page.
          (await (await caches.open(DOWNLOADS)).match(url.pathname)) ??
          (await caches.match("/offline")) ??
          Response.error(),
      ),
    );
  }
});
