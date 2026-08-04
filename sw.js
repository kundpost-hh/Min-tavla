// Min Tavla – service worker
// Strategi: "network-first" för sidan själv (så inloggade användare alltid får senaste
// versionen när de har nät), med fallback till cache när man är offline.
// OBS: rör INTE anrop till Google/Firebase (inloggning, Firestore) – de ska alltid gå ut på nätet.
//
// FIX (v2): fetch(req) respekterade tidigare webbläsarens EGEN inbyggda HTTP-cache (helt skild
// från Cache Storage-API:t nedan). Om hosten (t.ex. GitHub Pages) skickar cache-headers på
// filerna kunde webbläsaren då tysta returnera en gammal, cachad version direkt - även om koden
// SÅG UT att göra ett färskt nätverksanrop. Det gav precis symptomet "jag laddar upp en ny
// index.html men inget uppdateras, och inget felmeddelande visas". Lösningen är att tvinga
// fram ett äkta nätverksanrop med { cache: 'no-store' }, som går förbi webbläsarens HTTP-cache
// helt. Cachenamnet är också höjt till v2 så alla som redan har den gamla, "läckande" versionen
// installerad får en ren cache-städning nästa gång de öppnar sidan.
const CACHE_NAME = 'min-tavla-cache-v2';
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
    // FIX: { cache: 'no-store' } tvingar fram ett äkta nätverksanrop förbi webbläsarens
    // inbyggda HTTP-cache, så vi alltid får den absolut senaste filen från servern när vi
    // är online - inte en potentiellt gammal version som webbläsaren råkar ha liggande.
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
