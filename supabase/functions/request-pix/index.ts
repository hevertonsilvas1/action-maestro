import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WinnerPayload {
  winner_id: string;
  winner_name: string;
  winner_phone: string;
  action_id: string;
  action_name: string;
  prize_type: string;
  prize_title: string;
  prize_value: number;
}

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

    // Try to read webhook URL from integration_configs table first, fallback to env var
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: configRow } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "N8N_WEBHOOK_URL")
      .maybeSingle();

    const n8nWebhookUrl = (configRow?.value && configRow.value.trim() !== "")
      ? configRow.value
      : Deno.env.get("N8N_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      return new Response(
        JSON.stringify({ error: "N8N_WEBHOOK_URL not configured. Configure em Configurações > Integrações." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Get user profile for logging
    const { data: profile } = await supabase
      .from("profiles")
      .select("signature, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = profile?.signature || profile?.display_name || claimsData.claims.email || "Sistema";

    const { winners } = await req.json() as { winners: WinnerPayload[] };

    if (!winners || winners.length === 0) {
      return new Response(
        JSON.stringify({ error: "No winners provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { winner_id: string; success: boolean; error?: string }[] = [];

    // Process each winner
    for (const w of winners) {
      try {
        // Send to n8n webhook
        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_id: w.action_id,
            action_name: w.action_name,
            winner_id: w.winner_id,
            winner_name: w.winner_name,
            winner_phone: w.winner_phone,
            prize_type: w.prize_type,
            prize_title: w.prize_title,
            prize_value: w.prize_value,
          }),
        });

        if (!n8nResponse.ok) {
          const errText = await n8nResponse.text();
          throw new Error(`n8n error [${n8nResponse.status}]: ${errText}`);
        }

        // Consume response body
        await n8nResponse.text();

        // Update winner status to pix_requested
        const { error: updateError } = await supabase
          .from("winners")
          .update({ status: "pix_requested", updated_at: new Date().toISOString() })
          .eq("id", w.winner_id);

        if (updateError) {
          throw new Error(`DB update error: ${updateError.message}`);
        }

        // Log success in audit
        const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await serviceClient.from("action_audit_log").insert({
          action_id: w.action_id,
          action_name: w.action_name,
          table_name: "winners",
          record_id: w.winner_id,
          operation: "pix_solicitado",
          user_id: userId,
          user_name: userName,
          user_role: null,
          changes: {
            winner_name: w.winner_name,
            prize_title: w.prize_title,
            prize_value: w.prize_value,
            channel: "n8n/UnniChat",
            status_before: "imported",
            status_after: "pix_requested",
          },
        });

        results.push({ winner_id: w.winner_id, success: true });
      } catch (err) {
        console.error(`Error processing winner ${w.winner_id}:`, err);

        // Log failure
        try {
          const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await serviceClient.from("action_audit_log").insert({
            action_id: w.action_id,
            action_name: w.action_name,
            table_name: "winners",
            record_id: w.winner_id,
            operation: "pix_solicitado_erro",
            user_id: userId,
            user_name: userName,
            user_role: null,
            changes: {
              winner_name: w.winner_name,
              error: err instanceof Error ? err.message : "Unknown error",
              channel: "n8n/UnniChat",
            },
          });
        } catch (_) { /* ignore audit log error */ }

        results.push({
          winner_id: w.winner_id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Request PIX error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
