import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.sunoapi.org/api/v1";
const API_KEY = process.env.SUNO_API_KEY || "";

interface StemResult {
  vocals?: string;
  instrumental?: string;
  guitar?: string;
  bass?: string;
  drums?: string;
}

// POST /api/suno/separate — separate audio into stems
export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { audioUrl, clipId } = body as { audioUrl?: string; clipId?: string };

    if (!audioUrl && !clipId) {
      return NextResponse.json({ error: "Provide audioUrl or clipId" }, { status: 400 });
    }

    // Start vocal separation task
    const payload: Record<string, unknown> = {};
    if (audioUrl) payload.audioUrl = audioUrl;
    if (clipId) payload.clipId = clipId;

    const genRes = await fetch(`${BASE}/vocal-removal/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!genRes.ok) {
      const text = await genRes.text().catch(() => "");
      throw new Error(`Suno separation error ${genRes.status}: ${text}`);
    }

    const genJson = await genRes.json();
    if (genJson.code !== 200) throw new Error(`Suno error: ${genJson.msg}`);

    const taskId = genJson.data?.taskId;
    if (!taskId) throw new Error("No taskId returned from separation API");

    // Poll for completion (max 3 minutes, check every 6s)
    let stems: StemResult | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 6000));

      const pollRes = await fetch(`${BASE}/vocal-removal/record-info?taskId=${taskId}`, {
        headers: { "Authorization": `Bearer ${API_KEY}` },
      });

      if (!pollRes.ok) continue;
      const pollJson = await pollRes.json();

      if (pollJson.data?.status === "SUCCESS") {
        const data = pollJson.data?.response || pollJson.data;
        stems = {
          vocals: data.vocals || data.vocalsUrl || data.vocal,
          instrumental: data.instrumental || data.instrumentalUrl || data.accomp || data.accompaniment,
          guitar: data.guitar || data.guitarUrl,
          bass: data.bass || data.bassUrl,
          drums: data.drums || data.drumsUrl,
        };
        break;
      }

      if (pollJson.data?.status === "FAILED") {
        throw new Error("Stem separation failed on the server");
      }
    }

    if (!stems) {
      return NextResponse.json(
        { error: "Separation timed out — task may still be processing", taskId },
        { status: 202 }
      );
    }

    // Filter out null/undefined stems
    const result: StemResult = {};
    if (stems.vocals) result.vocals = stems.vocals;
    if (stems.instrumental) result.instrumental = stems.instrumental;
    if (stems.guitar) result.guitar = stems.guitar;
    if (stems.bass) result.bass = stems.bass;
    if (stems.drums) result.drums = stems.drums;

    return NextResponse.json({ taskId, stems: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
