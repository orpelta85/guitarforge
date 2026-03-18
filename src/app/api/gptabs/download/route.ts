import { NextRequest, NextResponse } from "next/server";

const BASE = "https://guitarprotabs.org";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing ?url= parameter" }, { status: 400 });

  // Only allow guitarprotabs.org URLs
  if (!url.startsWith(BASE)) {
    return NextResponse.json({ error: "Invalid URL — must be guitarprotabs.org" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });

    const html = await res.text();

    // Look for direct download links to GP files (.gp3, .gp4, .gp5, .gpx, .gp)
    const gpLinkRegex = /<a[^>]+href="([^"]*\.(?:gp[345x]?|gtp))"[^>]*>/gi;
    let match: RegExpExecArray | null;
    const links: string[] = [];

    while ((match = gpLinkRegex.exec(html)) !== null) {
      let href = match[1];
      if (!href.startsWith("http")) {
        href = href.startsWith("/") ? `${BASE}${href}` : `${BASE}/${href}`;
      }
      links.push(href);
    }

    // Also check for download buttons/links with common patterns
    const dlBtnRegex = /<a[^>]+href="([^"]*(?:download|getfile|dl)[^"]*)"[^>]*>/gi;
    while ((match = dlBtnRegex.exec(html)) !== null) {
      let href = match[1];
      if (!href.startsWith("http")) {
        href = href.startsWith("/") ? `${BASE}${href}` : `${BASE}/${href}`;
      }
      if (!links.includes(href)) links.push(href);
    }

    if (links.length === 0) {
      return NextResponse.json({ error: "No GP file download link found on page" }, { status: 404 });
    }

    return NextResponse.json({ downloadUrl: links[0], allLinks: links });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch page" }, { status: 500 });
  }
}
