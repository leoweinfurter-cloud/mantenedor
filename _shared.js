// ── SHARED: dados iniciais e utilitários ──────────────────────────────────
var DEMO_ORDENS=[
  {id:1,titulo:"Troca de rolamento",ativo:"Compressor 2",tipo:"Corretiva",prioridade:"Alta",status:"Em Andamento",tecnico:"Joao Silva",abertura:"2026-05-01",prazo:"2026-05-10",descricao:"Ruido anormal detectado."},
  {id:2,titulo:"Lubrificacao geral",ativo:"Esteira Principal",tipo:"Preventiva",prioridade:"Normal",status:"Aberta",tecnico:"Maria Santos",abertura:"2026-05-03",prazo:"2026-05-12",descricao:"Lubrificacao mensal."},
  {id:3,titulo:"Troca de filtro HVAC",ativo:"Sistema HVAC",tipo:"Preventiva",prioridade:"Baixa",status:"Concluida",tecnico:"Carlos Pereira",abertura:"2026-04-20",prazo:"2026-04-25",descricao:"Troca mensal."},
  {id:4,titulo:"Vazamento hidraulico",ativo:"Prensa Hidraulica 1",tipo:"Corretiva",prioridade:"Critica",status:"Aberta",tecnico:"Joao Silva",abertura:"2026-05-09",prazo:"2026-05-09",descricao:"Vazamento no cilindro."},
  {id:5,titulo:"Calibracao sensores",ativo:"Forno Industrial",tipo:"Preditiva",prioridade:"Normal",status:"Concluida",tecnico:"Ana Lima",abertura:"2026-04-15",prazo:"2026-04-20",descricao:"Calibracao semestral."},
  {id:6,titulo:"Revisao geral",ativo:"Compressor 2",tipo:"Preventiva",prioridade:"Normal",status:"Concluida",tecnico:"Joao Silva",abertura:"2026-03-01",prazo:"2026-03-05",descricao:"Revisao trimestral."}
];
var DEMO_ATIVOS=[
  {id:1,nome:"Compressor 2",categoria:"Pneumatico",localizacao:"Galpao A",fabricante:"Atlas Copco",modelo:"GA37",serie:"AC-2019-037",ano:"2019",status:"Em Manutencao",ultima_manutencao:"2026-05-01",proxima_manutencao:"2026-08-01"},
  {id:2,nome:"Esteira Principal",categoria:"Transporte",localizacao:"Linha 1",fabricante:"Intral",modelo:"ET-500",serie:"IN-2020-112",ano:"2020",status:"Operacional",ultima_manutencao:"2026-04-01",proxima_manutencao:"2026-05-01"},
  {id:3,nome:"Sistema HVAC",categoria:"Utilidades",localizacao:"Cobertura",fabricante:"Carrier",modelo:"30XA",serie:"CA-2018-089",ano:"2018",status:"Operacional",ultima_manutencao:"2026-04-25",proxima_manutencao:"2026-05-25"},
  {id:4,nome:"Prensa Hidraulica 1",categoria:"Producao",localizacao:"Galpao B",fabricante:"Romi",modelo:"PH-200T",serie:"RO-2017-045",ano:"2017",status:"Parado",ultima_manutencao:"2026-03-01",proxima_manutencao:"2026-05-09"},
  {id:5,nome:"Forno Industrial",categoria:"Producao",localizacao:"Galpao A",fabricante:"Brafer",modelo:"FI-800",serie:"BR-2021-023",ano:"2021",status:"Operacional",ultima_manutencao:"2026-04-15",proxima_manutencao:"2026-10-15"}
];
var DEMO_FICHAS={
  1:{historico:[
    {id:101,desc:"Troca de rolamento dianteiro",data:"2026-05-01",tipo:"Corretiva",tecnico:"Joao Silva",horas:6,custo:850,obs:"Rolamento SKF substituido."},
    {id:102,desc:"Revisao geral trimestral",data:"2026-02-10",tipo:"Preventiva",tecnico:"Joao Silva",horas:3,custo:200,obs:"Verificacao de correias."},
    {id:103,desc:"Falha no selo mecanico",data:"2025-11-15",tipo:"Corretiva",tecnico:"Carlos Pereira",horas:8,custo:1100,obs:"Selo mecanico substituido."}
  ],preditiva:[
    {id:111,data:"2026-02-01",param:"Vibracao (mm/s)",valor:3.1,limite:6.0,obs:"Normal"},
    {id:112,data:"2026-03-01",param:"Vibracao (mm/s)",valor:3.8,limite:6.0,obs:"Normal"},
    {id:113,data:"2026-04-01",param:"Vibracao (mm/s)",valor:4.2,limite:6.0,obs:"Leve aumento"},
    {id:114,data:"2026-05-01",param:"Vibracao (mm/s)",valor:5.1,limite:6.0,obs:"Monitorar"},
    {id:115,data:"2026-02-01",param:"Temperatura (C)",valor:72,limite:85,obs:"Normal"},
    {id:116,data:"2026-03-01",param:"Temperatura (C)",valor:74,limite:85,obs:"Normal"},
    {id:117,data:"2026-04-01",param:"Temperatura (C)",valor:76,limite:85,obs:"Tendencia de alta"},
    {id:118,data:"2026-05-01",param:"Temperatura (C)",valor:79,limite:85,obs:"Atencao"}
  ],planos:[
    {id:11,nome:"Revisao Geral Trimestral",frequencia:"Trimestral",tipo:"Preventiva",ultima_execucao:"2026-03-01",proxima_execucao:"2026-06-01",responsavel:"Joao Silva",status:"OK",acoes:[{id:1101,desc:"Inspecionar correias e tensionamento",tipo:"acao",obrigatorio:true},{id:1102,desc:"Verificar niveis de oleo",tipo:"acao",obrigatorio:true},{id:1103,desc:"Medir temperatura do motor",tipo:"medicao",param:"Temperatura motor (C)",unidade:"C",limite_min:0,limite_max:85,obrigatorio:true},{id:1104,desc:"Medir vibracao",tipo:"medicao",param:"Vibracao (mm/s)",unidade:"mm/s",limite_min:0,limite_max:6.0,obrigatorio:false}]}
  ],docs:[],indicadores:["mtbf","mttr","disp","manuplan","backlog","conf"],crit:{hse:4,prod:5,custo:4,freq:4,det:3,red:3}},
  2:{historico:[
    {id:201,desc:"Lubrificacao rolamentos",data:"2026-04-01",tipo:"Preventiva",tecnico:"Maria Santos",horas:2,custo:120,obs:"Graxa Shell Gadus S2."},
    {id:202,desc:"Correia rompida",data:"2026-01-18",tipo:"Corretiva",tecnico:"Carlos Pereira",horas:4,custo:350,obs:"Correia substituida."}
  ],preditiva:[],planos:[
    {id:21,nome:"Lubrificacao Geral",frequencia:"Mensal",tipo:"Preventiva",ultima_execucao:"2026-04-01",proxima_execucao:"2026-05-01",responsavel:"Maria Santos",status:"Atrasado",acoes:[{id:2101,desc:"Aplicar graxas nos rolamentos",tipo:"acao",obrigatorio:true},{id:2102,desc:"Lubrificar correntes e guias",tipo:"acao",obrigatorio:true},{id:2103,desc:"Verificar estado das correias",tipo:"acao",obrigatorio:false}]}
  ],docs:[],indicadores:["mtbf","disp","manuplan","backlog"],crit:{hse:2,prod:3,custo:2,freq:3,det:2,red:2}},
  3:{historico:[{id:301,desc:"Troca filtros G4 e F7",data:"2026-04-25",tipo:"Preventiva",tecnico:"Carlos Pereira",horas:1,custo:180,obs:"Filtros Camfil."}],preditiva:[],planos:[
    {id:31,nome:"Troca de Filtros",frequencia:"Mensal",tipo:"Preventiva",ultima_execucao:"2026-04-25",proxima_execucao:"2026-05-25",responsavel:"Carlos Pereira",status:"OK",acoes:[{id:3101,desc:"Substituir filtro G4",tipo:"acao",obrigatorio:true},{id:3102,desc:"Substituir filtro F7",tipo:"acao",obrigatorio:true},{id:3103,desc:"Medir pressao diferencial",tipo:"medicao",param:"Pressao diferencial (Pa)",unidade:"Pa",limite_min:0,limite_max:250,obrigatorio:true}]}
  ],docs:[],indicadores:["disp","compliance","manuplan"],crit:{hse:1,prod:2,custo:2,freq:2,det:1,red:2}},
  4:{historico:[
    {id:401,desc:"Substituicao vedacoes cilindro",data:"2026-03-01",tipo:"Corretiva",tecnico:"Joao Silva",horas:8,custo:1200,obs:"Vedacoes Parker."},
    {id:402,desc:"Inspecao de vazamento",data:"2025-12-10",tipo:"Corretiva",tecnico:"Joao Silva",horas:5,custo:600,obs:"Reparo temporario."}
  ],preditiva:[],planos:[
    {id:41,nome:"Inspecao Hidraulica",frequencia:"Bimestral",tipo:"Preditiva",ultima_execucao:"2026-03-09",proxima_execucao:"2026-05-09",responsavel:"Joao Silva",status:"Vence Hoje",acoes:[{id:4101,desc:"Inspecionar mangueiras e conexoes",tipo:"acao",obrigatorio:true},{id:4102,desc:"Medir pressao do sistema",tipo:"medicao",param:"Pressao hidraulica (bar)",unidade:"bar",limite_min:150,limite_max:200,obrigatorio:true},{id:4103,desc:"Verificar nivel do reservatorio",tipo:"acao",obrigatorio:true},{id:4104,desc:"Coletar amostra de oleo",tipo:"acao",obrigatorio:false}]}
  ],docs:[],indicadores:["mtbf","mttr","disp","lambda","nfalhas","backlog"],crit:{hse:4,prod:4,custo:4,freq:3,det:4,red:4}},
  5:{historico:[{id:501,desc:"Calibracao sensores PT100",data:"2026-04-15",tipo:"Preditiva",tecnico:"Ana Lima",horas:3,custo:400,obs:"Calibracao INMETRO."}],preditiva:[],planos:[
    {id:51,nome:"Calibracao de Sensores",frequencia:"Semestral",tipo:"Preditiva",ultima_execucao:"2026-04-15",proxima_execucao:"2026-10-15",responsavel:"Ana Lima",status:"OK",acoes:[{id:5101,desc:"Calibrar sensores PT100 de temperatura",tipo:"acao",obrigatorio:true},{id:5102,desc:"Medir temperatura de referencia",tipo:"medicao",param:"Temperatura referencia (C)",unidade:"C",limite_min:20,limite_max:25,obrigatorio:true},{id:5103,desc:"Registrar numero do certificado",tipo:"acao",obrigatorio:true}]}
  ],docs:[],indicadores:["disp","manuplan","compliance"],crit:{hse:2,prod:4,custo:3,freq:2,det:2,red:3}}
};

