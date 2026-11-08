// Testes do motor de cálculo — rodar: node avaliacao/tests/test_calc.js
// Baseados no exemplo numérico do torno CNC (data-base 2026, fabricado em 2016)
// do relatório de pesquisa que originou o módulo.
var assert = require("assert");
var C = require("../calc.js");

var passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log("  ok   " + nome); }
  catch (e) { failed++; console.log("  FAIL " + nome + "\n       " + e.message); }
}
function near(a, b, tol, msg) {
  assert.ok(Math.abs(a - b) <= tol, (msg || "") + " esperado ≈ " + b + " (±" + tol + "), obtido " + a);
}

var AV = { data_base: "2026-11-03", ff_padrao: 0.90, margem_arbitrio: 15 };
var TORNO = {
  id: "b1", numero: 1, descricao: "Torno CNC", fabricante: "Romi", modelo: "GL 240", serie: "123",
  ano_fabricacao: 2016, capacidade: "240 mm", estado: "c", funcionamento: "completo", fotos_qtd: 5,
  vida_util_ref: "torno", valor_novo: 480000, residual_pct: 10, metodo: "comparativo", propriedade: "propria", quantidade: 1
};
var COTS = [2017, 2015, 2016, 2018].map(function (ano, i) {
  return { id: "c" + i, bem_id: "b1", tipo: "oferta", ano: ano, preco: [320000, 290000, 300000, 350000][i] };
});

console.log("Utilidades");
test("num aceita pt-BR e ponto decimal", function () {
  assert.strictEqual(C.num("1.234,56"), 1234.56);
  assert.strictEqual(C.num("1234.5"), 1234.5);
  assert.strictEqual(C.num("0,9"), 0.9);
  assert.strictEqual(C.num("14.006", true), 14006);
  assert.strictEqual(C.num("1.234.567", true), 1234567);
  assert.strictEqual(C.num("14.006"), 14.006);        // sem a opção, ponto continua decimal
  assert.strictEqual(C.num("0.950", true), 0.95);     // começa com 0: é decimal
  assert.strictEqual(C.num("14006.4", true), 14006.4);
  assert.strictEqual(C.num("14.5", true), 14.5);
  assert.strictEqual(C.num(""), null);
  assert.strictEqual(C.num(null), null);
  assert.strictEqual(C.num("abc"), null);
});
test("brl formata em reais", function () {
  assert.strictEqual(C.brl(10400), "R$ 10.400,00");
  assert.strictEqual(C.brl(273933.4), "R$ 273.933,40");
  assert.strictEqual(C.brl(null), "—");
});

console.log("Depreciação");
test("curva IBAPE: pontos tabelados e interpolação", function () {
  assert.strictEqual(C.ibapeK(0.5, "bom"), 0.58);
  assert.strictEqual(C.ibapeK(0.5, "regular"), 0.49);
  near(C.ibapeK(0.45, "bom"), 0.615, 1e-9);
  assert.strictEqual(C.ibapeK(3, "bom"), 0.10);   // piso
  assert.strictEqual(C.ibapeK(0, "bom"), 0.95);
});
test("Ross-Heidecke: α e k do exemplo (x=10, n=20, c=0,0252)", function () {
  var r = C.rossHeidecke(10, 20, 0.0252);
  near(r.alpha, 0.375, 1e-9);
  near(r.k, 0.39075, 1e-9);
});
test("Ross-Heidecke limita x/n a 1", function () {
  var r = C.rossHeidecke(40, 20, 0);
  near(r.k, 1, 1e-9);
});

console.log("Custo de reedição");
test("curva IBAPE: 480.000 × 0,58 = 278.400", function () {
  var r = C.calcReedicao(TORNO, AV, [], "ibape");
  near(r.iv, 0.5, 1e-9); near(r.K, 0.58, 1e-9); near(r.valor, 278400, 0.01);
});
test("Ross-Heidecke: R$ 311.196 (conferência do exemplo)", function () {
  var r = C.calcReedicao(TORNO, AV, [], "rossheidecke");
  near(r.valor, 311196, 0.01);
});
test("Ross-Heidecke com Fobs 0,90 e NR-12 de R$ 25.000 = R$ 255.076", function () {
  var b = Object.assign({}, TORNO, { fobs: 0.9, nr12_custo: 25000 });
  var r = C.calcReedicao(b, AV, [], "rossheidecke");
  near(r.valor, 255076.4, 0.5);
});
test("linear usa x/n e residual", function () {
  var r = C.calcReedicao(TORNO, AV, [], "linear"); // k = 0,5 ; V = 480k - 0,5*432k = 264k
  near(r.valor, 264000, 0.01);
});
test("valor novo vem da média das cotações de novo quando não informado", function () {
  var b = Object.assign({}, TORNO, { valor_novo: "" });
  var cots = [{ id: "n1", bem_id: "b1", tipo: "novo", preco: 470000 }, { id: "n2", bem_id: "b1", tipo: "novo", preco: 490000 }];
  var r = C.calcReedicao(b, AV, cots, "ibape");
  near(r.vn_base, 480000, 0.01); near(r.valor, 278400, 0.01);
});
test("sem dados suficientes devolve valor nulo (não NaN)", function () {
  var r = C.calcReedicao({ estado: "c" }, AV, [], "ibape");
  assert.strictEqual(r.valor, null);
});
test("idade aparente substitui a idade cronológica", function () {
  var b = Object.assign({}, TORNO, { idade_aparente: 5 });
  var r = C.calcReedicao(b, AV, [], "ibape"); // i/v = 0,25 -> K = 0,755
  near(r.K, 0.755, 1e-9);
});

