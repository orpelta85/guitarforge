import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BASE = "https://guitarprotabs.org";

interface TabResult {
  song: string;
  artist: string;
  version: string;
  downloads: string;
  downloadUrl: string;
}

async function searchGuitarProTabs(query: string): Promise<TabResult[]> {
  const url = `${BASE}/search.php?search=${encodeURIComponent(query)}&in=songs&page=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  if (!res.ok) throw new Error(`Upstream returned status ${res.status}`);

  const html = await res.text();
  const results: TabResult[] = [];

  const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
    || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return results;

  const tbody = tableMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[1];
    if (row.includes("<th")) continue;

    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].trim());
    }
    if (cells.length < 2) continue;

    const linkMatch = cells[0].match(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1];
    const songName = linkMatch[2].replace(/<[^>]*>/g, "").trim();
    const downloadUrl = href.startsWith("http") ? href : `${BASE}/${href.replace(/^\//, "")}`;

    const artist = (cells[1] || "").replace(/<[^>]*>/g, "").trim();
    const version = cells.length > 2 ? cells[2].replace(/<[^>]*>/g, "").trim() : "";
    const downloads = cells.length > 3 ? cells[3].replace(/<[^>]*>/g, "").trim() : "";

    results.push({ song: songName, artist, version, downloads, downloadUrl });
  }

  return results;
}

export function registerTabTools(server: McpServer): void {
  server.registerTool(
    "gf_search_tabs",
    {
      title: "Search Guitar Pro Tabs",
      description: `Search guitarprotabs.org for Guitar Pro tabs.

Scrapes the search results page and returns matching tabs with download links.

Args:
  - query (string): Search query (song name, artist, or both)

Returns: Array of { song, artist, version, downloads, downloadUrl }`,
      inputSchema: {
        query: z.string().min(2).max(200).describe("Search query (song name, artist, or both)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      try {
        const results = await searchGuitarProTabs(query);

        if (results.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `No Guitar Pro tabs found for "${query}". Try a different search term or check the spelling.`,
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: results.length, results }, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Error searching tabs: ${error instanceof Error ? error.message : String(error)}. Check your internet connection and try again.`,
          }],
        };
      }
    }
  );
}
