import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const winnerId = url.searchParams.get("id");

  if (!winnerId) {
    return new Response("Missing id", { status: 400 });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: winner } = await svc
    .from("winners")
    .select("receipt_url")
    .eq("id", winnerId)
    .maybeSingle();

  if (!winner?.receipt_url) {
    return new Response("Not found", { status: 404 });
  }

  const { data: signed, error } = await svc.storage
    .from("receipts")
    .createSignedUrl(winner.receipt_url, 7 * 24 * 60 * 60);

  if (error || !signed?.signedUrl) {
    return new Response("Error generating URL", { status: 500 });
  }

  return Response.redirect(signed.signedUrl, 302);
});
