import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

async function fetchBase64(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const ab = await r.arrayBuffer();
  const b64 = Buffer.from(ab).toString("base64");
  return b64;
}

function buildPrompt() {
  return (
    "You are an exam assistant. Extract all questions from the provided content and return strictly JSON. " +
    "Each question must be an object with fields: order_index (number), type ('mcq'|'text'|'boolean'|'numeric'), prompt (string), choices (array of strings, optional for MCQ/boolean), max_marks (number, optional). " +
    "Detect multiple-choice options (A/B/C/D), true/false, numeric, and free-text. If marks are indicated like '(5 marks)', include max_marks. " +
    "Respond ONLY with JSON in the shape: {\"questions\": [ ... ] }."
  );
}

function parseTextToQuestions(text: string) {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = [] as string[];
  for (const line of lines) {
    if (/^\s*\d+[\).\s]/.test(line)) {
      if (current.length > 0) { chunks.push(current.join("\n")); current = []; }
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current.join("\n"));

  const questions = [] as any[];
  let idx = 0;
  for (const chunk of chunks) {
    const promptMatch = chunk.match(/^\s*\d+[\).\s]+(.+?)(?:\n|$)/);
    const prompt = promptMatch ? promptMatch[1].trim() : chunk.trim().split(/\n/)[0] || `Question ${idx + 1}`;
    const choiceMatches = Array.from(chunk.matchAll(/\([A-D]\)\s*([^\n]+)/g)).map((m) => m[1].trim());
    const marksMatch = chunk.match(/\[(\d+)\]|\((\d+)\s*marks?\)/i);
    const maxMarks = marksMatch ? Number(marksMatch[1] || marksMatch[2]) : undefined;
    questions.push({ order_index: idx, type: choiceMatches.length > 0 ? 'mcq' : 'text', prompt, choices: choiceMatches, max_marks: maxMarks });
    idx++;
  }

  return questions;
}

function sanitizeGeminiKey(raw?: string) {
  let s = (raw || "");
  // Remove BOM if present
  s = s.replace(/^\uFEFF/, "");
  s = s.trim();
  if (s.includes("GEMINI_API_KEY")) {
    const idx = s.lastIndexOf("=");
    if (idx >= 0) s = s.slice(idx + 1).trim();
  }
  s = s.replace(/^YOUR_KEY/, "").trim();
  return s;
}

async function callGeminiImage(b64: string, mimeType: string) {
  const apiKey = sanitizeGeminiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) return { error: "Missing GEMINI_API_KEY" };
  try {
    const genai = new GoogleGenAI({ apiKey });
    const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
    const contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: b64 } },
          { text: buildPrompt() },
        ]
      }
    ];
    const maxOutputTokens = 1024;
    let lastErr: any = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response: any = await genai.models.generateContent({
            model,
            contents,
            generationConfig: { temperature: 0.1, maxOutputTokens },
          });
          const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (typeof text === "string" && text.length) {
            try {
              const m = text.match(/\{[\s\S]*\}/);
              const obj = m ? JSON.parse(m[0]) : {};
              return { result: obj };
            } catch {
              const fallback = parseTextToQuestions(text);
              if (fallback.length > 0) return { result: { questions: fallback } };
              return { error: "Parse JSON failed", details: text };
            }
          }
          const part = response?.candidates?.[0]?.content?.parts?.[0];
          if (part) {
            try { return { result: JSON.parse(JSON.stringify(part)) }; } catch {}
          }
          lastErr = response;
        } catch (e: any) {
          lastErr = e;
          const msg = String(e);
          if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
            await new Promise(res => setTimeout(res, 800 * (attempt + 1)));
            continue;
          }
          if (msg.includes('404') || (e?.status === 404)) {
            // Try a legacy model id once
            try {
              const response: any = await genai.models.generateContent({
                model: 'gemini-1.5-pro',
                contents,
                generationConfig: { temperature: 0.1, maxOutputTokens },
              });
              const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (typeof text === "string" && text.length) {
                try {
                  const m = text.match(/\{[\s\S]*\}/);
                  const obj = m ? JSON.parse(m[0]) : {};
                  return { result: obj };
                } catch {
                  const fallback = parseTextToQuestions(text);
                  if (fallback.length > 0) return { result: { questions: fallback } };
                }
              }
            } catch {}
          }
          break;
        }
      }
    }
    return { error: "Gemini error", details: lastErr };
  } catch (e: any) {
    return { error: String(e) };
  }
}

