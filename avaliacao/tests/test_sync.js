// Testes da sincronização offline — rodar: node avaliacao/tests/test_sync.js
var assert = require("assert");
var S = require("../sync.js");

var passed = 0, failed = 0;
async function test(nome, fn) {
  try { await fn(); passed++; console.log("  ok   " + nome); }
  catch (e) { failed++; console.log("  FAIL " + nome + "\n       " + (e && e.stack || e)); }
}

// Servidor falso: 3 tabelas, upsert por id, atualizado_em carimbado a cada gravação.
function FakeServer() {
  this.t = { avl_avaliacoes: {}, avl_bens: {}, avl_cotacoes: {} };
  this.clock = 0; this.log = []; this.falhar = null; this.hook = null;
}
FakeServer.prototype.ts = function () {
  this.clock++;
  return "2026-11-06T10:00:" + String(Math.floor(this.clock / 1000000)).padStart(2, "0") + "." + String(this.clock % 1000000).padStart(6, "0") + "+00:00";
};
FakeServer.prototype.request = async function (method, path, body, headers) {
  var self = this;
  var table = path.split("?")[0];
  this.log.push({ method: method, table: table, path: path, body: body, headers: headers });
  if (this.falhar) { var f = this.falhar; return { ok: false, status: f.status, json: async function () { return { message: f.message }; } }; }
  if (this.hook) this.hook(method, table);
  if (method === "POST") {
    body.forEach(function (r) {
      var antigo = self.t[table][r.id] || {};
      self.t[table][r.id] = Object.assign({}, antigo, r, { atualizado_em: self.ts() });
    });
    return { ok: true, status: 201, json: async function () { return null; } };
  }
  var m = /atualizado_em=gt\.([^&]+)/.exec(path);
  var desde = m ? decodeURIComponent(m[1]) : "";
  var lim = parseInt(/limit=(\d+)/.exec(path)[1], 10);
  var rows = Object.keys(this.t[table]).map(function (k) { return self.t[table][k]; })
    .filter(function (r) { return r.atualizado_em > desde; })
    .sort(function (a, b) { return a.atualizado_em < b.atualizado_em ? -1 : 1; }).slice(0, lim);
  return { ok: true, status: 200, json: async function () { return JSON.parse(JSON.stringify(rows)); } };
};

function novo() {
  var srv = new FakeServer(), store = new S.MemStore();
  return { srv: srv, store: store, ctx: { store: store, request: srv.request.bind(srv) } };
}
async function salvar(store, nome, rec) {
  rec._dirty = 1; rec._local_ts = (rec._local_ts || 0) + 1; await store.put(nome, rec);
}

