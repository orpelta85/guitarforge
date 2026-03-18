import { NextRequest, NextResponse } from "next/server";

// GET /api/youtube?q=search+query
// Returns first video ID by scraping YouTube search results (no API key needed)
// If YOUTUBE_API_KEY is set, uses official API instead
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing 'q'" }, { status: 400 });

  const apiKey = process.env.YOUTUBE_API_KEY;

  // Method 1: Official API (if key exists)
  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(q)}&key=${apiKey}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((item: Record<string, Record<string, unknown>>) => ({
          videoId: (item.id as Record<string, unknown>)?.videoId,
          title: (item.snippet as Record<string, unknown>)?.title,
          channel: (item.snippet as Record<string, unknown>)?.channelTitle,
          thumbnail: ((item.snippet as Record<string, Record<string, Record<string, string>>>)?.thumbnails?.medium?.url) || "",
        }));
        return NextResponse.json({ items, fallback: false });
      }
    } catch {}
  }

  // Method 2: Scrape YouTube search page (no API key needed)
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        next: { revalidate: 3600 },
      }
    );
    if (res.ok) {
      const html = await res.text();
      // Extract video IDs from the page
      const ids: string[] = [];
      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        if (!ids.includes(match[1])) ids.push(match[1]);
        if (ids.length >= 5) break;
      }

      return NextResponse.json({
        items: ids.map((id) => ({ videoId: id, title: "", channel: "", thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg` })),
        fallback: true,
        searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      });
    }
  } catch {}

  // Fallback: return search URL only
  return NextResponse.json({
    items: [],
    fallback: true,
    searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  });
}
