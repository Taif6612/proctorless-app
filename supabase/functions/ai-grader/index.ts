import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { studentAnswer?: string; correctAnswer?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const studentAnswer = String(payload.studentAnswer ?? "");
  const correctAnswer = String(payload.correctAnswer ?? "");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=" + apiKey;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `You are an AI TA. Compare this student answer: ${studentAnswer} to the correct answer: ${correctAnswer}. Return a JSON object: {"score": number, "feedback": string}.`,
          },
        ],
      },
    ],
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    return new Response(JSON.stringify({ error: "Gemini error", details: text }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await r.json();
  let out: any = { score: 0, feedback: "" };
  try {
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      out = JSON.parse(match[0]);
    }
  } catch {}

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
