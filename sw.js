const CACHE = "budget-v3";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./config.js",
  "./js/app.js", "./js/ctx.js", "./js/state.js", "./js/utils.js",
  "./js/data.js", "./js/calculations.js", "./js/modals.js",
  "./js/ai.js", "./js/render.js", "./js/auth.js",
  "./icon.svg", "./icon-192.png", "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((x) => x !== CACHE).map((x) => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Appels API Supabase : toujours réseau, jamais mis en cache
  if (url.hostname.endsWith("supabase.co") || url.hostname === "esm.sh") return;
  // index.html : réseau d'abord pour toujours servir la dernière version
  if (url.pathname === "/" || url.pathname.endsWith("/index.html")) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  // Autres assets (JS, icônes, manifest) : cache d'abord, réseau en secours
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
