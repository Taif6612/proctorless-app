import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

function sanitizeKey(raw?: string) {
  let s = (raw || "");
  s = s.replace(/^\uFEFF/, "").trim();
  const idx = s.lastIndexOf("=");
  if (s.includes("GEMINI_API_KEY") && idx >= 0) s = s.slice(idx + 1).trim();
  return s;
}

function buildPrompt(master: string, topic?: string, difficulty?: string, count?: number) {
  const c = Math.max(1, Math.min(10, count || 3));
  return (
    "You generate isomorphic exam questions that preserve deep structure while changing surface context. " +
    "Return STRICT JSON with shape {\"variations\":[{\"prompt\":string,\"type\":\"mcq\"|\"text\"|\"boolean\"|\"numeric\",\"choices\":string[]?,\"answer\":string?,\"solution_steps\":string[],\"max_marks\":number?,\"tags\":string[]?}]}. " +
    "Rules: keep the same underlying logical steps and difficulty, change context and numbers, ensure numeric constraints are valid. " +
    (topic ? ("Topic: " + topic + ". ") : "") +
    (difficulty ? ("Difficulty: " + difficulty + ". ") : "") +
    ("Generate " + c + " variations for: \n" + master)
  );
}

function buildSetPrompt(master: string, topic?: string, difficulty?: string, count?: number) {
  const c = Math.max(1, Math.min(10, count || 3));
  return (
    "You transform an entire exam text into isomorphic variants of the same caliber and deep structure, preserving logical steps while changing context. " +
    "Return STRICT JSON with shape {\"set_texts\":[string,string,...]} where each string is a FULL exam variant text (numbered items, choices if present). " +
    "Rules: keep difficulty and constraints consistent; do not invent unsolvable items; keep the structure compatible with standard parsing into numbered questions. " +
    (topic ? ("Topic: " + topic + ". ") : "") +
    (difficulty ? ("Difficulty: " + difficulty + ". ") : "") +
    ("Generate " + c + " full-text variants for this exam: \n" + master)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const master = String(body?.master || "").trim();
    const topic = body?.topic ? String(body.topic) : undefined;
    const difficulty = body?.difficulty ? String(body.difficulty) : undefined;
    const count = typeof body?.count === "number" ? body.count : undefined;
    const mode = (body?.mode && typeof body.mode === 'string') ? String(body.mode) : undefined;
    if (!master) return NextResponse.json({ ok: false, error: "master required" }, { status: 400 });
    const apiKey = sanitizeKey(process.env.GEMINI_API_KEY);
    if (!apiKey) return NextResponse.json({ ok: false, error: "Missing GEMINI_API_KEY" }, { status: 500 });
    const genai = new GoogleGenAI({ apiKey });
    const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
    const prompt = mode === 'set' ? buildSetPrompt(master, topic, difficulty, count) : buildPrompt(master, topic, difficulty, count);
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    let lastErr: any = null;
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response: any = await genai.models.generateContent({
            model,
            contents,
            config: { temperature: 0.2, maxOutputTokens: 1024 }
          } as any);
          const text = response?.text || response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n') || "";
          if (typeof text === "string" && text.length) {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) {
              try {
                const obj = JSON.parse(m[0]);
                if (mode === 'set') {
                  const sets = Array.isArray(obj?.set_texts) ? obj.set_texts : [];
                  return NextResponse.json({ ok: true, set_texts: sets });
                } else {
                  const arr = Array.isArray(obj?.variations) ? obj.variations : [];
                  return NextResponse.json({ ok: true, variations: arr });
                }
              } catch { }
            }
            return NextResponse.json({ ok: false, error: "Bad JSON", details: text }, { status: 500 });
          }
          lastErr = response;
        } catch (e: any) {
          lastErr = e;
          const msg = String(e || "");
          if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
            await new Promise(res => setTimeout(res, 600 * (attempt + 1)));
            continue;
          }
          if (msg.includes('404') || (e?.status === 404)) {
            try {
              const response: any = await genai.models.generateContent({
                model: 'gemini-1.5-pro',
                contents,
                config: { temperature: 0.2, maxOutputTokens: 1024 }
              } as any);
              const text = response?.text || response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n') || "";
              if (typeof text === "string" && text.length) {
                const m = text.match(/\{[\s\S]*\}/);
                if (m) {
                  try {
                    const obj = JSON.parse(m[0]);
                    if (mode === 'set') {
                      const sets = Array.isArray(obj?.set_texts) ? obj.set_texts : [];
                      return NextResponse.json({ ok: true, set_texts: sets });
                    } else {
                      const arr = Array.isArray(obj?.variations) ? obj.variations : [];
                      return NextResponse.json({ ok: true, variations: arr });
                    }
                  } catch { }
                }
              }
            } catch { }
          }
          break;
        }
      }
    }
    return NextResponse.json({ ok: false, error: "Gemini error", details: lastErr }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';
