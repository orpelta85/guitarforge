import { NextRequest, NextResponse } from "next/server";

const BASE = "https://guitarprotabs.org";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing ?q= parameter" }, { status: 400 });

  try {
    const res = await fetch(`${BASE}/search.php?search=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });

    const html = await res.text();
    const results: { song: string; artist: string; version: string; downloads: string; downloadUrl: string }[] = [];

    // Parse HTML table rows — each result row has: Song (link), Artist, Version, Downloads
    const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
      || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return NextResponse.json(results);

    const tbody = tableMatch[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tbody)) !== null) {
      const row = rowMatch[1];
      // Skip header rows
      if (row.includes("<th")) continue;

      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(cellMatch[1].trim());
      }
      if (cells.length < 2) continue;

      // Extract link from first cell (song name)
      const linkMatch = cells[0].match(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const href = linkMatch[1];
      const songName = linkMatch[2].replace(/<[^>]*>/g, "").trim();
      const downloadUrl = href.startsWith("http") ? href : `${BASE}/${href.replace(/^\//, "")}`;

      // Artist is typically second cell, version third, downloads fourth
      const artist = (cells[1] || "").replace(/<[^>]*>/g, "").trim();
      const version = cells.length > 2 ? cells[2].replace(/<[^>]*>/g, "").trim() : "";
      const downloads = cells.length > 3 ? cells[3].replace(/<[^>]*>/g, "").trim() : "";

      results.push({ song: songName, artist, version, downloads, downloadUrl });
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
