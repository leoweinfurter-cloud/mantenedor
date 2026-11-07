// ── AVALIAÇÃO — service worker (escopo /avaliacao/) ──────────────────────
// Guarda o "app shell" para o levantamento em campo funcionar sem internet.
// NUNCA intercepta chamadas ao Supabase (outra origem): os dados vivem no
// IndexedDB e sincronizam pelo código da página.
var CACHE = "avl-shell-v1";
var SHELL = [
  "./", "index.html", "login.html", "avaliacao.html", "bem.html", "laudo.html",
  "calc.js", "sync.js", "_shared.js", "assets/avaliacao.css",
  "assets/timbrado-topo.jpg", "assets/timbrado-rodape.jpg"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () { /* ignora falha isolada */ }); }));
  }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("avl-shell-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase etc.: direto na rede
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp && resp.ok) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
      return resp;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("index.html"); });
    })
  );
});
