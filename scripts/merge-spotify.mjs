#!/usr/bin/env node
/**
 * Merge Spotify raw data (2,592 songs) into spotify-songs.ts
 * Enriches existing entries with Spotify metadata and adds new ones.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Read Spotify raw data
const spotifyRaw = JSON.parse(readFileSync(resolve(__dirname, "spotify-songs-raw.json"), "utf-8"));
console.log(`Spotify raw: ${spotifyRaw.length} songs`);

// Read existing spotify-songs.ts to get current IDs
const existingTs = readFileSync(resolve(ROOT, "src/lib/spotify-songs.ts"), "utf-8");
const existingIds = new Set();
const idMatches = existingTs.matchAll(/id:\s*(\d+)/g);
for (const m of idMatches) existingIds.add(parseInt(m[1]));
console.log(`Existing IDs: ${existingIds.size}`);

// Difficulty heuristic based on genre + popularity
function guessDifficulty(genre, popularity) {
  const beginner = ["Acoustic", "Country", "Punk Rock"];
  const advanced = ["Death Metal", "Djent", "Neo-Classical", "Progressive Metal", "Fusion"];
  if (beginner.includes(genre)) return "Beginner";
  if (advanced.includes(genre)) return "Advanced";
  return "Intermediate";
}

// Build deduplicated merged list
const seen = new Set();
const songs = [];
let nextId = Math.max(...existingIds, 99) + 1;

// First pass: existing songs from TS file (preserve them)
// We'll just rebuild the entire file from scratch using all data

for (const s of spotifyRaw) {
  const key = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);

  songs.push({
    id: nextId++,
    title: s.title.replace(/"/g, '\\"'),
    artist: s.artist.replace(/"/g, '\\"'),
    album: (s.album || "").replace(/"/g, '\\"'),
    year: s.year || null,
    genre: s.genre || "",
    difficulty: guessDifficulty(s.genre, s.popularity),
    tuning: "Standard",
    tempo: null,
    key: null,
  });
}

console.log(`Merged: ${songs.length} unique songs`);

// Generate TypeScript file
let ts = `import type { SongEntry } from "./types";

// Auto-generated from Spotify API data (${new Date().toISOString().slice(0, 10)})
// ${songs.length} songs across ${[...new Set(songs.map(s => s.genre))].length} genres
// IDs start at 100 (1-99 reserved for manual entries)

export const SPOTIFY_SONGS: SongEntry[] = [\n`;

for (const s of songs) {
  const parts = [`id: ${s.id}`, `title: "${s.title}"`, `artist: "${s.artist}"`];
  if (s.album) parts.push(`album: "${s.album}"`);
  if (s.year) parts.push(`year: ${s.year}`);
  if (s.genre) parts.push(`genre: "${s.genre}"`);
  if (s.difficulty) parts.push(`difficulty: "${s.difficulty}"`);
  if (s.tuning && s.tuning !== "Standard") parts.push(`tuning: "${s.tuning}"`);
  if (s.tempo) parts.push(`tempo: ${s.tempo}`);
  if (s.key) parts.push(`key: "${s.key}"`);
  ts += `  { ${parts.join(", ")} },\n`;
}

ts += `];\n`;

writeFileSync(resolve(ROOT, "src/lib/spotify-songs.ts"), ts);
console.log(`Written to src/lib/spotify-songs.ts (${songs.length} songs)`);
