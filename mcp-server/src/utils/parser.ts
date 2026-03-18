import { readExercisesFile, writeExercisesFile, readSongsFile, writeSongsFile } from "./file-ops.js";

export interface ExerciseData {
  id: number;
  c: string;
  n: string;
  m: number;
  b: string;
  d: string;
  yt: string;
  t: string;
  f: string;
  bt: boolean;
  tex?: string;
  styles?: string[];
  ss?: boolean;
  songId?: number;
  songName?: string;
  songUrl?: string;
  stageIdx?: number;
}

export interface SongEntryData {
  id: number;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  tuning?: string;
  tempo?: number;
  key?: string;
  songsterrUrl?: string;
  gpFileName?: string;
  ytTutorial?: string;
}

/**
 * Parse exercises from the TypeScript source file.
 * Uses Function constructor to evaluate the array literal safely.
 */
export function parseExercises(): ExerciseData[] {
  const source = readExercisesFile();
  // Extract the array content between the first [ and last ]
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Cannot find EXERCISES array in exercises.ts");

  const arrayContent = source.substring(start, end + 1);
  // Use Function to evaluate the array literal (no imports needed, pure data)
  const fn = new Function(`return ${arrayContent}`);
  return fn() as ExerciseData[];
}

/**
 * Parse songs from the TypeScript source file.
 */
export function parseSongs(): SongEntryData[] {
  const source = readSongsFile();
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Cannot find SONG_LIBRARY array in songs-data.ts");

  const arrayContent = source.substring(start, end + 1);
  const fn = new Function(`return ${arrayContent}`);
  return fn() as SongEntryData[];
}

/**
 * Serialize an exercise object to a TypeScript object literal string.
 */
function serializeExercise(ex: ExerciseData): string {
  const parts: string[] = [];
  parts.push(`id: ${ex.id}`);
  parts.push(`c: ${JSON.stringify(ex.c)}`);
  parts.push(`n: ${JSON.stringify(ex.n)}`);
  parts.push(`m: ${ex.m}`);
  parts.push(`b: ${JSON.stringify(ex.b)}`);
  parts.push(`d: ${JSON.stringify(ex.d)}`);
  parts.push(`yt: ${JSON.stringify(ex.yt)}`);
  parts.push(`t: ${JSON.stringify(ex.t)}`);
  parts.push(`f: ${JSON.stringify(ex.f)}`);
  parts.push(`bt: ${ex.bt}`);
  if (ex.tex) parts.push(`tex: \`${ex.tex.replace(/`/g, "\\`")}\``);
  if (ex.styles && ex.styles.length > 0) parts.push(`styles: ${JSON.stringify(ex.styles)}`);
  if (ex.ss) parts.push(`ss: true`);
  if (ex.songId !== undefined) parts.push(`songId: ${ex.songId}`);
  if (ex.songName) parts.push(`songName: ${JSON.stringify(ex.songName)}`);
  if (ex.songUrl) parts.push(`songUrl: ${JSON.stringify(ex.songUrl)}`);
  if (ex.stageIdx !== undefined) parts.push(`stageIdx: ${ex.stageIdx}`);
  return `  { ${parts.join(", ")} }`;
}

/**
 * Append a new exercise to exercises.ts
 */
export function appendExercise(ex: ExerciseData): void {
  const source = readExercisesFile();
  const lastBracket = source.lastIndexOf("]");
  if (lastBracket === -1) throw new Error("Cannot find closing bracket in exercises.ts");

  // Find if there's a trailing comma or whitespace before the bracket
  const beforeBracket = source.substring(0, lastBracket).trimEnd();
  const needsComma = !beforeBracket.endsWith(",");

  const serialized = serializeExercise(ex);
  const newSource =
    beforeBracket +
    (needsComma ? "," : "") +
    "\n" +
    serialized + ",\n" +
    source.substring(lastBracket);

  writeExercisesFile(newSource);
}

/**
 * Update the tex field of an exercise by ID in exercises.ts
 */
