// ============================================================
// Edge Function: enviar-relatorio
// Recebe o PDF gerado no client (base64) e envia por e-mail
// pro cliente via Resend, anexado. Marca o relatório como
// enviado.
//
// Deploy: supabase functions deploy enviar-relatorio
// Secrets necessários:
//   RESEND_API_KEY        (criar em resend.com > API Keys)
//   RESEND_FROM_EMAIL      ex: "Caspere <relatorios@mantenedor.app.br>"
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm por padrão)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")!;

  const callerClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });
  }

  const { relatorio_id, pdf_base64 } = await req.json();
  if (!relatorio_id || !pdf_base64) {
    return new Response(JSON.stringify({ error: "relatorio_id e pdf_base64 são obrigatórios" }), { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: relatorio, error: relErr } = await adminClient
    .from("caspere_relatorios")
    .select("id, caspere_equipamentos(identificacao, caspere_clientes(razao_social, email_principal, emails_copia))")
    .eq("id", relatorio_id)
    .single();

  if (relErr || !relatorio) {
    return new Response(JSON.stringify({ error: "Relatório não encontrado" }), { status: 404 });
  }

  const cliente = relatorio.caspere_equipamentos?.caspere_clientes;
  const equipamentoNome = relatorio.caspere_equipamentos?.identificacao || "equipamento";

  if (!cliente?.email_principal) {
    return new Response(JSON.stringify({ error: "Cliente sem e-mail cadastrado" }), { status: 400 });
  }

  const destinatarios = [cliente.email_principal, ...(cliente.emails_copia || [])];

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: destinatarios,
      subject: `Relatório de manutenção — ${equipamentoNome}`,
      html: `<p>Olá,</p><p>Segue em anexo o relatório da manutenção preventiva realizada em <strong>${equipamentoNome}</strong>.</p><p>Qualquer dúvida, estamos à disposição.</p>`,
      attachments: [{
        filename: `relatorio-${relatorio_id}.pdf`,
        content: pdf_base64,
      }],
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    return new Response(JSON.stringify({ error: `Falha ao enviar e-mail: ${errBody}` }), { status: 502 });
  }

  await adminClient
    .from("caspere_relatorios")
    .update({ email_enviado_em: new Date().toISOString() })
    .eq("id", relatorio_id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
