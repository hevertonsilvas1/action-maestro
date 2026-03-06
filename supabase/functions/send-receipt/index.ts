import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("signature, display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const userName = profile?.signature || profile?.display_name || user.email || "Sistema";

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const userRole = roleData?.role || null;

    const body = await req.json();
    const {
      winner_id, winner_name, winner_phone, action_id, action_name,
      prize_title, prize_value, receipt_path, mode,
      trigger: triggerSource, // 'manual' | 'auto_attach'
    } = body;

    const isAuto = triggerSource === "auto_attach";
    const isConfirmation = mode === "confirmation";

    if (!winner_id || !receipt_path) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify winner status & conditions
    const { data: currentWinner, error: fetchErr } = await serviceClient
      .from("winners")
      .select("status, receipt_url, receipt_sent_at, last_inbound_at, phone_e164")
      .eq("id", winner_id)
      .maybeSingle();

    if (fetchErr || !currentWinner) {
      return new Response(
        JSON.stringify({ error: "Ganhador não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (currentWinner.status !== "receipt_attached") {
      return new Response(
        JSON.stringify({ error: `Status "${currentWinner.status}" não permite enviar comprovante. Necessário: "receipt_attached".` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For auto-send: validate additional conditions
    if (isAuto) {
      // Already sent?
      if (currentWinner.receipt_sent_at) {
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "receipt_already_sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Phone valid?
      if (!currentWinner.phone_e164) {
        await saveError(serviceClient, winner_id, "Auto-envio bloqueado: telefone E.164 não cadastrado.");
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "no_phone_e164" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Window open?
      const { data: windowConfig } = await serviceClient
        .from("integration_configs")
        .select("value")
        .eq("key", "INBOUND_WINDOW_HOURS")
        .maybeSingle();
      const windowHours = parseInt(windowConfig?.value || "24", 10);

      if (!currentWinner.last_inbound_at) {
        await saveError(serviceClient, winner_id, "Auto-envio bloqueado: sem interação inbound registrada.");
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "no_inbound" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const inboundAge = Date.now() - new Date(currentWinner.last_inbound_at).getTime();
      if (inboundAge > windowHours * 3600000) {
        await saveError(serviceClient, winner_id, `Auto-envio bloqueado: janela fechada (última interação há ${Math.round(inboundAge / 3600000)}h).`);
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "window_closed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Webhook URL
    const { data: webhookConfig } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "UNNICHAT_COMPROVANTE")
      .maybeSingle();

    let unnichatUrl = webhookConfig?.value;
    if (!unnichatUrl) {
      const { data: fallback } = await serviceClient
        .from("integration_configs")
        .select("value")
        .eq("key", "UNNICHAT_PIX")
        .maybeSingle();
      unnichatUrl = fallback?.value;
    }

    if (!unnichatUrl) {
      const errMsg = "Webhook de envio de comprovante não configurado em Integrações.";
      if (isAuto) {
        await saveError(serviceClient, winner_id, `Auto-envio bloqueado: ${errMsg}`);
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "no_webhook" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate signed URL for the receipt
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("receipts")
      .createSignedUrl(receipt_path, 7 * 24 * 60 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      const errMsg = "Erro ao gerar URL do comprovante.";
      if (isAuto) {
        await saveError(serviceClient, winner_id, errMsg);
        return new Response(
          JSON.stringify({ success: false, error: errMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build payload
    let payloadBody: Record<string, unknown>;
    if (isConfirmation) {
      const { data: templateConfig } = await serviceClient
        .from("integration_configs")
        .select("value")
        .eq("key", "RECEIPT_CONFIRMATION_TEMPLATE")
        .maybeSingle();
      const template = templateConfig?.value || "Olá! Temos seu comprovante de pagamento. Responda esta mensagem para recebê-lo.";
      payloadBody = {
        tel: winner_phone || currentWinner.phone_e164,
        nome: winner_name,
        acao: action_name,
        mensagem: template,
        row_number: 0,
      };
    } else {
      payloadBody = {
        tel: winner_phone || currentWinner.phone_e164,
        nome: winner_name,
        acao: action_name,
        tipo_premio: prize_title,
        valor: String(prize_value),
        comprovante_url: signedUrlData.signedUrl,
        row_number: 0,
      };
    }

    // Send to UnniChat
    const unnichatResponse = await fetch(unnichatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
    });

    // Determine audit operation names
    const opSuccess = isConfirmation
      ? "confirmacao_enviada"
      : isAuto
        ? "AUTO_SEND_RECEIPT"
        : "MANUAL_SEND_RECEIPT";
    const opFail = isAuto ? "AUTO_SEND_RECEIPT_FAILED" : "MANUAL_SEND_RECEIPT_FAILED";

    if (!unnichatResponse.ok) {
      const errText = await unnichatResponse.text();
      const errorMsg = `UnniChat: ${unnichatResponse.status} ${unnichatResponse.statusText}`.substring(0, 200);

      // Log failure
      await serviceClient.from("action_audit_log").insert({
        action_id,
        action_name,
        table_name: "winners",
        record_id: winner_id,
        operation: opFail,
        user_id: user.id,
        user_name: isAuto ? `${userName} (auto)` : userName,
        user_role: userRole,
        changes: { winner_name, error: errorMsg, trigger: triggerSource || "manual" },
      });

      // Save error on winner
      await saveError(serviceClient, winner_id, `Erro envio comprovante: ${errorMsg}`);

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await unnichatResponse.text();

    // Success: update status
    const now = new Date().toISOString();
    await serviceClient
      .from("winners")
      .update({
        status: isConfirmation ? "receipt_attached" : "receipt_sent",
        receipt_sent_at: isConfirmation ? undefined : now,
        last_outbound_at: now,
        last_pix_error: null,
        updated_at: now,
      })
      .eq("id", winner_id);

    // Audit
    await serviceClient.from("action_audit_log").insert({
      action_id,
      action_name,
      table_name: "winners",
      record_id: winner_id,
      operation: opSuccess,
      user_id: user.id,
      user_name: isAuto ? `${userName} (auto)` : userName,
      user_role: userRole,
      changes: {
        winner_name,
        prize_title,
        prize_value,
        channel: "UnniChat",
        trigger: triggerSource || "manual",
        mode: isConfirmation ? "confirmation" : "receipt",
        status: { before: "receipt_attached", after: isConfirmation ? "receipt_attached" : "receipt_sent" },
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Send receipt error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function saveError(client: any, winnerId: string, error: string) {
  await client
    .from("winners")
    .update({ last_pix_error: error.substring(0, 500) })
    .eq("id", winnerId);
}
