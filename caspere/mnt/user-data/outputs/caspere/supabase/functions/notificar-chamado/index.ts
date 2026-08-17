// ============================================================
// Edge Function: notificar-chamado
// Chamada por um Database Webhook (trigger de INSERT em
// caspere_chamados) — não precisa de auth de usuário, só do
// segredo do webhook.
//
// Configurar em: Supabase > Database > Webhooks
//   Table: caspere_chamados | Event: INSERT
//   Type: HTTP Request -> esta function
//
// Secrets necessários:
//   RESEND_API_KEY, RESEND_FROM_EMAIL, DONO_EMAIL
// ============================================================

Deno.serve(async (req) => {
  const resendKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")!;
  const donoEmail = Deno.env.get("DONO_EMAIL")!;

  const payload = await req.json();
  const chamado = payload.record; // formato padrão do webhook do Supabase

  if (!chamado) {
    return new Response(JSON.stringify({ error: "Payload inválido" }), { status: 400 });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [donoEmail],
      subject: `Novo chamado aberto — Caspere`,
      html: `
        <p>Um novo chamado foi aberto:</p>
        <p><strong>Solicitante:</strong> ${chamado.nome_solicitante || "—"}<br>
        <strong>Contato:</strong> ${chamado.contato_solicitante || "—"}<br>
        <strong>Descrição:</strong> ${chamado.descricao}</p>
        <p><a href="https://mantenedor.app.br/caspere/chamados.html">Ver no painel</a></p>
      `,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    return new Response(JSON.stringify({ error: `Falha ao notificar: ${errBody}` }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
