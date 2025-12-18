import { NextRequest, NextResponse } from "next/server";

function parseQuestions(text: string) {
  const lines = text.replace(/\r/g, "").split(/\n/);
  const joined = lines.join("\n");
  const parts: { num: number; start: number; end: number }[] = [];
  const regex = /^\s*(\d+)[\).]\s+/gm;
  let m;
  const indices: number[] = [];
  while ((m = regex.exec(joined))) {
    indices.push(m.index);
  }
  if (indices.length === 0) {
    return [];
  }
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : joined.length;
    const chunk = joined.slice(start, end).trim();
    const numMatch = chunk.match(/^\s*(\d+)[\).]\s+/);
    const num = numMatch ? parseInt(numMatch[1], 10) : i + 1;
    const body = chunk.replace(/^\s*(\d+)[\).]\s+/, "");
    const choiceRegex = /^\s*([A-Da-d])[\).]\s+(.*)$/gm;
    const choices: string[] = [];
    let cm;
    while ((cm = choiceRegex.exec(body))) {
      choices.push(cm[2].trim());
    }
    const markRegex = /([\[(]?)(\d+)(\s*)(m|marks)([\])]?)/i;
    let maxMarks: number | null = null;
    const mm = body.match(markRegex);
    if (mm) {
      maxMarks = parseInt(mm[2], 10);
    }
    let type: "mcq" | "boolean" | "text" | "numeric" = "text";
    if (choices.length >= 2) {
      const tf = choices.map((c) => c.toLowerCase());
      if (tf.includes("true") && tf.includes("false")) {
        type = "boolean";
      } else {
        type = "mcq";
      }
    } else {
      const numericHint = /\b\d+(?:\.\d+)?\b/.test(body);
      type = numericHint ? "numeric" : "text";
    }
    const prompt = body.replace(markRegex, "").trim();
    parts.push({ num, start, end });
    (parts as any);
    (parts as any);
    (parts as any);
    (parts as any);
  }
  const result: any[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : joined.length;
    const chunk = joined.slice(start, end).trim();
    const numMatch = chunk.match(/^\s*(\d+)[\).]\s+/);
    const num = numMatch ? parseInt(numMatch[1], 10) : i + 1;
    const body = chunk.replace(/^\s*(\d+)[\).]\s+/, "");
    const choiceRegex = /^\s*([A-Da-d])[\).]\s+(.*)$/gm;
    const choices: string[] = [];
    let cm;
    while ((cm = choiceRegex.exec(body))) {
      choices.push(cm[2].trim());
    }
    const markRegex = /([\[(]?)(\d+)(\s*)(m|marks)([\])]?)/i;
    let maxMarks: number | null = null;
    const mm = body.match(markRegex);
    if (mm) {
      maxMarks = parseInt(mm[2], 10);
    }
    let type: "mcq" | "boolean" | "text" | "numeric" = "text";
    if (choices.length >= 2) {
      const tf = choices.map((c) => c.toLowerCase());
      if (tf.includes("true") && tf.includes("false")) {
        type = "boolean";
      } else {
        type = "mcq";
      }
    } else {
      const numericHint = /\b\d+(?:\.\d+)?\b/.test(body);
      type = numericHint ? "numeric" : "text";
    }
    const prompt = body.replace(markRegex, "").trim();
    result.push({ order_index: i + 1, prompt, type, choices: choices.length ? choices : undefined, max_marks: maxMarks });
  }
  return result;
}

async function callOcr(fileUrl: string, language?: string) {
  const apiKey = process.env.OPTIIC_API_KEY;
  if (!apiKey) {
    return { error: "Missing OPTIIC_API_KEY" };
  }
  const endpoint = process.env.OPTIIC_BASE_URL || "https://api.optiic.dev/ocr";
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url: fileUrl, language }),
    });
    if (!resp.ok) {
      return { error: `OCR request failed ${resp.status}` };
    }
    const data = await resp.json();
    const text = (data && (data.text || data.result?.text || data.data?.text)) || "";
    return { text };
  } catch (e: any) {
    return { error: String(e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fileUrl = body.fileUrl as string | undefined;
    const textInput = body.text as string | undefined;
    const language = body.language as string | undefined;
    let text = "";
    if (textInput && textInput.trim().length) {
      text = textInput;
    } else if (fileUrl) {
      const ocr = await callOcr(fileUrl, language);
      if ((ocr as any).error) {
        return NextResponse.json({ ok: false, error: (ocr as any).error }, { status: 500 });
      }
      text = (ocr as any).text || "";
    } else {
      return NextResponse.json({ ok: false, error: "fileUrl or text required" }, { status: 400 });
    }
    const questions = parseQuestions(text);
    return NextResponse.json({ ok: true, rawText: text, questions });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
