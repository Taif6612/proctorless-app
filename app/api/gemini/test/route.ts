import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

function sanitize(raw?: string) {
  let s = (raw || "");
  s = s.replace(/^\uFEFF/, "");
  s = s.trim();
  if (s.includes("GEMINI_API_KEY")) {
    const idx = s.lastIndexOf("=");
    if (idx >= 0) s = s.slice(idx + 1).trim();
  }
  s = s.replace(/^YOUR_KEY/, "").trim();
  return s;
}

export async function GET() {
  const apiKey = sanitize(process.env.GEMINI_API_KEY);
  if (!apiKey) return NextResponse.json({ ok: false, error: "Missing GEMINI_API_KEY" }, { status: 400 });
  try {
    const genai = new GoogleGenAI({ apiKey });
    const response: any = await genai.models.generateContent({ model: "gemini-2.5-flash", contents: ["ping"] });
    const text = response?.text || JSON.stringify(response);
    return NextResponse.json({ ok: true, status: 200, body: text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
