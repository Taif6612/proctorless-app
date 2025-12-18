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
  const raw = process.env.GEMINI_API_KEY;
  const apiKey = sanitize(raw);
  const hasPattern = (raw || "").includes("GEMINI_API_KEY");
  const eqIndex = (raw || "").lastIndexOf("=");
  const afterEq = eqIndex >= 0 ? (raw || "").slice(eqIndex + 1).slice(0, 4) : "";
  const info = {
    present: !!raw,
    sanitizedPresent: !!apiKey,
    length: apiKey.length,
    prefix: apiKey.slice(0, 4),
    suffix: apiKey.slice(-4),
    hasPattern,
    eqIndex,
    afterEqPrefix: afterEq,
  };
  try {
    // REST probe
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const rest = await fetch(url, { headers: { "x-goog-api-key": apiKey } });
    const restText = await rest.text();

    // SDK probe
    const genai = new GoogleGenAI({ apiKey });
    let sdkOk = false;
    let sdkErr: string | undefined;
    try {
      const r: any = await genai.models.generateContent({ model: "gemini-2.5-flash", contents: ["ping"] });
      sdkOk = !!(r?.text || r?.candidates);
    } catch (e: any) {
      sdkErr = String(e);
    }

    return NextResponse.json({ ok: rest.ok && sdkOk, rest: { ok: rest.ok, status: rest.status, body: restText.slice(0, 200) }, sdk: { ok: sdkOk, error: sdkErr }, key: info });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e), key: info }, { status: 500 });
  }
}