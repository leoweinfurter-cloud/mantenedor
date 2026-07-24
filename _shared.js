// ═══════════════════════════════════════════════════════════════════════
//  MaintenX _shared.js — Supabase Auth + Multi-Tenant
// ═══════════════════════════════════════════════════════════════════════

var SB_URL  = "https://mtmcrpigiwsxfwxkqdkz.supabase.co";
var SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10bWNycGlnaXdzeGZ3eGtxZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTYxNTYsImV4cCI6MjA5NTkzMjE1Nn0.U3_-Fh35p-l3ZYSApbmn-7KRLlF1voZWS5Pbm0_LQ7A";
var REST    = SB_URL + "/rest/v1";

// ── SESSION ───────────────────────────────────────────────────────────
function getSession(){
  var s=localStorage.getItem("mx_session");
  return s?JSON.parse(s):null;
}
function getToken(){
  var s=getSession();
  return s?s.access_token:"";
}
function getTenantId(){
  var s=getSession();
  return s?s.tenant_id:"";
}
function getPlano(){
  var s=getSession();
  return s?s.plano:"free";
}
function authRequired(){
  var s=getSession();
  if(!s||!s.access_token){window.location.href="login.html";return null;}
  if(!s.tenant_id){
    // Sessão "quebrada": autenticado mas sem empresa associada (user_tenants ausente/corrompido).
    // Continuar assim faz toda gravação falhar em silêncio (RLS 42501). Força novo login.
    console.error("[Auth] sessão sem tenant_id — forçando novo login");
    localStorage.clear();
    window.location.href="login.html?erro=sem_tenant";
    return null;
  }
  return s;
}
function authLogout(){
  localStorage.clear();
  window.location.href="login.html";
}
function meuNome(){var s=getSession();return s?s.nome:"";}
function meuPrimeiro(){return meuNome().split(" ")[0]||"";}
function meuPerfil(){var s=getSession();return s?s.perfil:"";}
function isCoordenador(){return meuPerfil()==="Coordenador";}

// ── TOAST ─────────────────────────────────────────────────────────────
function mxToast(msg,type){
  type=type||"error";
  var host=document.getElementById("mx-toast-host");
  if(!host){
    host=document.createElement("div");
    host.id="mx-toast-host";
    host.style.cssText="position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;";
    document.body.appendChild(host);
  }
  var colors={error:"#f87171",success:"#4ade80",warn:"#fbbf24",info:"#60a5fa"};
  var el=document.createElement("div");
  el.style.cssText="background:#1f2937;color:#fff;border-left:4px solid "+(colors[type]||colors.error)+";padding:12px 14px;border-radius:8px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.35);opacity:0;transform:translateY(-8px);transition:all .25s ease;";
  el.textContent=msg;
  host.appendChild(el);
  requestAnimationFrame(function(){el.style.opacity="1";el.style.transform="translateY(0)";});
  setTimeout(function(){
    el.style.opacity="0";el.style.transform="translateY(-8px)";
    setTimeout(function(){el.remove();},250);
  },6000);
}

