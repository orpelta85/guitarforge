import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

async function fetchFromGemini(title: string, artist: string) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

  const prompt = `Return the chords and lyrics for the song "${title}" by ${artist}.

STRICT FORMAT RULES:
- Output ONLY the chord sheet, nothing else. No intro, no explanation, no markdown.
- Put chords on their own line directly above the lyrics line, aligned above the syllable they fall on.
- Use standard chord names (e.g. Em, C, G, D, Am, F, A7, Dmaj7, Csus4, F#m).
- Use section headers in square brackets on their own line: [Intro], [Verse 1], [Chorus], [Bridge], [Solo], [Outro].
- Preserve original song structure and lyrics accurately.
- If you do not know this song or are uncertain, respond with exactly: NOT_FOUND

Example output format:
[Verse 1]
Em          D        C       G
So close, no matter how far
C              G            Em
Couldn't be much more from the heart

[Chorus]
D          C           G
Trust I seek and I find in you

Now output the chord sheet for "${title}" by ${artist}:`;

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
          })
        }
      );
      if (!res.ok) { lastError = `${model}:${res.status}`; continue; }
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastError = `${model}:empty`; continue; }
      const cleaned = text.trim().replace(/^```[\w]*\n?/, "").replace(/```$/, "").trim();
      if (cleaned === "NOT_FOUND" || cleaned.startsWith("NOT_FOUND")) return null;
      return cleaned;
    } catch (e) {
      lastError = `${model}:${String(e)}`;
    }
  }
  throw new Error(`Gemini all models failed: ${lastError}`);
}

const UG_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function fetchFromUG(title: string, artist: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${title} ${artist}`.trim());
    const searchRes = await fetch(
      `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`,
      { headers: { "User-Agent": UG_UA }, next: { revalidate: 86400 } }
    );
    if (!searchRes.ok) return null;
    const searchHtml = await searchRes.text();

    const searchDataMatch = searchHtml.match(/data-content="([^"]{500,})"/);
    if (!searchDataMatch) return null;
    const searchDecoded = decodeHtmlEntities(searchDataMatch[1]);

    const chordLinks = searchDecoded.match(/https:\/\/tabs\.ultimate-guitar\.com\/tab\/[^"\\]*chords[^"\\]*/gi);
    if (!chordLinks || chordLinks.length === 0) return null;

    const pageRes = await fetch(chordLinks[0], { headers: { "User-Agent": UG_UA } });
    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();

    const pageDataMatch = pageHtml.match(/data-content="([^"]{1000,})"/);
    if (!pageDataMatch) return null;
    const pageDecoded = decodeHtmlEntities(pageDataMatch[1]);

    const contentMatch = pageDecoded.match(/"content":"((?:\\.|[^"\\])*)"/);
    if (!contentMatch) return null;

    const content = contentMatch[1]
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\[ch\]/g, "")
      .replace(/\[\/ch\]/g, "")
      .replace(/\[tab\]/g, "")
      .replace(/\[\/tab\]/g, "")
      .trim();

    return content.length > 100 ? content : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, artist } = await req.json();
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

    const ug = await fetchFromUG(title, artist || "");
    if (ug && ug.length > 50) {
      return NextResponse.json({ chord_sheet: ug, source: "ultimate-guitar" });
    }

    const gem = await fetchFromGemini(title, artist || "");
    if (gem) {
      return NextResponse.json({ chord_sheet: gem, source: "gemini" });
    }

    return NextResponse.json({ error: "Not found in any source" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: "Fetch failed", detail: String(e) }, { status: 500 });
  }
}