function loadData(){
  var o=localStorage.getItem("mx_ordens");
  var a=localStorage.getItem("mx_ativos");
  var f=localStorage.getItem("mx_fichas");
  if(!o){localStorage.setItem("mx_ordens",JSON.stringify(DEMO_ORDENS));}
  if(!a){localStorage.setItem("mx_ativos",JSON.stringify(DEMO_ATIVOS));}
  if(!f){localStorage.setItem("mx_fichas",JSON.stringify(DEMO_FICHAS));}
  var ordens = o?JSON.parse(o):DEMO_ORDENS;
  var ativos = a?JSON.parse(a):DEMO_ATIVOS;
  var fichas = f?JSON.parse(f):DEMO_FICHAS;
  // Normaliza fichas — garante que todos os campos existam
  ativos.forEach(function(at){
    if(!fichas[at.id]) fichas[at.id]={};
    var fi=fichas[at.id];
    if(!fi.historico) fi.historico=[];
    if(!fi.preditiva) fi.preditiva=[];
    if(!fi.planos)    fi.planos=[];
    if(!fi.docs)      fi.docs=[];
    if(!fi.indicadores) fi.indicadores=["mtbf","mttr","disp","manuplan"];
    // Normaliza planos — garante que acoes exista
    fi.planos=fi.planos.map(function(p){
      if(!p.acoes) p.acoes=[];
      if(!p.tipo)  p.tipo="Preventiva";
      if(!p.status) p.status=calcPlanStatus(p.proxima_execucao);
      return p;
    });
    // Normaliza OS — garante que execLog exista
  });
  ordens=ordens.map(function(o){
    if(!o.execLog) o.execLog=[];
    return o;
  });
  return{ordens:ordens, ativos:ativos, fichas:fichas};
}
function saveOrdens(d){localStorage.setItem("mx_ordens",JSON.stringify(d));}
function saveAtivos(d){localStorage.setItem("mx_ativos",JSON.stringify(d));}
function saveFichas(d){localStorage.setItem("mx_fichas",JSON.stringify(d));}
function nextId(){var n=parseInt(localStorage.getItem("mx_nextid")||"700");localStorage.setItem("mx_nextid",n+1);return n+1;}

