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

    const { url, payload } = await req.json() as { url: string; payload?: Record<string, unknown> };

    if (!url || !url.startsWith("http")) {
      return new Response(
        JSON.stringify({ success: false, error: "URL inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const method = "POST";
    const requestPayload = payload || {
      nome: "Teste",
      tel: "5573999999999",
      acao: "Ação de teste",
      tipo_premio: "Teste",
      valor: 0,
      receipt_url: "https://example.com/receipt.pdf",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseBody = await response.text();

      return new Response(
        JSON.stringify({
          success: response.ok,
          url_called: url,
          http_method: method,
          payload_sent: requestPayload,
          status_code: response.status,
          status_text: response.statusText,
          status: response.status,
          statusText: response.statusText,
          response_body: responseBody.substring(0, 4000),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const message = fetchErr instanceof Error ? fetchErr.message : "Erro desconhecido";
      const isTimeout = message.includes("abort");

      return new Response(
        JSON.stringify({
          success: false,
          url_called: url,
          http_method: method,
          payload_sent: requestPayload,
          error: isTimeout ? "Timeout: webhook não respondeu em 10s" : message,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
