import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

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
    const { phone } = body;

    if (!phone) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizePhone(phone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Find winners by phone
    const { data: winners, error: findErr } = await serviceClient
      .from("winners")
      .select("id, status, action_id, name, phone, prize_title, prize_type, value, receipt_url, receipt_sent_at, created_at")
      .not("phone", "is", null);

    if (findErr) {
      console.error("Error finding winners:", findErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matched = (winners || []).filter(
      (w) => normalizePhone(w.phone || "") === normalized
    );

    if (matched.length === 0) {
      return new Response(JSON.stringify({ ok: true, matched: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update ultima_interacao_whatsapp for all matched
    const now = new Date().toISOString();
    for (const winner of matched) {
      await serviceClient
        .from("winners")
        .update({ ultima_interacao_whatsapp: now })
        .eq("id", winner.id);
    }

    // Check auto-send config
    const { data: autoSendConfig } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "AUTO_SEND_RECEIPT_ON_INBOUND")
      .maybeSingle();

    const autoSendEnabled = autoSendConfig?.value !== "false";

    if (!autoSendEnabled) {
      return new Response(
        JSON.stringify({ ok: true, matched: matched.length, receipts_sent: 0, auto_send: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter candidates for auto-send: receipt_attached and not yet sent
    const candidates = matched
      .filter((w) => w.status === "receipt_attached" && !w.receipt_sent_at && w.receipt_url)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (candidates.length > 1) {
      // Log conflict on extras
      for (let i = 1; i < candidates.length; i++) {
        await serviceClient
          .from("winners")
          .update({ last_pix_error: `Conflito: múltiplos ganhadores com mesmo telefone. Comprovante enviado para ${candidates[0].name} (mais recente).` })
          .eq("id", candidates[i].id);
      }
    }

    let receiptsSent = 0;
    const target = candidates[0];
    if (!target) {
      return new Response(
        JSON.stringify({ ok: true, matched: matched.length, receipts_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get receipt path
    const receiptPath = extractStoragePath(target.receipt_url || "");
    if (!receiptPath) {
      return new Response(
        JSON.stringify({ ok: true, matched: matched.length, receipts_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get action name
    const { data: action } = await serviceClient
      .from("actions")
      .select("name")
      .eq("id", target.action_id)
      .maybeSingle();

    // Get webhook URL
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
      return new Response(
        JSON.stringify({ ok: true, matched: matched.length, receipts_sent: 0, error: "No webhook configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedErr } = await serviceClient.storage
      .from("receipts")
      .createSignedUrl(receiptPath, 7 * 24 * 60 * 60);

    if (signedErr || !signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ ok: true, matched: matched.length, receipts_sent: 0, error: "Signed URL failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to UnniChat
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
          status: { before: "receipt_attached", after: "receipt_sent" },
        },
      });

      receiptsSent++;
    } else {
      const errText = await resp.text();
      await serviceClient
        .from("winners")
        .update({ last_pix_error: `Erro auto-envio inbound: ${resp.status} ${resp.statusText}`.substring(0, 200) })
        .eq("id", target.id);
    }

    return new Response(
      JSON.stringify({ ok: true, matched: matched.length, receipts_sent: receiptsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Inbound error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/object\/(?:public|sign)\/receipts\/(.+?)(?:\?|$)/);
  if (match) return match[1];
  const match2 = url.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/(.+?)(?:\?|$)/);
  if (match2) return match2[1];
  if (!url.startsWith("http")) return url;
  return null;
}
