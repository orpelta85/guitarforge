import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert guitar teacher and practice coach for GuitarForge, a guitar practice app for metal/rock guitarists.

Rules:
- Respond in Hebrew. Music terminology (BPM, scales, chord names, technique names like "alternate picking", "legato", "sweep picking") stays in English.
- Be encouraging but honest. Give specific, actionable advice.
- When suggesting exercises, reference real technique names and practice methods.
- When building practice plans, structure them day-by-day with specific exercises, durations, and BPM targets.
- Keep responses concise — 2-4 paragraphs max unless building a detailed plan.
- You know the user's profile and practice data (provided in context).
- If asked about songs, recommend from common metal/rock repertoire appropriate for their level.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context, history, apiKey } = body;

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return NextResponse.json({ error: "No valid API key provided" }, { status: 401 });
    }

    const messages = [
      ...(history || []).slice(-18).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20241022",
        max_tokens: 1024,
        system: `${SYSTEM_PROMPT}\n\nUser context: ${context || "No data available."}`,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Claude API error: ${res.status}`, details: errText }, { status: res.status });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "No response generated.";

    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
