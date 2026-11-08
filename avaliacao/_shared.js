// ═══════════════════════════════════════════════════════════════════════
//  AVALIAÇÃO — helpers compartilhados (módulo isolado do Mantenedor)
//  Mesmo projeto Supabase, tabelas próprias (prefixo avl_), auth própria
//  (chave de sessão avl_session) e armazenamento local em IndexedDB para
//  o levantamento em campo sem internet. Requer calc.js e sync.js antes.
// ═══════════════════════════════════════════════════════════════════════

var AVL_SB_URL = "https://mtmcrpigiwsxfwxkqdkz.supabase.co";
// Chave anon/public do projeto (nunca a service_role).
var AVL_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10bWNycGlnaXdzeGZ3eGtxZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTYxNTYsImV4cCI6MjA5NTkzMjE1Nn0.U3_-Fh35p-l3ZYSApbmn-7KRLlF1voZWS5Pbm0_LQ7A";

// ── SESSÃO ──────────────────────────────────────────────────────────────
function avlSession() {
  try { return JSON.parse(localStorage.getItem("avl_session") || "null"); } catch (e) { return null; }
}
function avlSetSession(d) {
  var s = {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Date.now() + ((d.expires_in || 3600) * 1000),
    user: d.user ? { id: d.user.id, email: d.user.email } : (avlSession() || {}).user
  };
  localStorage.setItem("avl_session", JSON.stringify(s));
  return s;
}
function avlRequireLogin() {
  var s = avlSession();
  if (!s || !s.access_token) { window.location.href = "login.html"; return null; }
  return s;
}
function avlLogout() {
  if (!confirm("Sair? Dados ainda não sincronizados continuam guardados neste aparelho.")) return;
  localStorage.removeItem("avl_session");
  window.location.href = "login.html";
}
async function avlLogin(email, senha) {
  var r = await fetch(AVL_SB_URL + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { "apikey": AVL_SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: senha })
  });
  var d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.msg || "Falha no login");
  return avlSetSession(d);
}
async function avlRefresh() {
  var s = avlSession();
  if (!s || !s.refresh_token) throw new Error("sem refresh_token");
  var r = await fetch(AVL_SB_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST", headers: { "apikey": AVL_SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh_token })
  });
  var d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.msg || "sessão expirada");
  return avlSetSession(d);
}
// Renova o token só quando está perto de vencer (e há rede).
async function avlToken() {
  var s = avlSession();
  if (!s) throw new Error("sem sessão");
  if (s.expires_at - Date.now() < 60000 && navigator.onLine) { s = await avlRefresh(); }
  return s.access_token;
}
// REST com token válido e 1 retry em 401. Compatível com AVLSYNC.
async function avlRequest(method, path, body, headers) {
  async function once() {
    var tk = await avlToken();
    var h = Object.assign({ "apikey": AVL_SB_KEY, "Authorization": "Bearer " + tk, "Content-Type": "application/json" }, headers || {});
    return fetch(AVL_SB_URL + "/rest/v1/" + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined });
  }
  var r = await once();
  if (r.status === 401) { try { await avlRefresh(); r = await once(); } catch (e) { /* devolve o 401 original */ } }
  return r;
}

// ── UTILIDADES ──────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function avlUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function avlQS(k) { return new URLSearchParams(window.location.search).get(k); }
function avlFmtData(d) {
  if (!d) return "";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : d;
}
function avlHoje() {
  var d = new Date(); function p(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function avlToast(msg, tipo) {
  var el = document.createElement("div");
  el.className = "avl-toast " + (tipo || "");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.classList.add("show"); }, 10);
  setTimeout(function () { el.classList.remove("show"); setTimeout(function () { el.remove(); }, 300); }, tipo === "erro" ? 6000 : 2600);
}
function avlDebounce(fn, ms) {
  var t = null;
  return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
}

