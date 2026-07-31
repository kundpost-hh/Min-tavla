// Min Tavla – service worker
// Strategi: "network-first" för sidan själv (så inloggade användare alltid får senaste
// versionen när de har nät), med fallback till cache när man är offline.
// OBS: rör INTE anrop till Google/Firebase (inloggning, Firestore) – de ska alltid gå ut på nätet.

const CACHE_NAME = 'min-tavla-cache-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Rör aldrig externa anrop (Google-inloggning, Firebase, YouTube, Gemini m.m.) –
  // de måste alltid gå live mot nätet, inte cachas.
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