function bdg(t,m){var c=m[t]||"#9ca3af";return'<span class="badge" style="background:'+c+'18;color:'+c+';border:1px solid '+c+'35">'+t+'</span>';}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

var PC={"Critica":"#f87171","Alta":"#fb923c","Normal":"#60a5fa","Baixa":"#9ca3af"};
var SC={"Aberta":"#fbbf24","Em Andamento":"#60a5fa","Concluida":"#4ade80","Cancelada":"#6b7280"};
var AC={"Operacional":"#4ade80","Em Manutencao":"#fbbf24","Parado":"#f87171"};
var TC={"Corretiva":"#f87171","Preventiva":"#4ade80","Preditiva":"#8b5cf6","Inspecao":"#60a5fa"};
var LP={"OK":"#4ade80","Atrasado":"#f87171","Vence Hoje":"#fbbf24"};
var ANAL_LABELS={"5porques":"5 Porques","ishikawa":"Ishikawa (6M)","fmea":"FMEA","rca":"RCA","fta":"Arvore de Falhas","pdca":"PDCA"};
var ANAL_COLORS={"5porques":"#60a5fa","ishikawa":"#f59e0b","fmea":"#f87171","rca":"#a78bfa","fta":"#34d399","pdca":"#fb923c"};
var IND_CATALOG=[
  {id:"mtbf",abbr:"MTBF",nome:"Tempo Medio entre Falhas",unit:"h",color:"#60a5fa",norma:"EN 13306"},
  {id:"mttr",abbr:"MTTR",nome:"Tempo Medio de Reparo",unit:"h",color:"#f59e0b",norma:"EN 13306"},
  {id:"disp",abbr:"A(%)",nome:"Disponibilidade",unit:"%",color:"#4ade80",norma:"ISO 14224"},
  {id:"conf",abbr:"R(t)",nome:"Confiabilidade 1000h",unit:"%",color:"#a78bfa",norma:"ISO 14224"},
  {id:"lambda",abbr:"Txa-F",nome:"Taxa de Falhas",unit:"f/h",color:"#f87171",norma:"EN 13306"},
  {id:"manuplan",abbr:"MP%",nome:"Manutencao Planejada",unit:"%",color:"#34d399",norma:"NBR 5462"},
  {id:"backlog",abbr:"BKL",nome:"Backlog de OS",unit:"OS",color:"#fb923c",norma:"SMRP"},
  {id:"nfalhas",abbr:"NF",nome:"Numero de Falhas",unit:"",color:"#f87171",norma:"ISO 14224"},
  {id:"compliance",abbr:"CP%",nome:"Compliance Preventivo",unit:"%",color:"#4ade80",norma:"SMRP"},
  {id:"mttf",abbr:"MTTF",nome:"Tempo Medio ate Falha",unit:"h",color:"#60a5fa",norma:"ISO 14224"},
  {id:"downtime",abbr:"DT",nome:"Horas Indisponivel",unit:"h",color:"#f87171",norma:"EN 13306"},
  {id:"oee_a",abbr:"OEE-A",nome:"Disponibilidade OEE",unit:"%",color:"#4ade80",norma:"ISO 22400"}
];

