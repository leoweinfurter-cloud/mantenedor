// ═══════════════════════════════════════════════════════════════════════
//  Avaliação — sincronização offline → Supabase (UMD, testável no Node)
//
//  Modelo: cada registro local carrega _dirty (1 = alterado e ainda não
//  enviado) e _local_ts (marca da última edição local). O envio é upsert
//  em lote; só limpa _dirty se o registro NÃO foi editado durante o envio.
//  A leitura é incremental por atualizado_em (carimbado pelo servidor).
//  Regras de segurança (mesmas lições do Mantenedor):
//   • nunca falhar em silêncio: erro HTTP vira exceção com a mensagem real;
//   • nunca apagar nada localmente por causa do servidor;
//   • registro local sujo nunca é sobrescrito pelo que vem do servidor;
//   • exclusão é lógica (excluido = true) e sincroniza como qualquer edição.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AVLSYNC = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // Ordem importa: pai antes do filho (chaves estrangeiras).
  var TABELAS = [
    { store: "avaliacoes", table: "avl_avaliacoes" },
    { store: "bens",       table: "avl_bens" },
    { store: "cotacoes",   table: "avl_cotacoes" }
  ];
  var LOTE = 50;
  var PAGINA = 500;
  var EPOCH = "1970-01-01T00:00:00+00:00";

  function paraEnvio(rec) {
    var o = {};
    Object.keys(rec).forEach(function (k) {
      if (k.charAt(0) === "_" || k === "atualizado_em") return; // atualizado_em é do servidor
      o[k] = rec[k];
    });
    return o;
  }

  function erroHttp(resp, tabela, dados) {
    var msg = (dados && (dados.message || dados.error_description || dados.hint)) || ("Erro " + resp.status);
    var e = new Error(tabela + ": " + msg);
    e.status = resp.status;
    return e;
  }

  // Compara conteúdo ignorando campos de controle (atualizado_em é do servidor;
  // criado_em muda de formato ao ir e voltar do banco).
  function iguais(local, remoto) {
    var chaves = Object.keys(remoto);
    for (var i = 0; i < chaves.length; i++) {
      var k = chaves[i];
      if (k === "atualizado_em" || k === "criado_em") continue;
      if (JSON.stringify(local[k] === undefined ? null : local[k]) !== JSON.stringify(remoto[k])) return false;
    }
    return true;
  }

  // ctx = { store, request(method, path, body, headers) -> Promise<{ok,status,json()}> }
  async function enviar(ctx) {
    var enviados = 0;
    for (var t = 0; t < TABELAS.length; t++) {
      var def = TABELAS[t];
      var sujos = await ctx.store.dirty(def.store);
      for (var i = 0; i < sujos.length; i += LOTE) {
        var lote = sujos.slice(i, i + LOTE);
        var resp = await ctx.request("POST", def.table + "?on_conflict=id", lote.map(paraEnvio),
          { "Prefer": "resolution=merge-duplicates,return=minimal" });
        if (!resp.ok) {
          var dados = null; try { dados = await resp.json(); } catch (e) { /* sem corpo */ }
          throw erroHttp(resp, def.table, dados);
        }
        for (var j = 0; j < lote.length; j++) {
          var atual = await ctx.store.get(def.store, lote[j].id);
          // só limpa se não houve edição durante o envio
          if (atual && atual._local_ts === lote[j]._local_ts) {
            atual._dirty = 0;
            await ctx.store.put(def.store, atual);
          }
        }
        enviados += lote.length;
      }
    }
    return enviados;
  }

  async function receber(ctx) {
    var recebidos = 0;
    for (var t = 0; t < TABELAS.length; t++) {
      var def = TABELAS[t];
      var desde = (await ctx.store.getMeta("pull_" + def.store)) || EPOCH;
      for (;;) {
        var path = def.table + "?select=*&atualizado_em=gt." + encodeURIComponent(desde) +
                   "&order=atualizado_em.asc&limit=" + PAGINA;
        var resp = await ctx.request("GET", path);
        if (!resp.ok) {
          var dados = null; try { dados = await resp.json(); } catch (e) { /* sem corpo */ }
          throw erroHttp(resp, def.table, dados);
        }
        var linhas = await resp.json();
        for (var i = 0; i < linhas.length; i++) {
          var local = await ctx.store.get(def.store, linhas[i].id);
          if (local && local._dirty === 1) continue; // edição local pendente vence
          var novo = Object.assign({}, linhas[i], { _dirty: 0, _local_ts: local ? local._local_ts : 0 });
          await ctx.store.put(def.store, novo);
          // O "eco" do que acabamos de enviar não conta como novidade (evita redesenhar a tela).
          if (!local || !iguais(local, linhas[i])) recebidos++;
        }
        if (linhas.length) {
          desde = linhas[linhas.length - 1].atualizado_em;
          await ctx.store.setMeta("pull_" + def.store, desde);
        }
        if (linhas.length < PAGINA) break;
      }
    }
    return recebidos;
  }

  async function sincronizar(ctx) {
    var enviados = await enviar(ctx);
    var recebidos = await receber(ctx);
    await ctx.store.setMeta("ultima_sync", new Date().toISOString());
    return { enviados: enviados, recebidos: recebidos };
  }

  async function pendentes(store) {
    var n = 0;
    for (var t = 0; t < TABELAS.length; t++) n += (await store.dirty(TABELAS[t].store)).length;
    return n;
  }

  // Armazenamento em memória (testes) com a mesma interface do IndexedDB.
  function MemStore() { this.d = { avaliacoes: {}, bens: {}, cotacoes: {} }; this.m = {}; }
  MemStore.prototype.all = async function (n) { var o = this.d[n]; return Object.keys(o).map(function (k) { return JSON.parse(JSON.stringify(o[k])); }); };
  MemStore.prototype.get = async function (n, id) { var r = this.d[n][id]; return r ? JSON.parse(JSON.stringify(r)) : undefined; };
  MemStore.prototype.put = async function (n, r) { this.d[n][r.id] = JSON.parse(JSON.stringify(r)); };
  MemStore.prototype.dirty = async function (n) { var o = this.d[n]; return Object.keys(o).filter(function (k) { return o[k]._dirty === 1; }).map(function (k) { return JSON.parse(JSON.stringify(o[k])); }); };
  MemStore.prototype.getMeta = async function (k) { return this.m[k]; };
  MemStore.prototype.setMeta = async function (k, v) { this.m[k] = v; };

  return { TABELAS: TABELAS, paraEnvio: paraEnvio, enviar: enviar, receber: receber, sincronizar: sincronizar, pendentes: pendentes, MemStore: MemStore };
});
