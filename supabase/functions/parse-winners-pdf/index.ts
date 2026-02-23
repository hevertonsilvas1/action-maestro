import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: "PDF content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a data extraction expert. Analyze this PDF document which is an accumulated prize report from a sales system (relatório acumulado).

Extract ALL winner records found in the document. Each record should have:
- name: the winner's name
- cpf: CPF number (only digits, remove dots and dashes)
- phone: phone number (only digits, remove formatting)
- value: prize value as a number (e.g., 100.00)
- prize_datetime: date and time of the prize in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)
- prize_type: type of prize (e.g., "Giro Abençoado", "Hora Abençoada", "Bônus", etc.)

IMPORTANT:
- Extract EVERY single record, even if they appear repeated across pages
- CPF must be digits only (remove . and -)
- Phone must be digits only
- Value must be a valid number
- Date must be in ISO format
- If a field is missing or unreadable, set it to null

Return ONLY a valid JSON object with this exact structure:
{
  "winners": [
    {
      "name": "string",
      "cpf": "string or null",
      "phone": "string or null",
      "value": number,
      "prize_datetime": "string ISO or null",
      "prize_type": "string"
    }
  ],
  "total_found": number
}

Do NOT include any text outside the JSON. Do NOT use markdown code fences.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all winner records from this PDF report. File: ${fileName || "report.pdf"}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process PDF with AI", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse the JSON from AI response
    let parsed;
    try {
      // Remove potential markdown code fences
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
