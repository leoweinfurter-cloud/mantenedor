// Garante que o que o app envia ao Supabase bate com a migração SQL:
//  • toda chave dos registros novos existe como coluna da tabela (senão o PostgREST responde PGRST204);
//  • campos de data vazios viram null (coluna date rejeita "").
// Rodar: node avaliacao/tests/test_contrato_banco.js
var assert = require("assert"), fs = require("fs"), path = require("path");
var RAIZ = path.resolve(__dirname, "../..");
global.window = { crypto: require("crypto").webcrypto, location: { search: "" } };
global.localStorage = { getItem: function (k) { return k === "avl_session" ? JSON.stringify({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" } }) : null; } };
global.document = { getElementById: function () { return null; } };
global.navigator = { onLine: true };
global.AVLCALC = require("../calc.js");
var S = new Function(fs.readFileSync(path.join(RAIZ, "avaliacao/_shared.js"), "utf8") + "; return {avlNovaAvaliacao, avlNovoBem, avlNovaCotacao, avlLer};")();
var sync = require("../sync.js");
var ddl = fs.readFileSync(path.join(RAIZ, "migracao_avaliacao.sql"), "utf8");

var passed = 0, failed = 0;
function test(nome, fn) { try { fn(); passed++; console.log("  ok   " + nome); } catch (e) { failed++; console.log("  FAIL " + nome + "\n       " + e.message); } }
function colunas(tabela) {
  var m = new RegExp("CREATE TABLE IF NOT EXISTS public\\." + tabela + " \\(([\\s\\S]*?)\\n\\);").exec(ddl);
  assert.ok(m, "tabela " + tabela + " não encontrada no SQL");
  return m[1].split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l && l.indexOf("--") !== 0; }).map(function (l) { return l.split(/\s+/)[0]; });
}
var av = S.avlNovaAvaliacao(), bem = S.avlNovoBem(av.id, 1), cot = S.avlNovaCotacao(av.id, bem.id, "oferta");
[["avl_avaliacoes", av], ["avl_bens", bem], ["avl_cotacoes", cot]].forEach(function (p) {
  test("chaves enviadas para " + p[0] + " existem na tabela", function () {
    var cols = colunas(p[0]), extras = Object.keys(sync.paraEnvio(p[1])).filter(function (k) { return cols.indexOf(k) < 0; });
    assert.deepStrictEqual(extras, []);
  });
});
test("bem novo traz checklist vazio (objeto) e a coluna é jsonb", function () {
  assert.deepStrictEqual(bem.checklist, {});
  assert.ok(/checklist\s+jsonb/.test(ddl));
});
test("a sincronização usa as mesmas tabelas da migração", function () {
  sync.TABELAS.forEach(function (t) { assert.ok(ddl.indexOf("public." + t.table) >= 0, t.table); });
});
test("data vazia vira null; número pt-BR e inteiro vazio", function () {
  var el = function (t, v) { return { getAttribute: function () { return t; }, value: v }; };
  assert.strictEqual(S.avlLer(el("date", "")), null);
  assert.strictEqual(S.avlLer(el("date", "2026-11-03")), "2026-11-03");
  assert.strictEqual(S.avlLer(el("num", "1.234,5")), 1234.5);
  assert.strictEqual(S.avlLer(el("int", "")), null);
  assert.strictEqual(av.data_base, null);
});
console.log("\n" + passed + " passaram, " + failed + " falharam");
process.exit(failed ? 1 : 0);
