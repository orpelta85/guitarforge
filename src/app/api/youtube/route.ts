import { NextRequest, NextResponse } from "next/server";

// Proxy for YouTube Data API v3 search
// GET /api/youtube?q=Am+backing+track
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing 'q' parameter" }, { status: 400 });

  const apiKey = process.env.YOUTUBE_API_KEY;

  // If no API key, return a search URL instead
  if (!apiKey) {
    return NextResponse.json({
      fallback: true,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%3D%3D`,
      items: [],
    });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&type=video&videoCategoryId=10&maxResults=8&` +
      `q=${encodeURIComponent(q)}&key=${apiKey}`,
      { next: { revalidate: 3600 } } // cache 1h
    );

    if (!res.ok) {
      return NextResponse.json({
        fallback: true,
        searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%3D%3D`,
        items: [],
        error: "YouTube API quota exceeded or error",
      });
    }

    const data = await res.json();
    const items = (data.items || []).map((item: Record<string, unknown>) => {
      const snippet = item.snippet as Record<string, unknown>;
      const id = item.id as Record<string, unknown>;
      const thumbs = snippet?.thumbnails as Record<string, unknown>;
      const medium = thumbs?.medium as Record<string, unknown>;
      return {
        videoId: id?.videoId,
        title: snippet?.title,
        channel: snippet?.channelTitle,
        thumbnail: medium?.url || "",
      };
    });

    return NextResponse.json({ items, fallback: false });
  } catch {
    return NextResponse.json({
      fallback: true,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%3D%3D`,
      items: [],
    });
  }
}