(async function () {
  console.log("Envio");
  await test("envia sujos (pai antes do filho) e limpa o flag", async function () {
    var x = novo();
    await salvar(x.store, "cotacoes", { id: "c1", bem_id: "b1", avaliacao_id: "a1", preco: 10 });
    await salvar(x.store, "bens", { id: "b1", avaliacao_id: "a1", descricao: "Torno" });
    await salvar(x.store, "avaliacoes", { id: "a1", titulo: "Processo 1" });
    var r = await S.sincronizar(x.ctx);
    assert.strictEqual(r.enviados, 3);
    var ordem = x.srv.log.filter(function (l) { return l.method === "POST"; }).map(function (l) { return l.table; });
    assert.deepStrictEqual(ordem, ["avl_avaliacoes", "avl_bens", "avl_cotacoes"]);
    assert.strictEqual((await x.store.get("bens", "b1"))._dirty, 0);
    assert.strictEqual(await S.pendentes(x.store), 0);
    assert.ok(x.srv.t.avl_bens.b1);
  });
  await test("não envia campos locais (_dirty, _local_ts) nem atualizado_em", async function () {
    var x = novo();
    await salvar(x.store, "avaliacoes", { id: "a1", titulo: "T", atualizado_em: "2020-01-01T00:00:00+00:00" });
    await S.enviar(x.ctx);
    var corpo = x.srv.log[0].body[0];
    assert.deepStrictEqual(Object.keys(corpo).sort(), ["id", "titulo"]);
    assert.strictEqual(x.srv.log[0].headers.Prefer, "resolution=merge-duplicates,return=minimal");
  });
  await test("registro editado DURANTE o envio continua sujo", async function () {
    var x = novo();
    await salvar(x.store, "avaliacoes", { id: "a1", titulo: "v1" });
    x.srv.hook = function (m, t) {
      if (m === "POST" && t === "avl_avaliacoes") {
        // edição concorrente (usuário digitando) enquanto o POST está no ar
        var p = x.store.d.avaliacoes.a1; p.titulo = "v2"; p._local_ts += 1; p._dirty = 1;
      }
    };
    await S.enviar(x.ctx);
    var a = await x.store.get("avaliacoes", "a1");
    assert.strictEqual(a._dirty, 1); assert.strictEqual(a.titulo, "v2");
    x.srv.hook = null;
    await S.enviar(x.ctx);
    assert.strictEqual((await x.store.get("avaliacoes", "a1"))._dirty, 0);
    assert.strictEqual(x.srv.t.avl_avaliacoes.a1.titulo, "v2");
  });
  await test("erro HTTP vira exceção com a mensagem real e nada é marcado como enviado", async function () {
    var x = novo();
    await salvar(x.store, "avaliacoes", { id: "a1", titulo: "T" });
    x.srv.falhar = { status: 403, message: "new row violates row-level security policy" };
    await assert.rejects(S.sincronizar(x.ctx), /row-level security/);
    assert.strictEqual((await x.store.get("avaliacoes", "a1"))._dirty, 1);
    assert.strictEqual(await S.pendentes(x.store), 1);
  });
  await test("exclusão lógica sincroniza como edição", async function () {
    var x = novo();
    await salvar(x.store, "avaliacoes", { id: "a1", titulo: "T", excluido: false });
    await S.sincronizar(x.ctx);
    var a = await x.store.get("avaliacoes", "a1"); a.excluido = true; await salvar(x.store, "avaliacoes", a);
    await S.sincronizar(x.ctx);
    assert.strictEqual(x.srv.t.avl_avaliacoes.a1.excluido, true);
  });
  await test("lotes de 50", async function () {
    var x = novo();
    await salvar(x.store, "avaliacoes", { id: "a1" });
    for (var i = 0; i < 120; i++) await salvar(x.store, "bens", { id: "b" + i, avaliacao_id: "a1" });
    await S.enviar(x.ctx);
    var posts = x.srv.log.filter(function (l) { return l.method === "POST" && l.table === "avl_bens"; });
    assert.deepStrictEqual(posts.map(function (p) { return p.body.length; }), [50, 50, 20]);
  });

  console.log("Recebimento");
  await test("traz registros do servidor (novo aparelho) sem marcá-los como sujos", async function () {
    var x = novo();
    x.srv.t.avl_avaliacoes.a1 = { id: "a1", titulo: "do servidor", atualizado_em: x.srv.ts() };
    x.srv.t.avl_bens.b1 = { id: "b1", avaliacao_id: "a1", descricao: "Prensa", atualizado_em: x.srv.ts() };
    var r = await S.receber(x.ctx);
    assert.strictEqual(r, 2);
    var b = await x.store.get("bens", "b1");
    assert.strictEqual(b.descricao, "Prensa"); assert.strictEqual(b._dirty, 0);
    assert.strictEqual(await S.pendentes(x.store), 0);
  });
  await test("edição local pendente NÃO é sobrescrita pelo servidor", async function () {
    var x = novo();
    x.srv.t.avl_bens.b1 = { id: "b1", avaliacao_id: "a1", descricao: "servidor", atualizado_em: x.srv.ts() };
    await salvar(x.store, "bens", { id: "b1", avaliacao_id: "a1", descricao: "local" });
    await S.receber(x.ctx);
    assert.strictEqual((await x.store.get("bens", "b1")).descricao, "local");
  });
  await test("leitura incremental: só traz o que mudou desde a última", async function () {
    var x = novo();
    x.srv.t.avl_avaliacoes.a1 = { id: "a1", titulo: "1", atualizado_em: x.srv.ts() };
    await S.receber(x.ctx);
    var antes = x.srv.log.length;
    x.srv.t.avl_avaliacoes.a2 = { id: "a2", titulo: "2", atualizado_em: x.srv.ts() };
    var n = await S.receber(x.ctx);
    assert.strictEqual(n, 1);
    assert.ok(x.srv.log.length > antes);
    assert.strictEqual(await S.receber(x.ctx), 0);
  });
  await test("timestamp com '+' é codificado na URL", async function () {
    var x = novo();
    x.srv.t.avl_avaliacoes.a1 = { id: "a1", atualizado_em: x.srv.ts() };
    await S.receber(x.ctx);
    await S.receber(x.ctx);
    var gets = x.srv.log.filter(function (l) { return l.method === "GET"; });
    var comDesde = gets.filter(function (g) { return /gt\.1970/.test(g.path) === false; });
    assert.ok(comDesde.length > 0, "segunda leitura deve usar o carimbo salvo");
    comDesde.forEach(function (g) {
      assert.ok(g.path.indexOf("%2B") >= 0, "'+' deve ir como %2B: " + g.path);
      assert.ok(!/gt\.[^&]*\+/.test(g.path), "sem '+' cru na URL");
    });
  });
  await test("eco do que acabamos de enviar não conta como recebido", async function () {
    var x = novo();
    await salvar(x.store, "avaliacoes", { id: "a1", titulo: "T", criado_em: "2026-11-06T10:00:00.000Z" });
    await salvar(x.store, "bens", { id: "b1", avaliacao_id: "a1", descricao: "Torno", fotos_nomes: ["a.jpg"], ano_fabricacao: null });
    var r = await S.sincronizar(x.ctx);
    assert.strictEqual(r.enviados, 2);
    assert.strictEqual(r.recebidos, 0);
    // mudança vinda de outro aparelho conta
    x.srv.t.avl_bens.b1 = Object.assign({}, x.srv.t.avl_bens.b1, { descricao: "Torno CNC", atualizado_em: x.srv.ts() });
    assert.strictEqual((await S.sincronizar(x.ctx)).recebidos, 1);
    assert.strictEqual((await x.store.get("bens", "b1")).descricao, "Torno CNC");
  });
  await test("paginação traz mais de 500 registros", async function () {
    var x = novo();
    x.srv.t.avl_avaliacoes.a1 = { id: "a1", atualizado_em: x.srv.ts() };
    for (var i = 0; i < 1100; i++) x.srv.t.avl_bens["b" + i] = { id: "b" + i, avaliacao_id: "a1", atualizado_em: x.srv.ts() };
    var n = await S.receber(x.ctx);
    assert.strictEqual(n, 1101);
    assert.strictEqual((await x.store.all("bens")).length, 1100);
  });
  await test("ida e volta entre dois aparelhos", async function () {
    var srv = new FakeServer();
    var A = new S.MemStore(), B = new S.MemStore();
    var ca = { store: A, request: srv.request.bind(srv) }, cb = { store: B, request: srv.request.bind(srv) };
    await salvar(A, "avaliacoes", { id: "a1", titulo: "Campo" });
    await salvar(A, "bens", { id: "b1", avaliacao_id: "a1", descricao: "Torno" });
    await S.sincronizar(ca);
    await S.sincronizar(cb);
    assert.strictEqual((await B.get("bens", "b1")).descricao, "Torno");
    var b = await B.get("bens", "b1"); b.descricao = "Torno CNC"; await salvar(B, "bens", b);
    await S.sincronizar(cb); await S.sincronizar(ca);
    assert.strictEqual((await A.get("bens", "b1")).descricao, "Torno CNC");
  });

  console.log("\n" + passed + " passaram, " + failed + " falharam");
  process.exit(failed ? 1 : 0);
})();
