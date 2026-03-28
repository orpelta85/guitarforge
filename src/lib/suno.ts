/* Suno AI API Client
 * Uses sunoapi.org hosted API service
 * Set SUNO_API_KEY in .env.local
 */

const BASE = "https://api.sunoapi.org/api/v1";

export interface SunoTrack {
  id: string;
  audioUrl: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  title: string;
  duration: number;
}

export interface GenerateResult {
  taskId: string;
}

export async function generateTrack(style: string, title: string, apiKey: string): Promise<GenerateResult> {
  const res = await fetch(`${BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      customMode: true,
      instrumental: true,
      model: "V4_5",
      style,
      title,
      callBackUrl: "https://example.com/callback",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Suno generate error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Suno error: ${json.msg}`);
  return { taskId: json.data.taskId };
}

export async function pollTask(taskId: string, apiKey: string): Promise<SunoTrack[]> {
  const res = await fetch(`${BASE}/generate/record-info?taskId=${taskId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`Suno poll error: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Suno poll: ${json.msg}`);

  if (json.data?.status !== "SUCCESS") return [];

  return (json.data.response?.sunoData || []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    audioUrl: c.audioUrl as string,
    streamAudioUrl: c.streamAudioUrl as string,
    imageUrl: c.imageUrl as string,
    title: c.title as string,
    duration: c.duration as number,
  }));
}

export async function checkCredits(apiKey: string): Promise<number> {
  const res = await fetch(`${BASE}/generate/credit`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`Suno credits error: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Suno credits: ${json.msg}`);
  return json.data as number;
}

// Genre-specific style tags (max 200 chars for style field)
const GENRE_TEMPLATES: Record<string, string> = {
  "Metal": "heavy metal, distorted rhythm guitar, double bass drums, aggressive",
  "Hard Rock": "hard rock, overdriven rhythm guitar, driving drums, powerful",
  "Classic Rock": "classic rock, warm distorted guitar, steady drums, groovy",
  "Blues": "12-bar blues, shuffle feel, walking bass, warm clean guitar",
  "Jazz": "jazz combo, walking bass, ride cymbal, jazz comping guitar",
  "Grunge": "grunge, fuzzy distorted guitar, heavy drums, raw, gritty",
  "Stoner Rock": "stoner rock, fuzzy heavy riff, slow heavy drums, doom groove",
  "Punk Rock": "punk rock, fast power chords, driving drums, energetic",
  "Neo-Classical": "neo-classical metal, orchestral, dramatic, classical influenced",
  "Funk": "funk, slap bass, wah guitar, tight groove, syncopated drums",
  "Country": "country, clean twangy guitar, steady drums, Nashville feel",
  "Flamenco": "flamenco, nylon string guitar, percussive, passionate, Spanish",
  "Acoustic": "acoustic, fingerpicking guitar, warm tone, natural, unplugged",
  "Progressive Metal": "progressive metal, odd time signatures, technical, heavy",
  "Djent": "djent, polyrhythmic, 8-string guitar, tight palm mutes, heavy",
  "Death Metal": "death metal, blast beats, heavily distorted, brutal",
  "Fusion": "jazz fusion, complex harmony, technical, funky, dynamic",
};

export function buildStyle(scale: string, mode: string, style: string, bpm?: number): string {
  const key = scale.replace(/m$/, "");
  const musicalKey = `${key} ${mode}`;
  const genreDesc = GENRE_TEMPLATES[style] || `${style}, rhythm guitar, drums`;
  const parts = [musicalKey, genreDesc, "instrumental backing track, no vocals, no lead guitar"];
  if (bpm) parts.push(`${bpm} BPM`);
  return parts.join(", ").slice(0, 200);
}

// Client-side IndexedDB cache for generated tracks
const DB_NAME = "guitarforge_suno_cache";
const DB_VERSION = 2;
const STORE_NAME = "tracks";
const LIB_STORE = "library";

export interface CachedTrack {
  cacheKey: string;
  clipId: string;
  audioBlob: Blob;
  audioUrl: string;
  params: { scale: string; mode: string; style: string; bpm: number };
  createdAt: number;
  duration: number;
  title: string;
}

export interface LibraryTrack {
  id: string;
  audioBlob: Blob;
  audioUrl: string;
  title: string;
  style: string;
  params: { scale: string; mode: string; style: string; bpm: number };
  duration: number;
  createdAt: number;
  source: "generate" | "exercise";
  exerciseId?: number;
  favorite: boolean;
  rating?: 1 | -1;
  tags?: string[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
      if (!db.objectStoreNames.contains(LIB_STORE)) {
        const lib = db.createObjectStore(LIB_STORE, { keyPath: "id" });
        lib.createIndex("createdAt", "createdAt");
        lib.createIndex("favorite", "favorite");
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

// ── Library CRUD ──

export async function saveToLibrary(track: LibraryTrack): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIB_STORE, "readwrite");
      tx.objectStore(LIB_STORE).put(track);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* non-critical */ }
}

export async function getAllLibraryTracks(): Promise<LibraryTrack[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIB_STORE, "readonly");
      const req = tx.objectStore(LIB_STORE).index("createdAt").openCursor(null, "prev");
      const results: LibraryTrack[] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const t = cursor.value as LibraryTrack;
          if (t.audioBlob) t.audioUrl = URL.createObjectURL(t.audioBlob);
          results.push(t);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteFromLibrary(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIB_STORE, "readwrite");
      tx.objectStore(LIB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* non-critical */ }
}

export async function updateLibraryTrack(id: string, updates: Partial<Pick<LibraryTrack, "favorite" | "rating" | "tags">>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIB_STORE, "readwrite");
      const store = tx.objectStore(LIB_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as LibraryTrack | undefined;
        if (existing) {
          store.put({ ...existing, ...updates });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* non-critical */ }
}

export async function getLibraryStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const tracks = await getAllLibraryTracks();
    const totalBytes = tracks.reduce((sum, t) => sum + (t.audioBlob?.size || 0), 0);
    return { count: tracks.length, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

// ── YouTube Backing Tracks (localStorage) ──

export interface YtBackingTrack {
  id: string;
  videoId: string;
  title: string;
  searchQuery: string;
  style: string;
  scale: string;
  mode: string;
  savedAt: number;
  exerciseId?: number;
  exerciseName?: string;
}

const YT_BT_KEY = "gf-yt-backing-tracks";

export function saveYtBackingTrack(track: YtBackingTrack): void {
  const existing = getYtBackingTracks();
  if (existing.some(t => t.videoId === track.videoId)) return;
  existing.unshift(track);
  try { localStorage.setItem(YT_BT_KEY, JSON.stringify(existing)); } catch {}
}

export function getYtBackingTracks(): YtBackingTrack[] {
  try {
    const raw = localStorage.getItem(YT_BT_KEY);
    return raw ? JSON.parse(raw) as YtBackingTrack[] : [];
  } catch { return []; }
}

export function deleteYtBackingTrack(id: string): void {
  const tracks = getYtBackingTracks().filter(t => t.id !== id);
  try { localStorage.setItem(YT_BT_KEY, JSON.stringify(tracks)); } catch {}
}

export function isYtBackingTrackSaved(videoId: string): boolean {
  return getYtBackingTracks().some(t => t.videoId === videoId);
}

// ── Daily credit usage tracking ──

interface DailyUsage { date: string; used: number; generations: number; }

export function getDailyUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem("gf-suno-daily-usage");
    if (raw) {
      const d: DailyUsage = JSON.parse(raw);
      if (d.date === new Date().toISOString().slice(0, 10)) return d;
    }
  } catch {}
  return { date: new Date().toISOString().slice(0, 10), used: 0, generations: 0 };
}

export function recordUsage(credits: number): void {
  const usage = getDailyUsage();
  usage.used += credits;
  usage.generations += 1;
  try { localStorage.setItem("gf-suno-daily-usage", JSON.stringify(usage)); } catch {}
}
