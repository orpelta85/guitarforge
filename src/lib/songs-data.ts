import type { SongEntry } from "./types";
import { SPOTIFY_SONGS } from "./spotify-songs";

const MANUAL_SONGS: SongEntry[] = [
  { id: 1, title: "Master of Puppets", artist: "Metallica", album: "Master of Puppets", year: 1986, genre: "Thrash Metal", difficulty: "Advanced", tuning: "Standard", tempo: 212, key: "Em", songsterrUrl: "https://www.songsterr.com/a/wsa/metallica-master-of-puppets-tab-s455118" , gp: true, gpPath: "songs/metallica/Master Of Puppets.gp4"},
  { id: 2, title: "Enter Sandman", artist: "Metallica", album: "Metallica (Black Album)", year: 1991, genre: "Heavy Metal", difficulty: "Intermediate", tuning: "Standard", tempo: 123, key: "Em" , gp: true, gpPath: "songs/metallica/Enter Sandman (3).gp3"},
  { id: 3, title: "Nothing Else Matters", artist: "Metallica", album: "Metallica (Black Album)", year: 1991, genre: "Ballad", difficulty: "Intermediate", tuning: "Standard", tempo: 46, key: "Em" , gp: true, gpPath: "songs/metallica/Nothing Else Matters (6).gp4"},
  { id: 4, title: "Smoke on the Water", artist: "Deep Purple", album: "Machine Head", year: 1972, genre: "Hard Rock", difficulty: "Beginner", tuning: "Standard", tempo: 112, key: "Gm" , gp: true, gpPath: "songs/deep-purple/Smoke On The Water.gp4"},
  { id: 5, title: "Iron Man", artist: "Black Sabbath", album: "Paranoid", year: 1970, genre: "Heavy Metal", difficulty: "Intermediate", tuning: "Standard", tempo: 76, key: "Bm" , gp: true, gpPath: "songs/black-sabbath/Iron Man V6.gp3"},
  // Non-standard tunings
  { id: 6, title: "Killing in the Name", artist: "Rage Against the Machine", album: "Rage Against the Machine", year: 1992, genre: "Rap Metal", difficulty: "Intermediate", tuning: "Drop D", tempo: 105, key: "Dm" , gp: true, gpPath: "songs/rage-against-the-machine/Killing In The Name.gp3"},
  { id: 7, title: "Like a Stone", artist: "Audioslave", album: "Audioslave", year: 2002, genre: "Hard Rock", difficulty: "Intermediate", tuning: "Drop D", tempo: 70, key: "Am" , gp: true, gpPath: "songs/audioslave/Like A Stone V5.gp4"},
  { id: 8, title: "Sweet Child O' Mine", artist: "Guns N' Roses", album: "Appetite for Destruction", year: 1987, genre: "Hard Rock", difficulty: "Intermediate", tuning: "Eb Standard", tempo: 122, key: "D" , gp: true, gpPath: "songs/guns-n-roses/Sweet Child O Mine (4).gp4"},
  { id: 9, title: "Welcome to the Jungle", artist: "Guns N' Roses", album: "Appetite for Destruction", year: 1987, genre: "Hard Rock", difficulty: "Intermediate", tuning: "Eb Standard", tempo: 133, key: "E" , gp: true, gpPath: "songs/guns-n-roses/Welcome To The Jungle.gp3"},
  { id: 10, title: "Kashmir", artist: "Led Zeppelin", album: "Physical Graffiti", year: 1975, genre: "Hard Rock", difficulty: "Advanced", tuning: "DADGAD", tempo: 88, key: "D" , gp: true, gpPath: "songs/led-zeppelin/Kashmir.gp3"},
  { id: 11, title: "Black", artist: "Pearl Jam", album: "Ten", year: 1991, genre: "Grunge", difficulty: "Beginner", tuning: "Eb Standard", tempo: 76, key: "E" , gp: true, gpPath: "songs/pearl-jam/Black (2).gp4"},
  { id: 12, title: "Down in a Hole", artist: "Alice in Chains", album: "Dirt", year: 1992, genre: "Grunge", difficulty: "Intermediate", tuning: "Eb Standard", tempo: 69, key: "Em" , gp: true, gpPath: "songs/alice-in-chains/Down In A Hole V2.gp3"},
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