function calcInd(ativoNome,hist,ordens){
  var corr=hist.filter(function(h){return h.tipo=="Corretiva";});
  var plan=hist.filter(function(h){return h.tipo=="Preventiva"||h.tipo=="Preditiva";});
  var nC=corr.length,nT=hist.length;
  var hC=corr.reduce(function(s,h){return s+(h.horas||0);},0);
  var per=8760;
  if(hist.length>=2){var ds=hist.map(function(h){return new Date(h.data).getTime();}).sort(function(a,b){return a-b;});per=Math.max((ds[ds.length-1]-ds[0])/3600000,720);}
  var mtbf=nC>0?Math.round((per-hC)/nC):per;
  var mttr=nC>0?Math.round(hC/nC*10)/10:0;
  var disp=mttr>0?Math.round(mtbf/(mtbf+mttr)*1000)/10:99.5;
  var lam=mtbf>0?Math.round(1/mtbf*100000)/100000:0;
  var conf=mtbf>0?Math.round(Math.exp(-1000/mtbf)*1000)/10:99;
  var mp=nT>0?Math.round(plan.length/nT*100):0;
  var bkl=(ordens||[]).filter(function(o){return o.ativo==ativoNome&&(o.status=="Aberta"||o.status=="Em Andamento");}).length;
  return{mtbf:mtbf,mttr:mttr,disp:disp,conf:conf,lambda:lam,manuplan:mp,backlog:bkl,nfalhas:nC,compliance:100,mttf:mtbf,downtime:hC,oee_a:Math.max(0,Math.round((1-hC/per)*1000)/10)};
}

