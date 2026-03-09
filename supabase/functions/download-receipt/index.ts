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
    .select("receipt_url, receipt_filename")
    .eq("id", winnerId)
    .maybeSingle();

  if (!winner?.receipt_url) {
    return new Response("Not found", { status: 404 });
  }

  // Download the file from storage
  const { data: fileData, error } = await svc.storage
    .from("receipts")
    .download(winner.receipt_url);

  if (error || !fileData) {
    return new Response("Error downloading file", { status: 500 });
  }

  // Determine filename and content type
  const filename = winner.receipt_filename || winner.receipt_url.split("/").pop() || "comprovante.pdf";
  const contentType = fileData.type || "application/octet-stream";

  // Serve the file directly with proper Content-Disposition
  return new Response(fileData, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "public, max-age=604800",
    },
  });
});
