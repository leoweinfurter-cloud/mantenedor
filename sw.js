// ── MANTENEDOR SERVICE WORKER ────────────────────────────────────────────
// Cache do "app shell" (HTML/CSS/JS estáticos) para permitir instalação
// (PWA/TWA) e carregamento mais rápido/resiliente. NUNCA faz cache de
// chamadas à API do Supabase — dados sempre vêm da rede, para não servir
// informação desatualizada ou quebrar a autenticação.

var CACHE_VERSION = "mx-shell-v1";

var APP_SHELL = [
  "./",
  "index.html",
  "login.html",
  "dashboard.html",
  "ordens.html",
  "ordens-corretiva.html",
  "ordens-programada.html",
  "ativos.html",
  "cadastros.html",
  "calendario.html",
  "relatorios.html",
  "_shared.js",
  "_lang.js",
  "_theme.js",
  "_pwa.js",
  "_style.css",
  "_style_light.css",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache){
      return cache.addAll(APP_SHELL).catch(function(err){
        console.warn("[SW] Falha ao pré-cachear app shell:", err);
      });
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_VERSION; })
            .map(function(key){ return caches.delete(key); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;

  // Só GET, só same-origin. Chamadas ao Supabase (API/Auth) e qualquer
  // outro domínio passam direto pela rede, sem cache.
  if(req.method !== "GET" || new URL(req.url).origin !== self.location.origin){
    return;
  }

  // Stale-while-revalidate: responde do cache imediatamente (se houver)
  // e atualiza o cache em segundo plano.
  event.respondWith(
    caches.open(CACHE_VERSION).then(function(cache){
      return cache.match(req).then(function(cached){
        var fetchPromise = fetch(req).then(function(networkResp){
          if(networkResp && networkResp.ok){
            cache.put(req, networkResp.clone());
          }
          return networkResp;
        }).catch(function(){
          return cached; // offline: usa o que tiver em cache
        });
        return cached || fetchPromise;
      });
    })
  );
});
