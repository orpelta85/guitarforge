import type { SongEntry } from "./types";
import { SPOTIFY_SONGS } from "./spotify-songs";

const MANUAL_SONGS: SongEntry[] = [
  { id: 1, title: "Master of Puppets", artist: "Metallica", album: "Master of Puppets", year: 1986, genre: "Thrash Metal", difficulty: "Advanced", tuning: "Standard", tempo: 212, key: "Em", songsterrUrl: "https://www.songsterr.com/a/wsa/metallica-master-of-puppets-tab-s455118" },
  { id: 2, title: "Enter Sandman", artist: "Metallica", album: "Metallica (Black Album)", year: 1991, genre: "Heavy Metal", difficulty: "Intermediate", tuning: "Standard", tempo: 123, key: "Em" },
  { id: 3, title: "Nothing Else Matters", artist: "Metallica", album: "Metallica (Black Album)", year: 1991, genre: "Ballad", difficulty: "Intermediate", tuning: "Standard", tempo: 46, key: "Em" },
  { id: 4, title: "Smoke on the Water", artist: "Deep Purple", album: "Machine Head", year: 1972, genre: "Hard Rock", difficulty: "Beginner", tuning: "Standard", tempo: 112, key: "Gm" },
  { id: 5, title: "Iron Man", artist: "Black Sabbath", album: "Paranoid", year: 1970, genre: "Heavy Metal", difficulty: "Intermediate", tuning: "Standard", tempo: 76, key: "Bm" },
];

// Merge manual + Spotify songs, deduplicating by title+artist
const seen = new Set<string>();
const merged: SongEntry[] = [];

for (const song of MANUAL_SONGS) {
  const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
  if (!seen.has(key)) {
    seen.add(key);
    merged.push(song);
  }
}

for (const song of SPOTIFY_SONGS) {
  const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
  if (!seen.has(key)) {
    seen.add(key);
    merged.push(song);
  }
}

export const SONG_LIBRARY: SongEntry[] = merged;
