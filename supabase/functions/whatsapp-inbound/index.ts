import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWindowMessage, buildPayload, dispatchAutomation } from "../_shared/window-messages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) {
    if (digits.length === 13) return `+${digits}`;
    if (digits.length === 12) {
      const ddd = digits.substring(2, 4);
      const number = digits.substring(4);
      return `+55${ddd}9${number}`;
    }
  }
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    const number = digits.substring(2);
    return `+55${ddd}9${number}`;
  }
  return null;
}

const FALLBACK_STATUSES = [
  "pix_requested",
  "cliente_nao_responde",
  "numero_inexistente",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[INBOUND] ✅ Request received", {
      method: req.method, url: req.url, timestamp: new Date().toISOString(),
    });

    // Secret validation
    const secret = req.headers.get("x-webhook-secret");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let expectedSecret: string | undefined;
    const { data: secretRow } = await adminClient
      .from("integration_configs").select("value").eq("key", "UNNICHAT_INBOUND_SECRET").maybeSingle();

    if (secretRow?.value) {
      expectedSecret = secretRow.value;
    } else {
      expectedSecret = Deno.env.get("UNNICHAT_INBOUND_SECRET");
    }

    if (!expectedSecret || secret !== expectedSecret) {
      console.error("[INBOUND] ❌ AUTH FAILED");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse payload
    const body = await req.json();
    const phoneRaw: string | undefined = body.phone ?? body.data?.phoneNumber ?? body.data?.phone;
    const message: string | null = body.message ?? body.data?.lastMessage ?? body.data?.message ?? null;
    const actionId: string | undefined = body.action_id;

    if (!phoneRaw) {
      return new Response(
        JSON.stringify({ error: "phone is required", received_keys: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneE164 = normalizePhoneE164(phoneRaw);
    if (!phoneE164) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format", raw: phoneRaw }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[INBOUND] ✅ Phone normalized", { raw: phoneRaw, e164: phoneE164 });

    const serviceClient = adminClient;
    const now = new Date().toISOString();
    let fallbackUsed = false;

    // Match winners
    let query = serviceClient
      .from("winners")
      .select("id, status, action_id, name, phone, phone_e164, prize_title, prize_type, value, receipt_url, receipt_filename, receipt_sent_at, template_reopen_count, created_at, last_outbound_at")
      .eq("phone_e164", phoneE164)
      .is("deleted_at", null);

    if (actionId) query = query.eq("action_id", actionId);

    const { data: matched, error: findErr } = await query;
    if (findErr) {
      console.error("[INBOUND] ❌ DB error finding winners", findErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let winners = matched ?? [];

    // Fallback
    if (winners.length === 0) {
      fallbackUsed = true;
      const { data: fallbackMatched } = await serviceClient
        .from("winners")
        .select("id, status, action_id, name, phone, phone_e164, prize_title, prize_type, value, receipt_url, receipt_filename, receipt_sent_at, template_reopen_count, created_at, last_outbound_at")
        .eq("phone_e164", phoneE164)
        .is("deleted_at", null)
        .in("status", FALLBACK_STATUSES)
        .order("last_outbound_at", { ascending: false, nullsFirst: false })
        .limit(1);
      winners = fallbackMatched ?? [];
    }

    if (winners.length === 0) {
      return jsonResponse({ ok: true, matched: 0, normalized_phone: phoneE164, fallback_used: fallbackUsed, winner_id: null, action_id_resolved: null });
    }

    // Update inbound timestamps
    for (const winner of winners) {
      await serviceClient.from("winners").update({
        ultima_interacao_whatsapp: now, last_inbound_at: now, last_pix_error: null,
      }).eq("id", winner.id);
    }

    // Check auto-send config
    const { data: autoSendConfig } = await serviceClient
      .from("integration_configs").select("value").eq("key", "AUTO_SEND_RECEIPT_ON_INBOUND").maybeSingle();
    const autoSendEnabled = autoSendConfig?.value !== "false";

    const primaryWinner = winners[0];

    if (!autoSendEnabled) {
      return jsonResponse({
        ok: true, matched: winners.length, receipts_sent: 0, auto_send: false,
        normalized_phone: phoneE164, winner_id: primaryWinner.id,
        action_id_resolved: primaryWinner.action_id, fallback_used: fallbackUsed, inbound_window_open: true,
      });
    }

    // Filter candidates for auto-send
    const candidates = winners
      .filter((w) => w.status === "receipt_attached" && !w.receipt_sent_at && w.receipt_url)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (candidates.length > 1) {
      for (let i = 1; i < candidates.length; i++) {
        await serviceClient.from("winners").update({
          last_pix_error: `Conflito: múltiplos ganhadores com mesmo telefone. Comprovante enviado para ${candidates[0].name} (mais recente).`,
        }).eq("id", candidates[i].id);
      }
    }

    const target = candidates[0];
    if (!target) {
      return jsonResponse({
        ok: true, matched: winners.length, receipts_sent: 0,
        normalized_phone: phoneE164, winner_id: primaryWinner.id,
        action_id_resolved: primaryWinner.action_id, fallback_used: fallbackUsed, inbound_window_open: true,
      });
    }

    // Extract receipt path
    const receiptPath = extractStoragePath(target.receipt_url || "");
    if (!receiptPath) {
      return jsonResponse({
        ok: true, matched: winners.length, receipts_sent: 0, error: "Could not extract receipt path",
        normalized_phone: phoneE164, winner_id: target.id,
        action_id_resolved: target.action_id, fallback_used: fallbackUsed, inbound_window_open: true,
      });
    }

    // Get action name
    const { data: action } = await serviceClient.from("actions").select("name").eq("id", target.action_id).maybeSingle();

    // ── Resolve automation from window_messages (single source of truth) ──
    const automation = await getWindowMessage(serviceClient, "enviar_comprovante", { autoOnly: true });
    if (!automation) {
      console.error("[INBOUND] ❌ No active automation 'enviar_comprovante' found in window_messages");
      return jsonResponse({
        ok: true, matched: winners.length, receipts_sent: 0, error: "Automação 'enviar_comprovante' não encontrada",
        normalized_phone: phoneE164, winner_id: target.id,
        action_id_resolved: target.action_id, fallback_used: fallbackUsed, inbound_window_open: true,
      });
    }

    console.log(`[INBOUND] Using automation: "${automation.name}" (type: enviar_comprovante)`);

    // Build payload
    const receiptName = (target.receipt_filename || "comprovante.pdf")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_") || "comprovante.pdf";
    const shortUrl = `${supabaseUrl}/functions/v1/download-receipt/comprovante.pdf?id=${target.id}`;
    const payloadBody = buildPayload({
      nome: target.name,
      tel: target.phone_e164 || normalizePhoneE164(target.phone || "") || target.phone || "",
      acao: action?.name || "",
      tipo_premio: target.prize_title,
      valor: target.value,
      receipt_url: shortUrl,
      comprovante_filename: receiptName,
    });

    // Dispatch via unified automation system
    const { success, statusCode, responseBody } = await dispatchAutomation(
      serviceClient, automation, payloadBody,
      { winnerId: target.id, actionId: target.action_id, actionName: action?.name || "", triggerSource: "auto_inbound" }
    );

    let receiptsSent = 0;

    if (success) {
      const { data: transitionResult } = await serviceClient.rpc(
        "apply_automatic_status_transition",
        { _winner_id: target.id, _trigger_event: "receipt_sent" }
      );
      const resolvedStatus = transitionResult?.changed ? transitionResult.to : "receipt_sent";

      await serviceClient.from("winners").update({
        status: resolvedStatus, receipt_sent_at: now, last_outbound_at: now,
        last_pix_error: null, template_reopen_sent_at: null, template_reopen_count: 0, updated_at: now,
      }).eq("id", target.id);

      await serviceClient.from("action_audit_log").insert({
        action_id: target.action_id, action_name: action?.name || null,
        table_name: "winners", record_id: target.id,
        operation: "AUTO_SEND_RECEIPT", user_id: null,
        user_name: "Sistema (Inbound WhatsApp)", user_role: null,
        changes: {
          winner_name: target.name, prize_title: target.prize_title,
          trigger: "whatsapp_inbound", phone_e164: phoneE164, automation_used: automation.name,
          message_preview: message?.substring(0, 100) ?? null,
          status: { before: "receipt_attached", after: resolvedStatus },
        },
      });

      receiptsSent++;
      console.log("[INBOUND] ✅ Receipt sent successfully", { winner_id: target.id });
    } else {
      console.error("[INBOUND] ❌ Receipt send FAILED", { status: statusCode, response: responseBody.substring(0, 200) });
      await serviceClient.from("winners").update({
        last_pix_error: `AUTO_SEND_RECEIPT_FAILED (inbound): ${statusCode}`.substring(0, 200),
      }).eq("id", target.id);
    }

    return jsonResponse({
      ok: true, matched: winners.length, receipts_sent: receiptsSent,
      normalized_phone: phoneE164, winner_id: target.id,
      action_id_resolved: target.action_id, fallback_used: fallbackUsed, inbound_window_open: true,
    });
  } catch (err) {
    console.error("[INBOUND] 💥 Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/object\/(?:public|sign)\/receipts\/(.+?)(?:\?|$)/);
  if (match) return match[1];
  const match2 = url.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/(.+?)(?:\?|$)/);
  if (match2) return match2[1];
  if (!url.startsWith("http")) return url;
  return null;
}
