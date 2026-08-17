// ============================================================
// CASPERE — helpers compartilhados
// Módulo isolado do Mantenedor CMMS: usa o mesmo projeto
// Supabase, mas tabelas próprias (prefixo caspere_) e sua
// própria lógica de auth/RLS.
// ============================================================

const SUPABASE_URL = "https://mtmcrpigiwsxfwxkqdkz.supabase.co";
// TODO: colar a anon key do projeto (Supabase > Project Settings > API).
// Nunca usar a service_role key aqui — só a anon/public key.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10bWNycGlnaXdzeGZ3eGtxZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTYxNTYsImV4cCI6MjA5NTkzMjE1Nn0.U3_-Fh35p-l3ZYSApbmn-7KRLlF1voZWS5Pbm0_LQ7A";

const CP_HEADERS_BASE = {
  "apikey": SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
};

// ------------------------------------------------------------
// Sessão (Supabase Auth via REST, sem SDK — mesmo padrão do
// Mantenedor)
// ------------------------------------------------------------
function cpGetSession() {
  try {
    return JSON.parse(localStorage.getItem("cp_session") || "null");
  } catch {
    return null;
  }
}

function cpSetSession(session) {
  localStorage.setItem("cp_session", JSON.stringify(session));
}

function cpClearSession() {
  localStorage.removeItem("cp_session");
}

function cpAuthHeaders() {
  const session = cpGetSession();
  const headers = { ...CP_HEADERS_BASE };
  if (session && session.access_token) {
    headers["Authorization"] = "Bearer " + session.access_token;
  } else {
    headers["Authorization"] = "Bearer " + SUPABASE_ANON_KEY;
  }
  return headers;
}

async function cpLogin(email, senha) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: CP_HEADERS_BASE,
    body: JSON.stringify({ email, password: senha }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || "Falha no login");
  }
  cpSetSession(data);
  return data;
}

async function cpLogout() {
  cpClearSession();
  window.location.href = "login.html";
}

function cpRequireLogin() {
  const session = cpGetSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// ------------------------------------------------------------
// Perfil do funcionário logado (nome, se é dono etc.)
// ------------------------------------------------------------
async function cpFuncionarioAtual() {
  const session = cpGetSession();
  if (!session) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/caspere_funcionarios?auth_user_id=eq.${session.user.id}&select=*`,
    { headers: cpAuthHeaders() }
  );
  if (!res.ok) {
    let msg = `Erro ${res.status} ao consultar caspere_funcionarios`;
    try {
      const body = await res.json();
      msg = body.message || msg;
    } catch { /* corpo sem JSON */ }
    throw new Error(msg);
  }
  const rows = await res.json();
  return rows[0] || null; // null = autenticado, mas sem registro em caspere_funcionarios
}

async function cpRequireDono() {
  let funcionario;
  try {
    funcionario = await cpFuncionarioAtual();
  } catch (err) {
    alert("Erro ao verificar seu acesso: " + err.message);
    cpClearSession();
    window.location.href = "login.html";
    return null;
  }
  if (!funcionario) {
    alert("Seu login não está vinculado a um funcionário cadastrado no Caspere. Verifique se o registro em caspere_funcionarios foi criado para este usuário.");
    cpClearSession();
    window.location.href = "login.html";
    return null;
  }
  if (!funcionario.eh_dono) {
    alert("Esta área é restrita ao dono. Você está logado como funcionário.");
    window.location.href = "checklist.html";
    return null;
  }
  return funcionario;
}

// ------------------------------------------------------------
// REST genérico com checagem de erro (nunca falhar em
// silêncio — mesmo padrão do Mantenedor)
// ------------------------------------------------------------
async function cpFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...cpAuthHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      msg = body.message || body.error_description || msg;
    } catch {
      /* corpo sem JSON */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ------------------------------------------------------------
// Escapar HTML (proteção XSS em qualquer texto injetado via
// innerHTML)
// ------------------------------------------------------------
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ------------------------------------------------------------
// Rótulos amigáveis
// ------------------------------------------------------------
const CP_TIPO_EQUIP_LABEL = {
  autoclave: "Autoclave",
  osmose_reversa: "Osmose reversa",
  termodesinfectora: "Termodesinfectora",
};

const CP_STATUS_ITEM_LABEL = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  nao_se_aplica: "Não se aplica",
};

const CP_STATUS_CHAMADO_LABEL = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

function cpFmtData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ------------------------------------------------------------
// URL do equipamento (usada tanto para gerar o QR quanto para
// montar links de navegação)
// ------------------------------------------------------------
function cpUrlEquipamento(equipamentoId) {
  return `${window.location.origin}/caspere/equip.html?id=${equipamentoId}`;
}
