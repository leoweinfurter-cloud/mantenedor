// ═══════════════════════════════════════════════════════════════════════
//  Avaliação — checklist de vistoria in loco (UMD, testável no Node)
//
//  Cada bem guarda bem.checklist = { <idItem>: { s: "ok" | "nc" | "na", n: "nota" } }.
//  Item ausente = ainda não verificado.
//  O checklist é registro de campo: não altera o valor sozinho. A tela oferece
//  atalhos (NR-12, observações) que o avaliador aplica conscientemente.
// ═══════════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AVLCHECK = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // nr12: true = item de segurança que alimenta o campo "NR-12" da ficha.
  var GRUPOS = [
    { cod: "id", nome: "Identificação e documentação", itens: [
      { id: "id_placa", t: "Plaqueta do fabricante presente e legível" },
      { id: "id_serie", t: "Nº de série / modelo conferem com a relação do cliente" },
      { id: "id_nf", t: "Nota fiscal ou documento de propriedade apresentado" },
      { id: "id_manual", t: "Manual de operação / manutenção disponível" },
      { id: "id_plaqpat", t: "Plaqueta de patrimônio / TAG afixada" }
    ] },
    { cod: "est", nome: "Estrutura e mecânica", itens: [
      { id: "est_corrosao", t: "Sem corrosão relevante na estrutura e chapas" },
      { id: "est_trincas", t: "Sem trincas, empenos ou deformações" },
      { id: "est_vazamento", t: "Sem vazamentos de óleo, graxa ou fluidos" },
      { id: "est_folgas", t: "Sem folgas, ruídos ou vibração anormais" },
      { id: "est_lubrif", t: "Lubrificação em dia (níveis, pontos de graxa)" },
      { id: "est_transm", t: "Correias, correntes, engrenagens e acoplamentos em bom estado" },
      { id: "est_guias", t: "Guias, barramentos e fusos sem desgaste visível" },
      { id: "est_fixacao", t: "Fixação / fundação adequada e nivelamento" },
      { id: "est_pintura", t: "Pintura e aparência geral conservadas" }
    ] },
    { cod: "ele", nome: "Elétrica e comando", itens: [
      { id: "ele_painel", t: "Painel elétrico limpo, organizado e fechado" },
      { id: "ele_cabos", t: "Cabos e fiação íntegros (sem emendas ou ressecamento)" },
      { id: "ele_aterr", t: "Aterramento presente" },
      { id: "ele_ihm", t: "CNC / CLP / IHM funcionando, sem alarmes ativos" },
      { id: "ele_motores", t: "Motores, inversores e sensores sem sinais de superaquecimento" },
      { id: "ele_suporte", t: "Comando e componentes com suporte e peças disponíveis (não descontinuados)" }
    ] },
    { cod: "flu", nome: "Pneumática e hidráulica", itens: [
      { id: "flu_mang", t: "Mangueiras e conexões sem ressecamento ou vazamento" },
      { id: "flu_pressao", t: "Manômetros e pressões de trabalho normais" },
      { id: "flu_filtros", t: "Filtros, unidade de conservação e reservatórios em ordem" },
      { id: "flu_valv", t: "Válvulas e atuadores funcionando" }
    ] },
    { cod: "nr12", nome: "Segurança — NR-12", itens: [
      { id: "nr_fixas", t: "Proteções fixas nas zonas de risco (transmissões, partes móveis)", nr12: true },
      { id: "nr_moveis", t: "Proteções móveis com intertravamento funcionando", nr12: true },
      { id: "nr_emerg", t: "Botão de parada de emergência presente e funcional", nr12: true },
      { id: "nr_partida", t: "Dispositivo de partida protegido contra acionamento acidental", nr12: true },
      { id: "nr_bimanual", t: "Comando bimanual / cortina de luz quando aplicável", nr12: true },
      { id: "nr_sinal", t: "Sinalização de segurança e advertência", nr12: true },
      { id: "nr_manual", t: "Manual em português e procedimentos de operação", nr12: true },
      { id: "nr_laudo", t: "Laudo / apreciação de risco NR-12 apresentado", nr12: true }
    ] },
    { cod: "fun", nome: "Funcionamento e histórico", itens: [
      { id: "fun_liga", t: "Liga e parte normalmente" },
      { id: "fun_ciclo", t: "Operação observada em ciclo completo" },
      { id: "fun_ruido", t: "Sem ruído, aquecimento ou vibração anormais em operação" },
      { id: "fun_prod", t: "Produção / eficiência relatada pelo operador" },
      { id: "fun_hist", t: "Histórico de paradas e reparos informado" },
      { id: "fun_plano", t: "Plano ou registros de manutenção apresentados" },
      { id: "fun_pecas", t: "Peças de reposição disponíveis no mercado" }
    ] },
    { cod: "ent", nome: "Instalação e remoção", itens: [
      { id: "ent_linha", t: "Opera de forma independente (não depende da linha)" },
      { id: "ent_acesso", t: "Acesso e espaço permitem desmontagem / remoção" },
      { id: "ent_acess", t: "Acessórios e ferramental completos" }
    ] },
    { cod: "reg", nome: "Registros do levantamento", itens: [
      { id: "reg_placa", t: "Foto da plaqueta" },
      { id: "reg_geral", t: "Fotos gerais (frente, laterais, traseira)" },
      { id: "reg_painel", t: "Foto do painel / comando" },
      { id: "reg_detalhe", t: "Fotos de detalhes e defeitos" },
      { id: "reg_horim", t: "Horímetro / contador lido e anotado" },
      { id: "reg_oper", t: "Operador / responsável entrevistado" }
    ] }
  ];

  var ITENS = [];
  GRUPOS.forEach(function (g) { g.itens.forEach(function (i) { ITENS.push({ id: i.id, t: i.t, grupo: g.cod, grupoNome: g.nome, nr12: !!i.nr12 }); }); });

  // Todos os itens são redigidos pela ótica do bom estado: "ok" = conforme, "nc" = não conforme.
  function resumo(chk) {
    chk = chk || {};
    var r = { total: ITENS.length, respondidos: 0, ok: 0, nc: 0, na: 0, ncLista: [], nr12: { total: 0, resp: 0, nc: 0, ok: 0, na: 0 }, grupos: {} };
    GRUPOS.forEach(function (g) { r.grupos[g.cod] = { total: g.itens.length, resp: 0, nc: 0 }; });
    ITENS.forEach(function (i) {
      var x = chk[i.id], s = x && x.s;
      if (i.nr12) r.nr12.total++;
      if (s !== "ok" && s !== "nc" && s !== "na") return;
      r.respondidos++; r[s]++;
      r.grupos[i.grupo].resp++;
      if (i.nr12) { r.nr12.resp++; r.nr12[s]++; }
      if (s === "nc") { r.grupos[i.grupo].nc++; r.ncLista.push({ id: i.id, t: i.t, grupoNome: i.grupoNome, n: (x.n || "").trim() }); }
    });
    return r;
  }

  // Sugestão para o campo NR-12 da ficha: null = ainda sem base para sugerir.
  function sugestaoNR12(chk) {
    var r = resumo(chk).nr12;
    if (r.nc > 0) return "nao_conforme";
    if (r.resp === r.total && r.na === r.total) return "nao_aplica";
    if (r.resp === r.total && r.ok > 0) return "conforme";
    return null;
  }

  function definir(chk, id, s, nota) {
    var o = Object.assign({}, chk || {});
    var ant = o[id] || {};
    if (!s) { delete o[id]; return o; }
    o[id] = { s: s, n: nota !== undefined ? nota : (ant.n || "") };
    return o;
  }

  // Texto curto para o laudo / observações.
  function textoNC(chk) {
    return resumo(chk).ncLista.map(function (i) { return i.t + (i.n ? " (" + i.n + ")" : ""); });
  }

  return { GRUPOS: GRUPOS, ITENS: ITENS, resumo: resumo, sugestaoNR12: sugestaoNR12, definir: definir, textoNC: textoNC };
});
