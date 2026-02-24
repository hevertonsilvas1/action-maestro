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

    // Webhook URL
    const { data: webhookConfig } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "UNNICHAT_COMPROVANTE")
      .maybeSingle();

    // Fallback to PIX webhook if no specific receipt webhook configured
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
        JSON.stringify({ error: "Webhook de envio de comprovante não configurado em Integrações." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { winner_id, winner_name, winner_phone, action_id, action_name, prize_title, prize_value, receipt_path } = body;

    if (!winner_id || !receipt_path) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify winner status
    const { data: currentWinner, error: fetchErr } = await serviceClient
      .from("winners")
      .select("status, receipt_url")
      .eq("id", winner_id)
      .maybeSingle();

    if (fetchErr || !currentWinner) {
      return new Response(
        JSON.stringify({ error: "Ganhador não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (currentWinner.status !== "receipt_attached") {
      return new Response(
        JSON.stringify({ error: `Status "${currentWinner.status}" não permite enviar comprovante. Necessário: "receipt_attached".` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL for the receipt
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("receipts")
      .createSignedUrl(receipt_path, 7 * 24 * 60 * 60); // 7 days

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar URL do comprovante." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to UnniChat
    const unnichatResponse = await fetch(unnichatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tel: winner_phone,
        nome: winner_name,
        acao: action_name,
        tipo_premio: prize_title,
        valor: String(prize_value),
        comprovante_url: signedUrlData.signedUrl,
        row_number: 0,
      }),
    });

    if (!unnichatResponse.ok) {
      const errText = await unnichatResponse.text();
      const errorMsg = `UnniChat: ${unnichatResponse.status} ${unnichatResponse.statusText}`.substring(0, 200);

      // Log failure
      await serviceClient.from("action_audit_log").insert({
        action_id,
        action_name,
        table_name: "winners",
        record_id: winner_id,
        operation: "comprovante_envio_erro",
        user_id: user.id,
        user_name: userName,
        user_role: userRole,
        changes: { winner_name, error: errorMsg },
      });

      // Save error on winner
      await serviceClient
        .from("winners")
        .update({ last_pix_error: `Erro envio comprovante: ${errorMsg}` })
        .eq("id", winner_id);

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await unnichatResponse.text();

    // Success: update status
    const now = new Date().toISOString();
    await serviceClient
      .from("winners")
      .update({
        status: "receipt_sent",
        receipt_sent_at: now,
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
      operation: "comprovante_enviado",
      user_id: user.id,
      user_name: userName,
      user_role: userRole,
      changes: {
        winner_name,
        prize_title,
        prize_value,
        channel: "UnniChat",
        status: { before: "receipt_attached", after: "receipt_sent" },
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Send receipt error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
