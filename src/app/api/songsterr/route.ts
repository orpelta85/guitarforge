import { NextRequest, NextResponse } from "next/server";

// Proxy for Songsterr API (bypasses CORS)
// GET /api/songsterr?q=metallica
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });

  try {
    const res = await fetch(
      `https://www.songsterr.com/api/songs?size=20&pattern=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Songsterr API error", status: res.status }, { status: res.status });
    }

    const data = await res.json();

    const songs = (data as Array<Record<string, unknown>>).slice(0, 20).map((s: Record<string, unknown>) => ({
      id: s.songId,
      title: s.title,
      artist: s.artist || "",
      hasPlayer: s.hasPlayer,
      tracks: Array.isArray(s.tracks) ? (s.tracks as Array<Record<string, unknown>>).map((t: Record<string, unknown>) => ({
        instrument: t.instrument,
        name: t.name || "",
        views: t.views,
      })) : [],
      url: `https://www.songsterr.com/a/wsa/song?id=${s.songId}`,
    }));

    return NextResponse.json(songs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch from Songsterr" }, { status: 500 });
  }
}