// ── CRITICIDADE ─────────────────────────────────────────────────────────────
var CRIT_DESCS={
  hse:["","Sem impacto em pessoas ou meio ambiente","Primeiros socorros, impacto ambiental minimo","Tratamento medico, vazamento contido","Lesao com afastamento, derramamento significativo","Fatalidade ou desastre ambiental"],
  prod:["","Sem impacto na producao","Reducao inferior a 5%","Reducao de 5 a 25%","Parada parcial: 25 a 50%","Parada total, mais de 50% de perda"],
  custo:["","Abaixo de R$ 1.000","De R$ 1.000 a R$ 5.000","De R$ 5.000 a R$ 20.000","De R$ 20.000 a R$ 100.000","Acima de R$ 100.000"],
  freq:["","Menos de 1 falha em 10 anos","1 falha a cada 5 a 10 anos","1 falha a cada 1 a 5 anos","Aproximadamente 1 falha por ano","Mais de 1 falha por ano"],
  det:["","Degradacao gradual facilmente visivel","Detectavel com monitoramento periodico","Detectavel com inspecao especifica","Sinais sutis, dificil interpretar","Falha subita sem aviso previo"],
  red:["","Equipamento redundante em operacao","Standby pronto para operar","Redundancia parcial ou bypass","Sem backup, sobressalentes disponiveis","Ativo unico, sem pecas em estoque"]
};
var CRIT_CLASS_NAMES={"A":"Critico","B":"Alto","C":"Medio","D":"Baixo"};
var CRIT_CLASS_COLORS={"A":"#f87171","B":"#fb923c","C":"#fbbf24","D":"#4ade80"};
var CRIT_RECS={
  "A":"Monitoramento continuo (preditiva). Plano de contingencia obrigatorio. FMEA e analise de causa raiz.",
  "B":"Preventiva sistematica. Monitoramento por condicao recomendado. Incluir no plano de inspecao.",
  "C":"Preventiva baseada em tempo ou ciclos. Avaliar custo-beneficio de preditiva.",
  "D":"Corretiva planejada aceitavel (run-to-failure). Garantir sobressalentes disponiveis."
};

function calcCritScore(s){
  var cons=(s.hse||1)*2.5+(s.prod||1)*2.0+(s.custo||1)*1.0;
  var prob=(s.freq||1)*2.0+(s.det||1)*1.5+(s.red||1)*1.0;
  var max=(5*2.5+5*2.0+5*1.0)*(5*2.0+5*1.5+5*1.0);
  return Math.round(cons*prob/max*100);
}
function getCritClass(score){if(score>=70)return"A";if(score>=45)return"B";if(score>=25)return"C";return"D";}

// ── USUARIOS ──────────────────────────────────────────────────────────────────

function loadUsuarios(){
  var d=localStorage.getItem("mx_usuarios");
  return d ? JSON.parse(d) : [];
}
function saveUsuarios(d){localStorage.setItem("mx_usuarios",JSON.stringify(d));}