export function updateExerciseTex(exerciseId: number, tex: string): boolean {
  const source = readExercisesFile();

  // Find the exercise object with this ID
  const idPattern = new RegExp(`(\\{[^}]*id:\\s*${exerciseId}\\b)`, "g");
  const match = idPattern.exec(source);
  if (!match) return false;

  // Find the complete object - from the { to the matching }
  const objStart = match.index;
  let braceCount = 0;
  let objEnd = objStart;
  for (let i = objStart; i < source.length; i++) {
    if (source[i] === "{") braceCount++;
    if (source[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        objEnd = i;
        break;
      }
    }
  }

  const objStr = source.substring(objStart, objEnd + 1);

  // Check if tex field already exists
  const texPattern = /tex:\s*`[^`]*`/;
  const texPatternDQ = /tex:\s*"[^"]*"/;
  let newObjStr: string;

  if (texPattern.test(objStr)) {
    newObjStr = objStr.replace(texPattern, `tex: \`${tex.replace(/`/g, "\\`")}\``);
  } else if (texPatternDQ.test(objStr)) {
    newObjStr = objStr.replace(texPatternDQ, `tex: \`${tex.replace(/`/g, "\\`")}\``);
  } else {
    // Add tex field before the closing brace
    newObjStr = objStr.slice(0, -1).trimEnd();
    if (!newObjStr.endsWith(",")) newObjStr += ",";
    newObjStr += ` tex: \`${tex.replace(/`/g, "\\`")}\` }`;
  }

  const newSource = source.substring(0, objStart) + newObjStr + source.substring(objEnd + 1);
  writeExercisesFile(newSource);
  return true;
}

/**
 * Serialize a song entry to a TypeScript object literal string.
 */
function serializeSong(song: SongEntryData): string {
  const parts: string[] = [];
  parts.push(`id: ${song.id}`);
  parts.push(`title: ${JSON.stringify(song.title)}`);
  parts.push(`artist: ${JSON.stringify(song.artist)}`);
  if (song.album) parts.push(`album: ${JSON.stringify(song.album)}`);
  if (song.year) parts.push(`year: ${song.year}`);
  if (song.genre) parts.push(`genre: ${JSON.stringify(song.genre)}`);
  if (song.difficulty) parts.push(`difficulty: ${JSON.stringify(song.difficulty)}`);
  if (song.tuning) parts.push(`tuning: ${JSON.stringify(song.tuning)}`);
  if (song.tempo) parts.push(`tempo: ${song.tempo}`);
  if (song.key) parts.push(`key: ${JSON.stringify(song.key)}`);
  if (song.songsterrUrl) parts.push(`songsterrUrl: ${JSON.stringify(song.songsterrUrl)}`);
  if (song.gpFileName) parts.push(`gpFileName: ${JSON.stringify(song.gpFileName)}`);
  if (song.ytTutorial) parts.push(`ytTutorial: ${JSON.stringify(song.ytTutorial)}`);
  return `  { ${parts.join(", ")} }`;
}

/**
 * Append a new song to songs-data.ts
 */
export function appendSong(song: SongEntryData): void {
  const source = readSongsFile();
  const lastBracket = source.lastIndexOf("]");
  if (lastBracket === -1) throw new Error("Cannot find closing bracket in songs-data.ts");

  const beforeBracket = source.substring(0, lastBracket).trimEnd();
  const needsComma = !beforeBracket.endsWith(",");

  const serialized = serializeSong(song);
  const newSource =
    beforeBracket +
    (needsComma ? "," : "") +
    "\n" +
    serialized + ",\n" +
    source.substring(lastBracket);

  writeSongsFile(newSource);
}

/**
 * Get the next available ID for exercises or songs.
 */
export function getNextExerciseId(): number {
  const exercises = parseExercises();
  return Math.max(...exercises.map(e => e.id), 0) + 1;
}

export function getNextSongId(): number {
  const songs = parseSongs();
  return Math.max(...songs.map(s => s.id), 0) + 1;
}
