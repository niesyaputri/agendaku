/**
 * ============================================================
 *  AgendaKu — sw.js  (service worker)
 *  Keeps a copy of the app on the phone so it opens instantly
 *  and still opens without internet.
 *  When you upload a new version of the app, change CACHE below
 *  (for example v1 -> v2) so phones pick up the new files.
 * ============================================================
 */
const CACHE = 'agendaku-v4';
const FILES = ['./', 'index.html', 'styles.css', 'config.js', 'hash.js', 'i18n.js', 'parser.js', 'app.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only the app's own files are cached. Data requests to Google always go to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
