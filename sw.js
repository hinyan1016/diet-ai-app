const CACHE = 'diet-ai-v2';
const ASSETS = [
  './', './index.html', './css/styles.css', './manifest.json',
  './js/app.js', './js/ui.js', './js/constants.js', './js/nutrition.js',
  './js/schema.js', './js/ai.js', './js/camera.js', './js/db.js',
  './js/backup.js', './js/utils.js',
  './js/screens/home.js', './js/screens/capture.js', './js/screens/history.js',
  './js/screens/trends.js', './js/screens/settings.js',
  './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === 'api.anthropic.com') return; // API呼び出しはキャッシュしない

  const isHTML = e.request.mode === 'navigate' ||
    (e.request.destination === 'document') ||
    url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // network-first（更新を確実に反映、オフライン時はキャッシュ）
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  // 静的アセットは cache-first
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
