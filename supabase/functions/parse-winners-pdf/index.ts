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

    const prompt = `You are a precise data extraction expert. You will receive a PDF containing a table of prize winners.

The PDF has a structured table with these columns (in Portuguese):
- Nome (name)
- Telefone (phone)
- Tipo (prize type description, e.g. "Roleta Instantânea")
- Valor (value in BRL, e.g. "R$ 100,00")
- Data (date/time in DD/MM/YYYY HH:mm:ss format)

Sometimes the table may also include a "Cota" or "Título" column with a ticket/quota number.

CRITICAL RULES FOR ACCURATE EXTRACTION:
1. Extract EACH ROW independently. Do NOT mix data between rows.
2. The "Nome" column contains the winner's full name - copy it EXACTLY as shown.
3. The "Telefone" column contains the phone number - extract ONLY digits (remove parentheses, dashes, spaces).
4. The "Valor" column contains the prize value - convert "R$ 100,00" to 100.00 (use dot as decimal separator).
5. The "Data" column contains date/time - convert from "DD/MM/YYYY HH:mm:ss" to ISO 8601 with Brazil timezone: "YYYY-MM-DDTHH:mm:ss-03:00".
6. The "Tipo" column describes the prize type - extract it as-is into the "prize_type_label" field.
7. If there is a "Cota" or "Título" column, extract the number into the "title" field.

IMPORTANT:
- Process ALL pages of the PDF, extracting EVERY row.
- Keep each row's data aligned - the name, phone, value, and date must belong to the SAME person.
- Do NOT skip any rows. Do NOT merge rows.
- Do NOT invent or modify data. Extract exactly what is in the PDF.
- If there is a "CPF" column, extract the digits only (remove dots and dashes) into the "cpf" field. If no CPF column exists, set cpf to null.

Return ONLY a valid JSON object:
{
  "winners": [
    {
      "name": "string",
      "cpf": null,
      "phone": "string (digits only) or null",
      "value": number,
      "prize_datetime": "YYYY-MM-DDTHH:mm:ss-03:00",
      "title": "string or null",
      "prize_type_label": "string"
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
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract ALL winner records from this PDF table. Each row is one winner. Keep each row's data aligned correctly — name, phone, value, and date must belong to the same row. File: ${fileName || "report.pdf"}`,
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
