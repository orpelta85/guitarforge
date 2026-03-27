/* ── GuitarForge Type Definitions ── */

export interface Exercise {
  id: number;
  c: string;       // category
  n: string;       // name
  m: number;       // minutes
  b: string;       // BPM range
  d: string;       // description
  yt: string;      // YouTube search query or URL
  t: string;       // tips
  f: string;       // focus areas
  bt: boolean;     // needs backing track
  tex?: string;    // AlphaTex notation for built-in tab display
  styles?: string[]; // applicable music styles
  ss?: boolean;    // needs Songsterr
  songId?: number;
  songName?: string;
  songUrl?: string;
  stageIdx?: number;
  gpPath?: string;   // personal GP file path
}

export interface Song {
  id: number;
  name: string;
  url: string;
}

export interface SongEntry {
  id: number;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  tuning?: string;
  tempo?: number;
  key?: string;
  songsterrUrl?: string;
  gpFileName?: string;
  ytTutorial?: string;
  popularity?: number;
  durationMs?: number;
  artistCountry?: string;
  artistTags?: string;
  gp?: boolean;
  gpPath?: string;
  personal?: boolean;
  notes?: string;
  attachments?: { name: string; type: string; idbKey: string }[];
}

export interface Stage {
  name: string;
  m: number;       // minutes
  d: string;       // description
}

export interface DayCats {
  [day: string]: string[];
}

export interface DayHrs {
  [day: string]: number;
}

export interface DayExMap {
  [day: string]: Exercise[];
}

export interface BoolMap {
  [key: string]: boolean;
}

export interface StringMap {
  [key: string]: string;
}

export interface SongProgressEntry {
  done?: boolean;
}

export interface SongProgressMap {
  [key: string]: SongProgressEntry;
}

export interface ExEditMap {
  [id: string]: Partial<Exercise> & { notes?: string; ytUrl?: string; gpFileName?: string };
}

export interface SavedRecording {
  dt: string;
  d: string; // base64 data URL or object URL
  name?: string; // auto-generated or user-edited name
}

export interface AppData {
  week: number;
  mode: string;
  scale: string;
  style: string;
  dayCats: DayCats;
  dayHrs: DayHrs;
  dayExMap: DayExMap;
  doneMap: BoolMap;
  bpmLog: StringMap;
  noteLog: StringMap;
  songs: Song[];
  songProgress: SongProgressMap;
  exEdits: ExEditMap;
}
