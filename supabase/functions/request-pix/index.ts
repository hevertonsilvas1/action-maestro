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

const ALLOWED_STATUSES = ["imported", "pix_refused"];

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

    // Service client (bypasses RLS for audit logging + config reads)
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Read webhook URL from integration_configs table (manageable via UI)
    const { data: webhookConfig, error: configError } = await serviceClient
      .from("integration_configs")
      .select("value")
      .eq("key", "UNNICHAT_PIX")
      .maybeSingle();

    if (configError || !webhookConfig?.value) {
      return new Response(
        JSON.stringify({ error: "UNNICHAT_WEBHOOK_URL não configurada em Integrações." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unnichatUrl = webhookConfig.value;

    // Auth client (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Get user profile for audit
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("signature, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = profile?.signature || profile?.display_name || user.email || "Sistema";

    // Get user role
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const userRole = roleData?.role || null;

    const { winners } = await req.json() as { winners: WinnerPayload[] };

    if (!winners || winners.length === 0) {
      return new Response(
        JSON.stringify({ error: "No winners provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { winner_id: string; success: boolean; error?: string }[] = [];

    for (const w of winners) {
      try {
        // --- Idempotency check: re-read current status from DB ---
        const { data: currentWinner, error: fetchErr } = await serviceClient
          .from("winners")
          .select("status, last_pix_request_at")
          .eq("id", w.winner_id)
          .maybeSingle();

        if (fetchErr || !currentWinner) {
          throw new Error("Ganhador não encontrado no banco.");
        }

        if (!ALLOWED_STATUSES.includes(currentWinner.status)) {
          throw new Error(
            `Status "${currentWinner.status}" não permite solicitar PIX. Permitidos: ${ALLOWED_STATUSES.join(", ")}.`
          );
        }

        // Duplicate prevention: block if last request was < 30 seconds ago
        if (currentWinner.last_pix_request_at) {
          const lastReq = new Date(currentWinner.last_pix_request_at).getTime();
          const now = Date.now();
          if (now - lastReq < 30_000) {
            throw new Error("Solicitação duplicada. Aguarde 30 segundos entre tentativas.");
          }
        }

        // --- Normalize phone to E.164 ---
        const normalizedPhone = normalizePhoneE164(w.winner_phone) || w.winner_phone;

        // --- Send to UnniChat ---
        const unnichatResponse = await fetch(unnichatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tel: normalizedPhone,
            nome: w.winner_name,
            acao: w.action_name,
            tipo_premio: w.prize_title,
            valor: String(w.prize_value),
            row_number: 0,
          }),
        });

        if (!unnichatResponse.ok) {
          const errText = await unnichatResponse.text();
          const shortErr = `${unnichatResponse.status} ${unnichatResponse.statusText}`.substring(0, 100);
          throw new Error(`UnniChat: ${shortErr}`);
        }

        // Consume response body
        await unnichatResponse.text();

        // --- Success: Update winner status + tracking fields + clear error ---
        const now = new Date().toISOString();
        const { error: updateError } = await serviceClient
          .from("winners")
          .update({
            status: "pix_requested",
            updated_at: now,
            last_pix_request_at: now,
            last_pix_requested_by: userName,
            last_pix_error: null,
            last_outbound_at: now,
          })
          .eq("id", w.winner_id);

        if (updateError) {
          throw new Error(`DB update error: ${updateError.message}`);
        }

        // --- Audit log (success) ---
        await serviceClient.from("action_audit_log").insert({
          action_id: w.action_id,
          action_name: w.action_name,
          table_name: "winners",
          record_id: w.winner_id,
          operation: "pix_solicitado",
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          changes: {
            winner_name: w.winner_name,
            prize_title: w.prize_title,
            prize_value: w.prize_value,
            channel: "UnniChat",
            status_before: currentWinner.status,
            status_after: "pix_requested",
          },
        });

        results.push({ winner_id: w.winner_id, success: true });
      } catch (err) {
        console.error(`Error processing winner ${w.winner_id}:`, err);
        const errorMsg = err instanceof Error ? err.message : "Unknown error";

        // Save error on winner record (do NOT change status on failure)
        try {
          await serviceClient
            .from("winners")
            .update({
              last_pix_error: errorMsg,
              last_pix_request_at: new Date().toISOString(),
              last_pix_requested_by: userName,
            })
            .eq("id", w.winner_id);
        } catch (_) { /* ignore */ }

        // Audit log (failure)
        try {
          await serviceClient.from("action_audit_log").insert({
            action_id: w.action_id,
            action_name: w.action_name,
            table_name: "winners",
            record_id: w.winner_id,
            operation: "pix_solicitado_erro",
            user_id: userId,
            user_name: userName,
            user_role: userRole,
            changes: {
              winner_name: w.winner_name,
              error: errorMsg,
              channel: "UnniChat",
            },
          });
        } catch (_) { /* ignore audit log error */ }

        results.push({
          winner_id: w.winner_id,
          success: false,
          error: errorMsg,
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