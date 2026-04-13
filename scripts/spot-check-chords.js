// Spot-check: pick 10 random chord sheets from Supabase and validate them.
// Run: node scripts/spot-check-chords.js

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
for (const l of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function validateSheet(sheet) {
  const issues = [];
  if (!sheet || sheet.length < 200) issues.push("too short (<200 chars)");
  const chordPattern = /\b[A-G](#|b)?(m|maj|min|sus|dim|add|aug)?\d*(\/[A-G](#|b)?)?\b/g;
  const chords = sheet.match(chordPattern) || [];
  if (chords.length < 5) issues.push(`only ${chords.length} chords detected`);
  const sections = sheet.match(/\[(Intro|Verse|Chorus|Bridge|Solo|Outro|Pre-Chorus|Interlude)/gi) || [];
  if (sections.length === 0) issues.push("no section headers");
  if (sheet.includes("NOT_FOUND")) issues.push("contains NOT_FOUND marker");
  if (sheet.includes("</")) issues.push("contains HTML tags");
  return issues;
}

(async () => {
  // Fetch total count
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/song_chords?select=song_id`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Prefer: "count=exact" }
  });
  const allIds = await countRes.json();
  console.log(`[spot-check] Total rows in DB: ${allIds.length}`);

  // Pick 10 random
  const shuffled = [...allIds].sort(() => Math.random() - 0.5).slice(0, 10);
  const ids = shuffled.map(r => r.song_id).join(",");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/song_chords?song_id=in.(${ids})&select=song_id,title,artist,chord_sheet,source`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
  });
  const rows = await res.json();

  let pass = 0, fail = 0;
  for (const row of rows) {
    const issues = validateSheet(row.chord_sheet);
    const status = issues.length === 0 ? "OK" : `FAIL (${issues.join("; ")})`;
    console.log(`[${row.song_id}] ${row.artist} - ${row.title} (${row.chord_sheet.length}ch, ${row.source}): ${status}`);
    if (issues.length === 0) pass++; else fail++;
  }
  console.log(`\n[spot-check] Pass=${pass}/10 Fail=${fail}/10`);
})();