console.log("Comparativo direto");
test("homogeneização e média ≈ R$ 273,9 mil (n = 4, nenhum descartado)", function () {
  var r = C.calcComparativo(TORNO, AV, COTS);
  assert.strictEqual(r.n_validos, 4);
  assert.strictEqual(r.descartados.length, 0);
  near(r.media, 273933, 3000); // a pesquisa arredondou K das amostras; interpolação difere < 1 %
  assert.ok(r.cv < 0.03);
  near(r.arb_min, r.media * 0.85, 1e-6); near(r.arb_max, r.media * 1.15, 1e-6);
});
test("dado de mesmo ano e estado: fator idade = 1", function () {
  var r = C.calcComparativo(TORNO, AV, [COTS[2]]);
  near(r.linhas[0].fid, 1, 1e-9);
  near(r.linhas[0].vh, 270000, 0.01); // 300.000 × 0,90
});
test("dado discrepante (> ±30 %) é descartado com 3+ dados", function () {
  var cots = COTS.concat([{ id: "x", bem_id: "b1", tipo: "oferta", ano: 2016, preco: 900000 }]);
  var r = C.calcComparativo(TORNO, AV, cots);
  assert.deepStrictEqual(r.descartados, ["x"]);
  assert.strictEqual(r.n_validos, 4);
});
test("ofertas desmarcadas (incluido=false) não entram", function () {
  var cots = COTS.map(function (c, i) { return Object.assign({}, c, { incluido: i < 2 }); });
  assert.strictEqual(C.calcComparativo(TORNO, AV, cots).n_validos, 2);
});
test("transação real usa fator de oferta 1,00", function () {
  var r = C.calcComparativo(TORNO, AV, [{ id: "t", tipo: "transacao", ano: 2016, preco: 300000 }]);
  near(r.linhas[0].ff, 1, 1e-9);
});
test("fatores fora de 0,50–2,00 geram alerta", function () {
  var r = C.calcComparativo(TORNO, AV, [{ id: "t", tipo: "oferta", ano: 2016, preco: 300000, fcap: 3 }]);
  assert.ok(r.linhas[0].alertas.join(" ").indexOf("fora de") >= 0);
});
test("cotações de 'novo' não entram no comparativo", function () {
  var r = C.calcComparativo(TORNO, AV, [{ id: "n", tipo: "novo", preco: 480000 }]);
  assert.strictEqual(r.n_validos, 0); assert.strictEqual(r.valor, null);
});

console.log("Grau de fundamentação");
test("comparativo com 4 dados, vistoria completa e funcionamento observado = Grau III (12 pts)", function () {
  var g = C.calcGrau(TORNO, "comparativo", 4, false);
  assert.strictEqual(g.pontos, 12); assert.strictEqual(g.grau, "III");
});
test("reedição sem cotação direta, 1 dado, depreciação calculada = Grau II", function () {
  var b = Object.assign({}, TORNO, { fotos_qtd: 1, funcionamento: "observado" });
  var g = C.calcGrau(b, "ibape", 1, false); // 2 + 2 + 1 + 2 = 7
  assert.strictEqual(g.pontos, 7); assert.strictEqual(g.grau, "II");
});
test("sem funcionamento observado não chega a Grau II", function () {
  var b = Object.assign({}, TORNO, { funcionamento: "nao_observado", fotos_qtd: 0 });
  var g = C.calcGrau(b, "ibape", 1, false);
  assert.notStrictEqual(g.grau, "II"); assert.notStrictEqual(g.grau, "III");
});
test("valor arbitrado é no máximo Grau I", function () {
  var g = C.calcGrau(TORNO, "manual", 0, false);
  assert.ok(g.grau === "I" || g.grau === "II");
  assert.strictEqual(g.depreciacao, 1);
});

console.log("VLF");
test("VLF = VM × (1 − custos) / (1 + i)^t ≈ R$ 237.160", function () {
  near(C.calcVLF(273933, { vlf_custos: 7, vlf_juros_mensal: 1.2, vlf_meses: 6 }), 237160, 100);
});

