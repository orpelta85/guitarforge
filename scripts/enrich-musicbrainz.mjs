#!/usr/bin/env node
/**
 * Enrich song library with MusicBrainz data
 * No API key needed! Just 1 request per second rate limit.
 * Adds: tags/genres, country, formation year, label, album year
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_FILE = resolve(__dirname, "../src/lib/spotify-songs.ts");
const OUT_FILE = resolve(__dirname, "enriched-songs.json");
const UA = "GuitarForge/1.0 (orpelta85@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Parse songs from TS file
function parseSongs() {
  const content = readFileSync(SONGS_FILE, "utf-8");
  const songs = [];
  const regex = /\{\s*id:\s*(\d+),\s*title:\s*"([^"]*)",\s*artist:\s*"([^"]*)",\s*album:\s*"([^"]*)",\s*year:\s*(\d+),\s*genre:\s*"([^"]*)",\s*difficulty:\s*"([^"]*)",\s*tuning:\s*"([^"]*)",\s*tempo:\s*(\d+),\s*key:\s*"([^"]*)"/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    songs.push({
      id: +m[1], title: m[2], artist: m[3], album: m[4], year: +m[5],
      genre: m[6], difficulty: m[7], tuning: m[8], tempo: +m[9], key: m[10],
    });
  }
  return songs;
}

// Cache artist lookups to avoid duplicate requests
const artistCache = {};

async function getArtistInfo(artistName) {
  if (artistCache[artistName]) return artistCache[artistName];

  await sleep(1100); // MusicBrainz: max 1 req/sec
  try {
    const r = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artistName)}&fmt=json&limit=1`,
      { headers: { "User-Agent": UA } }
    );
    if (r.status === 503) { await sleep(5000); return getArtistInfo(artistName); }
    if (!r.ok) return null;

    const d = await r.json();
    const a = d.artists?.[0];
    if (!a) return null;

    const info = {
      mbid: a.id,
      name: a.name,
      country: a.country || "",
      type: a.type || "",
      formed: a["life-span"]?.begin?.slice(0, 4) || "",
      tags: (a.tags || []).sort((x, y) => y.count - x.count).slice(0, 8).map((t) => t.name),
    };
    artistCache[artistName] = info;
    return info;
  } catch { return null; }
}

async function getRecordingInfo(title, artist) {
  await sleep(1100);
  try {
    const q = `${title} AND artist:${artist}`;
    const r = await fetch(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=1`,
      { headers: { "User-Agent": UA } }
    );
    if (r.status === 503) { await sleep(5000); return getRecordingInfo(title, artist); }
    if (!r.ok) return null;

    const d = await r.json();
    const rec = d.recordings?.[0];
    if (!rec) return null;

    return {
      duration: rec.length ? Math.round(rec.length / 1000) : null,
      firstRelease: rec["first-release-date"]?.slice(0, 4) || null,
      releases: (rec.releases || []).slice(0, 3).map((r) => ({
        album: r.title,
        date: r.date?.slice(0, 4) || "",
        country: r.country || "",
      })),
    };
  } catch { return null; }
}

async function main() {
  const songs = parseSongs();
  console.log(`Parsed ${songs.length} songs\n`);

  // Resume support
  let enriched = [];
  const processed = new Set();
  if (existsSync(OUT_FILE)) {
    try {
      enriched = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
      enriched.forEach((s) => processed.add(s.id));
      console.log(`Resuming: ${enriched.length} already done\n`);
    } catch {}
  }

  // Get unique artists first
  const uniqueArtists = [...new Set(songs.map((s) => s.artist))];
  console.log(`${uniqueArtists.length} unique artists to look up\n`);

  let artistsDone = 0;
  for (const artist of uniqueArtists) {
    if (artistCache[artist]) continue;
    const info = await getArtistInfo(artist);
    artistsDone++;
    if (info) {
      process.stdout.write(`[${artistsDone}/${uniqueArtists.length}] ${artist}: ${info.tags.slice(0, 3).join(", ")} (${info.country})\n`);
    } else {
      process.stdout.write(`[${artistsDone}/${uniqueArtists.length}] ${artist}: NOT FOUND\n`);
    }
  }

  console.log(`\nArtist lookup done. Now enriching songs...\n`);

  // Enrich songs with artist tags
  for (const song of songs) {
    if (processed.has(song.id)) continue;

    const artistInfo = artistCache[song.artist] || {};
    const enrichedSong = {
      ...song,
      artistCountry: artistInfo.country || "",
      artistFormed: artistInfo.formed || "",
      artistTags: (artistInfo.tags || []).join(", "),
      ytTutorial: `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to play ${song.title} ${song.artist} guitar tutorial`)}`,
    };

    enriched.push(enrichedSong);
    processed.add(song.id);
  }

  // Sort and save
  enriched.sort((a, b) => a.genre.localeCompare(b.genre) || a.artist.localeCompare(b.artist));
  writeFileSync(OUT_FILE, JSON.stringify(enriched, null, 2));
  console.log(`\nSaved ${enriched.length} enriched songs to ${OUT_FILE}`);

  // Stats
  const withTags = enriched.filter((s) => s.artistTags).length;
  const withCountry = enriched.filter((s) => s.artistCountry).length;
  console.log(`With tags: ${withTags}/${enriched.length}`);
  console.log(`With country: ${withCountry}/${enriched.length}`);
}

main().catch(console.error);
