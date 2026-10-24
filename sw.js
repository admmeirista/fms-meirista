/* FMS Meirista — service worker (GitHub Pages).
 * Tujuan: aplikasi tetap TERBUKA saat internet putus / halaman di-refresh offline, supaya rekaman di antrean
 * perangkat bisa dipulihkan & dilanjutkan. Halaman: jaringan dulu (selalu versi terbaru), salinan terakhir bila offline.
 * Data (panggilan API ke Apps Script) TIDAK pernah di-cache. */
var CACHE = 'fms-shell-v1';
var SHELL = './';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('fms-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // halaman aplikasi: jaringan dulu (maks 8 dtk) → simpan salinan; gagal → salinan terakhir
  if (req.mode === 'navigate') {
    e.respondWith(Promise.race([fetch(req), timeout(8000)]).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(SHELL, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(SHELL).then(function (hit) { return hit || new Response('<h3 style="font-family:sans-serif">Offline — aplikasi belum pernah dibuka di perangkat ini.</h3>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); });
    }));
    return;
  }

  // ikon/logo sendiri & pustaka MD5 (verifikasi video): cache dulu, jaringan bila belum ada
  var mine = url.origin === self.location.origin && /\.(png|webp|webmanifest|ico|svg)$/.test(url.pathname);
  var lib = url.hostname === 'cdnjs.cloudflare.com' && url.pathname.indexOf('/spark-md5/') >= 0;
  if (mine || lib) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