// ── CATEGORIAS ────────────────────────────────────────────────────────────────
function loadCategorias(){
  var d=localStorage.getItem("mx_categorias");
  return d ? JSON.parse(d) : [];
}
function saveCategorias(d){localStorage.setItem("mx_categorias",JSON.stringify(d));}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function authLogin(email,senha){
  var users=loadUsuarios();
  var u=users.find(function(x){return x.email===email&&x.senha===senha&&x.ativo;});
  if(!u)return null;
  var s={id:u.id,nome:u.nome,email:u.email,perfil:u.perfil};
  localStorage.setItem("mx_session",JSON.stringify(s));
  return s;
}
function authLogout(){
  localStorage.removeItem("mx_session");
  window.location.href="login.html";
}
function authSession(){
  var s=localStorage.getItem("mx_session");
  return s?JSON.parse(s):null;
}
function authRequired(){
  var s=authSession();
  if(!s){window.location.href="login.html";return null;}
  return s;
}
function authCoordenador(){
  var s=authRequired();
  if(s&&s.perfil!=="Coordenador"){window.location.href="executor.html";return null;}
  return s;
}
function authTecnico(){
  var s=authRequired();
  if(s&&s.perfil!=="Tecnico"){window.location.href="dashboard.html";return null;}
  return s;
}
function meuNome(){var s=authSession();return s?s.nome:"";}
function meuPrimeiro(){return meuNome().split(" ")[0]||"";}
function meuPerfil(){var s=authSession();return s?s.perfil:"";}

// ── PLANOS — ESTRUTURA DE AÇÕES ───────────────────────────────────────────────
// Cada plano agora pode ter:
//   tipo: "Preventiva" | "Preditiva" | "Ambos"
//   acoes: [{id, desc, tipo:"acao"|"medicao", param, unidade, limite_min, limite_max, obrigatorio}]
//   tecnico: responsável padrão
//   os_gerada_id: id da OS em aberto gerada por este plano (null se nenhuma)

// ── FREQUÊNCIA → DIAS ─────────────────────────────────────────────────────────
var FREQ_DIAS = {
  "Semanal":7,"Quinzenal":15,"Mensal":30,
  "Bimestral":60,"Trimestral":90,"Semestral":180,"Anual":365
};

// ── CALCULA PRÓXIMA EXECUÇÃO ──────────────────────────────────────────────────
function calcProxima(ultima, frequencia){
  var dias = FREQ_DIAS[frequencia] || 30;
  var d = ultima ? new Date(ultima) : new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0,10);
}

// ── STATUS DO PLANO ───────────────────────────────────────────────────────────
function calcPlanStatus(proxima){
  if(!proxima) return "OK";
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var prox  = new Date(proxima); prox.setHours(0,0,0,0);
  var diff  = Math.round((prox - hoje) / 86400000);
  if(diff < 0)  return "Atrasado";
  if(diff === 0) return "Vence Hoje";
  if(diff <= 7) return "Vence em Breve";
  return "OK";
}

// ── GERA OS A PARTIR DE PLANOS VENCIDOS/PRÓXIMOS ─────────────────────────────
// Agrupa por ativo — uma OS por ativo com todos os planos vencidos
// toleranceDias: quantos dias antes do vencimento já gera a OS (padrão 7)
function gerarOSProgramadas(toleranceDias){
  var tol = toleranceDias !== undefined ? toleranceDias : 7;
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var D = loadData();
  var ordens = D.ordens;
  var ativos = D.ativos;
  var fichas = D.fichas;
  var novas = [];

  ativos.forEach(function(ativo){
    var ficha = fichas[ativo.id];
    if(!ficha || !ficha.planos || ficha.planos.length === 0) return;

    // Filtra planos vencidos ou que vencem em breve e sem OS aberta
    var planosDevidos = ficha.planos.filter(function(p){
      // Ja tem OS aberta gerada por este plano?
      if(p.os_gerada_id){
        var osExiste = ordens.find(function(o){
          return o.id == p.os_gerada_id &&
                 o.status !== "Concluida" && o.status !== "Cancelada";
        });
        if(osExiste) return false; // ja tem OS em aberto, pula
      }
      if(!p.proxima_execucao) return false;
      var prox = new Date(p.proxima_execucao); prox.setHours(0,0,0,0);
      var diff = Math.round((prox - hoje) / 86400000);
      return diff <= tol; // vencido ou vence em até X dias
    });

    if(planosDevidos.length === 0) return;

    // Determina tipo da OS
    var tipos = planosDevidos.map(function(p){ return p.tipo || "Preventiva"; });
    var temPrev = tipos.indexOf("Preventiva") >= 0 || tipos.indexOf("Ambos") >= 0;
    var temPred = tipos.indexOf("Preditiva") >= 0  || tipos.indexOf("Ambos") >= 0;
    var tipoOS  = (temPrev && temPred) ? "Mista" : temPred ? "Preditiva" : "Preventiva";

    // Cria OS
    var osId = nextId();
    var nomesTipos = planosDevidos.map(function(p){ return p.nome; }).join(", ");
    var novaOS = {
      id:        osId,
      titulo:    ativo.nome + " — " + tipoOS + " (" + planosDevidos.length + " plano(s))",
      ativo:     ativo.nome,
      ativo_id:  ativo.id,
      tipo:      tipoOS,
      prioridade:"Normal",
      status:    "Aberta",
      tecnico:   planosDevidos[0].responsavel || "",
      abertura:  hoje.toISOString().slice(0,10),
      prazo:     planosDevidos[0].proxima_execucao || "",
      descricao: "OS gerada automaticamente dos planos: " + nomesTipos,
      origem:    "plano",
      planos_ids: planosDevidos.map(function(p){ return p.id; }),
      // Snapshot das ações de cada plano para execução
      planos_exec: planosDevidos.map(function(p){
        return {
          plano_id:   p.id,
          plano_nome: p.nome,
          tipo:       p.tipo || "Preventiva",
          acoes:      (p.acoes || []).map(function(a){
            return Object.assign({}, a, {concluida: false, valor_exec: null, obs_exec: ""});
          })
        };
      }),
      execLog: []
    };

    novas.push(novaOS);

    // Marca planos com o id da OS gerada
    ficha.planos = ficha.planos.map(function(p){
      if(planosDevidos.find(function(pd){ return pd.id === p.id; })){
        return Object.assign({}, p, {os_gerada_id: osId});
      }
      return p;
    });
  });

  if(novas.length > 0){
    ordens = novas.concat(ordens);
    saveOrdens(ordens);
    saveFichas(fichas);
  }
  return novas;
}