// ── ARMAZENAMENTO LOCAL (IndexedDB) ─────────────────────────────────────
// Mesma interface do AVLSYNC.MemStore.
function AvlIDB() { this.db = null; }
AvlIDB.prototype.open = function () {
  var self = this;
  if (self.db) return Promise.resolve(self.db);
  return new Promise(function (resolve, reject) {
    var rq = indexedDB.open("avl_db", 1);
    rq.onupgradeneeded = function () {
      var db = rq.result;
      ["avaliacoes", "bens", "cotacoes"].forEach(function (n) {
        var os = db.createObjectStore(n, { keyPath: "id" });
        os.createIndex("_dirty", "_dirty");
      });
      db.createObjectStore("meta", { keyPath: "k" });
    };
    rq.onsuccess = function () { self.db = rq.result; resolve(self.db); };
    rq.onerror = function () { reject(rq.error || new Error("IndexedDB indisponível")); };
  });
};
AvlIDB.prototype._req = function (name, mode, fn) {
  return this.open().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(name, mode), os = tx.objectStore(name), out;
      try { out = fn(os); } catch (e) { reject(e); return; }
      tx.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : undefined); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error("transação abortada")); };
    });
  });
};
AvlIDB.prototype.all = function (n) { return this._req(n, "readonly", function (os) { return os.getAll(); }).then(function (r) { return r || []; }); };
AvlIDB.prototype.get = function (n, id) { return this._req(n, "readonly", function (os) { return os.get(id); }); };
AvlIDB.prototype.put = function (n, rec) { return this._req(n, "readwrite", function (os) { return os.put(rec); }); };
AvlIDB.prototype.dirty = function (n) { return this._req(n, "readonly", function (os) { return os.index("_dirty").getAll(1); }).then(function (r) { return r || []; }); };
AvlIDB.prototype.getMeta = function (k) { return this._req("meta", "readonly", function (os) { return os.get(k); }).then(function (r) { return r ? r.v : undefined; }); };
AvlIDB.prototype.setMeta = function (k, v) { return this._req("meta", "readwrite", function (os) { return os.put({ k: k, v: v }); }); };

var AVL_STORE = new AvlIDB();
var _avlTs = 0;

// Salva localmente (marca como pendente) e agenda sincronização.
async function avlSalvar(nome, rec) {
  rec._dirty = 1;
  rec._local_ts = Math.max(Date.now(), _avlTs + 1); _avlTs = rec._local_ts;
  await AVL_STORE.put(nome, rec);
  avlAgendarSync();
  avlAtualizarBarra();
  return rec;
}

// ── DADOS ───────────────────────────────────────────────────────────────
function avlNovaAvaliacao() {
  var s = avlSession();
  return {
    id: avlUuid(), owner_id: s && s.user ? s.user.id : undefined,
    titulo: "", processo: "", cliente: "", empresa_avaliada: "", local_vistoria: "",
    data_base: null, data_vistoria: avlHoje(),
    finalidade: "Partilha de bens na dissolução da sociedade", tipo_valor: "mercado_em_uso",
    art_numero: "", ff_padrao: 0.90, margem_arbitrio: 15,
    vlf_ativo: false, vlf_custos: 7, vlf_juros_mensal: 1.2, vlf_meses: 6,
    pressupostos: "", ressalvas: "", observacoes: "", excluido: false, criado_em: new Date().toISOString()
  };
}
function avlNovoBem(avId, numero) {
  var s = avlSession();
  return {
    id: avlUuid(), avaliacao_id: avId, owner_id: s && s.user ? s.user.id : undefined,
    numero: numero, quantidade: 1, tag: "", cod_contabil: "", descricao: "", fabricante: "", modelo: "", serie: "",
    ano_fabricacao: null, ano_aquisicao: null, capacidade: "", comando: "", horimetro: "", localizacao: "",
    integracao: "isolada", funcionamento: "nao_observado", estado: "", manutencao: "", regime: "", ambiente: "normal",
    retrofit: "", idade_aparente: null, nr12: "nao_avaliado", nr12_custo: null, custo_reparos: null, obsolescencia: "",
    fobs: 1, liquidez: "", propriedade: "propria", onus: "nenhum", onus_credor: "", onus_saldo: null,
    valor_aquisicao: null, valor_contabil: null, vida_util_ref: "", vida_util_anos: null, residual_pct: 10,
    valor_novo: null, custos_adicionais: null, valor_novo_fonte: "", metodo: "comparativo",
    valor_manual: null, justificativa_manual: "", peso_kg: null, preco_sucata_kg: null,
    fotos_qtd: 0, fotos_nomes: [], checklist: {}, observacoes: "", excluido: false, criado_em: new Date().toISOString()
  };
}
function avlNovaCotacao(avId, bemId, tipo) {
  var s = avlSession();
  return {
    id: avlUuid(), avaliacao_id: avId, bem_id: bemId, owner_id: s && s.user ? s.user.id : undefined,
    tipo: tipo || "oferta", fonte: "", referencia: "", data_coleta: avlHoje(), descricao: "", ano: null,
    preco: null, ff: null, fid: null, fest: null, fcap: null, fop: null, curva: "bom", direta: false,
    incluido: true, observacoes: "", excluido: false, criado_em: new Date().toISOString()
  };
}
// Carrega tudo de uma avaliação (sem excluídos).
async function avlCarregar(avId) {
  var av = await AVL_STORE.get("avaliacoes", avId);
  var bens = (await AVL_STORE.all("bens")).filter(function (b) { return b.avaliacao_id === avId && !b.excluido; });
  var cots = (await AVL_STORE.all("cotacoes")).filter(function (c) { return c.avaliacao_id === avId && !c.excluido; });
  return { av: av, bens: bens, cots: cots };
}

