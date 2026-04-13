// Bulk-fetch chord sheets for every song in SONG_LIBRARY from Ultimate Guitar
// and upsert to Supabase song_chords table. Resumable.
//
// Run:  node scripts/bulk-fetch-chords.js [--limit 100] [--start 0]

const fs = require("fs");
const path = require("path");

// ---- env ----
const envPath = path.join(__dirname, "..", ".env.local");
const envLines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
const env = {};
for (const l of envLines) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error("Missing Supabase env");

// ---- parse args ----
const args = process.argv.slice(2);
const LIMIT = parseInt((args.find(a => a.startsWith("--limit=")) || "").split("=")[1] || args[args.indexOf("--limit") + 1] || "100", 10);
const START = parseInt((args.find(a => a.startsWith("--start=")) || "").split("=")[1] || args[args.indexOf("--start") + 1] || "0", 10);
const DELAY_MS = 1200;

const UG_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function decodeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

async function fetchFromUG(title, artist) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`.trim());
    const searchRes = await fetch(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, {
      headers: { "User-Agent": UG_UA }
    });
    if (!searchRes.ok) return null;
    const searchHtml = await searchRes.text();
    const dm = searchHtml.match(/data-content="([^"]{500,})"/);
    if (!dm) return null;
    const decoded = decodeHtml(dm[1]);
    const chordLinks = decoded.match(/https:\/\/tabs\.ultimate-guitar\.com\/tab\/[^"\\]*chords[^"\\]*/gi);
    if (!chordLinks || chordLinks.length === 0) return null;

    const pageRes = await fetch(chordLinks[0], { headers: { "User-Agent": UG_UA } });
    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();
    const pm = pageHtml.match(/data-content="([^"]{1000,})"/);
    if (!pm) return null;
    const pageDecoded = decodeHtml(pm[1]);
    const cm = pageDecoded.match(/"content":"((?:\\.|[^"\\])*)"/);
    if (!cm) return null;

    const content = cm[1]
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\[ch\]/g, "")
      .replace(/\[\/ch\]/g, "")
      .replace(/\[tab\]/g, "")
      .replace(/\[\/tab\]/g, "")
      .trim();
    return content.length > 100 ? content : null;
  } catch {
    return null;
  }
}

// ---- supabase helpers via REST ----
async function supa(method, pathRel, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathRel}`, {
    method,
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${pathRel} ${res.status}: ${text}`);
  }
  // return=minimal yields empty body with 2xx - don't try to parse
  return null;
}

async function getExistingIds() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/song_chords?select=song_id&limit=20000`, {
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` }
  });
  if (!res.ok) throw new Error("Could not list existing");
  const rows = await res.json();
  return new Set(rows.map(r => r.song_id));
}

async function upsert(row) {
  await supa("POST", "song_chords", [row]);
}

// ---- load songs from compiled data ----
function loadSongs() {
  // The data is TypeScript - we load and parse manually.
  // Strategy: use regex to extract { id, title, artist } from spotify-songs.ts and songs-data.ts
  const manualSrc = fs.readFileSync(path.join(__dirname, "..", "src/lib/songs-data.ts"), "utf8");
  const spotifySrc = fs.readFileSync(path.join(__dirname, "..", "src/lib/spotify-songs.ts"), "utf8");

  const all = [];
  const seen = new Set();
  const songRe = /\{\s*id:\s*(\d+),\s*title:\s*"([^"]+)",\s*artist:\s*"([^"]+)"/g;

  for (const src of [manualSrc, spotifySrc]) {
    let m;
    while ((m = songRe.exec(src)) !== null) {
      const id = parseInt(m[1], 10);
      const title = m[2];
      const artist = m[3];
      const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ id, title, artist });
    }
  }
  return all;
}

// ---- main ----
(async () => {
  console.log(`[bulk-fetch] Start=${START} Limit=${LIMIT}`);
  const songs = loadSongs();
  console.log(`[bulk-fetch] Loaded ${songs.length} songs total`);

  const existing = await getExistingIds();
  console.log(`[bulk-fetch] Already in DB: ${existing.size}`);

  const queue = songs.slice(START).filter(s => !existing.has(s.id)).slice(0, LIMIT);
  console.log(`[bulk-fetch] Queue size for this run: ${queue.length}`);

  let ok = 0, fail = 0;
  const t0 = Date.now();

  for (let i = 0; i < queue.length; i++) {
    const song = queue[i];
    const pct = ((i / queue.length) * 100).toFixed(1);
    process.stdout.write(`[${i+1}/${queue.length} ${pct}%] ${song.artist} - ${song.title} ... `);
    try {
      const sheet = await fetchFromUG(song.title, song.artist);
      if (sheet) {
        await upsert({
          song_id: song.id,
          title: song.title,
          artist: song.artist,
          chord_sheet: sheet,
          source: "ultimate-guitar"
        });
        ok++;
        console.log(`OK (${sheet.length}ch)`);
      } else {
        fail++;
        console.log(`miss`);
      }
    } catch (e) {
      fail++;
      console.log(`err: ${e.message.substring(0, 100)}`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`\n[bulk-fetch] Done. OK=${ok} Fail=${fail} Elapsed=${elapsed}s`);
})();
