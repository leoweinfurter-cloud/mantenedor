// Rodar: node avaliacao/tests/test_checklist.js
var assert = require("assert"), CK = require("../checklist.js");
var passed = 0, failed = 0;
function test(n, f) { try { f(); passed++; console.log("  ok   " + n); } catch (e) { failed++; console.log("  FAIL " + n + "\n       " + e.message); } }
test("ids únicos e todos os grupos preenchidos", function () {
  var ids = CK.ITENS.map(function (i) { return i.id; });
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(CK.GRUPOS.every(function (g) { return g.itens.length > 0; }));
});
test("checklist vazio: nada respondido", function () {
  var r = CK.resumo(undefined); assert.strictEqual(r.respondidos, 0); assert.strictEqual(r.total, CK.ITENS.length); assert.strictEqual(CK.sugestaoNR12({}), null);
});
test("definir não muta o original, tocar de novo (s vazio) remove", function () {
  var a = {}, b = CK.definir(a, "est_corrosao", "nc", "ferrugem na base");
  assert.deepStrictEqual(a, {}); assert.strictEqual(b.est_corrosao.n, "ferrugem na base");
  var c = CK.definir(b, "est_corrosao", "ok"); assert.strictEqual(c.est_corrosao.n, "ferrugem na base"); // mantém a nota
  assert.deepStrictEqual(CK.definir(c, "est_corrosao", ""), {});
});
test("resumo conta ok / nc / na e lista as não conformidades com nota", function () {
  var c = {}; c = CK.definir(c, "id_placa", "ok"); c = CK.definir(c, "est_vazamento", "nc", "óleo no cilindro"); c = CK.definir(c, "ele_aterr", "na");
  var r = CK.resumo(c);
  assert.deepStrictEqual([r.respondidos, r.ok, r.nc, r.na], [3, 1, 1, 1]);
  assert.strictEqual(r.grupos.est.nc, 1);
  assert.deepStrictEqual(CK.textoNC(c), ["Sem vazamentos de óleo, graxa ou fluidos (óleo no cilindro)"]);
});
test("respostas inválidas e ids desconhecidos são ignorados", function () {
  var r = CK.resumo({ id_placa: { s: "xx" }, nao_existe: { s: "ok" } }); assert.strictEqual(r.respondidos, 0);
});
test("sugestão de NR-12: qualquer nc → não conforme; tudo ok → conforme; tudo N/A → não se aplica; incompleto → nenhuma", function () {
  var nr = CK.ITENS.filter(function (i) { return i.nr12; }), c = {};
  nr.slice(0, 3).forEach(function (i) { c = CK.definir(c, i.id, "ok"); });
  assert.strictEqual(CK.sugestaoNR12(c), null);
  c = CK.definir(c, nr[3].id, "nc"); assert.strictEqual(CK.sugestaoNR12(c), "nao_conforme");
  var ok = {}; nr.forEach(function (i) { ok = CK.definir(ok, i.id, "ok"); }); assert.strictEqual(CK.sugestaoNR12(ok), "conforme");
  var na = {}; nr.forEach(function (i) { na = CK.definir(na, i.id, "na"); }); assert.strictEqual(CK.sugestaoNR12(na), "nao_aplica");
});
console.log("\n" + passed + " passaram, " + failed + " falharam"); process.exit(failed ? 1 : 0);