// ── SINCRONIZAÇÃO ───────────────────────────────────────────────────────
var _avlSyncando = false;
async function avlSincronizar(silencioso) {
  if (_avlSyncando) return null;
  if (!navigator.onLine) { if (!silencioso) avlToast("Sem conexão. Os dados continuam salvos neste aparelho.", "erro"); return null; }
  _avlSyncando = true; avlAtualizarBarra();
  try {
    var r = await AVLSYNC.sincronizar({ store: AVL_STORE, request: avlRequest });
    if (!silencioso) avlToast("Sincronizado: " + r.enviados + " enviado(s), " + r.recebidos + " recebido(s).");
    if (typeof avlAposSync === "function" && (r.recebidos > 0)) avlAposSync(r);
    return r;
  } catch (e) {
    console.error("[AVL] sync falhou", e);
    avlToast("Falha ao sincronizar: " + e.message, "erro");
    return null;
  } finally { _avlSyncando = false; avlAtualizarBarra(); }
}
var avlAgendarSync = avlDebounce(function () { if (navigator.onLine && avlSession()) avlSincronizar(true); }, 4000);

async function avlAtualizarBarra() {
  var el = document.getElementById("avl-syncbar");
  if (!el) return;
  var pend = 0, ultima = "";
  try { pend = await AVLSYNC.pendentes(AVL_STORE); var u = await AVL_STORE.getMeta("ultima_sync"); ultima = u ? new Date(u).toLocaleString("pt-BR") : ""; } catch (e) { /* ignora */ }
  var on = navigator.onLine;
  el.className = "avl-syncbar " + (on ? (pend ? "pend" : "ok") : "off");
  el.innerHTML =
    '<span><b>' + (_avlSyncando ? "Sincronizando…" : (on ? (pend ? pend + " alteração(ões) pendente(s)" : "Tudo sincronizado") : "Offline — salvando neste aparelho")) + '</b>' +
    (ultima && !pend ? ' <small>· última: ' + esc(ultima) + '</small>' : '') + '</span>' +
    '<button type="button" class="avl-btn sm ghost" onclick="avlSincronizar()">Sincronizar</button>';
}

// ── LAYOUT ──────────────────────────────────────────────────────────────
function avlTopbar(titulo, voltarHref) {
  var s = avlSession();
  return '<div class="avl-topbar"><div class="avl-brand">' +
    (voltarHref ? '<a class="avl-back" href="' + voltarHref + '" aria-label="Voltar">&#8592;</a>' : '') +
    '<span class="avl-logo">M</span><span>' + esc(titulo) + '</span></div>' +
    '<div class="avl-top-right">' + (s && s.user ? '<small>' + esc(s.user.email) + '</small>' : '') +
    '<button class="avl-btn sm ghost light" onclick="avlLogout()">Sair</button></div></div>' +
    '<div id="avl-syncbar" class="avl-syncbar"></div>';
}

