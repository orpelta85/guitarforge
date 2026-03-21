import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert guitar teacher and practice coach for GuitarForge, a guitar practice app for metal/rock guitarists.

Rules:
- Respond in English. Use music terminology naturally (BPM, scales, chord names, technique names).
- Be encouraging but honest. Give specific, actionable advice.
- When suggesting exercises, reference real technique names and practice methods.
- When building practice plans, structure them day-by-day with specific exercises, durations, and BPM targets.
- Keep responses concise — 2-4 paragraphs max unless building a detailed plan.
- You know the user's profile and practice data (provided in context).
- If asked about songs, recommend from common metal/rock repertoire appropriate for their level.

You can include structured actions in your response by placing them on their own line in this format:
[ACTION:navigate:practice]
[ACTION:navigate:learn]
[ACTION:navigate:studio]
[ACTION:navigate:songs]
[ACTION:suggest_exercises:Sweep]
[ACTION:suggest_exercises:Legato]
[ACTION:generate_backing:Metal:Am:120]

Only include actions when they are directly relevant to what you're advising. Don't force actions into every response.`;

// Rate limiting: simple in-memory store (resets on deploy)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // messages per day
const RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(sessionId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Gemini API (free default) ──
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  userMessage: string
): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
}

// ── Anthropic API (BYOK) ──
async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  userMessage: string
): Promise<string> {
  const allMessages = [
    ...messages.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
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
      system: systemPrompt,
      messages: allMessages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "No response generated.";
}

// ── OpenAI API (BYOK) ──
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  userMessage: string
): Promise<string> {
  const allMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: allMessages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response generated.";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context, history, provider, byokKey } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const systemPrompt = `${SYSTEM_PROMPT}\n\nUser context:\n${context || "No data available."}`;

    const chatHistory = (history || []).slice(-18).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    // Determine which provider/key to use
    // Priority: 1) BYOK key, 2) Server-side Gemini key, 3) Server-side Anthropic key
    let responseText: string;

    if (byokKey && provider) {
      // BYOK path — user's own key
      const sessionId = `byok-${provider}`;
      if (!checkRateLimit(sessionId)) {
        return NextResponse.json({ error: "Rate limit exceeded (30 messages/day)" }, { status: 429 });
      }

      switch (provider) {
        case "anthropic":
          responseText = await callAnthropic(byokKey, systemPrompt, chatHistory, message);
          break;
        case "openai":
          responseText = await callOpenAI(byokKey, systemPrompt, chatHistory, message);
          break;
        case "gemini":
          responseText = await callGemini(byokKey, systemPrompt, chatHistory, message);
          break;
        default:
          return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }
    } else {
      // Server-side key path (free for all users)
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const anthropicKey = process.env.ANTHROPIC_API_KEY;

      if (geminiKey) {
        const sessionId = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "default";
        if (!checkRateLimit(sessionId)) {
          return NextResponse.json({ error: "Rate limit exceeded (30 messages/day). Try again tomorrow." }, { status: 429 });
        }
        responseText = await callGemini(geminiKey, systemPrompt, chatHistory, message);
      } else if (anthropicKey) {
        const sessionId = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "default";
        if (!checkRateLimit(sessionId)) {
          return NextResponse.json({ error: "Rate limit exceeded (30 messages/day). Try again tomorrow." }, { status: 429 });
        }
        responseText = await callAnthropic(anthropicKey, systemPrompt, chatHistory, message);
      } else {
        return NextResponse.json(
          { error: "No AI provider configured. Add GEMINI_API_KEY to .env.local or use BYOK in Profile settings." },
          { status: 503 }
        );
      }
    }

    // Parse actions from response
    const actions: { type: string; params: string[] }[] = [];
    const actionRegex = /\[ACTION:(\w+)(?::([^\]]+))?\]/g;
    let actionMatch;
    while ((actionMatch = actionRegex.exec(responseText)) !== null) {
      actions.push({
        type: actionMatch[1],
        params: actionMatch[2] ? actionMatch[2].split(":") : [],
      });
    }

    // Clean action tags from displayed text
    const cleanContent = responseText.replace(/\[ACTION:[^\]]+\]\n?/g, "").trim();

    return NextResponse.json({ content: cleanContent, actions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Coach API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