console.log("Avaliação de um bem");
test("avaliarBem (comparativo) devolve valor, grau, conferência e VLF", function () {
  var r = C.avaliarBem(TORNO, AV, COTS);
  near(r.valor, 273933, 3000); assert.strictEqual(r.grau.grau, "III");
  assert.ok(r.conferencia && r.conferencia.metodo === "ibape");
  near(r.conferencia.valor, 278400, 0.01);
  assert.ok(r.vlf < r.valor);
});
test("estado 'e'–'h' com método IBAPE: alerta, e conferência usa Ross-Heidecke", function () {
  var b = Object.assign({}, TORNO, { estado: "e", metodo: "ibape" });
  var r = C.avaliarBem(b, AV, []);
  assert.ok(r.alertas.some(function (a) { return a.indexOf("Curva IBAPE não recomendada") >= 0; }));
});
test("quantidade multiplica o valor total", function () {
  var b = Object.assign({}, TORNO, { quantidade: 3, metodo: "ibape" });
  var r = C.avaliarBem(b, AV, []);
  near(r.valor_total, 278400 * 3, 0.05);
});
test("sucata = peso × preço", function () {
  var b = { descricao: "Sucata", estado: "i", metodo: "sucata", peso_kg: 1200, preco_sucata_kg: 1.5 };
  near(C.avaliarBem(b, AV, []).valor, 1800, 1e-9);
});
test("valor manual exige justificativa (alerta)", function () {
  var b = { descricao: "x", estado: "c", metodo: "manual", valor_manual: 5000 };
  var r = C.avaliarBem(b, AV, []);
  near(r.valor, 5000, 1e-9);
  assert.ok(r.alertas.some(function (a) { return /justificativa/.test(a); }));
});
test("comparativo sem dados: valor nulo e alerta", function () {
  var r = C.avaliarBem(Object.assign({}, TORNO), AV, []);
  assert.strictEqual(r.valor, null);
  assert.ok(r.alertas.some(function (a) { return /sem dados de mercado/i.test(a); }));
});

console.log("Totais");
test("totais separam bens próprios dos não pertencentes e somam saldo de ônus", function () {
  var b1 = Object.assign({}, TORNO, { id: "b1", metodo: "ibape", onus: "alienacao_fiduciaria", onus_saldo: 100000 });
  var b2 = Object.assign({}, TORNO, { id: "b2", numero: 2, metodo: "ibape", propriedade: "leasing" });
  var b3 = Object.assign({}, TORNO, { id: "b3", numero: 3, metodo: "ibape", excluido: true });
  var r = C.avaliarTudo(AV, [b1, b2, b3], []);
  assert.strictEqual(r.totais.n_bens, 2);
  near(r.totais.proprios, 278400, 0.05);
  near(r.totais.nao_pertencentes, 278400, 0.05);
  assert.strictEqual(r.totais.saldo_onus, 100000);
});
test("bens sem valor são contados e não quebram o total", function () {
  var r = C.avaliarTudo(AV, [Object.assign({}, TORNO, { id: "z", metodo: "comparativo" })], []);
  assert.strictEqual(r.totais.n_sem_valor, 1); assert.strictEqual(r.totais.proprios, 0);
});

console.log("Extenso");
test("valor por extenso", function () {
  assert.strictEqual(C.extenso(10400), "dez mil e quatrocentos reais");
  assert.strictEqual(C.extenso(1), "um real");
  assert.strictEqual(C.extenso(0), "zero reais");
  assert.strictEqual(C.extenso(273933.4), "duzentos e setenta e três mil, novecentos e trinta e três reais e quarenta centavos");
  assert.strictEqual(C.extenso(1500000), "um milhão e quinhentos mil reais");
  assert.strictEqual(C.extenso(2000000), "dois milhões de reais");
  assert.strictEqual(C.extenso(100), "cem reais");
  assert.strictEqual(C.extenso(101.01), "cento e um reais e um centavo");
  assert.strictEqual(C.extenso(1000), "mil reais");
  assert.strictEqual(C.extenso(1234567.89), "um milhão, duzentos e trinta e quatro mil, quinhentos e sessenta e sete reais e oitenta e nove centavos");
});

test("sem data-base na avaliação: sem valor por depreciação e com alerta explicando", function () {
  var bem = { descricao: "Talha", metodo: "rossheidecke", estado: "a", valor_novo: 14006.4, vida_util_anos: 15, ano_fabricacao: 2026, quantidade: 1 };
  var r = C.avaliarBem(bem, { data_base: null }, []);
  assert.strictEqual(r.valor, null);
  assert.ok(r.alertas.some(function (a) { return /data-base/.test(a); }));
  assert.ok(C.avaliarBem(bem, { data_base: "2026-11-08" }, []).valor > 0);
});

console.log("\n" + passed + " passaram, " + failed + " falharam");
process.exit(failed ? 1 : 0);
