import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizePhone(raw: string): string {
  // Strip everything non-digit
  let digits = raw.replace(/\D/g, "");
  // Remove leading 55 (Brazil country code) if present and long enough
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  // Remove leading 0
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
    // Validate webhook secret
    const secret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("UNNICHAT_INBOUND_SECRET");

    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { phone, name, message, timestamp } = body;

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

    // Find winner by normalized phone (strip non-digits from DB phone too)
    const { data: winners, error: findErr } = await serviceClient
      .from("winners")
      .select("id, status, action_id, name, phone, prize_title, prize_type, value, receipt_url, receipt_sent_at")
      .not("phone", "is", null);

    if (findErr) {
      console.error("Error finding winners:", findErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Match by normalized phone
    const matched = (winners || []).filter(
      (w) => normalizePhone(w.phone || "") === normalized
    );

    if (matched.length === 0) {
      return new Response(JSON.stringify({ ok: true, matched: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let receiptsSent = 0;

    for (const winner of matched) {
      // Update last interaction timestamp
      await serviceClient
        .from("winners")
        .update({ ultima_interacao_whatsapp: new Date().toISOString() })
        .eq("id", winner.id);

      // Auto-send receipt if status is receipt_attached and not yet sent
      if (winner.status === "receipt_attached" && !winner.receipt_sent_at) {
        // Get receipt path from URL
        const receiptPath = extractStoragePath(winner.receipt_url || "");
        if (!receiptPath) continue;

        // Get action name
        const { data: action } = await serviceClient
          .from("actions")
          .select("name")
          .eq("id", winner.action_id)
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

        if (!unnichatUrl) continue;

        // Generate signed URL
        const { data: signedUrlData, error: signedErr } = await serviceClient.storage
          .from("receipts")
          .createSignedUrl(receiptPath, 7 * 24 * 60 * 60);

        if (signedErr || !signedUrlData?.signedUrl) continue;

        // Send to UnniChat
        const resp = await fetch(unnichatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tel: winner.phone,
            nome: winner.name,
            acao: action?.name || "",
            tipo_premio: winner.prize_title,
            valor: String(winner.value),
            comprovante_url: signedUrlData.signedUrl,
            row_number: 0,
          }),
        });

        if (resp.ok) {
          await resp.text();
          const now = new Date().toISOString();
          await serviceClient
            .from("winners")
            .update({
              status: "receipt_sent",
              receipt_sent_at: now,
              last_pix_error: null,
              updated_at: now,
            })
            .eq("id", winner.id);

          // Audit
          await serviceClient.from("action_audit_log").insert({
            action_id: winner.action_id,
            action_name: action?.name || null,
            table_name: "winners",
            record_id: winner.id,
            operation: "comprovante_enviado_auto",
            user_id: null,
            user_name: "Sistema (Inbound WhatsApp)",
            user_role: null,
            changes: {
              winner_name: winner.name,
              prize_title: winner.prize_title,
              trigger: "whatsapp_inbound",
              status: { before: "receipt_attached", after: "receipt_sent" },
            },
          });

          receiptsSent++;
        } else {
          await resp.text();
        }
      }
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
  // Handle /object/public/receipts/... or /object/sign/receipts/...
  const match = url.match(/\/object\/(?:public|sign)\/receipts\/(.+?)(?:\?|$)/);
  if (match) return match[1];
  // Handle /storage/v1/object/...
  const match2 = url.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/(.+?)(?:\?|$)/);
  if (match2) return match2[1];
  // Fallback: just use the URL as-is if it looks like a path
  if (!url.startsWith("http")) return url;
  return null;
}
