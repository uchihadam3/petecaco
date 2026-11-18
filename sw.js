// Service worker do Petecaço: instala o jogo, funciona offline e se atualiza sozinho.
// Estratégia: rede primeiro (sempre pega a versão mais nova publicada), cache como reserva offline.
const VERSION = '1.2.0';
const CACHE = 'petecaco-' + VERSION;
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/game.js', './js/data.js', './js/save.js', './js/audio.js', './js/physics.js',
  './js/world.js', './js/peteca.js', './js/fx.js', './js/character.js', './js/player.js', './js/ai.js',
  './js/input.js', './js/ui.js', './js/app.js', './js/assists.js', './lib/three.module.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('petecaco-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // fontes do Google: cache primeiro
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // rede primeiro, revalidando (no-cache) pra nunca ficar preso numa versão velha
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return c.match('./index.html');
      return Response.error();
    }
  })());
});
