// ============================================================
// Edge Function: criar-funcionario
// Cria o usuário no Supabase Auth (exige service_role, por
// isso não pode ser feito direto do client) e o registro
// correspondente em caspere_funcionarios.
//
// Só quem já é dono (caspere_eh_dono) pode chamar — checagem
// feita validando o JWT de quem chama antes de usar o
// service_role internamente.
//
// Deploy: supabase functions deploy criar-funcionario
// Secrets necessários (já disponíveis por padrão no ambiente
// da function): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente com o token de quem chamou, só pra confirmar que é o dono.
  const callerClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });
  }

  const { data: donoRows } = await callerClient
    .from("caspere_funcionarios")
    .select("eh_dono")
    .eq("auth_user_id", userData.user.id)
    .eq("ativo", true);

  if (!donoRows?.length || !donoRows[0].eh_dono) {
    return new Response(JSON.stringify({ error: "Só o dono pode cadastrar funcionários" }), { status: 403 });
  }

  const { email, senha, nome, cargo, telefone } = await req.json();
  if (!email || !senha || !nome) {
    return new Response(JSON.stringify({ error: "email, senha e nome são obrigatórios" }), { status: 400 });
  }

  // Cliente admin (service_role) pra criar o usuário de fato.
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: novoUsuario, error: criarErr } = await adminClient.auth.admin.createUser({
    email, password: senha, email_confirm: true,
  });
  if (criarErr) {
    return new Response(JSON.stringify({ error: criarErr.message }), { status: 400 });
  }

  const { error: insertErr } = await adminClient.from("caspere_funcionarios").insert({
    auth_user_id: novoUsuario.user.id, nome, cargo, telefone, eh_dono: false,
  });
  if (insertErr) {
    // Reverte o usuário criado no Auth se o insert falhar, pra não deixar órfão.
    await adminClient.auth.admin.deleteUser(novoUsuario.user.id);
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true, id: novoUsuario.user.id }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