// ── CONCLUI OS PROGRAMADA — atualiza planos e histórico ──────────────────────
function concluirOSProgramada(os, fichas){
  if(!os || os.origem !== "plano") return fichas;
  var hoje = new Date().toISOString().slice(0,10);
  var ativoId = os.ativo_id;
  var ficha = fichas[ativoId];
  if(!ficha) return fichas;

  // Atualiza cada plano envolvido
  if(os.planos_exec){
    os.planos_exec.forEach(function(pe){
      ficha.planos = ficha.planos.map(function(p){
        if(p.id !== pe.plano_id) return p;
        // Calcula proxima execucao
        var prox = calcProxima(hoje, p.frequencia);
        // Adiciona ao histórico preditivo se houver medições
        pe.acoes.forEach(function(a){
          if(a.tipo === "medicao" && a.valor_exec !== null && a.valor_exec !== ""){
            if(!ficha.preditiva) ficha.preditiva = [];
            ficha.preditiva.push({
              id:     nextId(),
              data:   hoje,
              param:  a.param || a.desc,
              valor:  parseFloat(a.valor_exec),
              limite: parseFloat(a.limite_max) || 0,
              obs:    a.obs_exec || ""
            });
          }
        });
        return Object.assign({}, p, {
          ultima_execucao: hoje,
          proxima_execucao: prox,
          status: calcPlanStatus(prox),
          os_gerada_id: null
        });
      });

      // Adiciona ao histórico de manutenção
      var horas = os.execLog ? os.execLog.reduce(function(s,e){
        return s + (e.horas || 0);
      }, 0) : 0;
      ficha.historico = ficha.historico || [];
      ficha.historico.unshift({
        id:      nextId(),
        desc:    pe.plano_nome,
        data:    hoje,
        tipo:    pe.tipo === "Preditiva" ? "Preditiva" : "Preventiva",
        tecnico: os.tecnico || "",
        horas:   horas,
        custo:   0,
        obs:     "OS #" + os.id + " — " + pe.acoes.filter(function(a){ return a.concluida; }).length + "/" + pe.acoes.length + " acoes concluidas"
      });
    });
  }

  fichas[ativoId] = ficha;
  return fichas;
}

// ── VERIFICA PLANOS PENDENTES (para badge no dashboard) ───────────────────────
function contarPlanosPendentes(fichas){
  var total = 0;
  Object.keys(fichas).forEach(function(id){
    var f = fichas[id];
    if(!f || !f.planos) return;
    f.planos.forEach(function(p){
      if(calcPlanStatus(p.proxima_execucao) !== "OK") total++;
    });
  });
  return total;
}