// ── TOKEN REFRESH ─────────────────────────────────────────────────────
function isTokenExpiringSoon(token){
  try{
    var b64=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    var payload=JSON.parse(atob(b64));
    return (payload.exp*1000 - Date.now()) < 60000; // <60s de vida restante
  }catch(e){return true;}
}
function refreshSession(){
  var sess=getSession();
  if(!sess||!sess.refresh_token) return Promise.reject(new Error("Sessão sem refresh_token."));
  return fetch(SB_URL+"/auth/v1/token?grant_type=refresh_token",{
    method:"POST",
    headers:{"apikey":SB_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({refresh_token:sess.refresh_token})
  }).then(function(r){
    if(!r.ok) throw new Error("Renovação de sessão falhou ("+r.status+").");
    return r.json();
  }).then(function(d){
    sess.access_token=d.access_token;
    sess.refresh_token=d.refresh_token||sess.refresh_token;
    localStorage.setItem("mx_session",JSON.stringify(sess));
    return sess;
  });
}
function ensureFreshToken(){
  var sess=getSession();
  if(!sess||!sess.access_token) return Promise.resolve(null);
  if(!isTokenExpiringSoon(sess.access_token)) return Promise.resolve(sess);
  return refreshSession().catch(function(e){
    console.warn("[Auth] Falha ao renovar token, redirecionando para login.",e);
    authLogout();
    return null;
  });
}

// ── SUPABASE HELPERS ──────────────────────────────────────────────────
function sbHeaders(extra){
  var h={"apikey":SB_KEY,"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"};
  if(extra)Object.assign(h,extra);
  return h;
}
// Wrapper central: garante token válido antes de cada chamada e faz 1 retry em 401
function sbFetch(path,opts){
  opts=opts||{};
  var extraHeaders=opts.headers;
  return ensureFreshToken().then(function(){
    return fetch(REST+"/"+path,Object.assign({},opts,{headers:sbHeaders(extraHeaders)}));
  }).then(function(r){
    if(r.status===401){
      return refreshSession().then(function(){
        return fetch(REST+"/"+path,Object.assign({},opts,{headers:sbHeaders(extraHeaders)}));
      }).catch(function(){return r;});
    }
    return r;
  });
}
function sbGet(table,qs){
  return sbFetch(table+"?"+(qs||"select=*")).then(function(r){
    if(!r.ok){
      return r.json().catch(function(){return{message:r.statusText};}).then(function(err){
        console.error("[SB] GET "+table+" falhou ("+r.status+")",err);
        return [];
      });
    }
    return r.json();
  }).catch(function(e){console.warn("[SB] GET "+table,e);return [];});
}
function sbUpsert(table,data){
  if(!data||(Array.isArray(data)&&!data.length))return Promise.resolve();
  var rows=Array.isArray(data)?data:[data];
  // Auto-inject tenant_id
  var tid=getTenantId();
  if(!tid){
    console.error("[SB] upsert "+table+" abortado: sem tenant_id na sessão");
    mxToast("Não foi possível salvar: sessão sem empresa associada. Faça login novamente.","error");
    return Promise.reject(new Error("tenant_id ausente na sessão"));
  }
  rows=rows.map(function(r){return Object.assign({},r,{tenant_id:tid});});
  return sbFetch(table,{
    method:"POST",
    headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(rows)
  }).then(function(r){
    if(!r.ok){
      return r.json().catch(function(){return{message:r.statusText};}).then(function(err){
        var msg=(err&&err.message)||("Erro "+r.status);
        console.error("[SB] upsert "+table+" falhou ("+r.status+")",err);
        mxToast("Erro ao salvar em \""+table+"\": "+msg,"error");
        throw new Error(msg);
      });
    }
    return r;
  }).catch(function(e){
    console.warn("[SB] upsert "+table,e);
    if(!/tenant_id ausente/.test(e.message||"")) mxToast("Falha de conexão ao salvar \""+table+"\".","error");
    throw e;
  });
}
function sbDelete(table,field,value){
  return sbFetch(table+"?"+field+"=eq."+value,{method:"DELETE"}).then(function(r){
    if(!r.ok){
      return r.json().catch(function(){return{message:r.statusText};}).then(function(err){
        var msg=(err&&err.message)||("Erro "+r.status);
        console.error("[SB] delete "+table+" falhou ("+r.status+")",err);
        mxToast("Erro ao excluir em \""+table+"\": "+msg,"error");
        throw new Error(msg);
      });
    }
    return r;
  }).catch(function(e){console.warn("[SB] delete "+table,e);throw e;});
}

// ── NEXT ID ───────────────────────────────────────────────────────────
function nextId(){
  var n=parseInt(localStorage.getItem("mx_nextid")||"700");
  var id=n+1;
  localStorage.setItem("mx_nextid",id);
  return id;
}
function syncNextId(lists){
  // Garante que nextId seja maior que todos os IDs existentes
  var maxId=parseInt(localStorage.getItem("mx_nextid")||"700");
  lists.forEach(function(arr){
    (arr||[]).forEach(function(item){
      if(item&&item.id&&parseInt(item.id)>maxId) maxId=parseInt(item.id);
    });
  });
  localStorage.setItem("mx_nextid",maxId+1);
}

// ── NUMERACAO DE O.S. (rastreio) ─────────────────────────────────────
// Formato: ANO-TIPO-SEQUENCIAL, ex: 2026-COR-0001, 2026-PRV-0002, 2026-PRD-0003
// Campo adicional "numero_os" — nao substitui o id interno (usado em relacoes/localStorage/Supabase).
// A sequencia e recalculada a partir dos numero_os ja existentes no array de ordens do tenant,
// evitando depender de um contador isolado no localStorage (mesma limitacao de nextId(): risco de
// colisao com escrita concorrente entre usuarios do mesmo tenant — ver observacao no README/memoria).
var OS_TIPO_PREFIXO={"Corretiva":"COR","Preventiva":"PRV","Preditiva":"PRD","Mista":"MST"};
function isOSProgramada(o){
  if(!o)return false;
  if(o.origem==="plano")return true;
  return o.tipo==="Preventiva"||o.tipo==="Preditiva"||o.tipo==="Mista";
}
function isOSCorretiva(o){return !isOSProgramada(o);}
function ordensDetailUrl(o){
  return (isOSProgramada(o)?"ordens-programada.html":"ordens-corretiva.html")+"?id="+o.id;
}
function nextNumeroOS(tipo,ordensArr){
  var ano=new Date().getFullYear();
  var prefixo=OS_TIPO_PREFIXO[tipo]||"OS";
  var base=ano+"-"+prefixo+"-";
  var max=0;
  (ordensArr||[]).forEach(function(o){
    if(o&&o.numero_os&&o.numero_os.indexOf(base)===0){
      var n=parseInt(o.numero_os.slice(base.length),10);
      if(!isNaN(n)&&n>max)max=n;
    }
  });
  return base+String(max+1).padStart(4,"0");
}
// Preenche numero_os em OS antigas que ainda nao tem (migracao silenciosa, roda uma vez por carga)
function backfillNumerosOS(ordensArr){
  var mudou=false;
  (ordensArr||[]).forEach(function(o){
    if(!o.numero_os){
      o.numero_os=nextNumeroOS(o.tipo||"Corretiva",ordensArr);
      mudou=true;
    }
  });
  return mudou;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────
var PC={"Critica":"#f87171","Alta":"#fb923c","Normal":"#60a5fa","Baixa":"#9ca3af"};
var SC={"Aberta":"#fbbf24","Em Andamento":"#60a5fa","Concluida":"#4ade80","Cancelada":"#6b7280"};
var AC={"Operacional":"#4ade80","Em Manutencao":"#fbbf24","Parado":"#f87171"};
var TC={"Corretiva":"#f87171","Preventiva":"#4ade80","Preditiva":"#8b5cf6","Mista":"#60a5fa","Inspecao":"#60a5fa"};
var LP={"OK":"#4ade80","Atrasado":"#f87171","Vence Hoje":"#fbbf24","Vence em Breve":"#f59e0b"};
var ANAL_LABELS={"5porques":"5 Porques","ishikawa":"Ishikawa (6M)","fmea":"FMEA","rca":"RCA","fta":"Arvore de Falhas","pdca":"PDCA"};
var FREQ_DIAS={"Semanal":7,"Quinzenal":15,"Mensal":30,"Bimestral":60,"Trimestral":90,"Semestral":180,"Anual":365};
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
var CRIT_DESCS={
  hse: ["","Sem impacto","Primeiros socorros","Tratamento medico","Lesao com afastamento","Fatalidade"],
  prod:["","Sem impacto","Reducao <5%","Reducao 5-25%","Parada parcial 25-50%","Parada total"],
  custo:["","<R$1.000","R$1K-5K","R$5K-20K","R$20K-100K",">R$100K"],
  freq:["","<1 falha/10 anos","1 falha/5-10 anos","1 falha/1-5 anos","~1 falha/ano",">1 falha/ano"],
  det:["","Visivel facilmente","Detectavel c/ monit.","Inspecao especifica","Sinais sutis","Falha subita"],
  red:["","Redundante em op.","Standby pronto","Redundancia parcial","Sem backup","Ativo unico"]
};
var CRIT_CLASS_COLORS={"A":"#f87171","B":"#fb923c","C":"#fbbf24","D":"#4ade80"};
var CRIT_RECS={
  "A":"Monitoramento continuo. Plano de contingencia obrigatorio. FMEA e analise de causa raiz.",
  "B":"Preventiva sistematica. Monitoramento por condicao recomendado.",
  "C":"Preventiva baseada em tempo. Avaliar custo-beneficio de preditiva.",
  "D":"Corretiva planejada aceitavel. Garantir sobressalentes."
};

// ── UTILS ─────────────────────────────────────────────────────────────
function bdg(t,m){var c=m[t]||"#9ca3af";return'<span class="badge" style="background:'+c+'18;color:'+c+';border:1px solid '+c+'35">'+t+'</span>';}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function gv(id){var e=document.getElementById(id);return e?e.value:"";}

// ── GLOBALS ───────────────────────────────────────────────────────────
var ordens=[], ativos=[], fichas={};

// ── LOAD / SAVE ───────────────────────────────────────────────────────
function loadData(){
  var o=localStorage.getItem("mx_ordens");
  var a=localStorage.getItem("mx_ativos");
  var f=localStorage.getItem("mx_fichas");
  return{ordens:o?JSON.parse(o):[],ativos:a?JSON.parse(a):[],fichas:f?JSON.parse(f):{}};
}
function loadUsuarios(){var d=localStorage.getItem("mx_usuarios");return d?JSON.parse(d):[];}
function loadCategorias(){var d=localStorage.getItem("mx_categorias");return d?JSON.parse(d):[];}
function loadEmpresas(){var d=localStorage.getItem("mx_empresas");return d?JSON.parse(d):[];}

// Popula um <select> de tecnico com os usuarios REALMENTE cadastrados (tela
// Cadastros > Usuarios), em vez da lista fixa de nomes de teste (Joao Silva,
// Maria Santos, Carlos Pereira, Ana Lima, Pedro Oliveira) que ficava
// hardcoded direto no HTML dos modais de criacao/execucao de OS e nunca
// refletia quem o usuario realmente cadastrou.
function populaSelectTecnicos(selectId,selecionado){
  var sel=document.getElementById(selectId);
  if(!sel)return;
  var usuarios=loadUsuarios().filter(function(u){return u.ativo!==false;});
  sel.innerHTML='<option value="">Selecione...</option>'
    +usuarios.map(function(u){return'<option value="'+esc(u.nome)+'"'+(u.nome===selecionado?' selected':'')+'>'+esc(u.nome)+'</option>';}).join("");
}

// Mesma lista, mas so as tags <option> (sem o <select> nem o "Selecione..."
// inicial) — usada em templates HTML montados como string, como o
// formulario de execucao das OS, onde o <select> ja vem com o placeholder
// escrito diretamente na string.
function optsUsuariosTecnicos(selecionado){
  var usuarios=loadUsuarios().filter(function(u){return u.ativo!==false;});
  return usuarios.map(function(u){return'<option value="'+esc(u.nome)+'"'+(u.nome===selecionado?' selected':'')+'>'+esc(u.nome)+'</option>';}).join("");
}

function saveOrdens(arr){
  localStorage.setItem("mx_ordens",JSON.stringify(arr));
  sbUpsert("ordens",arr.map(function(o){return{id:o.id,numero_os:o.numero_os||"",titulo:o.titulo||"",ativo_nome:o.ativo||"",ativo_id:o.ativo_id||null,tipo:o.tipo||"Corretiva",prioridade:o.prioridade||"Normal",status:o.status||"Aberta",tecnico:o.tecnico||"",abertura:o.abertura||"",prazo:o.prazo||"",descricao:o.descricao||"",origem:o.origem||"manual",planos_ids:o.planos_ids||[],planos_exec:o.planos_exec||[],exec_log:o.execLog||[]};}));
}
function saveAtivos(arr){
  localStorage.setItem("mx_ativos",JSON.stringify(arr));
  sbUpsert("ativos",arr.map(function(a){return{id:a.id,nome:a.nome,categoria:a.categoria||"",empresa:a.empresa||"",unidade:a.unidade||"",localizacao:a.localizacao||"",fabricante:a.fabricante||"",modelo:a.modelo||"",serie:a.serie||"",ano:a.ano||"",tag:a.tag||"",patrimonio:a.patrimonio||"",status:a.status||"Operacional",motivo_desativacao:a.motivo_desativacao||"",desativado_em:a.desativado_em||""};}));
}
function saveFichas(fichasObj){
  localStorage.setItem("mx_fichas",JSON.stringify(fichasObj));
  Object.keys(fichasObj).forEach(function(aid){
    var ativoId=parseInt(aid),f=fichasObj[aid];
    if(!f)return;
    // O upsert abaixo usa "resolution=merge-duplicates" (INSERT ... ON CONFLICT DO UPDATE).
    // A coluna "nome" é NOT NULL no banco e o Postgres valida essa constraint na
    // construcao da linha candidata ANTES de checar o conflito — ou seja, mesmo
    // atualizando um ativo ja existente, omitir "nome" do payload faz o upsert
    // inteiro falhar com 23502 (violates not-null constraint). Como a "ficha"
    // nao guarda o nome do ativo, buscamos no array global `ativos`.
    var ativoRef=ativos.find(function(a){return a.id===ativoId;});
    if(!ativoRef){
      console.warn("[saveFichas] ativo id="+ativoId+" não encontrado no array 'ativos' em memória — upsert de ativos ignorado para não enviar 'nome' nulo (indicadores/crit/docs deste ativo não serão sincronizados nesta chamada).");
    } else {
      sbUpsert("ativos",[{id:ativoId,nome:ativoRef.nome,indicadores:f.indicadores||["mtbf","mttr","disp","manuplan"],crit:f.crit||{},docs:f.docs||[]}]);
    }
    sbDelete("planos","ativo_id",ativoId).then(function(){if(f.planos&&f.planos.length)sbUpsert("planos",f.planos.map(function(p){return{id:p.id,ativo_id:ativoId,nome:p.nome,tipo:p.tipo||"Preventiva",frequencia:p.frequencia||"Mensal",ultima_execucao:p.ultima_execucao||"--",proxima_execucao:p.proxima_execucao||"--",responsavel:p.responsavel||"",status:p.status||"OK",os_gerada_id:p.os_gerada_id||null,acoes:p.acoes||[],ativo:p.ativo!==false,motivo_desativacao:p.motivo_desativacao||"",desativado_em:p.desativado_em||""};}));});
    sbDelete("historico","ativo_id",ativoId).then(function(){if(f.historico&&f.historico.length)sbUpsert("historico",f.historico.map(function(h){return{id:h.id,ativo_id:ativoId,descricao:h.desc||"",data:h.data||"",tipo:h.tipo||"Corretiva",tecnico:h.tecnico||"",horas:h.horas||0,custo:h.custo||0,obs:h.obs||"",analise:h.analise||null,os_id:h.os_id||null};}));});
    sbDelete("medicoes","ativo_id",ativoId).then(function(){if(f.preditiva&&f.preditiva.length)sbUpsert("medicoes",f.preditiva.map(function(m){return{id:m.id,ativo_id:ativoId,data:m.data||"",param:m.param||"",valor:m.valor||0,limite:m.limite||0,obs:m.obs||""};}));});
  });
}
function saveUsuarios(d){localStorage.setItem("mx_usuarios",JSON.stringify(d));sbUpsert("usuarios",d.map(function(u){return{id:u.id,nome:u.nome,email:u.email||"",telefone:u.telefone||"",perfil:u.perfil||"Tecnico",ativo:u.ativo!==false};}));}
function saveCategorias(d){localStorage.setItem("mx_categorias",JSON.stringify(d));sbUpsert("categorias",d.map(function(c){return{id:c.id,nome:c.nome,descricao:c.descricao||"",icone:c.icone||"⚙",cor:c.cor||"#60a5fa"};}));}
function saveEmpresas(d){
  localStorage.setItem("mx_empresas",JSON.stringify(d));
  var er=[],ur=[];
  d.forEach(function(e){er.push({id:e.id,nome:e.nome,cnpj:e.cnpj||"",endereco:e.endereco||"",contato:e.contato||""});(e.unidades||[]).forEach(function(u){ur.push({id:u.id,empresa_id:e.id,nome:u.nome,endereco:u.endereco||"",responsavel:u.responsavel||""});});});
  if(er.length)sbUpsert("empresas",er);
  if(ur.length)sbUpsert("unidades",ur);
}

// ── PLAN UTILS ────────────────────────────────────────────────────────
function calcProxima(ultima,freq){var d=FREQ_DIAS[freq]||30,dt=ultima?new Date(ultima):new Date();dt.setDate(dt.getDate()+d);return dt.toISOString().slice(0,10);}
function calcPlanStatus(p){
  if(!p||p==="--")return"OK";
  var hoje=new Date();hoje.setHours(0,0,0,0);
  var prox=new Date(p);prox.setHours(0,0,0,0);
  var d=Math.round((prox-hoje)/86400000);
  if(d<0)return"Atrasado";if(d===0)return"Vence Hoje";if(d<=7)return"Vence em Breve";return"OK";
}
function inferPlTipo(acoes){var a=acoes.some(function(x){return x.tipo==="acao";});var m=acoes.some(function(x){return x.tipo==="medicao";});if(a&&m)return"Ambos";if(m)return"Preditiva";return"Preventiva";}

// ── GERAR OS PROGRAMADAS ──────────────────────────────────────────────
function gerarOSProgramadas(tol){
  tol=tol!==undefined?tol:7;
  var hoje=new Date();hoje.setHours(0,0,0,0);
  var novas=[];
  ativos.forEach(function(ativo){
    var f=fichas[ativo.id];
    if(!f||!f.planos||!f.planos.length)return;
    var dev=f.planos.filter(function(p){
      if(p.ativo===false) return false;
      if(p.os_gerada_id){var ex=ordens.find(function(o){return o.id==p.os_gerada_id&&o.status!=="Concluida"&&o.status!=="Cancelada";});if(ex)return false;}
      if(!p.proxima_execucao||p.proxima_execucao==="--")return false;
      var prox=new Date(p.proxima_execucao);prox.setHours(0,0,0,0);
      return Math.round((prox-hoje)/86400000)<=tol;
    });
    if(!dev.length)return;
    var tipos=dev.map(function(p){return p.tipo||"Preventiva";});
    var tp=tipos.indexOf("Preventiva")>=0||tipos.indexOf("Ambos")>=0;
    var td=tipos.indexOf("Preditiva")>=0||tipos.indexOf("Ambos")>=0;
    var tipoOS=tp&&td?"Mista":td?"Preditiva":"Preventiva";
    var osId=nextId();
    var numeroOS=nextNumeroOS(tipoOS,ordens.concat(novas));
    novas.push({id:osId,numero_os:numeroOS,titulo:ativo.nome+" — "+tipoOS+" ("+dev.length+" plano(s))",ativo:ativo.nome,ativo_id:ativo.id,tipo:tipoOS,prioridade:"Normal",status:"Aberta",tecnico:dev[0].responsavel||"",abertura:hoje.toISOString().slice(0,10),prazo:dev[0].proxima_execucao||"",descricao:"OS dos planos: "+dev.map(function(p){return p.nome;}).join(", "),origem:"plano",planos_ids:dev.map(function(p){return p.id;}),planos_exec:dev.map(function(p){return{plano_id:p.id,plano_nome:p.nome,tipo:p.tipo||"Preventiva",acoes:(p.acoes||[]).map(function(a){return Object.assign({},a,{concluida:false,valor_exec:null,obs_exec:""});})};})  ,execLog:[]});
    f.planos=f.planos.map(function(p){return dev.find(function(d){return d.id===p.id;})?Object.assign({},p,{os_gerada_id:osId}):p;});
  });
  if(novas.length){ordens=novas.concat(ordens);saveOrdens(ordens);saveFichas(fichas);}
  return novas;
}

// ── CONCLUI OS DE PLANO ───────────────────────────────────────────────
// Ao concluir uma OS de plano (preventiva/preditiva), registra o historico
// e as medicoes. Se alguma medicao vier fora do padrao (limite_min/limite_max
// definidos na acao do plano), abre AUTOMATICAMENTE uma OS Corretiva
// vinculada ao ativo, com prioridade Alta e descricao listando os desvios.
function concluirOSProgramada(os,fichasObj){
  if(!os||os.origem!=="plano")return fichasObj;
  var hoje=new Date().toISOString().slice(0,10);
  var f=fichasObj[os.ativo_id];
  if(!f)return fichasObj;
  var desvios=[]; // medicoes fora do padrao detectadas nesta conclusao
  if(os.planos_exec){
    os.planos_exec.forEach(function(pe){
      f.planos=f.planos.map(function(p){
        if(p.id!==pe.plano_id)return p;
        var prox=calcProxima(hoje,p.frequencia);
        pe.acoes.forEach(function(a){
          if(a.tipo==="medicao"&&a.valor_exec!=null&&a.valor_exec!==""){
            var valor=parseFloat(a.valor_exec);
            if(!f.preditiva)f.preditiva=[];
            f.preditiva.push({id:nextId(),data:hoje,param:a.param||a.desc,valor:valor,limite:parseFloat(a.limite_max)||0,obs:a.obs_exec||""});
            // 0 (ou vazio) em limite_min/limite_max significa "sem limite definido"
            // — mesma convencao ja usada no restante do arquivo (ver linha de cima).
            var max=parseFloat(a.limite_max)||0, min=parseFloat(a.limite_min)||0;
            var foraMax = max>0 && valor>max;
            var foraMin = min>0 && valor<min;
            if((foraMax||foraMin) && !isNaN(valor)){
              desvios.push({plano_nome:pe.plano_nome,param:a.param||a.desc,unidade:a.unidade||"",valor:valor,limite_max:max,limite_min:min,tipo:foraMax?"acima":"abaixo"});
            }
          }
        });
        return Object.assign({},p,{ultima_execucao:hoje,proxima_execucao:prox,status:calcPlanStatus(prox),os_gerada_id:null});
      });
      var horas=(os.execLog||[]).reduce(function(s,e){return s+(e.horas||0);},0);
      var custo=(os.execLog||[]).reduce(function(s,e){return s+(e.tipo==="peca"&&e.custo?e.qty*e.custo:0);},0);
      f.historico=f.historico||[];
      f.historico.unshift({id:nextId(),desc:pe.plano_nome,data:hoje,tipo:pe.tipo==="Preditiva"?"Preditiva":"Preventiva",tecnico:os.tecnico||"",horas:horas,custo:custo,obs:"OS "+(os.numero_os||"#"+os.id)+" — "+pe.acoes.filter(function(a){return a.concluida;}).length+"/"+pe.acoes.length+" acoes",os_id:os.id});
    });
  }
  fichasObj[os.ativo_id]=f;

  if(desvios.length){
    var novaCorretiva=abrirCorretivaPorDesvio(os,desvios);
    if(novaCorretiva && typeof mxToast==="function"){
      mxToast(desvios.length+" medição(ões) fora do padrão — OS Corretiva "+novaCorretiva.numero_os+" aberta automaticamente.","warn");
    }
  }

  return fichasObj;
}

// Cria e persiste uma OS Corretiva a partir de desvios detectados numa
// medicao preditiva. Extraida como funcao separada para poder ser testada
// isoladamente e reaproveitada (ex: futura integracao com sensores/IoT).
function abrirCorretivaPorDesvio(osOrigem,desvios){
  if(!desvios||!desvios.length)return null;
  var hoje=new Date().toISOString().slice(0,10);
  var ativoObj=ativos.find(function(a){return a.id===osOrigem.ativo_id;});
  var numeroOS=nextNumeroOS("Corretiva",ordens);
  var descDesvios=desvios.map(function(d){
    var limite=d.tipo==="acima"?d.limite_max:d.limite_min;
    return d.param+": "+d.valor+(d.unidade?" "+d.unidade:"")+" ("+d.tipo+" do limite de "+limite+(d.unidade?" "+d.unidade:"")+")";
  }).join("; ");
  var novaCorretiva={
    id:nextId(),numero_os:numeroOS,
    titulo:(ativoObj?ativoObj.nome:"Ativo")+" — Desvio em medição preditiva",
    ativo:ativoObj?ativoObj.nome:"",ativo_id:osOrigem.ativo_id,
    tipo:"Corretiva",prioridade:"Alta",status:"Aberta",
    tecnico:osOrigem.tecnico||"",
    abertura:hoje,prazo:"",
    descricao:"OS aberta automaticamente: parâmetro(s) fora do padrão detectado(s) na OS "+osOrigem.numero_os+". "+descDesvios,
    origem:"auto_preditiva",origem_os_id:osOrigem.id,execLog:[]
  };
  ordens=[novaCorretiva].concat(ordens);
  saveOrdens(ordens);
  return novaCorretiva;
}



// ── REGISTRA HISTORICO AO CONCLUIR OS SEM PLANO VINCULADO ───────────────
// Usada para OS Corretiva e para OS Preventiva/Preditiva CRIADA MANUALMENTE
// (sem vinculo a um plano — nesse caso quem atualiza os planos e o historico
// e concluirOSProgramada(), que trata planos_exec). Aqui nao ha planos_exec:
// o unico registro disponivel e o proprio execLog da OS (observacoes,
// medicoes, pecas, fotos registradas na tela de execucao).
// Retorna null se a OS nao tiver ativo_id (dado incompleto — nao ha em qual
// ficha gravar) para o chamador decidir como avisar o usuario.
function registrarHistoricoOS(os,fichasObj){
  if(!os)return null;
  if(!os.ativo_id)return null; // sem vinculo com nenhum ativo especifico — nao ha onde gravar
  var f=fichasObj[os.ativo_id];
  if(!f)return null;
  var hoje=new Date().toISOString().slice(0,10);
  var horas=(os.execLog||[]).reduce(function(s,e){return s+(e.horas||0);},0);
  var custo=(os.execLog||[]).reduce(function(s,e){return s+(e.tipo==="peca"&&e.custo?e.qty*e.custo:0);},0);
  var nReg=(os.execLog||[]).length;
  f.historico=f.historico||[];
  var entry={
    id:nextId(),
    desc:os.titulo||os.numero_os||("OS #"+os.id),
    data:hoje,
    tipo:os.tipo||"Corretiva",
    tecnico:os.tecnico||"",
    horas:horas,custo:custo,
    obs:"OS "+(os.numero_os||"#"+os.id)+" — "+nReg+" registro(s) de execução"+(os.descricao?(": "+os.descricao):""),
    os_id:os.id
  };
  f.historico.unshift(entry);
  fichasObj[os.ativo_id]=f;
  return entry;
}

// ── KPIs ──────────────────────────────────────────────────────────────
// ativoId e o identificador confiavel; ativoNome fica so como fallback para
// OS antigas/legadas que foram criadas antes de gravarmos ativo_id (ver
// correcao em ordens.html). Sem isso, dois ativos com o mesmo nome (ex:
// dois ativos de teste chamados "Teste") teriam o backlog um do outro
// contado junto, dando o mesmo resultado para ativos diferentes.
function calcInd(ativoId,ativoNome,hist,ordArr){
  var bkl=(ordArr||[]).filter(function(o){
    var mesmoAtivo=(o.ativo_id!=null)?o.ativo_id===ativoId:o.ativo===ativoNome;
    return mesmoAtivo&&(o.status==="Aberta"||o.status==="Em Andamento");
  }).length;
  if(!hist||!hist.length)return{mtbf:null,mttr:null,disp:null,conf:null,lambda:null,manuplan:null,backlog:bkl,nfalhas:0,compliance:null,mttf:null,downtime:0,oee_a:null};
  var corr=hist.filter(function(h){return h.tipo==="Corretiva";});
  var plan=hist.filter(function(h){return h.tipo==="Preventiva"||h.tipo==="Preditiva";});
  var nC=corr.length,nT=hist.length,hC=corr.reduce(function(s,h){return s+(h.horas||0);},0);
  var per=8760;
  if(hist.length>=2){var ds=hist.map(function(h){return new Date(h.data).getTime();}).sort(function(a,b){return a-b;});per=Math.max((ds[ds.length-1]-ds[0])/3600000,720);}
  var mtbf=nC>0?Math.round((per-hC)/nC):null;
  var mttr=nC>0?Math.round(hC/nC*10)/10:null;
  var disp=(mtbf&&mttr)?Math.round(mtbf/(mtbf+mttr)*1000)/10:null;
  var mp=nT>0?Math.round(plan.length/nT*100):0;
  return{mtbf:mtbf,mttr:mttr,disp:disp,conf:mtbf?Math.round(Math.exp(-1000/mtbf)*1000)/10:null,lambda:mtbf?Math.round(1/mtbf*100000)/100000:null,manuplan:mp,backlog:bkl,nfalhas:nC,compliance:nT?Math.round(plan.length/nT*100):null,mttf:mtbf,downtime:hC,oee_a:hC>0?Math.max(0,Math.round((1-hC/per)*1000)/10):null};
}
function calcCritScore(s){var c=(s.hse||1)*2.5+(s.prod||1)*2.0+(s.custo||1)*1.0;var p=(s.freq||1)*2.0+(s.det||1)*1.5+(s.red||1)*1.0;var mx=(5*2.5+5*2.0+5*1.0)*(5*2.0+5*1.5+5*1.0);return Math.round(c*p/mx*100);}
function getCritClass(sc){if(sc>=70)return"A";if(sc>=45)return"B";if(sc>=25)return"C";return"D";}
function contarPlanosPendentes(fichasObj){var t=0;Object.keys(fichasObj).forEach(function(id){var f=fichasObj[id];if(!f||!f.planos)return;f.planos.forEach(function(p){if(calcPlanStatus(p.proxima_execucao)!=="OK")t++;});});return t;}

// ── INIT APP ──────────────────────────────────────────────────────────
function initApp(renderFn){
  // Auth check — redireciona para login se não autenticado
  var sess=authRequired();
  if(!sess)return;

  // Show/hide ads based on plan
  if(typeof showAds==="function") showAds(getPlano()==="free");

  Promise.all([
    sbGet("ativos",    "select=*&order=id.asc"),
    sbGet("ordens",    "select=*&order=criado_em.desc"),
    sbGet("planos",    "select=*"),
    sbGet("historico", "select=*"),
    sbGet("medicoes",  "select=*"),
    sbGet("usuarios",  "select=*"),
    sbGet("categorias","select=*"),
    sbGet("empresas",  "select=*"),
    sbGet("unidades",  "select=*")
  ]).then(function(res){
    var dbAt=res[0],dbOrd=res[1],dbPl=res[2],dbHist=res[3],dbMed=res[4],
        dbUsers=res[5],dbCats=res[6],dbEmps=res[7],dbUnids=res[8];

    // Ativos
    if(Array.isArray(dbAt)&&dbAt.length){
      ativos=dbAt.map(function(a){return{id:a.id,nome:a.nome,categoria:a.categoria,empresa:a.empresa,unidade:a.unidade,localizacao:a.localizacao,fabricante:a.fabricante,modelo:a.modelo,serie:a.serie,ano:a.ano,tag:a.tag,patrimonio:a.patrimonio,status:a.status};});
      fichas={};
      ativos.forEach(function(a){
        fichas[a.id]={historico:[],preditiva:[],planos:[],docs:[],indicadores:["mtbf","mttr","disp","manuplan"],crit:{}};
        var dbA=dbAt.find(function(x){return x.id===a.id;});
        if(dbA){fichas[a.id].indicadores=dbA.indicadores||["mtbf","mttr","disp","manuplan"];fichas[a.id].crit=dbA.crit||{};fichas[a.id].docs=dbA.docs||[];}
      });
      (dbPl||[]).forEach(function(p){if(fichas[p.ativo_id])fichas[p.ativo_id].planos.push({id:p.id,nome:p.nome,tipo:p.tipo,frequencia:p.frequencia,ultima_execucao:p.ultima_execucao,proxima_execucao:p.proxima_execucao,responsavel:p.responsavel,status:p.status||calcPlanStatus(p.proxima_execucao),os_gerada_id:p.os_gerada_id||null,acoes:p.acoes||[]});});
      (dbHist||[]).forEach(function(h){if(fichas[h.ativo_id])fichas[h.ativo_id].historico.push({id:h.id,desc:h.descricao,data:h.data,tipo:h.tipo,tecnico:h.tecnico,horas:h.horas,custo:h.custo,obs:h.obs,analise:h.analise||null,os_id:h.os_id||null});});
      (dbMed||[]).forEach(function(m){if(fichas[m.ativo_id])fichas[m.ativo_id].preditiva.push({id:m.id,data:m.data,param:m.param,valor:m.valor,limite:m.limite,obs:m.obs});});
      localStorage.setItem("mx_ativos",JSON.stringify(ativos));
      localStorage.setItem("mx_fichas",JSON.stringify(fichas));
    }else{ativos=[];fichas={};}

    // Ordens
    if(Array.isArray(dbOrd)&&dbOrd.length){
      ordens=dbOrd.map(function(o){return{id:o.id,numero_os:o.numero_os||"",titulo:o.titulo,ativo:o.ativo_nome,ativo_id:o.ativo_id,tipo:o.tipo,prioridade:o.prioridade,status:o.status,tecnico:o.tecnico,abertura:o.abertura,prazo:o.prazo,descricao:o.descricao,origem:o.origem||"manual",planos_ids:o.planos_ids||[],planos_exec:o.planos_exec||[],execLog:o.exec_log||[]};});
      localStorage.setItem("mx_ordens",JSON.stringify(ordens));
    }else{ordens=[];}

    // Usuarios
    if(Array.isArray(dbUsers)&&dbUsers.length){
      localStorage.setItem("mx_usuarios",JSON.stringify(dbUsers));
    }else{localStorage.removeItem("mx_usuarios");}

    // Categorias
    if(Array.isArray(dbCats)&&dbCats.length){
      localStorage.setItem("mx_categorias",JSON.stringify(dbCats));
    }else{localStorage.removeItem("mx_categorias");}

    // Empresas
    if(Array.isArray(dbEmps)&&dbEmps.length){
      var emps=dbEmps.map(function(e){return Object.assign({},e,{unidades:(dbUnids||[]).filter(function(u){return u.empresa_id===e.id;})});});
      localStorage.setItem("mx_empresas",JSON.stringify(emps));
    }else{localStorage.removeItem("mx_empresas");}

    // Auto-gera OS de planos vencidos
    var novasOS=gerarOSProgramadas(7);
    if(novasOS.length)console.log("[MaintenX] "+novasOS.length+" OS gerada(s) automaticamente.");
    // Sincroniza nextId para evitar colisao de IDs entre dispositivos
    syncNextId([ativos, ordens, dbPl, dbHist, dbMed]);
    console.log("[Supabase] Carregado: "+ativos.length+" ativos, "+ordens.length+" ordens | nextId="+localStorage.getItem("mx_nextid"));
    if(renderFn)renderFn();

  }).catch(function(err){
    console.warn("[Offline] Usando localStorage:",err);
    var D=loadData();ativos=D.ativos;ordens=D.ordens;fichas=D.fichas;
    if(renderFn)renderFn();
  });
}

// ── ADS (plano free) ──────────────────────────────────────────────────
function showAds(show){
  // Ativa/desativa banners de anúncio
  document.querySelectorAll(".ad-banner").forEach(function(el){
    el.style.display=show?"block":"none";
  });
  // Injeta Google AdSense se free (substitua ca-pub-XXXXXXXX pelo seu código)
  if(show && !document.getElementById("adsense-script")){
    // var s=document.createElement("script");
    // s.id="adsense-script";
    // s.async=true;
    // s.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX";
    // document.head.appendChild(s);
  }
}