// Fallback OCR using Optiic
async function callOcr(fileUrl: string, language?: string) {
  const apiKey = process.env.OPTIIC_API_KEY;
  if (!apiKey) return { error: "Missing OPTIIC_API_KEY" };
  const endpoint = process.env.OPTIIC_BASE_URL || "https://api.optiic.dev/ocr";
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url: fileUrl, language }),
    });
    if (!resp.ok) return { error: `OCR request failed ${resp.status}` };
    const data = await resp.json();
    const text = (data && (data.text || data.result?.text || data.data?.text)) || "";
    return { text };
  } catch (e: any) {
    return { error: String(e) };
  }
}

// Shared text parser to questions
function parseQuestions(text: string) {
  const lines = text.replace(/\r/g, "").split(/\n/);
  const joined = lines.join("\n");
  const indices: number[] = [];
  const regex = /^\s*(\d+)[\).]\s+/gm;
  let m;
  while ((m = regex.exec(joined))) indices.push(m.index);
  if (indices.length === 0) return [] as any[];
  const result: any[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : joined.length;
    const chunk = joined.slice(start, end).trim();
    const numMatch = chunk.match(/^\s*(\d+)[\).]\s+/);
    const body = chunk.replace(/^\s*(\d+)[\).]\s+/, "");
    const choiceRegex = /^\s*([A-Da-d])[\).]\s+(.*)$/gm;
    const choices: string[] = [];
    let cm;
    while ((cm = choiceRegex.exec(body))) choices.push(cm[2].trim());
    const markRegex = /([\[(]?)(\d+)(\s*)(m|marks)([\])]?)/i;
    const mm = body.match(markRegex);
    const maxMarks = mm ? parseInt(mm[2], 10) : undefined;
    let type: "mcq" | "boolean" | "text" | "numeric" = "text";
    if (choices.length >= 2) {
      const tf = choices.map((c) => c.toLowerCase());
      type = tf.includes("true") && tf.includes("false") ? "boolean" : "mcq";
    } else {
      const numericHint = /\b\d+(?:\.\d+)?\b/.test(body);
      type = numericHint ? "numeric" : "text";
    }
    const prompt = body.replace(markRegex, "").trim();
    result.push({ order_index: i + 1, prompt, type, choices: choices.length ? choices : undefined, max_marks: maxMarks });
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fileUrl = body.fileUrl as string | undefined;
    const contentType = body.contentType as string | undefined;
    if (!fileUrl || !contentType) {
      return NextResponse.json({ ok: false, error: "fileUrl and contentType required" }, { status: 400 });
    }
    if (contentType.startsWith("image/")) {
      const b64 = await fetchBase64(fileUrl);
      const out = await callGeminiImage(b64, contentType);
      if ((out as any).error) {
        // Fallback: do OCR then parse locally
        const ocr = await callOcr(fileUrl);
        if ((ocr as any).error) {
          return NextResponse.json({ ok: false, error: (out as any).error, details: (out as any).details, fallbackError: (ocr as any).error }, { status: 500 });
        }
        const text = (ocr as any).text || "";
        const questions = parseQuestions(text);
        return NextResponse.json({ ok: true, questions, usedFallback: true });
      }
      const questions = (out as any).result?.questions || [];
      return NextResponse.json({ ok: true, questions });
    }
    // Non-image types: use OCR directly
    const ocr = await callOcr(fileUrl);
    if ((ocr as any).error) {
      return NextResponse.json({ ok: false, error: (ocr as any).error }, { status: 500 });
    }
    const text = (ocr as any).text || "";
    const questions = parseQuestions(text);
    return NextResponse.json({ ok: true, questions, usedFallback: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
export const runtime = 'nodejs';
import { Buffer } from 'node:buffer';
