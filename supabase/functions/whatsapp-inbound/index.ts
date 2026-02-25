import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return null;
}

const OPERATIONAL_STATUSES = [
  "pix_requested",
  "cliente_nao_responde",
  "numero_inexistente",
  "receipt_attached",
  "imported",
  "pix_received",
  "sent_to_batch",
];

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
    const secret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("UNNICHAT_INBOUND_SECRET");

    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // 1️⃣ Read phone from multiple payload shapes
    const phoneRaw: string | undefined =
      body.phone ?? body.data?.phoneNumber ?? body.data?.phone;
    const message: string | null =
      body.message ?? body.data?.lastMessage ?? body.data?.message ?? null;
    const actionId: string | undefined = body.action_id;

    if (!phoneRaw) {
      return new Response(
        JSON.stringify({ error: "phone is required", received_keys: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2️⃣ Normalize to E.164
    const phoneE164 = normalizePhoneE164(phoneRaw);
    if (!phoneE164) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format", raw: phoneRaw }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();
    let fallbackUsed = false;

    // 3️⃣ Matching: primary query by phone_e164 + optional action_id
    let query = serviceClient
      .from("winners")
      .select("id, status, action_id, name, phone, phone_e164, prize_title, prize_type, value, receipt_url, receipt_sent_at, created_at, last_outbound_at")
      .eq("phone_e164", phoneE164)
      .is("deleted_at", null);

    if (actionId) {
      query = query.eq("action_id", actionId);
    }

    const { data: matched, error: findErr } = await query;

    if (findErr) {
      console.error("Error finding winners:", findErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let winners = matched ?? [];

    // Fallback: if no results (or action_id was provided but no match), try without action_id with operational statuses
    if (winners.length === 0) {
      fallbackUsed = true;
      const { data: fallbackMatched } = await serviceClient
        .from("winners")
        .select("id, status, action_id, name, phone, phone_e164, prize_title, prize_type, value, receipt_url, receipt_sent_at, created_at, last_outbound_at")
        .eq("phone_e164", phoneE164)
        .is("deleted_at", null)
        .in("status", FALLBACK_STATUSES)
        .order("last_outbound_at", { ascending: false, nullsFirst: false })
        .limit(1);

      winners = fallbackMatched ?? [];
    }

    if (winners.length === 0) {
      return jsonResponse({
        ok: true,
        matched: 0,
        normalized_phone: phoneE164,
        fallback_used: fallbackUsed,
        winner_id: null,
        action_id_resolved: null,
      });
    }

    // 4️⃣ Update all matched: last_inbound_at + ultima_interacao_whatsapp
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

    // 5️⃣ Check auto-send config
    const { data: autoSendConfig } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "AUTO_SEND_RECEIPT_ON_INBOUND")
      .maybeSingle();

    const autoSendEnabled = autoSendConfig?.value !== "false";

    // Check inbound window
    const { data: windowConfig } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "INBOUND_WINDOW_HOURS")
      .maybeSingle();

    const windowHours = parseInt(windowConfig?.value || "24", 10);
    const primaryWinner = winners[0];
    const inboundWindowOpen = true; // they just messaged, window is open by definition

    if (!autoSendEnabled) {
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        auto_send: false,
        normalized_phone: phoneE164,
        winner_id: primaryWinner.id,
        action_id_resolved: primaryWinner.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: inboundWindowOpen,
      });
    }

    // Filter candidates for auto-send: receipt_attached and not yet sent
    const candidates = winners
      .filter((w) => w.status === "receipt_attached" && !w.receipt_sent_at && w.receipt_url)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        normalized_phone: phoneE164,
        winner_id: primaryWinner.id,
        action_id_resolved: primaryWinner.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: inboundWindowOpen,
      });
    }

    const receiptPath = extractStoragePath(target.receipt_url || "");
    if (!receiptPath) {
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        error: "Could not extract receipt path",
        normalized_phone: phoneE164,
        winner_id: target.id,
        action_id_resolved: target.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: inboundWindowOpen,
      });
    }

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
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        error: "No webhook configured",
        normalized_phone: phoneE164,
        winner_id: target.id,
        action_id_resolved: target.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: inboundWindowOpen,
      });
    }

    const { data: signedUrlData, error: signedErr } = await serviceClient.storage
      .from("receipts")
      .createSignedUrl(receiptPath, 7 * 24 * 60 * 60);

    if (signedErr || !signedUrlData?.signedUrl) {
      return jsonResponse({
        ok: true,
        matched: winners.length,
        receipts_sent: 0,
        error: "Signed URL failed",
        normalized_phone: phoneE164,
        winner_id: target.id,
        action_id_resolved: target.action_id,
        fallback_used: fallbackUsed,
        inbound_window_open: inboundWindowOpen,
      });
    }

    const resp = await fetch(unnichatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tel: target.phone,
        nome: target.name,
        acao: action?.name || "",
        tipo_premio: target.prize_title,
        valor: String(target.value),
        comprovante_url: signedUrlData.signedUrl,
        row_number: 0,
      }),
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
          updated_at: now,
        })
        .eq("id", target.id);

      await serviceClient.from("action_audit_log").insert({
        action_id: target.action_id,
        action_name: action?.name || null,
        table_name: "winners",
        record_id: target.id,
        operation: "comprovante_enviado_auto",
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
    } else {
      const errText = await resp.text();
      await serviceClient
        .from("winners")
        .update({
          last_pix_error: `Erro auto-envio inbound: ${resp.status} ${resp.statusText}`.substring(0, 200),
        })
        .eq("id", target.id);
    }

    return jsonResponse({
      ok: true,
      matched: winners.length,
      receipts_sent: receiptsSent,
      normalized_phone: phoneE164,
      winner_id: target.id,
      action_id_resolved: target.action_id,
      fallback_used: fallbackUsed,
      inbound_window_open: inboundWindowOpen,
    });
  } catch (err) {
    console.error("Inbound error:", err);
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