function avlIniciarPagina() {
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(function () { /* sem SW: segue online */ }); }
  window.addEventListener("online", function () { avlAtualizarBarra(); avlSincronizar(true); });
  window.addEventListener("offline", avlAtualizarBarra);
  avlAtualizarBarra();
  if (navigator.onLine && avlSession()) avlSincronizar(true);
}

// ── CAMPOS DE FORMULÁRIO ────────────────────────────────────────────────
// Gera HTML de campo com data-f (nome do campo) e data-t (tipo de conversão).
function avlCampo(label, nome, valor, o) {
  o = o || {};
  var tipo = o.tipo || "text", cls = "avl-field" + (o.cls ? " " + o.cls : "");
  var attrs = ' data-f="' + nome + '" data-t="' + (o.conv || (tipo === "number" ? "num" : tipo === "date" ? "date" : "txt")) + '"';
  if (o.ph) attrs += ' placeholder="' + esc(o.ph) + '"';
  if (o.list) attrs += ' list="' + o.list + '"';
  if (tipo === "number") attrs += ' inputmode="decimal" step="any"';
  var v = valor == null ? "" : valor, campo;
  if (tipo === "textarea") campo = '<textarea rows="' + (o.rows || 3) + '"' + attrs + '>' + esc(v) + '</textarea>';
  else campo = '<input type="' + (tipo === "number" ? "text" : tipo) + '" value="' + esc(v) + '"' + attrs + '>';
  return '<label class="' + cls + '"><span>' + esc(label) + '</span>' + campo + (o.ajuda ? '<small>' + esc(o.ajuda) + '</small>' : '') + '</label>';
}
function avlSelect(label, nome, valor, opcoes, o) {
  o = o || {};
  var h = '<label class="avl-field' + (o.cls ? " " + o.cls : "") + '"><span>' + esc(label) + '</span><select data-f="' + nome + '" data-t="txt">';
  if (o.vazio !== false) h += '<option value="">—</option>';
  opcoes.forEach(function (p) { h += '<option value="' + esc(p[0]) + '"' + (String(valor) === String(p[0]) ? " selected" : "") + '>' + esc(p[1]) + '</option>'; });
  return h + '</select>' + (o.ajuda ? '<small>' + esc(o.ajuda) + '</small>' : '') + '</label>';
}
function avlCheck(label, nome, valor, o) {
  o = o || {};
  return '<label class="avl-check' + (o.cls ? " " + o.cls : "") + '"><input type="checkbox" data-f="' + nome + '" data-t="bool"' + (valor ? " checked" : "") + '><span>' + esc(label) + '</span></label>';
}
// Lê o valor de um elemento com data-f aplicando a conversão.
function avlLer(el) {
  var t = el.getAttribute("data-t");
  if (t === "bool") return el.checked;
  var v = el.value;
  if (t === "num") { return AVLCALC.num(v, true); }
  if (t === "fator") { return AVLCALC.num(v); }
  if (t === "int") { var i = parseInt(v, 10); return isFinite(i) ? i : null; }
  if (t === "date") { return v ? v : null; } // coluna date não aceita ""
  return v;
}

