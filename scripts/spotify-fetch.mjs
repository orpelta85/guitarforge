#!/usr/bin/env node
/**
 * Spotify Song Fetcher for GuitarForge
 * Conservative rate limiting: 3s between requests, exponential backoff on 429.
 * Saves after each style for resumability.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_PATH = resolve(__dirname, "spotify-songs-raw.json");

const envContent = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let token = null;
let tokenExpiry = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  token = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

let backoffMs = 3000; // Start with 3s delay

async function spotifySearch(query, offset = 0) {
  const t = await getToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&offset=${offset}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(backoffMs);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });

    if (res.status === 200) {
      backoffMs = Math.max(2000, backoffMs - 500); // Slowly reduce delay on success
      return res.json();
    }

    if (res.status === 429) {
      backoffMs = Math.min(30000, backoffMs * 2); // Double delay on rate limit
      console.log(`  [429] Backoff → ${backoffMs / 1000}s`);
      continue;
    }

    if (res.status === 400 || res.status === 404) return null;
    return null;
  }
  return null;
}

const STYLE_QUERIES = {
  "Metal": [
    "Metallica", "Iron Maiden", "Judas Priest", "Megadeth",
    "Slayer", "Anthrax", "Pantera", "Black Sabbath",
    "Ozzy Osbourne", "Motorhead", "Kreator", "Testament",
    "Helloween", "Blind Guardian", "Sabaton",
    "Lamb of God", "Machine Head", "Trivium",
    "Killswitch Engage", "Avenged Sevenfold", "Disturbed",
    "System of a Down", "Rammstein", "Gojira", "Sepultura",
    "Five Finger Death Punch", "Volbeat",
  ],
  "Hard Rock": [
    "AC DC", "Guns N Roses", "Led Zeppelin", "Van Halen",
    "Deep Purple", "Aerosmith", "KISS", "Whitesnake",
    "Def Leppard", "Bon Jovi", "Scorpions", "ZZ Top",
    "Thin Lizzy", "Bad Company", "Foreigner", "Dokken",
  ],
  "Classic Rock": [
    "Pink Floyd", "Rolling Stones", "The Who",
    "Jimi Hendrix", "Lynyrd Skynyrd", "Eagles",
    "Fleetwood Mac", "The Doors", "Santana",
    "Kansas", "Rush", "Queen", "Journey",
    "Dire Straits", "Steely Dan", "Heart",
  ],
  "Blues": [
    "B.B. King", "Stevie Ray Vaughan", "Muddy Waters",
    "Buddy Guy", "Joe Bonamassa", "Gary Moore",
    "Eric Clapton", "John Lee Hooker",
    "Freddie King", "Kenny Wayne Shepherd", "Rory Gallagher",
    "Johnny Winter", "Robert Cray",
  ],
  "Jazz": [
    "Wes Montgomery", "Pat Metheny", "Joe Pass",
    "Django Reinhardt", "George Benson", "John Scofield",
    "Grant Green", "Kenny Burrell", "Larry Carlton",
    "Lee Ritenour", "Al Di Meola", "Julian Lage",
  ],
  "Grunge": [
    "Nirvana", "Alice In Chains", "Soundgarden",
    "Pearl Jam", "Stone Temple Pilots", "Mudhoney",
    "Melvins", "Temple of the Dog", "Silverchair",
  ],
  "Stoner Rock": [
    "Kyuss", "Queens of the Stone Age", "Electric Wizard",
    "Fu Manchu", "Monster Magnet", "Clutch", "Orange Goblin",
  ],
  "Punk Rock": [
    "Ramones", "The Clash", "Green Day", "Blink 182",
    "Bad Religion", "The Offspring", "NOFX",
    "Dead Kennedys", "Social Distortion", "Rancid",
    "Rise Against", "Sum 41", "Misfits",
  ],
  "Neo-Classical": [
    "Yngwie Malmsteen", "Jason Becker", "Marty Friedman",
    "Paul Gilbert", "Tony MacAlpine",
  ],
  "Funk": [
    "Red Hot Chili Peppers", "James Brown", "Prince",
    "Earth Wind Fire", "Stevie Wonder",
    "Jamiroquai", "Living Colour", "Vulfpeck",
  ],
  "Country": [
    "Brad Paisley", "Keith Urban", "Johnny Cash",
    "Willie Nelson", "Chris Stapleton",
    "Jason Isbell", "Zach Bryan", "Tyler Childers",
  ],
  "Flamenco": [
    "Paco de Lucia", "Rodrigo y Gabriela",
    "Jesse Cook", "Vicente Amigo", "Ottmar Liebert",
  ],
  "Acoustic": [
    "Tommy Emmanuel", "Andy McKee", "James Taylor",
    "Jack Johnson", "John Mayer", "Tracy Chapman",
    "Cat Stevens", "Damien Rice", "Jose Gonzalez",
  ],
  "Progressive Metal": [
    "Dream Theater", "Tool", "Opeth",
    "Symphony X", "Mastodon", "Porcupine Tree",
    "Queensryche", "Devin Townsend", "Haken",
  ],
  "Djent": [
    "Meshuggah", "Periphery", "TesseracT",
    "Animals as Leaders", "Polyphia", "Plini",
  ],
  "Death Metal": [
    "Cannibal Corpse", "Morbid Angel", "Arch Enemy",
    "In Flames", "At the Gates", "Dark Tranquillity",
    "Behemoth", "Amon Amarth", "Children of Bodom",
  ],
  "Fusion": [
    "Steve Vai", "Joe Satriani", "Jeff Beck",
    "Guthrie Govan", "Allan Holdsworth",
    "Buckethead", "Eric Johnson",
  ],
};

function cleanTitle(name) {
  return name
    .replace(/\s*\(feat\..*?\)/gi, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/\s*-\s*Remaster(ed)?.*$/i, "")
    .replace(/\s*-\s*\d{4}\s*(Remaster|Mix).*$/i, "")
    .replace(/\s*-\s*Live\b.*$/i, "")
    .replace(/\s*-\s*Bonus\b.*$/i, "")
    .replace(/\s*-\s*Deluxe\b.*$/i, "")
    .replace(/\s*-\s*Radio\s*Edit.*$/i, "")
    .replace(/\s*-\s*Single\s*Version.*$/i, "")
    .trim();
}

async function fetchSongs() {
  let allSongs = [];
  const seenTracks = new Set();
  const completedStyles = new Set();

  // Resume support
  if (existsSync(OUT_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(OUT_PATH, "utf-8"));
      if (existing.length > 0) {
        allSongs = existing;
        for (const s of allSongs) {
          seenTracks.add(`${s.title.toLowerCase()}|${s.artist.toLowerCase()}`);
          completedStyles.add(s.genre);
        }
        console.log(`Resuming: ${allSongs.length} songs, completed: ${[...completedStyles].join(", ")}\n`);
      }
    } catch {}
  }

  await getToken();
  console.log("Token OK\n");

  for (const [style, queries] of Object.entries(STYLE_QUERIES)) {
    if (completedStyles.has(style)) {
      console.log(`── ${style}: SKIP ──\n`);
      continue;
    }

    let styleCount = 0;
    console.log(`── ${style} (${queries.length} artists) ──`);

    for (const query of queries) {
      let added = 0;

      // Get 2 pages (20 tracks) per artist
      for (let offset = 0; offset < 20; offset += 10) {
        const data = await spotifySearch(query, offset);
        if (!data?.tracks?.items?.length) break;

        for (const track of data.tracks.items) {
          if (!track?.name || !track?.artists?.length) continue;
          const title = cleanTitle(track.name);
          if (!title) continue;

          const artist = track.artists[0].name;
          const dedupKey = `${title.toLowerCase()}|${artist.toLowerCase()}`;
          if (seenTracks.has(dedupKey)) continue;
          seenTracks.add(dedupKey);

          allSongs.push({
            title,
            artist,
            album: track.album?.name || "",
            year: track.album?.release_date ? parseInt(track.album.release_date.slice(0, 4), 10) : null,
            genre: style,
            popularity: track.popularity || 0,
            durationMs: track.duration_ms || 0,
          });
          added++;
          styleCount++;
        }

        if (data.tracks.items.length < 10) break;
      }

      if (added > 0) process.stdout.write(` ${query}:${added}`);
    }

    console.log(`\n  → ${styleCount} (total: ${seenTracks.size})`);
    writeFileSync(OUT_PATH, JSON.stringify(allSongs, null, 2));
    console.log(`  [saved]\n`);
  }

  // Final sort
  allSongs.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  writeFileSync(OUT_PATH, JSON.stringify(allSongs, null, 2));
  console.log(`\nDone! ${allSongs.length} unique songs saved.`);
}

fetchSongs().catch(console.error);
