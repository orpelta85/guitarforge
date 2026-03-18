#!/usr/bin/env node
/**
 * Processes spotify-songs-raw.json into src/lib/spotify-songs.ts
 * Run this after spotify-fetch.mjs successfully completes.
 * This will MERGE with the existing curated library, not replace it.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ALWAYS_ADVANCED = ["Death Metal", "Djent", "Neo-Classical", "Progressive Metal"];

function mapKey(spotifyKey, spotifyMode) {
  if (spotifyKey === null || spotifyKey === undefined || spotifyKey < 0) return null;
  const note = KEY_NAMES[spotifyKey] || "C";
  const suffix = spotifyMode === 0 ? "m" : "";
  return `${note}${suffix}`;
}

function estimateDifficulty(tempo, genre) {
  if (ALWAYS_ADVANCED.includes(genre)) return "Advanced";
  if (!tempo) return "Intermediate";
  if (tempo < 100) return "Beginner";
  if (tempo <= 140) return "Intermediate";
  return "Advanced";
}

function makeYtUrl(title, artist) {
  const q = `how to play ${title} ${artist} guitar tutorial`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function main() {
  const rawPath = resolve(__dirname, "spotify-songs-raw.json");
  let raw;
  try {
    raw = JSON.parse(readFileSync(rawPath, "utf-8"));
  } catch {
    console.error("Cannot read spotify-songs-raw.json. Run spotify-fetch.mjs first.");
    process.exit(1);
  }

  console.log(`Read ${raw.length} raw songs`);

  // Dedup
  const seen = new Set();
  const deduped = [];
  for (const s of raw) {
    const key = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  console.log(`After dedup: ${deduped.length} songs`);

  // Sort by genre then popularity
  deduped.sort((a, b) => {
    if (a.genre !== b.genre) return a.genre.localeCompare(b.genre);
    return (b.popularity || 0) - (a.popularity || 0);
  });

  // Assign IDs starting at 2000 (to not conflict with curated library 100-1999)
  const entries = deduped.map((s, i) => ({
    id: 2000 + i,
    title: s.title,
    artist: s.artist,
    album: s.album || undefined,
    year: s.year || undefined,
    genre: s.genre,
    difficulty: estimateDifficulty(s.tempo, s.genre),
    tuning: "Standard",
    tempo: s.tempo || undefined,
    key: mapKey(s.spotifyKey, s.spotifyMode) || undefined,
    ytTutorial: makeYtUrl(s.title, s.artist),
  }));

  // Count per genre
  const genreCounts = {};
  for (const e of entries) genreCounts[e.genre] = (genreCounts[e.genre] || 0) + 1;
  console.log("\nSongs per genre:");
  for (const [g, c] of Object.entries(genreCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${g}: ${c}`);
  }

  // Read existing curated file to merge
  const existingPath = resolve(ROOT, "src/lib/spotify-songs.ts");
  let existingContent = "";
  try { existingContent = readFileSync(existingPath, "utf-8"); } catch {}

  // If existing file has curated data, append new entries
  // For now, generate a separate file that songs-data.ts will merge
  const outPath = resolve(ROOT, "src/lib/spotify-api-songs.ts");

  const lines = ['import type { SongEntry } from "./types";', "", "export const SPOTIFY_API_SONGS: SongEntry[] = ["];
  for (const e of entries) {
    const fields = [];
    fields.push(`id: ${e.id}`);
    fields.push(`title: "${escapeStr(e.title)}"`);
    fields.push(`artist: "${escapeStr(e.artist)}"`);
    if (e.album) fields.push(`album: "${escapeStr(e.album)}"`);
    if (e.year) fields.push(`year: ${e.year}`);
    if (e.genre) fields.push(`genre: "${escapeStr(e.genre)}"`);
    if (e.difficulty) fields.push(`difficulty: "${e.difficulty}"`);
    if (e.tuning) fields.push(`tuning: "${escapeStr(e.tuning)}"`);
    if (e.tempo) fields.push(`tempo: ${e.tempo}`);
    if (e.key) fields.push(`key: "${escapeStr(e.key)}"`);
    if (e.ytTutorial) fields.push(`ytTutorial: "${escapeStr(e.ytTutorial)}"`);
    lines.push(`  { ${fields.join(", ")} },`);
  }
  lines.push("];", "");

  writeFileSync(outPath, lines.join("\n"));
  console.log(`\nSaved ${entries.length} entries to ${outPath}`);
  console.log("Note: Update songs-data.ts to also import SPOTIFY_API_SONGS if needed.");
}

main();
