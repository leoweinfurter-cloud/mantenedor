// ═══════════════════════════════════════════════════════════════════════
//  Avaliação de máquinas e equipamentos — motor de cálculo
//  Módulo isolado do Mantenedor (pasta /avaliacao).
//
//  Funciona no navegador (window.AVLCALC) e no Node (require) para testes.
//
//  Referências (ver a pesquisa que originou este módulo):
//   • ABNT NBR 14653-1:2019 e NBR 14653-5:2006 (texto oficial da norma
//     deve ser conferido pelo avaliador — a norma é protegida por direitos
//     autorais e as tabelas abaixo vêm de fontes secundárias do IBAPE).
//   • IBAPE Nacional — "Novos Conceitos de Depreciações para Máquinas e
//     Equipamentos" (curvas K em função de i/v).
//   • IBAPE/SP — Estudo de Vidas Úteis (2007), valores de referência.
//   • Ross-Heidecke (coeficientes adaptados de edificações — justificar no laudo).
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AVLCALC = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // ── TABELAS ──────────────────────────────────────────────────────────

  // Estados de conservação (códigos a–i de Heidecke). c em fração (0–1).
  // "curva" indica qual curva IBAPE é aplicável (null = não recomendada).
  var ESTADOS = [
    { cod: "a", nome: "Novo / sem uso relevante",             c: 0.0000, curva: "bom" },
    { cod: "b", nome: "Entre novo e regular",                 c: 0.0032, curva: "bom" },
    { cod: "c", nome: "Regular (conservação normal)",         c: 0.0252, curva: "bom" },
    { cod: "d", nome: "Entre regular e reparos simples",      c: 0.0809, curva: "regular" },
    { cod: "e", nome: "Reparos simples",                      c: 0.1810, curva: null },
    { cod: "f", nome: "Entre reparos simples e importantes",  c: 0.3320, curva: null },
    { cod: "g", nome: "Reparos importantes",                  c: 0.5260, curva: null },
    { cod: "h", nome: "Entre reparos importantes e sem valor", c: 0.7520, curva: null },
    { cod: "i", nome: "Sem valor (sucata)",                   c: 1.0000, curva: null }
  ];

  // Curvas IBAPE: fator K = valor / valor novo, em função de i/v
  // (idade / vida útil). Pontos publicados em passos de 0,10 até 1,00 e
  // 1,20 / 1,50 / 1,80+. Entre os pontos usa-se interpolação linear —
  // CONFERIR com a tabela completa (passos de 0,05) do estudo do IBAPE.
  var IBAPE_IV   = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00, 1.20, 1.50, 1.80];
  var IBAPE_BOM  = [0.95, 0.87, 0.79, 0.72, 0.65, 0.58, 0.52, 0.47, 0.41, 0.36, 0.32, 0.24, 0.15, 0.10];
  var IBAPE_REG  = [0.95, 0.82, 0.71, 0.63, 0.55, 0.49, 0.42, 0.37, 0.32, 0.26, 0.22, 0.14, 0.10, 0.10];

  // Vidas úteis de referência (anos) — Estudo de Vidas Úteis IBAPE/SP (2007).
  // A vida contábil (10 % a.a.) NÃO é vida útil técnica.
  var VIDAS_UTEIS = [
    { ref: "torno",        nome: "Torno CNC / torno mecânico",                     anos: 20 },
    { ref: "fresadora",    nome: "Fresadora, retífica, mandriladora",              anos: 20 },
    { ref: "prensa",       nome: "Prensa, dobradeira, guilhotina, puncionadeira",  anos: 20 },
    { ref: "serra",        nome: "Serra de fita/disco, eletroerosão",              anos: 15 },
    { ref: "solda_mig",    nome: "Máquina de solda MIG",                           anos: 10 },
    { ref: "injetora",     nome: "Injetora / sopradora de plástico",               anos: 20 },
    { ref: "costura",      nome: "Máquina de costura industrial",                  anos: 10 },
    { ref: "pequeno_porte",nome: "Equipamento de pequeno porte (furadeira, lixadeira)", anos: 10 },
    { ref: "compressor",   nome: "Compressor de ar",                               anos: 15 },
    { ref: "caldeira",     nome: "Caldeira média pressão",                         anos: 25 },
    { ref: "ponte",        nome: "Ponte rolante / pórtico",                        anos: 20 },
    { ref: "talha",        nome: "Talha elétrica",                                 anos: 15 },
    { ref: "empilhadeira", nome: "Empilhadeira",                                   anos: 10 },
    { ref: "transformador",nome: "Transformador de força",                         anos: 40 },
    { ref: "painel",       nome: "Painel / distribuição elétrica",                 anos: 15 },
    { ref: "informatica",  nome: "Computadores / notebooks",                       anos: 3  },
    { ref: "outro",        nome: "Outro (informar a vida útil)",                   anos: null }
  ];

  var METODOS = [
    { cod: "comparativo",  nome: "Comparativo direto de dados de mercado" },
    { cod: "ibape",        nome: "Custo de reedição — curva IBAPE (K em função de i/v)" },
    { cod: "rossheidecke", nome: "Custo de reedição — Ross-Heidecke" },
    { cod: "linear",       nome: "Custo de reedição — depreciação linear" },
    { cod: "sucata",       nome: "Valor de sucata (peso × preço do material)" },
    { cod: "manual",       nome: "Arbitrado (justificar)" }
  ];

  // ── UTILIDADES ───────────────────────────────────────────────────────

  // milhar = true: "14.006" (sem vírgula, grupos de 3 dígitos) é lido como 14006, como se digita em pt-BR.
  // Usado nos campos de valor/quantidade; fatores (0,95; 1,125) ficam de fora porque são ambíguos.
  function num(v, milhar) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    var str = String(v).trim();
    if (str === "") return null;
    if (milhar && /^[1-9]\d{0,2}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, ""));
    // "1.234,56" (pt-BR) -> 1234.56 ; "1234.56" (ponto decimal) -> 1234.56
    var n = str.indexOf(",") !== -1 ? parseFloat(str.replace(/\./g, "").replace(",", ".")) : parseFloat(str);
    return isFinite(n) ? n : null;
  }
  function round(v, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(v * p) / p; }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : null; }
  function sd(a) { // desvio-padrão amostral (n-1)
    if (a.length < 2) return 0;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  function estadoInfo(cod) {
    for (var i = 0; i < ESTADOS.length; i++) if (ESTADOS[i].cod === cod) return ESTADOS[i];
    return null;
  }
  function vidaUtilInfo(ref) {
    for (var i = 0; i < VIDAS_UTEIS.length; i++) if (VIDAS_UTEIS[i].ref === ref) return VIDAS_UTEIS[i];
    return null;
  }
  function anoBase(dataBase) {
    var m = /^(\d{4})/.exec(String(dataBase || ""));
    return m ? parseInt(m[1], 10) : null;
  }

  // ── DEPRECIAÇÃO ──────────────────────────────────────────────────────

  // Fator K da curva IBAPE por interpolação linear. iv = idade / vida útil.
  function ibapeK(iv, curva) {
    var ys = curva === "regular" ? IBAPE_REG : IBAPE_BOM;
    if (iv === null || iv === undefined || !isFinite(iv)) return null;
    if (iv <= IBAPE_IV[0]) return ys[0];
    var last = IBAPE_IV.length - 1;
    if (iv >= IBAPE_IV[last]) return ys[last];
    for (var i = 0; i < last; i++) {
      if (iv >= IBAPE_IV[i] && iv <= IBAPE_IV[i + 1]) {
        var t = (iv - IBAPE_IV[i]) / (IBAPE_IV[i + 1] - IBAPE_IV[i]);
        return ys[i] + t * (ys[i + 1] - ys[i]);
      }
    }
    return ys[last];
  }

  // Ross: α = ½ (x/n + (x/n)²).  Ross-Heidecke: k = α + (1-α)·c
  function rossHeidecke(x, n, c) {
    var r = Math.min(Math.max(x / n, 0), 1);
    var alpha = 0.5 * (r + r * r);
    return { alpha: alpha, k: alpha + (1 - alpha) * c };
  }
  function linear(x, n) { return Math.min(Math.max(x / n, 0), 1); }

  // ── IDADE, VIDA ÚTIL, i/v ───────────────────────────────────────────

  function parametrosIdade(bem, av) {
    var ab = anoBase(av && av.data_base);
    var ano = num(bem.ano_fabricacao);
    var aparente = num(bem.idade_aparente);
    var x = aparente !== null ? aparente : (ab !== null && ano !== null ? Math.max(0, ab - ano) : null);
    var n = num(bem.vida_util_anos);
    if (n === null) { var vi = vidaUtilInfo(bem.vida_util_ref); n = vi ? vi.anos : null; }
    var iv = (x !== null && n) ? x / n : null;
    return { x: x, n: n, iv: iv, anoBase: ab, aparente: aparente !== null };
  }

  function curvaDoBem(bem) {
    var e = estadoInfo(bem.estado);
    return e ? e.curva : "bom"; // sem estado informado: usa "bom" e o alerta avisa
  }

  // ── CUSTO DE REEDIÇÃO ───────────────────────────────────────────────

  function valorNovoBase(bem, cots) {
    var vn = num(bem.valor_novo);
    if (vn !== null) return { vn: vn, origem: "informado" };
    var novos = (cots || []).filter(function (c) { return c.tipo === "novo" && c.incluido !== false && !c.excluido && num(c.preco) !== null; })
      .map(function (c) { return num(c.preco); });
    if (novos.length) return { vn: mean(novos), origem: "média de " + novos.length + " cotação(ões) de novo" };
    return { vn: null, origem: null };
  }

  // metodo: "ibape" | "rossheidecke" | "linear". Retorna o detalhamento.
  function calcReedicao(bem, av, cots, metodo) {
    var p = parametrosIdade(bem, av);
    var vnb = valorNovoBase(bem, cots);
    var out = { metodo: metodo, x: p.x, n: p.n, iv: p.iv, vn_base: vnb.vn, vn_origem: vnb.origem, valor: null };
    if (vnb.vn === null || p.x === null || !p.n) return out;

    var extras = num(bem.custos_adicionais) || 0;
    var VN = vnb.vn + extras;
    var fobs = num(bem.fobs); if (fobs === null) fobs = 1;
    var cadeq = (num(bem.nr12_custo) || 0) + (num(bem.custo_reparos) || 0);
    var est = estadoInfo(bem.estado);
    out.VN = VN; out.fobs = fobs; out.cadeq = cadeq;
    var v;
    if (metodo === "ibape") {
      var K = ibapeK(p.iv, curvaDoBem(bem));
      out.K = K; out.curva = curvaDoBem(bem);
      v = VN * K * fobs - cadeq; // a curva já contém piso residual de 0,10
    } else {
      var Rp = num(bem.residual_pct); if (Rp === null) Rp = 10;
      var R = Rp / 100, VR = VN * R, k;
      out.R = R;
      if (metodo === "rossheidecke") {
        var c = est ? est.c : 0;
        var rh = rossHeidecke(p.x, p.n, c);
        out.alpha = rh.alpha; out.c = c; out.k = rh.k; k = rh.k;
      } else {
        k = linear(p.x, p.n); out.k = k;
      }
      v = (VN - k * (VN - VR)) * fobs - cadeq;
    }
    out.valor = Math.max(0, v);
    return out;
  }

  // ── COMPARATIVO DIRETO ──────────────────────────────────────────────

  // Homogeneíza cada dado de mercado e sanea a amostra (±30 % em torno da média).
  function calcComparativo(bem, av, cots, opts) {
    opts = opts || {};
    var ffPadrao = num(av && av.ff_padrao); if (ffPadrao === null) ffPadrao = 0.90;
    var p = parametrosIdade(bem, av);
    var curvaBem = curvaDoBem(bem);
    var ivBem = p.iv;
    var linhas = [];
    (cots || []).forEach(function (c) {
      if (c.excluido || c.tipo === "novo") return;
      var preco = num(c.preco);
      var l = { id: c.id, tipo: c.tipo, incluido: c.incluido !== false, preco: preco, vh: null, produto: null, alertas: [] };
      if (preco === null) { l.alertas.push("sem preço"); linhas.push(l); return; }
      var ff = num(c.ff); if (ff === null) ff = (c.tipo === "transacao") ? 1 : ffPadrao;
      var fest = num(c.fest); if (fest === null) fest = 1;
      var fcap = num(c.fcap); if (fcap === null) fcap = 1;
      var fop = num(c.fop); if (fop === null) fop = 1;
      var fid = num(c.fid), fidAuto = false;
      if (fid === null) {
        var anoC = num(c.ano);
        if (anoC !== null && p.anoBase !== null && p.n && ivBem !== null) {
          var ivC = Math.max(0, (p.anoBase - anoC)) / p.n;
          var kb = ibapeK(ivBem, curvaBem), kc = ibapeK(ivC, c.curva === "regular" ? "regular" : "bom");
          fid = kb / kc; fidAuto = true;
        } else { fid = 1; if (p.n) l.alertas.push("sem ano do dado: fator idade = 1"); }
      }
      l.ff = ff; l.fid = fid; l.fidAuto = fidAuto; l.fest = fest; l.fcap = fcap; l.fop = fop;
      l.produto = ff * fid * fest * fcap * fop;
      if (l.produto < 0.5 || l.produto > 2.0) l.alertas.push("fatores fora de 0,50–2,00");
      l.vh = preco * l.produto;
      linhas.push(l);
    });

    var ativos = linhas.filter(function (l) { return l.incluido && l.vh !== null; });
    var saneamento = opts.saneamento !== false;
    var descartados = [];
    var amostra = ativos.slice();
    if (saneamento && amostra.length >= 3) {
      var m0 = mean(amostra.map(function (l) { return l.vh; }));
      var keep = [];
      amostra.forEach(function (l) {
        if (l.vh < m0 * 0.7 || l.vh > m0 * 1.3) { l.descartado = true; descartados.push(l.id); }
        else keep.push(l);
      });
      if (keep.length >= 1) amostra = keep; else descartados = [];
    }
    var vals = amostra.map(function (l) { return l.vh; });
    var media = mean(vals);
    var margem = num(av && av.margem_arbitrio); if (margem === null) margem = 15;
    var res = {
      linhas: linhas, n_total: linhas.length, n_validos: vals.length, descartados: descartados,
      media: media, dp: vals.length ? sd(vals) : null, cv: null,
      arb_min: null, arb_max: null, valor: media
    };
    if (media) {
      res.cv = res.dp / media;
      res.arb_min = media * (1 - margem / 100);
      res.arb_max = media * (1 + margem / 100);
    }
    return res;
  }

  // ── GRAU DE FUNDAMENTAÇÃO (bens isolados — Tabelas 2 e 3 da NBR 14653-5) ─
  // Pontuação sugerida a partir dos dados lançados. Conferir a redação
  // exata na norma oficial. Grau III ≥ 10 pts (todos ≥ 2); II ≥ 6 (itens 2 e 4 ≥ 2); I ≥ 4.
  function calcGrau(bem, metodoUsado, nDados, temCotacaoDireta) {
    var chaves = ["fabricante", "modelo", "serie", "ano_fabricacao", "capacidade"]
      .filter(function (k) { return String(bem[k] == null ? "" : bem[k]).trim() !== ""; }).length;
    var fotos = num(bem.fotos_qtd) || 0;
    var vistoria = (chaves >= 4 && fotos >= 4) ? 3 : (chaves >= 2 && fotos >= 1) ? 2 : 1;
    var func = bem.funcionamento === "completo" ? 3 : bem.funcionamento === "observado" ? 2 : 1;
    var dados;
    if (metodoUsado === "comparativo") dados = nDados >= 3 ? 3 : nDados >= 2 ? 2 : nDados >= 1 ? 1 : 0;
    else if (metodoUsado === "manual" || metodoUsado === "sucata") dados = 1;
    else dados = (temCotacaoDireta || nDados >= 3) ? 3 : nDados >= 2 ? 2 : 1;
    var deprec = metodoUsado === "comparativo" ? 3 : (metodoUsado === "manual" ? 1 : 2);
    var pontos = vistoria + func + dados + deprec;
    var itens = [vistoria, func, dados, deprec];
    var grau = null;
    if (pontos >= 10 && Math.min.apply(null, itens) >= 2) grau = "III";
    else if (pontos >= 6 && func >= 2 && deprec >= 2) grau = "II";
    else if (pontos >= 4) grau = "I";
    return { vistoria: vistoria, funcionamento: func, dados: dados, depreciacao: deprec, pontos: pontos, grau: grau };
  }

  // ── VALOR DE LIQUIDAÇÃO FORÇADA (apenas informativo) ────────────────

  function calcVLF(valorMercado, av) {
    if (valorMercado === null || valorMercado === undefined) return null;
    var cv = (num(av && av.vlf_custos) !== null ? num(av.vlf_custos) : 7) / 100;
    var i = (num(av && av.vlf_juros_mensal) !== null ? num(av.vlf_juros_mensal) : 1.2) / 100;
    var t = num(av && av.vlf_meses) !== null ? num(av.vlf_meses) : 6;
    return valorMercado * (1 - cv) / Math.pow(1 + i, t);
  }

  // ── AVALIAÇÃO DE UM BEM ─────────────────────────────────────────────

  function avaliarBem(bem, av, cotsDoBem) {
    var cots = (cotsDoBem || []).filter(function (c) { return !c.excluido; });
    var metodo = bem.metodo || "comparativo";
    var alertas = [];
    var p = parametrosIdade(bem, av);
    var est = estadoInfo(bem.estado);
    var qtd = Math.max(1, parseInt(bem.quantidade, 10) || 1);

    var comp = calcComparativo(bem, av, cots);
    var reedMetodo = metodo === "rossheidecke" || metodo === "linear" ? metodo : "ibape";
    if (reedMetodo === "ibape" && est && est.curva === null) reedMetodo = "rossheidecke"; // curva não recomendada
    var reed = calcReedicao(bem, av, cots, reedMetodo);

    var valor = null, usado = metodo;
    if (metodo === "comparativo") valor = comp.n_validos ? comp.valor : null;
    else if (metodo === "ibape" || metodo === "rossheidecke" || metodo === "linear") {
      reed = calcReedicao(bem, av, cots, metodo); valor = reed.valor;
    }
    else if (metodo === "sucata") {
      var peso = num(bem.peso_kg), preco = num(bem.preco_sucata_kg);
      valor = (peso !== null && preco !== null) ? peso * preco : null;
    }
    else if (metodo === "manual") valor = num(bem.valor_manual);

    // alertas
    if (!String(bem.descricao || "").trim()) alertas.push("Sem descrição.");
    if (bem.estado == null || bem.estado === "") alertas.push("Estado de conservação não informado.");
    if (metodo !== "sucata" && metodo !== "manual") {
      if (num(bem.ano_fabricacao) === null && num(bem.idade_aparente) === null) alertas.push("Sem ano de fabricação (nem idade aparente).");
      if (!p.n) alertas.push("Sem vida útil de referência.");
    }
    if (metodo === "comparativo" && !comp.n_validos) alertas.push("Comparativo sem dados de mercado válidos.");
    if (metodo === "comparativo" && comp.n_validos > 0 && comp.n_validos < 3) alertas.push("Menos de 3 dados de mercado (grau III exige ≥ 3).");
    if (metodo === "ibape" && est && est.curva === null) alertas.push("Curva IBAPE não recomendada para este estado de conservação.");
    if ((metodo === "ibape" || metodo === "rossheidecke" || metodo === "linear") && reed.vn_base === null) alertas.push("Sem valor do bem novo.");
    if (metodo === "manual" && !String(bem.justificativa_manual || "").trim()) alertas.push("Valor arbitrado sem justificativa.");
    if (bem.nr12 === "nao_conforme" && !(num(bem.nr12_custo) > 0)) alertas.push("NR-12 não conforme sem custo de adequação estimado.");
    if (bem.nr12 === "nao_avaliado") alertas.push("NR-12 não avaliada.");
    comp.linhas.forEach(function (l) { l.alertas.forEach(function (a) { alertas.push("Dado de mercado: " + a + "."); }); });

    var nNovos = cots.filter(function (c) { return c.tipo === "novo" && c.incluido !== false && num(c.preco) !== null; }).length;
    var direta = cots.some(function (c) { return c.tipo === "novo" && c.direta && c.incluido !== false; });
    var grau = calcGrau(bem, metodo, metodo === "comparativo" ? comp.n_validos : nNovos, direta);

    // conferência cruzada por um segundo método (quando possível)
    var conferencia = null;
    if (metodo === "comparativo" && reed.valor !== null) conferencia = { metodo: reedMetodo, valor: reed.valor, detalhe: reed };
    else if (metodo !== "comparativo" && comp.n_validos) conferencia = { metodo: "comparativo", valor: comp.valor, detalhe: comp };
    if (conferencia && valor) conferencia.dif_pct = (conferencia.valor - valor) / valor;

    var vlf = valor !== null ? calcVLF(valor, av) : null;
    return {
      metodo: metodo, valor: valor, qtd: qtd,
      valor_total: valor !== null ? valor * qtd : null,
      arb_min: (metodo === "comparativo") ? comp.arb_min : (valor !== null ? valor * (1 - (num(av && av.margem_arbitrio) !== null ? num(av.margem_arbitrio) : 15) / 100) : null),
      arb_max: (metodo === "comparativo") ? comp.arb_max : (valor !== null ? valor * (1 + (num(av && av.margem_arbitrio) !== null ? num(av.margem_arbitrio) : 15) / 100) : null),
      vlf: vlf, grau: grau, alertas: alertas, comparativo: comp, reedicao: reed, conferencia: conferencia,
      idade: p
    };
  }

  // ── TOTAIS DA AVALIAÇÃO ─────────────────────────────────────────────

  function avaliarTudo(av, bens, cots) {
    var itens = [];
    var tot = { proprios: 0, nao_pertencentes: 0, saldo_onus: 0, vlf: 0, n_bens: 0, n_unidades: 0,
                n_sem_valor: 0, n_grau: { III: 0, II: 0, I: 0, sem: 0 }, valor_grau_III: 0 };
    (bens || []).filter(function (b) { return !b.excluido; })
      .sort(function (a, b) { return (num(a.numero) || 0) - (num(b.numero) || 0); })
      .forEach(function (b) {
        var r = avaliarBem(b, av, (cots || []).filter(function (c) { return c.bem_id === b.id; }));
        var propriedade = b.propriedade || "propria";
        var proprio = propriedade === "propria";
        itens.push({ bem: b, res: r, proprio: proprio });
        tot.n_bens++; tot.n_unidades += r.qtd;
        if (r.valor_total === null) tot.n_sem_valor++;
        else if (proprio) {
          tot.proprios += r.valor_total;
          if (r.vlf !== null) tot.vlf += r.vlf * r.qtd;
          if (r.grau.grau === "III") tot.valor_grau_III += r.valor_total;
        } else tot.nao_pertencentes += r.valor_total;
        if (proprio && b.onus && b.onus !== "nenhum") tot.saldo_onus += (num(b.onus_saldo) || 0);
        tot.n_grau[r.grau.grau || "sem"]++;
      });
    tot.pct_grau_III = tot.proprios ? tot.valor_grau_III / tot.proprios : 0;
    return { itens: itens, totais: tot };
  }

  // Valor por extenso em reais (laudo). Ex.: 10400 -> "dez mil e quatrocentos reais"
  var EXT_UN = ["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  var EXT_DZ = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  var EXT_CT = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  function ate999(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";
    var c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(EXT_CT[c]);
    if (r) { if (r < 20) p.push(EXT_UN[r]); else { var d = Math.floor(r / 10), u = r % 10; p.push(EXT_DZ[d] + (u ? " e " + EXT_UN[u] : "")); } }
    return p.join(" e ");
  }
  function inteiroExtenso(n) {
    if (n === 0) return "zero";
    var mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1e3), r = n % 1e3, partes = [];
    if (mi) partes.push(ate999(mi) + (mi === 1 ? " milhão" : " milhões"));
    if (mil) partes.push(mil === 1 ? "mil" : ate999(mil) + " mil");
    if (r) partes.push(ate999(r));
    var ultimo = r || mil || mi;
    var ligaE = ultimo < 100 || ultimo % 100 === 0;
    var out = partes[0];
    for (var i = 1; i < partes.length; i++) out += (i === partes.length - 1 && ligaE ? " e " : ", ") + partes[i];
    return out;
  }
  function extenso(valor) {
    if (valor === null || valor === undefined || !isFinite(valor)) return "";
    var cents = Math.round(Math.abs(valor) * 100), reais = Math.floor(cents / 100), cent = cents % 100;
    var out = [];
    if (reais > 0 || cent === 0) out.push(inteiroExtenso(reais) + (reais >= 1e6 && reais % 1e6 === 0 ? " de" : "") + (reais === 1 ? " real" : " reais"));
    if (cent > 0) out.push(inteiroExtenso(cent) + (cent === 1 ? " centavo" : " centavos"));
    return out.join(" e ");
  }

  // ── FORMATAÇÃO ──────────────────────────────────────────────────────

  function brl(v) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    var neg = v < 0, parts = Math.abs(v).toFixed(2).split(".");
    var int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + "R$ " + int + "," + parts[1];
  }
  function pct(v, d) { return (v === null || v === undefined || !isFinite(v)) ? "—" : (v * 100).toFixed(d == null ? 1 : d).replace(".", ",") + " %"; }
  function fmtNum(v, d) { return (v === null || v === undefined || !isFinite(v)) ? "—" : Number(v).toFixed(d == null ? 4 : d).replace(".", ","); }

  return {
    ESTADOS: ESTADOS, VIDAS_UTEIS: VIDAS_UTEIS, METODOS: METODOS,
    IBAPE: { iv: IBAPE_IV, bom: IBAPE_BOM, regular: IBAPE_REG },
    num: num, round: round, mean: mean, sd: sd, estadoInfo: estadoInfo, vidaUtilInfo: vidaUtilInfo, anoBase: anoBase,
    ibapeK: ibapeK, rossHeidecke: rossHeidecke, linear: linear,
    parametrosIdade: parametrosIdade, valorNovoBase: valorNovoBase,
    calcReedicao: calcReedicao, calcComparativo: calcComparativo, calcGrau: calcGrau, calcVLF: calcVLF,
    avaliarBem: avaliarBem, avaliarTudo: avaliarTudo,
    brl: brl, pct: pct, fmtNum: fmtNum, extenso: extenso
  };
});
