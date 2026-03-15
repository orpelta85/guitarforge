import { NextRequest, NextResponse } from "next/server";
import { generateTrack, pollClips, checkCredits, buildPrompt } from "@/lib/suno";

// POST /api/suno — generate a backing track
export async function POST(req: NextRequest) {
  try {
    const { scale, mode, style, bpm, title } = await req.json();

    if (!scale || !mode || !style) {
      return NextResponse.json({ error: "Missing scale, mode, or style" }, { status: 400 });
    }

    const tags = buildPrompt(scale, mode, style, bpm);
    const trackTitle = title || `${scale} ${mode} ${style} Backing Track`;
    const clips = await generateTrack(tags, trackTitle);
    const ids = clips.map((c) => c.id);

    // Poll until complete (max 2 minutes)
    let result = clips;
    for (let i = 0; i < 24; i++) {
      if (result.every((c) => c.status === "complete")) break;
      await new Promise((r) => setTimeout(r, 5000));
      result = await pollClips(ids);
    }

    return NextResponse.json({
      tracks: result.map((c) => ({
        id: c.id,
        title: c.title,
        audioUrl: c.audio_url,
        duration: c.duration,
        status: c.status,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/suno — check credits
export async function GET() {
  try {
    const credits = await checkCredits();
    return NextResponse.json(credits);
  } catch (e) {
    return NextResponse.json({ error: String(e), configured: false }, { status: 200 });
  }
}
