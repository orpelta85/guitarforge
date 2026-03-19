import { NextRequest, NextResponse } from "next/server";
import { generateTrack, pollTask, checkCredits, buildStyle } from "@/lib/suno";

const API_KEY = process.env.SUNO_API_KEY || "";

// POST /api/suno — generate a backing track
export async function POST(req: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 500 });

  try {
    const { scale, mode, style, bpm, title } = await req.json();

    if (!scale || !mode || !style) {
      return NextResponse.json({ error: "Missing scale, mode, or style" }, { status: 400 });
    }

    const tags = buildStyle(scale, mode, style, bpm);
    const trackTitle = (title || `${scale} ${mode} ${style} Backing Track`).slice(0, 80);
    const { taskId } = await generateTrack(tags, trackTitle, API_KEY);

    // Poll until complete (max 3 minutes, check every 8s)
    let tracks: Awaited<ReturnType<typeof pollTask>> = [];
    for (let i = 0; i < 22; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      tracks = await pollTask(taskId, API_KEY);
      if (tracks.length > 0) break;
    }

    if (tracks.length === 0) {
      return NextResponse.json({ error: "Generation timed out — track may still be processing", taskId }, { status: 202 });
    }

    return NextResponse.json({
      taskId,
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        audioUrl: t.audioUrl,
        streamAudioUrl: t.streamAudioUrl,
        duration: t.duration,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/suno — check credits
export async function GET() {
  if (!API_KEY) return NextResponse.json({ error: "SUNO_API_KEY not configured", configured: false }, { status: 200 });

  try {
    const credits = await checkCredits(API_KEY);
    return NextResponse.json({ credits_left: credits, configured: true });
  } catch (e) {
    return NextResponse.json({ error: String(e), configured: false }, { status: 200 });
  }
}