// ── MEMÓRIA DE CÁLCULO (usada na ficha do bem e no laudo) ───────────────
function avlMemoriaHtml(bem, res) {
  var C = AVLCALC, h = "", p = res.idade, comp = res.comparativo, reed = res.reedicao;
  var metodoNome = (C.METODOS.filter(function (m) { return m.cod === res.metodo; })[0] || {}).nome || res.metodo;
  h += '<p class="avl-calc"><b>Método adotado:</b> ' + esc(metodoNome) + '<br><b>Idade (x):</b> ' + (p.x === null ? "—" : p.x + " ano(s)" + (p.aparente ? " (aparente)" : "")) +
    ' · <b>Vida útil (n):</b> ' + (p.n ? p.n + " anos" : "—") + ' · <b>i/v:</b> ' + C.fmtNum(p.iv, 3) + '</p>';

  if (comp.linhas.length) {
    h += '<div class="avl-table-wrap"><table class="avl-table"><thead><tr><th>#</th><th>Tipo</th><th class="r">Preço</th><th class="r">Ff</th><th class="r">Fid</th><th class="r">Fest</th><th class="r">Fcap</th><th class="r">Fop</th><th class="r">Produto</th><th class="r">Homogeneizado</th><th>Situação</th></tr></thead><tbody>';
    comp.linhas.forEach(function (l, i) {
      var sit = !l.incluido ? "não incluído" : (l.descartado ? "descartado (±30 %)" : (l.vh === null ? "incompleto" : "usado"));
      h += '<tr' + (sit === "usado" ? "" : ' class="off"') + '><td>' + (i + 1) + '</td><td>' + esc(l.tipo === "transacao" ? "transação" : "oferta") + '</td><td class="r">' + esc(C.brl(l.preco)) + '</td>' +
        '<td class="r">' + C.fmtNum(l.ff, 2) + '</td><td class="r">' + C.fmtNum(l.fid, 3) + '</td><td class="r">' + C.fmtNum(l.fest, 2) + '</td><td class="r">' + C.fmtNum(l.fcap, 2) + '</td><td class="r">' + C.fmtNum(l.fop, 2) + '</td>' +
        '<td class="r">' + C.fmtNum(l.produto, 3) + '</td><td class="r">' + esc(C.brl(l.vh)) + '</td><td>' + sit + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (comp.n_validos) h += '<p class="avl-calc">Média saneada: <b>' + esc(C.brl(comp.media)) + '</b> · n = ' + comp.n_validos + ' · desvio-padrão ' + esc(C.brl(comp.dp)) + ' · CV ' + C.pct(comp.cv) +
      ' · campo de arbítrio ' + esc(C.brl(comp.arb_min)) + ' a ' + esc(C.brl(comp.arb_max)) + '</p>';
  }
  if (reed && reed.valor !== null) {
    var t = reed.metodo === "ibape" ? "Custo de reedição — curva IBAPE (" + (reed.curva || "") + ")" : reed.metodo === "rossheidecke" ? "Custo de reedição — Ross-Heidecke" : "Custo de reedição — linear";
    h += '<p class="avl-calc"><b>' + esc(t) + '</b><br>Valor do bem novo (VN) = ' + esc(C.brl(reed.VN)) + (reed.vn_origem ? ' (' + esc(reed.vn_origem) + (num0(bem.custos_adicionais) ? " + custos adicionais" : "") + ')' : '');
    if (reed.metodo === "ibape") h += '<br>K(i/v = ' + C.fmtNum(reed.iv, 3) + ') = ' + C.fmtNum(reed.K, 4) + ' → V = VN × K × Fobs − Cadeq';
    else if (reed.metodo === "rossheidecke") h += '<br>α = ½·(x/n + (x/n)²) = ' + C.fmtNum(reed.alpha, 4) + ' · c (Heidecke) = ' + C.fmtNum(reed.c, 4) + ' · k = α + (1−α)·c = ' + C.fmtNum(reed.k, 4) + ' · residual R = ' + C.pct(reed.R, 0) + ' → V = [VN − k·(VN − R·VN)] × Fobs − Cadeq';
    else h += '<br>k = x/n = ' + C.fmtNum(reed.k, 4) + ' · residual R = ' + C.pct(reed.R, 0) + ' → V = [VN − k·(VN − R·VN)] × Fobs − Cadeq';
    h += '<br>Fobs = ' + C.fmtNum(reed.fobs, 2) + ' · Cadeq (NR-12 / reparos) = ' + esc(C.brl(reed.cadeq)) + '<br><b>V = ' + esc(C.brl(reed.valor)) + '</b></p>';
  }
  return h;
}
function num0(v) { var n = AVLCALC.num(v); return n || 0; }
