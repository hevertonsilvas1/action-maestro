import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Already has country code 55
  if (digits.startsWith("55")) {
    if (digits.length === 13) {
      return `+${digits}`;
    }
    // 12 digits = 55 + DDD(2) + 8-digit number → insert 9 after DDD
    if (digits.length === 12) {
      const ddd = digits.substring(2, 4);
      const number = digits.substring(4);
      return `+55${ddd}9${number}`;
    }
  }
  // Local: DDD + number
  if (digits.length === 11) {
    return `+55${digits}`;
  }
  // 10 digits = DDD(2) + 8-digit number → insert 9
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
    // ── 1. LOG: Request received ──
    console.log("[INBOUND] ✅ Request received", {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    });

    // ── 2. Secret validation (reads from integration_configs first, env fallback) ──
    const secret = req.headers.get("x-webhook-secret");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Try to load secret from integration_configs table
    let expectedSecret: string | undefined;
    const { data: secretRow } = await adminClient
      .from("integration_configs")
      .select("value")
      .eq("key", "UNNICHAT_INBOUND_SECRET")
      .maybeSingle();

    if (secretRow?.value) {
      expectedSecret = secretRow.value;
    } else {
      expectedSecret = Deno.env.get("UNNICHAT_INBOUND_SECRET");
    }

    console.log("[INBOUND] 🔑 Secret check", {
      secret_present: !!secret,
      secret_length: secret?.length ?? 0,
      expected_present: !!expectedSecret,
      expected_length: expectedSecret?.length ?? 0,
      source: secretRow?.value ? "integration_configs" : "env",
      match: secret === expectedSecret,
    });

    if (!expectedSecret || secret !== expectedSecret) {
      console.error("[INBOUND] ❌ AUTH FAILED", {
        received: secret ? `${secret.substring(0, 4)}...` : "(null)",
        expected: expectedSecret ? `${expectedSecret.substring(0, 4)}...` : "(null)",
        reason: !expectedSecret
          ? "UNNICHAT_INBOUND_SECRET not configured"
          : "Secret mismatch",
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[INBOUND] ✅ Auth OK");

    // ── 3. Parse payload ──
    const body = await req.json();
    console.log("[INBOUND] 📦 Payload received", {
      keys: Object.keys(body),
      has_data: !!body.data,
      data_keys: body.data ? Object.keys(body.data) : [],
    });

    const phoneRaw: string | undefined =
      body.phone ?? body.data?.phoneNumber ?? body.data?.phone;
    const message: string | null =
      body.message ?? body.data?.lastMessage ?? body.data?.message ?? null;
    const actionId: string | undefined = body.action_id;

    console.log("[INBOUND] 📞 Extracted fields", {
      phoneRaw,
      message_preview: message?.substring(0, 80) ?? null,
      action_id: actionId ?? null,
    });

    if (!phoneRaw) {
      console.error("[INBOUND] ❌ No phone found in payload", { received_keys: Object.keys(body) });
      return new Response(
        JSON.stringify({ error: "phone is required", received_keys: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Normalize phone ──
    const phoneE164 = normalizePhoneE164(phoneRaw);
    if (!phoneE164) {
      console.error("[INBOUND] ❌ Invalid phone format", { raw: phoneRaw });
      return new Response(
        JSON.stringify({ error: "Invalid phone format", raw: phoneRaw }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[INBOUND] ✅ Phone normalized", { raw: phoneRaw, e164: phoneE164 });

    const serviceClient = adminClient;

    const now = new Date().toISOString();
    let fallbackUsed = false;

    // ── 5. Match winners ──
    let query = serviceClient
      .from("winners")
      .select("id, status, action_id, name, phone, phone_e164, prize_title, prize_type, value, receipt_url, receipt_sent_at, template_reopen_count, created_at, last_outbound_at")
      .eq("phone_e164", phoneE164)
      .is("deleted_at", null);

    if (actionId) {
      query = query.eq("action_id", actionId);
    }

    const { data: matched, error: findErr } = await query;

    if (findErr) {
      console.error("[INBOUND] ❌ DB error finding winners", findErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let winners = matched ?? [];
    console.log("[INBOUND] 🔍 Primary query result", {
      phone_e164: phoneE164,
      action_id: actionId ?? "none",
      matched_count: winners.length,
      matched_ids: winners.map((w) => w.id),
    });

    // Fallback
    if (winners.length === 0) {
      fallbackUsed = true;
      const { data: fallbackMatched } = await serviceClient
        .from("winners")
        .select("id, status, action_id, name, phone, phone_e164, prize_title, prize_type, value, receipt_url, receipt_sent_at, template_reopen_count, created_at, last_outbound_at")
        .eq("phone_e164", phoneE164)
        .is("deleted_at", null)
        .in("status", FALLBACK_STATUSES)
        .order("last_outbound_at", { ascending: false, nullsFirst: false })
        .limit(1);

      winners = fallbackMatched ?? [];
      console.log("[INBOUND] 🔄 Fallback query", {
        matched_count: winners.length,
        matched_ids: winners.map((w) => w.id),
      });
    }

    if (winners.length === 0) {
      console.log("[INBOUND] ⚠️ No winners found for phone", { phone_e164: phoneE164 });
      return jsonResponse({
        ok: true,
        matched: 0,
        normalized_phone: phoneE164,
        fallback_used: fallbackUsed,
        winner_id: null,
        action_id_resolved: null,
      });
    }

    // ── 6. Update inbound timestamps ──
    for (const winner of winners) {
      await serviceClient
        .from("winners")
        .update({
          ultima_interacao_whatsapp: now,
          last_inbound_at: now,
          last_pix_error: null,
        })
        .eq("id", winner.id);
    }

    console.log("[INBOUND] ✅ Updated last_inbound_at for", {
      winner_ids: winners.map((w) => w.id),
      timestamp: now,
    });

    // ── 7. Check auto-send config ──
    const { data: autoSendConfig } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "AUTO_SEND_RECEIPT_ON_INBOUND")
      .maybeSingle();

    const autoSendEnabled = autoSendConfig?.value !== "false";

    const primaryWinner = winners[0];

    if (!autoSendEnabled) {
      console.log("[INBOUND] ℹ️ Auto-send disabled, skipping receipt delivery");
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        auto_send: false,
        normalized_phone: phoneE164,
        winner_id: primaryWinner.id,
        action_id_resolved: primaryWinner.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: true,
      });
    }

    // ── 8. Filter candidates for auto-send ──
    const candidates = winners
      .filter((w) => w.status === "receipt_attached" && !w.receipt_sent_at && w.receipt_url)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log("[INBOUND] 📋 Auto-send candidates", {
      total_winners: winners.length,
      eligible_candidates: candidates.length,
      candidate_ids: candidates.map((c) => c.id),
    });

    if (candidates.length > 1) {
      for (let i = 1; i < candidates.length; i++) {
        await serviceClient
          .from("winners")
          .update({
            last_pix_error: `Conflito: múltiplos ganhadores com mesmo telefone. Comprovante enviado para ${candidates[0].name} (mais recente).`,
          })
          .eq("id", candidates[i].id);
      }
    }

    const target = candidates[0];
    if (!target) {
      console.log("[INBOUND] ℹ️ No eligible candidates for auto-send (no receipt_attached without receipt_sent_at)");
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        normalized_phone: phoneE164,
        winner_id: primaryWinner.id,
        action_id_resolved: primaryWinner.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: true,
      });
    }

    // ── 9. Extract receipt path ──
    const receiptPath = extractStoragePath(target.receipt_url || "");
    if (!receiptPath) {
      console.error("[INBOUND] ❌ Could not extract receipt path", { receipt_url: target.receipt_url });
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        error: "Could not extract receipt path",
        normalized_phone: phoneE164,
        winner_id: target.id,
        action_id_resolved: target.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: true,
      });
    }

    // ── 10. Get action name and webhook URL ──
    const { data: action } = await serviceClient
      .from("actions")
      .select("name")
      .eq("id", target.action_id)
      .maybeSingle();

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
      console.error("[INBOUND] ❌ No webhook URL configured (UNNICHAT_COMPROVANTE / UNNICHAT_PIX)");
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        error: "No webhook configured",
        normalized_phone: phoneE164,
        winner_id: target.id,
        action_id_resolved: target.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: true,
      });
    }

    // ── 11. Download receipt from storage and encode as base64 ──
    const { data: fileData, error: fileError } = await svc.storage
      .from("receipts")
      .download(target.receipt_url!);

    if (fileError || !fileData) {
      console.error("[INBOUND] ❌ Failed to download receipt from storage:", fileError?.message);
      await svc.from("winners").update({
        last_pix_error: `Erro ao baixar comprovante: ${fileError?.message || "não encontrado"}`.substring(0, 500),
      }).eq("id", target.id);
      return jsonResponse({ ok: false, error: "Failed to download receipt from storage" });
    }

    const arrayBuf = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);

    const ext = (target.receipt_url || "").split(".").pop()?.toLowerCase() || "pdf";
    const mimeMap: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
    const mimeType = mimeMap[ext] || "application/octet-stream";
    const filename = (target.receipt_url || "").split("/").pop() || `comprovante.${ext}`;

    // ── 12. Send receipt via webhook ──
    const payload = {
      tel: target.phone_e164 || normalizePhoneE164(target.phone || "") || target.phone,
      nome: target.name,
      acao: action?.name || "",
      tipo_premio: target.prize_title,
      valor: String(target.value),
      comprovante_base64: base64Content,
      comprovante_mime: mimeType,
      comprovante_filename: filename,
      row_number: 0,
    };

    console.log("[INBOUND] 🚀 Sending receipt to UnniChat", {
      webhook_url: unnichatUrl.substring(0, 60) + "...",
      winner_id: target.id,
      winner_name: target.name,
      phone: target.phone,
    });

    const resp = await fetch(unnichatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let receiptsSent = 0;

    if (resp.ok) {
      await resp.text();
      await serviceClient
        .from("winners")
        .update({
          status: "receipt_sent",
          receipt_sent_at: now,
          last_outbound_at: now,
          last_pix_error: null,
          template_reopen_sent_at: null,
          template_reopen_count: 0,
          updated_at: now,
        })
        .eq("id", target.id);

      await serviceClient.from("action_audit_log").insert({
        action_id: target.action_id,
        action_name: action?.name || null,
        table_name: "winners",
        record_id: target.id,
        operation: "AUTO_SEND_RECEIPT",
        user_id: null,
        user_name: "Sistema (Inbound WhatsApp)",
        user_role: null,
        changes: {
          winner_name: target.name,
          prize_title: target.prize_title,
          trigger: "whatsapp_inbound",
          phone_e164: phoneE164,
          message_preview: message?.substring(0, 100) ?? null,
          status: { before: "receipt_attached", after: "receipt_sent" },
        },
      });

      receiptsSent++;
      console.log("[INBOUND] ✅ Receipt sent successfully", {
        winner_id: target.id,
        status_changed: "receipt_attached → receipt_sent",
      });
    } else {
      const errText = await resp.text();
      console.error("[INBOUND] ❌ Receipt send FAILED", {
        status: resp.status,
        statusText: resp.statusText,
        response: errText.substring(0, 200),
        winner_id: target.id,
      });
      await serviceClient
        .from("winners")
        .update({
          last_pix_error: `AUTO_SEND_RECEIPT_FAILED (inbound): ${resp.status} ${resp.statusText}`.substring(0, 200),
        })
        .eq("id", target.id);
    }

    console.log("[INBOUND] 🏁 Processing complete", {
      matched: winners.length,
      receipts_sent: receiptsSent,
      fallback_used: fallbackUsed,
    });

    return jsonResponse({
      ok: true,
      matched: winners.length,
      receipts_sent: receiptsSent,
      normalized_phone: phoneE164,
      winner_id: target.id,
      action_id_resolved: target.action_id,
      fallback_used: fallbackUsed,
      inbound_window_open: true,
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
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
