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
        const results = items.map((i: { videoId: string }) => i.videoId).filter(Boolean);
        return NextResponse.json({ items, results, fallback: false });
      }
    } catch {}
  }

  // Method 2: Scrape YouTube search page (no API key needed)
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAASAhAB&gl=US&hl=en&persist_gl=1&persist_hl=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        next: { revalidate: 0 },
      }
    );
    if (res.ok) {
      const html = await res.text();
      // Extract video IDs and titles from the page
      const items: { videoId: string; title: string; channel: string; thumbnail: string }[] = [];
      const seen = new Set<string>();

      // Try to extract from ytInitialData JSON
      const dataStart = html.indexOf('var ytInitialData = ');
      const dataMatch = dataStart !== -1 ? (() => {
        const jsonStart = dataStart + 'var ytInitialData = '.length;
        const jsonEnd = html.indexOf(';</script>', jsonStart);
        return jsonEnd !== -1 ? [null, html.slice(jsonStart, jsonEnd)] : null;
      })() : null;
      if (dataMatch) {
        try {
          const ytData = JSON.parse(dataMatch[1] as string);
          const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          if (contents) {
            for (const section of contents) {
              const renderers = section?.itemSectionRenderer?.contents || [];
              for (const r of renderers) {
                const v = r?.videoRenderer;
                if (v?.videoId && !seen.has(v.videoId)) {
                  seen.add(v.videoId);
                  items.push({
                    videoId: v.videoId,
                    title: v.title?.runs?.[0]?.text || "",
                    channel: v.ownerText?.runs?.[0]?.text || "",
                    thumbnail: v.thumbnail?.thumbnails?.pop()?.url || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
                  });
                  if (items.length >= 5) break;
                }
              }
              if (items.length >= 5) break;
            }
          }
        } catch { /* fall through to regex */ }
      }

      // Fallback: regex extract IDs only
      if (items.length === 0) {
        const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
          if (!seen.has(match[1])) {
            seen.add(match[1]);
            items.push({ videoId: match[1], title: "", channel: "", thumbnail: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` });
          }
          if (items.length >= 5) break;
        }
      }

      return NextResponse.json({
        items,
        results: items.map(i => i.videoId),
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
