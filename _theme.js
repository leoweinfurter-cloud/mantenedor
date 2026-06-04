// ── MAINTENX THEME MANAGER ────────────────────────────────────────────────
(function(){
  var DARK  = "_style.css";
  var LIGHT = "_style_light.css";
  var KEY   = "mx_theme";

  // Aplica tema salvo antes de renderizar (evita flash)
  function applyTheme(theme){
    var link = document.getElementById("theme-link");
    if(link) link.href = theme === "light" ? LIGHT : DARK;
    document.body.classList.toggle("theme-light", theme === "light");
  }

  // Aplica imediatamente
  var saved = localStorage.getItem(KEY) || "dark";
  applyTheme(saved);

  // Injeta botão no topbar quando DOM estiver pronto
  document.addEventListener("DOMContentLoaded", function(){
    applyTheme(localStorage.getItem(KEY) || "dark");

    var topbar = document.getElementById("topbar");
    if(!topbar) return;

    var btn = document.createElement("button");
    btn.id = "theme-btn";
    btn.title = "Alternar tema claro/escuro";
    btn.style.cssText = [
      "background:transparent",
      "border:1px solid var(--theme-border, #1e3a5f)",
      "border-radius:8px",
      "padding:6px 10px",
      "cursor:pointer",
      "font-size:16px",
      "line-height:1",
      "transition:all .2s",
      "flex-shrink:0"
    ].join(";");

    function updateBtn(){
      var t = localStorage.getItem(KEY) || "dark";
      btn.textContent = t === "dark" ? "\uD83C\uDF19" : "\u2600\uFE0F";
      btn.title = t === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro";
    }
    updateBtn();

    btn.onclick = function(){
      var current = localStorage.getItem(KEY) || "dark";
      var next = current === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      applyTheme(next);
      updateBtn();
    };

    // Insere antes do último elemento do topbar (avatar)
    topbar.appendChild(btn);
  });
})();
