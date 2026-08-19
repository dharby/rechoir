// Suggest checklist entries + status options using Lovable AI
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { topic } = await req.json().catch(() => ({}));
    if (!topic || typeof topic !== "string" || topic.length > 200) {
      return new Response(JSON.stringify({ error: "topic required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `You help a choir/worship-team lead build a checklist.
Topic: "${topic}"

Return ONLY JSON in this exact shape:
{
  "entries": ["short task 1", "short task 2", ...],   // 4-8 concrete checklist items members will tick
  "statusOptions": ["option1","option2","option3"]    // 2-4 status labels members will pick from, tailored to the topic
}

Examples of statusOptions:
- Song readiness: ["Not ready","Almost ready","Ready"]
- Dues: ["I've paid","I've paid part","I've not paid"]
- Uniform: ["Have it","Need to wash","Missing"]
- Generic task: ["Not started","In progress","Done"]

Keep entries short (max ~60 chars). No markdown, no commentary.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "ai error", detail: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    let parsed: { entries?: string[]; statusOptions?: string[] } = {};
    try { parsed = JSON.parse(cleaned); } catch { /* ignore */ }
    const entries = Array.isArray(parsed.entries) ? parsed.entries.slice(0, 12).map((s) => String(s).slice(0, 120)) : [];
    const statusOptions = Array.isArray(parsed.statusOptions) ? parsed.statusOptions.slice(0, 6).map((s) => String(s).slice(0, 40)) : ["Not started", "In progress", "Done"];

    return new Response(JSON.stringify({ entries, statusOptions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
