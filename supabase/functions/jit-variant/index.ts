import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Question = {
  type?: string;
  prompt?: string;
  choices?: string[];
  correct_index?: number;
  max_marks?: number;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing secrets" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { quizId?: string; submissionId?: string; questions?: Question[] } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const quizId = String(payload.quizId || "");
  const submissionId = String(payload.submissionId || "");
  const questions: Question[] = Array.isArray(payload.questions) ? payload.questions : [];
  if (!quizId || !submissionId || questions.length === 0) {
    return new Response(JSON.stringify({ error: "Missing quizId, submissionId, or questions" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=" + apiKey;

  const variants: any[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] || {};
    const type = String(q.type || "text").toLowerCase();
    const prompt = String(q.prompt || "");
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const correctIndex = typeof q.correct_index === "number" ? q.correct_index : undefined;

    let variant: any = { type, prompt, choices, correct_index: correctIndex, max_marks: q.max_marks };

    try {
      const partsText = type === "mcq"
        ? `Rewrite this question stem with slight paraphrasing while preserving difficulty. Keep the core concept identical.
Stem: ${prompt}
Correct answer: ${typeof correctIndex === "number" && choices[correctIndex] !== undefined ? choices[correctIndex] : ""}
Distractors: ${(choices || []).filter((_, idx) => idx !== correctIndex).join(" | ")}
Return JSON: {"stem": string, "choices": string[], "correct_index": number}.`
        : `Rewrite this question in three slightly different ways keeping the core difficulty identical and avoiding keyword anchoring.
Question: ${prompt}
Return JSON: {"stem": string}.`;

      const body = { contents: [{ role: "user", parts: [{ text: partsText }]}] };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        const data = await r.json();
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (type === "mcq") {
            const vChoices = Array.isArray(parsed?.choices) ? parsed.choices : (choices || []);
            const vCorrect = typeof parsed?.correct_index === "number" ? parsed.correct_index : correctIndex;
            variant = { type, prompt: String(parsed?.stem || prompt), choices: vChoices, correct_index: vCorrect, max_marks: q.max_marks };
          } else {
            variant = { type, prompt: String(parsed?.stem || prompt), max_marks: q.max_marks };
          }
        }
      }
    } catch {}

    variants.push({ question_index: i, variant });
  }

  const rows = variants.map((v) => ({
    submission_id: submissionId,
    quiz_id: quizId,
    question_index: v.question_index,
    variant: v.variant,
    model: "gemini-2.5-flash-preview-09-2025",
  }));

  await supabase.from("generated_questions").upsert(rows, { onConflict: "submission_id,question_index" });

  return new Response(JSON.stringify({ ok: true, variants: rows }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});