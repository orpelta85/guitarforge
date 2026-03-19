/* Suno AI API Client
 * Works with gcui-art/suno-api self-hosted wrapper
 * Set SUNO_API_URL in .env.local to point to your deployment
 */

const BASE = process.env.SUNO_API_URL || "";

export interface SunoClip {
  id: string;
  audio_url: string;
  status: string;
  title: string;
  duration: number;
}

export async function generateTrack(tags: string, title: string): Promise<SunoClip[]> {
  if (!BASE) throw new Error("SUNO_API_URL not configured");

  const res = await fetch(`${BASE}/api/custom_generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "",
      tags,
      title,
      make_instrumental: true,
      wait_audio: false,
    }),
  });

  if (!res.ok) throw new Error(`Suno error: ${res.status}`);
  return res.json();
}

export async function pollClips(ids: string[]): Promise<SunoClip[]> {
  if (!BASE) throw new Error("SUNO_API_URL not configured");
  const res = await fetch(`${BASE}/api/get?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error(`Suno poll error: ${res.status}`);
  return res.json();
}

export async function checkCredits(): Promise<{ credits_left: number }> {
  if (!BASE) throw new Error("SUNO_API_URL not configured");
  const res = await fetch(`${BASE}/api/get_limit`);
  if (!res.ok) throw new Error(`Suno credits error: ${res.status}`);
  return res.json();
}

// Genre-specific prompt additions
const GENRE_TEMPLATES: Record<string, string> = {
  "Metal": "heavy metal instrumental, distorted rhythm guitar, double bass drums, aggressive, heavy",
  "Hard Rock": "hard rock instrumental, overdriven rhythm guitar, driving drums, powerful",
  "Classic Rock": "classic rock instrumental, warm distorted guitar, steady drums, groovy",
  "Blues": "12-bar blues instrumental, shuffle feel, walking bass, warm clean guitar, organ",
  "Jazz": "jazz combo instrumental, walking bass, ride cymbal, jazz comping guitar, smooth",
  "Grunge": "grunge instrumental, fuzzy distorted guitar, heavy drums, raw, gritty",
  "Stoner Rock": "stoner rock instrumental, fuzzy heavy riff, slow heavy drums, doom groove",
  "Punk Rock": "punk rock instrumental, fast power chords, driving drums, energetic, raw",
  "Neo-Classical": "neo-classical metal instrumental, orchestral, dramatic, classical influenced, sweep picking",
  "Funk": "funk instrumental, slap bass, wah guitar, tight groove, syncopated drums",
  "Country": "country instrumental, clean twangy guitar, steady drums, Nashville feel",
  "Flamenco": "flamenco instrumental, nylon string guitar, percussive, passionate, Spanish feel",
  "Acoustic": "acoustic instrumental, fingerpicking guitar, warm tone, natural, unplugged",
  "Progressive Metal": "progressive metal instrumental, odd time signatures, technical, heavy, dynamic",
  "Djent": "djent instrumental, polyrhythmic, 8-string guitar, tight palm mutes, heavy",
  "Death Metal": "death metal instrumental, blast beats, heavily distorted, brutal, aggressive",
  "Fusion": "jazz fusion instrumental, complex harmony, technical, funky, dynamic",
};

export function buildPrompt(scale: string, mode: string, style: string, bpm?: number): string {
  // Merge scale+mode into musical term: "A Phrygian" not "Am, Phrygian"
  const key = scale.replace(/m$/, "");
  const musicalKey = `${key} ${mode}`;

  const genreDesc = GENRE_TEMPLATES[style] || `${style} instrumental, rhythm guitar, drums`;

  const parts = [musicalKey, genreDesc, "backing track", "no vocals", "no lead guitar"];
  if (bpm) parts.push(`${bpm} BPM`);
  return parts.join(", ");
}

// Client-side IndexedDB cache for generated tracks
const DB_NAME = "guitarforge_suno_cache";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

export interface CachedTrack {
  cacheKey: string;
  clipId: string;
  audioBlob: Blob;
  audioUrl: string; // object URL for playback
  params: { scale: string; mode: string; style: string; bpm: number };
  createdAt: number;
  duration: number;
  title: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function buildCacheKey(exerciseId: number | string, style: string, scale: string, mode: string, bpm: number): string {
  return `suno-${exerciseId}-${style}-${scale}-${bpm}`.toLowerCase().replace(/[^a-z0-9-]/g, "_");
}

export async function getCachedTrack(cacheKey: string): Promise<CachedTrack | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey);
      req.onsuccess = () => {
        const result = req.result as CachedTrack | undefined;
        if (result && result.audioBlob) {
          result.audioUrl = URL.createObjectURL(result.audioBlob);
        }
        resolve(result || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function cacheTrack(entry: CachedTrack): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache write failure is non-critical
  }
}

export async function downloadAndCache(
  cacheKey: string,
  clipId: string,
  audioUrl: string,
  params: { scale: string; mode: string; style: string; bpm: number },
  duration: number,
  title: string
): Promise<CachedTrack> {
  const res = await fetch(audioUrl);
  const blob = await res.blob();
  const entry: CachedTrack = {
    cacheKey,
    clipId,
    audioBlob: blob,
    audioUrl: URL.createObjectURL(blob),
    params,
    createdAt: Date.now(),
    duration,
    title,
  };
  await cacheTrack(entry);
  return entry;
}
