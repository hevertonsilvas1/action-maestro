import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Normalize any phone to E.164: +55DDDNUMERO */
function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.length >= 12) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const svc = createClient(supabaseUrl, serviceRoleKey);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    // User info
    const [{ data: profile }, { data: roleData }] = await Promise.all([
      svc.from("profiles").select("signature, display_name").eq("user_id", user.id).maybeSingle(),
      svc.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    const userName = profile?.signature || profile?.display_name || user.email || "Sistema";
    const userRole = roleData?.role || null;

    const body = await req.json();
    const {
      winner_id, winner_name, winner_phone, action_id, action_name,
      prize_title, prize_value, receipt_path, mode,
      trigger: triggerSource,
    } = body;

    const isAuto = triggerSource === "auto_attach" || triggerSource === "auto_attach_template";
    const isConfirmation = mode === "confirmation";

    if (!winner_id || !receipt_path) {
      return jsonRes({ error: "Dados incompletos." }, 400);
    }

    // Fetch winner
    const { data: w, error: fetchErr } = await svc
      .from("winners")
      .select("status, receipt_url, receipt_sent_at, last_inbound_at, phone_e164, template_reopen_sent_at, template_reopen_count")
      .eq("id", winner_id)
      .maybeSingle();

    if (fetchErr || !w) return jsonRes({ error: "Ganhador não encontrado." }, 404);

    if (w.status !== "receipt_attached") {
      return jsonRes({ error: `Status "${w.status}" não permite enviar comprovante. Necessário: "receipt_attached".` }, 400);
    }

    // ── Duplicate prevention for receipt sends ──
    if (!isConfirmation && w.receipt_sent_at) {
      return jsonRes({ success: false, skipped: true, reason: "receipt_already_sent" });
    }

    // ── Template duplicate prevention: max 3 templates, min 1h between sends ──
    if (isConfirmation) {
      const MAX_TEMPLATES = 3;
      const MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

      if ((w.template_reopen_count || 0) >= MAX_TEMPLATES) {
        return jsonRes({ success: false, skipped: true, reason: "max_templates_reached" });
      }

      if (w.template_reopen_sent_at) {
        const elapsed = Date.now() - new Date(w.template_reopen_sent_at).getTime();
        if (elapsed < MIN_INTERVAL_MS) {
          return jsonRes({ success: false, skipped: true, reason: "template_cooldown" });
        }
      }
    }

    // For auto receipt sends: validate conditions
    if (isAuto && !isConfirmation) {
      if (!w.phone_e164) {
        await saveError(svc, winner_id, "Auto-envio bloqueado: telefone E.164 não cadastrado.");
        return jsonRes({ success: false, skipped: true, reason: "no_phone_e164" });
      }

      // Window check
      const { data: windowConfig } = await svc
        .from("integration_configs").select("value").eq("key", "INBOUND_WINDOW_HOURS").maybeSingle();
      const windowHours = parseInt(windowConfig?.value || "24", 10);

      if (!w.last_inbound_at) {
        await saveError(svc, winner_id, "Auto-envio bloqueado: sem interação inbound registrada.");
        return jsonRes({ success: false, skipped: true, reason: "no_inbound" });
      }

      const inboundAge = Date.now() - new Date(w.last_inbound_at).getTime();
      if (inboundAge > windowHours * 3600000) {
        await saveError(svc, winner_id, `Auto-envio bloqueado: janela fechada (última interação há ${Math.round(inboundAge / 3600000)}h).`);
        return jsonRes({ success: false, skipped: true, reason: "window_closed" });
      }
    }

    // Webhook URL
    const { data: webhookConfig } = await svc
      .from("integration_configs").select("value").eq("key", "UNNICHAT_COMPROVANTE").maybeSingle();
    let unnichatUrl = webhookConfig?.value;
    if (!unnichatUrl) {
      const { data: fallback } = await svc
        .from("integration_configs").select("value").eq("key", "UNNICHAT_PIX").maybeSingle();
      unnichatUrl = fallback?.value;
    }

    if (!unnichatUrl) {
      const errMsg = "Webhook de envio de comprovante não configurado em Integrações.";
      if (isAuto) {
        await saveError(svc, winner_id, `Auto-envio bloqueado: ${errMsg}`);
        return jsonRes({ success: false, skipped: true, reason: "no_webhook" });
      }
      return jsonRes({ error: errMsg }, 500);
    }

    // Build payload
    let payloadBody: Record<string, unknown>;
    if (isConfirmation) {
      const { data: templateConfig } = await svc
        .from("integration_configs").select("value").eq("key", "RECEIPT_CONFIRMATION_TEMPLATE").maybeSingle();
      const template = templateConfig?.value || "Olá! Temos seu comprovante de pagamento. Responda esta mensagem para recebê-lo.";
      payloadBody = {
      tel: normalizePhoneE164(winner_phone || w.phone_e164 || "") || winner_phone || w.phone_e164,
      nome: winner_name,
      acao: action_name,
      mensagem: template,
      row_number: 0,
      };
    } else {
      // Use short proxy URL instead of long signed URL
      const proxyUrl = `${supabaseUrl}/functions/v1/download-receipt?id=${winner_id}`;

      payloadBody = {
        tel: normalizePhoneE164(winner_phone || w.phone_e164 || "") || winner_phone || w.phone_e164,
        nome: winner_name,
        acao: action_name,
        tipo_premio: prize_title,
        valor: String(prize_value),
        comprovante_url: proxyUrl,
        row_number: 0,
      };
    }

    // Send to UnniChat
    const resp = await fetch(unnichatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
    });

    const opSuccess = isConfirmation
      ? "template_reopen_enviado"
      : isAuto ? "AUTO_SEND_RECEIPT" : "MANUAL_SEND_RECEIPT";
    const opFail = isAuto ? "AUTO_SEND_RECEIPT_FAILED" : "MANUAL_SEND_RECEIPT_FAILED";

    if (!resp.ok) {
      const errText = await resp.text();
      const errorMsg = `UnniChat: ${resp.status} ${resp.statusText}`.substring(0, 200);

      await svc.from("action_audit_log").insert({
        action_id, action_name, table_name: "winners", record_id: winner_id,
        operation: isConfirmation ? "template_reopen_falha" : opFail,
        user_id: user.id, user_name: isAuto ? `${userName} (auto)` : userName, user_role: userRole,
        changes: { winner_name, error: errorMsg, trigger: triggerSource || "manual" },
      });
      await saveError(svc, winner_id, `Erro envio: ${errorMsg}`);
      return jsonRes({ success: false, error: errorMsg });
    }

    await resp.text();
    const now = new Date().toISOString();

    if (isConfirmation) {
      // Template sent: update tracking, keep status as receipt_attached (pending)
      await svc.from("winners").update({
        template_reopen_sent_at: now,
        template_reopen_count: (w.template_reopen_count || 0) + 1,
        last_outbound_at: now,
        last_pix_error: null,
        updated_at: now,
      }).eq("id", winner_id);
    } else {
      // Receipt sent: update status
      await svc.from("winners").update({
        status: "receipt_sent",
        receipt_sent_at: now,
        last_outbound_at: now,
        last_pix_error: null,
        template_reopen_sent_at: null,
        template_reopen_count: 0,
        updated_at: now,
      }).eq("id", winner_id);
    }

    // Audit
    await svc.from("action_audit_log").insert({
      action_id, action_name, table_name: "winners", record_id: winner_id,
      operation: opSuccess,
      user_id: user.id, user_name: isAuto ? `${userName} (auto)` : userName, user_role: userRole,
      changes: {
        winner_name, prize_title, prize_value,
        channel: "UnniChat",
        trigger: triggerSource || "manual",
        mode: isConfirmation ? "template_reopen" : "receipt",
        template_count: isConfirmation ? (w.template_reopen_count || 0) + 1 : undefined,
        status: { before: "receipt_attached", after: isConfirmation ? "receipt_attached" : "receipt_sent" },
      },
    });

    return jsonRes({ success: true });
  } catch (err) {
    console.error("Send receipt error:", err);
    return jsonRes({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function jsonRes(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function saveError(client: any, winnerId: string, error: string) {
  await client.from("winners").update({ last_pix_error: error.substring(0, 500) }).eq("id", winnerId);
}
