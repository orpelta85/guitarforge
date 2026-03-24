#!/usr/bin/env node
/**
 * GuitarForge — Guitar Pro Tab Downloader
 *
 * Downloads .gp/.gp3/.gp4/.gp5/.gpx tabs from guitarprotabs.org
 * for all songs in the GuitarForge song library.
 *
 * Usage: node scripts/download-gp-tabs.mjs
 *
 * Features:
 * - Resume support via gp-download-progress.json
 * - Skips already-downloaded files
 * - 2-second delay between downloads
 * - Best-match title matching with download count preference
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Config ──────────────────────────────────────────────────────────────────
const DOWNLOAD_DIR = "C:\\Users\\User\\Downloads\\GuitarForge Library\\Songs GP";
const PROGRESS_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "gp-download-progress.json"
);
const BASE_URL = "https://guitarprotabs.org";
const DELAY_MS = 2000;
const PAGE_SIZE = 20; // songs per artist page on the site
const MAX_ARTIST_PAGES = 15; // safety limit

const SUPABASE_URL = "https://rmwaezujumikbukbirpt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtd2FlenVqdW1pa2J1a2JpcnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTE5MjksImV4cCI6MjA4OTYyNzkyOX0.FGusD1oWUS5e8zAPSB5-wm0cJg6yOCDK2ekdOGvw8Iw";
const SUPABASE_BUCKET = "gp-tabs";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPOTIFY_FILE = path.join(ROOT_DIR, "src/lib/spotify-songs.ts");
const MANUAL_FILE = path.join(ROOT_DIR, "src/lib/songs-data.ts");

// ── Load songs from the TS source files ─────────────────────────────────────
function loadSongs() {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  // Read and parse spotify-songs.ts
  const spotifyRaw = fs.readFileSync(
    path.join(rootDir, "src/lib/spotify-songs.ts"),
    "utf-8"
  );

  // Read and parse songs-data.ts manual songs
  const manualRaw = fs.readFileSync(
    path.join(rootDir, "src/lib/songs-data.ts"),
    "utf-8"
  );

  // Extract the array from spotify-songs.ts
  const spotifySongs = parseArrayFromTS(spotifyRaw, "SPOTIFY_SONGS");

  // Extract manual songs array
  const manualSongs = parseArrayFromTS(manualRaw, "MANUAL_SONGS");

  // Merge + deduplicate (same logic as songs-data.ts)
  const seen = new Set();
  const merged = [];

  for (const song of manualSongs) {
    const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(song);
    }
  }

  for (const song of spotifySongs) {
    const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(song);
    }
  }

  return merged;
}

function parseArrayFromTS(raw, varName) {
  // Find the array content between [ and the matching ]
  const regex = new RegExp(
    `(?:export\\s+)?(?:const|let|var)\\s+${varName}\\s*(?::\\s*[^=]+)?=\\s*\\[`,
    "s"
  );
  const match = raw.match(regex);
  if (!match) return [];

  const startIdx = match.index + match[0].length;

  // Find matching closing bracket
  let depth = 1;
  let i = startIdx;
  while (i < raw.length && depth > 0) {
    if (raw[i] === "[") depth++;
    if (raw[i] === "]") depth--;
    i++;
  }

  const arrayContent = raw.substring(startIdx, i - 1);

  // Parse individual objects using regex — more reliable than eval for TS
  const objects = [];
  const objRegex = /\{[^}]+\}/g;
  let objMatch;
  while ((objMatch = objRegex.exec(arrayContent)) !== null) {
    const objStr = objMatch[0];
    const obj = {};

    // Extract fields
    const fieldRegex = /(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|-?\d+(?:\.\d+)?|true|false)/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(objStr)) !== null) {
      const key = fieldMatch[1];
      let val = fieldMatch[2];
      // Strip quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith("`") && val.endsWith("`"))
      ) {
        val = val.slice(1, -1);
      } else if (val === "true") {
        val = true;
      } else if (val === "false") {
        val = false;
      } else {
        val = Number(val);
      }
      obj[key] = val;
    }

    if (obj.title && obj.artist) {
      objects.push(obj);
    }
  }

  return objects;
}

// ── Artist slug generation ──────────────────────────────────────────────────
function artistToSlug(artist) {
  let slug = artist.trim();

  // Handle "The X" → "x_(the)"
  const theMatch = slug.match(/^The\s+(.+)$/i);
  if (theMatch) {
    slug = `${theMatch[1]}_(the)`;
  }

  slug = slug
    .toLowerCase()
    .replace(/\//g, "") // AC/DC → acdc
    .replace(/['']/g, "") // Remove apostrophes
    .replace(/[&]/g, "and")
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[ç]/g, "c")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_()\-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return slug;
}

function artistFirstLetter(slug) {
  const ch = slug.charAt(0);
  if (/[0-9]/.test(ch)) return "0-9";
  return ch;
}

// ── Title normalization for matching ────────────────────────────────────────
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // strip parentheses content
    .replace(/\[.*?\]/g, "") // strip brackets content
    .replace(/[''""]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);

  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Word overlap
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;

  return union > 0 ? intersection / union : 0;
}

// ── Safe filename ───────────────────────────────────────────────────────────
function safeFilename(str) {
  return str
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Progress management ─────────────────────────────────────────────────────
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return { completed: {}, failed: {}, artistCache: {} };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Check if file already downloaded ────────────────────────────────────────
function alreadyDownloaded(artist, title) {
  const base = safeFilename(`${artist} - ${title}`);
  const exts = [".gp", ".gp3", ".gp4", ".gp5", ".gpx"];
  for (const ext of exts) {
    if (fs.existsSync(path.join(DOWNLOAD_DIR, base + ext))) {
      return true;
    }
  }
  return false;
}

// ── Main script ─────────────────────────────────────────────────────────────
async function main() {
  console.log("GuitarForge GP Tab Downloader");
  console.log("=".repeat(50));

  // Create download directory
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  // Load songs — only those missing a GP tab path
  const allSongs = loadSongs();
  const songs = allSongs.filter(s => !s.gpPath);
  console.log(`Loaded ${allSongs.length} songs total, ${songs.length} missing GP tab`);

  // Group by artist for efficient batch downloading
  const byArtist = new Map();
  for (const song of songs) {
    const key = song.artist;
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key).push(song);
  }
  console.log(`${byArtist.size} unique artists`);

  // Load progress
  const progress = loadProgress();

  // Count already done
  let skipCount = 0;
  for (const song of songs) {
    const songKey = `${song.artist}|${song.title}`;
    if (progress.completed[songKey] || alreadyDownloaded(song.artist, song.title)) {
      skipCount++;
    }
  }
  console.log(`${skipCount} songs already completed, ${songs.length - skipCount} remaining`);
  console.log("=".repeat(50));

  // Launch browser
  const browser = await chromium.launch({
    channel: "msedge",
    headless: false, // visible so we can see progress / handle captchas
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  });

  const page = await context.newPage();

  let processed = 0;
  let downloaded = 0;
  let failed = 0;
  let skipped = skipCount;

  // Process song by song — search by title directly
  for (const song of songs) {
    const songKey = `${song.artist}|${song.title}`;

    if (progress.completed[songKey] || alreadyDownloaded(song.artist, song.title)) continue;

    processed++;
    const idx = skipCount + processed;
    console.log(`\n[${idx}/${songs.length}] ${song.artist} - ${song.title}`);

    // Search by song title on the site
    const searchResults = await searchSongTabs(page, song.title, song.artist);

    // Find best matching tab
    const bestMatch = findBestMatch(song.title, searchResults);

    if (!bestMatch) {
      failed++;
      progress.failed[songKey] = "No matching tab found";
      console.log(`  \u2717 No match found`);
      saveProgress(progress);
      await delay(500);
      continue;
    }

    // Download the tab
    try {
      const result = await downloadTab(page, context, bestMatch, song.artist, song.title);
      if (result) {
        downloaded++;

        // Upload to Supabase storage
        let gpPath = null;
        try {
          const storagePath = buildStoragePath(song.artist, result.filename);
          const localPath = path.join(DOWNLOAD_DIR, result.filename);
          gpPath = await uploadToSupabase(localPath, storagePath);
          updateLibraryGpPath(song, gpPath);
        } catch (uploadErr) {
          console.log(`    ⚠ Upload failed: ${uploadErr.message}`);
        }

        progress.completed[songKey] = {
          file: result.filename,
          gpPath,
          url: bestMatch.url,
          matchedTitle: bestMatch.title,
          downloadedAt: new Date().toISOString(),
        };
        const ext = path.extname(result.filename).replace(".", "");
        const uploadStatus = gpPath ? "↑ uploaded" : "local only";
        console.log(`  \u2713 ${result.filename} (${ext}) ${uploadStatus}`);
      } else {
        failed++;
        progress.failed[songKey] = "Download failed";
        console.log(`  \u2717 Download failed`);
      }
    } catch (err) {
      failed++;
      progress.failed[songKey] = err.message;
      console.log(`  \u2717 Error: ${err.message}`);
    }

    saveProgress(progress);
    await delay(DELAY_MS);
  }


  // Final summary
  console.log("\n" + "=".repeat(50));
  console.log("COMPLETE");
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped (already had): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total processed: ${processed + skipped}/${songs.length}`);
  console.log(`  Progress file: ${PROGRESS_FILE}`);
  console.log(`  Download folder: ${DOWNLOAD_DIR}`);

  await browser.close();
}

// ── Search songs by title ────────────────────────────────────────────────────
async function searchSongTabs(page, title, artist) {
  const query = encodeURIComponent(title);
  const url = `${BASE_URL}/search.php?search=${query}&in=songs&page=1`;

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!response || response.status() >= 400) return [];

    const results = await page.evaluate((artistName) => {
      const rows = document.querySelectorAll("table tbody tr, .search-results tr");
      const items = [];

      for (const row of rows) {
        const link = row.querySelector("a[href]");
        if (!link) continue;
        const href = link.getAttribute("href") || "";
        if (href.includes("/download/") || !href) continue;

        const title = link.textContent?.trim() || "";
        if (!title) continue;

        // Try to get artist from row
        const cells = row.querySelectorAll("td");
        let rowArtist = "";
        let downloads = 0;
        for (const cell of cells) {
          const text = cell.textContent?.trim() || "";
          const num = parseInt(text.replace(/,/g, ""), 10);
          if (!isNaN(num) && num > 100) downloads = num;
          // Artist is often in a link in the second cell
          const artistLink = cell.querySelector("a");
          if (artistLink && artistLink !== link) rowArtist = artistLink.textContent?.trim() || "";
        }

        items.push({ title, url: href, downloads, artist: rowArtist });
      }

      return items;
    }, artist);

    // Prefer results where artist also matches
    return results;
  } catch {
    return [];
  }
}

// ── Scrape all tabs for an artist (all pages) ───────────────────────────────
async function scrapeArtistTabs(page, letter, slug) {
  const tabs = [];
  let pageNum = 1;

  while (pageNum <= MAX_ARTIST_PAGES) {
    const url = `${BASE_URL}/${letter}/${slug}/${pageNum}/`;

    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      if (!response || response.status() === 404) {
        if (pageNum === 1) return null; // artist doesn't exist
        break; // no more pages
      }

      // Check for "not found" content
      const content = await page.content();
      if (
        content.includes("Page not found") ||
        content.includes("404") && pageNum === 1
      ) {
        if (pageNum === 1) return null;
        break;
      }

      // Scrape song rows from the table
      const pageTabs = await page.evaluate(() => {
        const rows = document.querySelectorAll("table.table tbody tr, table tr");
        const results = [];

        for (const row of rows) {
          const link = row.querySelector("a[href]");
          if (!link) continue;

          const href = link.getAttribute("href");
          // Only tab links (they contain the song page path)
          if (!href || href.includes("/download/")) continue;

          const title = link.textContent?.trim() || "";
          if (!title) continue;

          // Try to find download count in the row
          const cells = row.querySelectorAll("td");
          let downloads = 0;
          for (const cell of cells) {
            const text = cell.textContent?.trim() || "";
            const num = parseInt(text.replace(/,/g, ""), 10);
            if (!isNaN(num) && num > 0 && cell !== cells[0]) {
              downloads = num;
            }
          }

          // Get file type info if available
          let fileType = "";
          for (const cell of cells) {
            const text = cell.textContent?.trim().toLowerCase() || "";
            if (
              text.includes("gp5") ||
              text.includes("gp4") ||
              text.includes("gp3") ||
              text.includes("gpx") ||
              text.includes("gp")
            ) {
              fileType = text;
            }
          }

          results.push({
            title,
            url: href.startsWith("http") ? href : href,
            downloads,
            fileType,
          });
        }

        return results;
      });

      if (pageTabs.length === 0 && pageNum > 1) break;

      tabs.push(...pageTabs);

      // Check if there might be more pages
      if (pageTabs.length < PAGE_SIZE) break;

      pageNum++;
      await delay(1000);
    } catch (err) {
      if (pageNum === 1) return null;
      break;
    }
  }

  return tabs.length > 0 ? tabs : (pageNum === 1 ? null : []);
}

// ── Find best matching tab from scraped list ────────────────────────────────
function findBestMatch(targetTitle, tabs, targetArtist = "") {
  if (!tabs || tabs.length === 0) return null;

  let bestScore = 0;
  let bestTab = null;

  for (const tab of tabs) {
    let score = titleSimilarity(targetTitle, tab.title);

    // Boost score if artist also matches
    if (targetArtist && tab.artist) {
      const artistScore = titleSimilarity(targetArtist, tab.artist);
      if (artistScore > 0.5) score += 0.2;
    }

    if (score > bestScore || (score === bestScore && bestTab && tab.downloads > bestTab.downloads)) {
      bestScore = score;
      bestTab = tab;
    }
  }

  // Require at least 0.5 similarity
  if (bestScore < 0.5) return null;

  return bestTab;
}

// ── Download a tab file ─────────────────────────────────────────────────────
async function downloadTab(page, context, tab, artist, songTitle) {
  // Build the download URL
  let tabUrl = tab.url;
  if (!tabUrl.startsWith("http")) {
    tabUrl = BASE_URL + (tabUrl.startsWith("/") ? "" : "/") + tabUrl;
  }

  // The download URL is the tab page URL + /download/
  const downloadUrl = tabUrl.endsWith("/")
    ? tabUrl + "download/"
    : tabUrl + "/download/";

  try {
    // Navigate to download URL — this triggers a file download
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.goto(downloadUrl, { waitUntil: "commit", timeout: 15000 }),
    ]);

    // Get suggested filename from the download
    const suggestedName = download.suggestedFilename();
    const ext = path.extname(suggestedName) || ".gp5";

    // Build our filename
    const filename = safeFilename(`${artist} - ${songTitle}`) + ext;
    const savePath = path.join(DOWNLOAD_DIR, filename);

    // Save the file
    await download.saveAs(savePath);

    // Verify file exists and has content
    const stats = fs.statSync(savePath);
    if (stats.size < 100) {
      // Too small, probably not a valid GP file
      fs.unlinkSync(savePath);
      return null;
    }

    return { filename, size: stats.size };
  } catch (err) {
    // If download event didn't fire, the page might have loaded normally
    // Try clicking a download button/link on the page
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10000 }),
        page.click('a[href*="download"], button:has-text("Download"), .download-btn', {
          timeout: 5000,
        }),
      ]);

      const suggestedName = download.suggestedFilename();
      const ext = path.extname(suggestedName) || ".gp5";
      const filename = safeFilename(`${artist} - ${songTitle}`) + ext;
      const savePath = path.join(DOWNLOAD_DIR, filename);

      await download.saveAs(savePath);

      const stats = fs.statSync(savePath);
      if (stats.size < 100) {
        fs.unlinkSync(savePath);
        return null;
      }

      return { filename, size: stats.size };
    } catch {
      throw new Error(`Download failed: ${err.message}`);
    }
  }
}

// ── Upload to Supabase storage ───────────────────────────────────────────────
async function uploadToSupabase(localPath, storagePath) {
  const fileBuffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === ".gpx" ? "application/xml" : "application/octet-stream";

  const url = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true", // overwrite if exists
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upload failed (${res.status}): ${err}`);
  }

  return storagePath;
}

// ── Update gpPath in the library TS files ────────────────────────────────────
function updateLibraryGpPath(song, gpPath) {
  // Determine which file to update
  const isManual = song.id <= 12; // MANUAL_SONGS have ids 1-12
  const filePath = isManual ? MANUAL_FILE : SPOTIFY_FILE;

  let content = fs.readFileSync(filePath, "utf-8");

  // Find the line with this song's id
  const idPattern = new RegExp(`(\\{[^}]*?id:\\s*${song.id},[^}]*?)(\\})`,"s");
  const match = content.match(idPattern);
  if (!match) return false;

  const objStr = match[1];
  // Skip if already has gpPath
  if (objStr.includes("gpPath")) return false;

  // Add gp: true and gpPath before closing brace
  const updated = content.replace(
    idPattern,
    `$1, gp: true, gpPath: "${gpPath}"$2`
  );

  fs.writeFileSync(filePath, updated, "utf-8");
  return true;
}

// ── Build Supabase storage path for a song ────────────────────────────────────
function buildStoragePath(artist, filename) {
  const artistSlug = artist
    .toLowerCase()
    .replace(/\//g, "")
    .replace(/['']/g, "")
    .replace(/[&]/g, "and")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `songs/${artistSlug}/${filename}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Run ─────────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
