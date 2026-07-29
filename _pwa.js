// ── MANTENEDOR PWA — Service Worker registration ────────────────────────
// Registra o service worker para permitir instalação (Add to Home Screen /
// TWA para Android) e cache básico do app shell. Não interfere nas chamadas
// à API do Supabase (ver sw.js — só faz cache de assets estáticos).
(function(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").catch(function(err){
        console.warn("[PWA] Falha ao registrar service worker:", err);
      });
    });
  }
})();
