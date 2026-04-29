"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import JamLooper from "@/components/JamLooper";
import { JamFretboard } from "@/components/JamFretboard";
import {
  PROGRESSIONS_BY_STYLE,
  JAM_STYLE_LIST,
  JAM_STYLE_LABELS,
  JAM_STYLE_TO_GROOVE,
  type JamStyleKey,
  type Progression,
} from "@/lib/constants";
import { recordUsage, saveToLibrary, type LibraryTrack } from "@/lib/suno";
import { createJamRecorder, type JamRecorder } from "@/lib/jamRecorder";
import { audioBufferToWav } from "@/lib/wavEncoder";
import { audioBufferToMp3 } from "@/lib/mp3Encoder";

// ── Music Theory Data ──

const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteIndex(name: string): number {
  const n = name.replace("m", "").replace("7", "").trim();
  let idx = NOTE_NAMES.indexOf(n);
  if (idx === -1) idx = FLAT_NAMES.indexOf(n);
  return idx === -1 ? 0 : idx;
}

function noteName(idx: number, preferFlat = false): string {
  const i = ((idx % 12) + 12) % 12;
  return preferFlat ? FLAT_NAMES[i] : NOTE_NAMES[i];
}

// ── Time Signature Helpers ──
// Translate a progression's `timeSignature` string (e.g. "4/4", "3/4", "6/8")
// into a beat layout used by the 16th-note Tone.Loop scheduler.
//
// `subsPerBar`     — total subdivisions per bar that the loop steps through
// `beatsPerBar`    — how many "beats" we display in the bar indicator
// `subsPerBeat`    — subdivisions between successive beats
// `accentPattern`  — for each beat in the bar, the metronome click kind
//                    ("accent" | "normal" | "mid" | "none")
//
//   4/4 → 16 subs, 4 beats × 4 sub each, accent on 1, normal on 2-3-4
//   3/4 → 12 subs, 3 beats × 4 sub each, accent on 1, normal on 2-3
//   6/8 → 12 subs, 6 pulses × 2 sub each, accent on 1, mid on 4 (others silent)
//   5/4 → 20 subs, 5 beats × 4 sub each, accent on 1, normal on 2-5
//   7/8 → 14 subs, 7 pulses × 2 sub each, accent on 1, mid on 4
type ClickKind = "accent" | "normal" | "mid" | "none";
interface TimeSigLayout {
  subsPerBar: number;
  beatsPerBar: number;
  subsPerBeat: number;
  accentPattern: ClickKind[];
}
function getTimeSigLayout(ts: string | undefined): TimeSigLayout {
  switch (ts) {
    case "3/4":
      return { subsPerBar: 12, beatsPerBar: 3, subsPerBeat: 4, accentPattern: ["accent", "normal", "normal"] };
    case "6/8":
      return { subsPerBar: 12, beatsPerBar: 6, subsPerBeat: 2, accentPattern: ["accent", "none", "none", "mid", "none", "none"] };
    case "5/4":
      return { subsPerBar: 20, beatsPerBar: 5, subsPerBeat: 4, accentPattern: ["accent", "normal", "normal", "normal", "normal"] };
    case "7/8":
      return { subsPerBar: 14, beatsPerBar: 7, subsPerBeat: 2, accentPattern: ["accent", "none", "none", "mid", "none", "normal", "none"] };
    case "4/4":
    default:
      return { subsPerBar: 16, beatsPerBar: 4, subsPerBeat: 4, accentPattern: ["accent", "normal", "normal", "normal"] };
  }
}

// Intervals from root for each scale degree in major scale: W W H W W W H
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
// Natural minor intervals
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

interface ChordDef {
  root: string;
  quality: string;
  numeral: string;
  display: string;
}

// ── Drum Patterns ──
// Each pattern works at 16th-note resolution (16 subdivisions per bar of 4/4)
// Indices 0-15 represent the 16 sixteenth notes in one bar

type DrumStyleName = "rock" | "metal" | "blues_shuffle" | "jazz" | "funk" | "punk" | "ballad" | "latin" | "reggae" | "country";

interface DrumPattern {
  name: string;
  kick: number[];
  snare: number[];
  hihat: number[];
  crash?: number[];
  ride?: number[];
}

const DRUM_PATTERNS: Record<DrumStyleName, DrumPattern> = {
  rock: {
    name: "Rock",
    kick: [0, 8],           // 1 and 3
    snare: [4, 12],         // 2 and 4
    hihat: [0, 2, 4, 6, 8, 10, 12, 14], // 8th notes
  },
  metal: {
    name: "Metal",
    kick: [0, 2, 4, 6, 8, 10, 12, 14], // double bass 8ths
    snare: [4, 12],         // 2 and 4
    hihat: [0, 2, 4, 6, 8, 10, 12, 14], // 8th notes
    crash: [0],             // crash on 1
  },
  blues_shuffle: {
    name: "Blues Shuffle",
    kick: [0, 8],           // 1 and 3
    snare: [4, 12],         // 2 and 4
    hihat: [0, 3, 4, 7, 8, 11, 12, 15], // triplet feel (swing 8ths)
  },
  jazz: {
    name: "Jazz",
    kick: [0, 10],          // light kick on 1, ghosted on 3-and
    snare: [4, 7, 12, 15],  // ghost notes + backbeat
    hihat: [],              // no hihat
    ride: [0, 3, 4, 6, 8, 11, 12, 14], // ride cymbal pattern
  },
  funk: {
    name: "Funk",
    kick: [0, 6, 10],       // syncopated kick (1, and-of-2, and-of-3)
    snare: [4, 7, 12, 14],  // 2 with ghost on and-of-2, 4 with ghost before
    hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // tight 16ths
  },
  punk: {
    name: "Punk",
    kick: [0, 4, 8, 12],    // fast four-on-floor
    snare: [4, 12],         // snare on 2 and 4
    hihat: [0, 2, 4, 6, 8, 10, 12, 14], // open 8ths
    crash: [0],             // crash every bar
  },
  ballad: {
    name: "Ballad",
    kick: [0, 8],           // soft kick 1 and 3
    snare: [4, 12],         // rim click on 2 and 4 (played softer)
    hihat: [0, 2, 4, 6, 8, 10, 12, 14], // brushed 8ths
  },
  latin: {
    name: "Latin",
    kick: [0, 3, 6, 10],    // tumbao pattern
    snare: [4, 12],         // cross-stick
    hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // shaker 16ths
  },
  reggae: {
    name: "Reggae",
    kick: [8],              // kick on 3 only
    snare: [8],             // rimshot on 3
    hihat: [2, 6, 10, 14],  // offbeats only
  },
  country: {
    name: "Country",
    kick: [0, 8],           // boom-chuck: kick 1+3
    snare: [4, 12],         // snare 2+4
    hihat: [0, 2, 4, 6, 8, 10, 12, 14], // 8th notes
  },
};

const DRUM_STYLE_LIST: DrumStyleName[] = ["rock", "metal", "blues_shuffle", "jazz", "funk", "punk", "ballad", "latin", "reggae", "country"];

// ── Bass Patterns ──
// Bass patterns define which subdivisions (0-15 per bar) get which chord tone
// Tones: "root", "third", "fifth", "seventh", "octave"

type BassStyleName = "rock" | "metal" | "blues" | "jazz" | "funk" | "punk" | "ballad" | "reggae";

interface BassEvent {
  sub: number;          // subdivision index (0-15)
  tone: "root" | "third" | "fifth" | "seventh" | "octave";
  duration: string;     // Tone.js duration
}

interface BassPattern {
  name: string;
  events: BassEvent[];
}

const BASS_PATTERNS: Record<BassStyleName, BassPattern> = {
  rock: {
    name: "Rock",
    events: [
      { sub: 0, tone: "root", duration: "4n" },
      { sub: 8, tone: "fifth", duration: "4n" },
    ],
  },
  metal: {
    name: "Metal",
    events: [
      { sub: 0, tone: "root", duration: "8n" },
      { sub: 2, tone: "root", duration: "8n" },
      { sub: 4, tone: "root", duration: "8n" },
      { sub: 6, tone: "root", duration: "8n" },
      { sub: 8, tone: "root", duration: "8n" },
      { sub: 10, tone: "root", duration: "8n" },
      { sub: 12, tone: "root", duration: "8n" },
      { sub: 14, tone: "root", duration: "8n" },
    ],
  },
  blues: {
    name: "Blues Walk",
    events: [
      { sub: 0, tone: "root", duration: "4n" },
      { sub: 4, tone: "third", duration: "4n" },
      { sub: 8, tone: "fifth", duration: "4n" },
      { sub: 12, tone: "seventh", duration: "4n" },
    ],
  },
  jazz: {
    name: "Jazz Walking",
    events: [
      { sub: 0, tone: "root", duration: "4n" },
      { sub: 4, tone: "fifth", duration: "4n" },
      { sub: 8, tone: "third", duration: "4n" },
      { sub: 12, tone: "seventh", duration: "4n" },
    ],
  },
  funk: {
    name: "Funk",
    events: [
      { sub: 0, tone: "root", duration: "16n" },
      { sub: 3, tone: "octave", duration: "16n" },
      { sub: 6, tone: "root", duration: "16n" },
      { sub: 8, tone: "fifth", duration: "8n" },
      { sub: 10, tone: "octave", duration: "16n" },
      { sub: 13, tone: "root", duration: "16n" },
    ],
  },
  punk: {
    name: "Punk",
    events: [
      { sub: 0, tone: "root", duration: "8n" },
      { sub: 2, tone: "root", duration: "8n" },
      { sub: 4, tone: "root", duration: "8n" },
      { sub: 6, tone: "root", duration: "8n" },
      { sub: 8, tone: "root", duration: "8n" },
      { sub: 10, tone: "root", duration: "8n" },
      { sub: 12, tone: "root", duration: "8n" },
      { sub: 14, tone: "root", duration: "8n" },
    ],
  },
  ballad: {
    name: "Ballad",
    events: [
      { sub: 0, tone: "root", duration: "2n" },
    ],
  },
  reggae: {
    name: "Reggae",
    events: [
      { sub: 2, tone: "root", duration: "16n" },
      { sub: 6, tone: "fifth", duration: "16n" },
      { sub: 10, tone: "root", duration: "16n" },
      { sub: 14, tone: "fifth", duration: "16n" },
    ],
  },
};

const BASS_STYLE_LIST: BassStyleName[] = ["rock", "metal", "blues", "jazz", "funk", "punk", "ballad", "reggae"];

// ── Groove Styles (unified drum + bass) ──

type GrooveStyleName = "rock" | "metal" | "blues" | "jazz" | "funk" | "punk" | "ballad" | "latin" | "reggae" | "country";

interface GrooveStyle {
  name: string;
  drum: DrumStyleName;
  bass: BassStyleName;
  guitar: GuitarStrumStyle;
}

const GROOVE_STYLES: Record<GrooveStyleName, GrooveStyle> = {
  rock:    { name: "Rock",          drum: "rock",          bass: "rock",    guitar: "rock" },
  metal:   { name: "Metal",         drum: "metal",         bass: "metal",   guitar: "metal" },
  blues:   { name: "Blues",         drum: "blues_shuffle", bass: "blues",   guitar: "blues" },
  jazz:    { name: "Jazz",          drum: "jazz",          bass: "jazz",    guitar: "jazz" },
  funk:    { name: "Funk",          drum: "funk",          bass: "funk",    guitar: "funk" },
  punk:    { name: "Punk",          drum: "punk",          bass: "punk",    guitar: "punk" },
  ballad:  { name: "Ballad",        drum: "ballad",        bass: "ballad",  guitar: "ballad" },
  latin:   { name: "Latin",         drum: "latin",         bass: "funk",    guitar: "latin" },
  reggae:  { name: "Reggae",        drum: "reggae",        bass: "reggae",  guitar: "reggae" },
  country: { name: "Country",       drum: "country",       bass: "rock",    guitar: "country" },
};

const GROOVE_STYLE_LIST: GrooveStyleName[] = ["rock", "metal", "blues", "jazz", "funk", "punk", "ballad", "latin", "reggae", "country"];

// Genre-to-groove auto-mapping
const GENRE_GROOVE_MAP: Record<string, GrooveStyleName> = {
  Blues: "blues", Rock: "rock", Jazz: "jazz", Metal: "metal",
  Funk: "funk", Punk: "punk", Ballad: "ballad", "R&B": "funk",
};

// ── Guitar Accompaniment ──
// Style-aware strumming patterns. Each pattern lists subdivision indices (0-15) in a bar
// where a chord should be struck. Works alongside the same Tone.Loop at 16n resolution.
type GuitarStrumStyle = "rock" | "metal" | "blues" | "jazz" | "funk" | "punk" | "ballad" | "latin" | "reggae" | "country";

interface GuitarPattern {
  name: string;
  // Subdivisions in a 16n bar where the chord is strummed
  hits: number[];
  // Note length for each strum
  duration: string;
}

const GUITAR_PATTERNS: Record<GuitarStrumStyle, GuitarPattern> = {
  rock:    { name: "Rock",    hits: [0, 4, 8, 12], duration: "4n" },      // quarter notes
  metal:   { name: "Metal",   hits: [0, 2, 4, 6, 8, 10, 12, 14], duration: "8n" }, // palm-mute 8ths
  blues:   { name: "Blues",   hits: [0, 8], duration: "2n" },             // 1 and 3
  jazz:    { name: "Jazz",    hits: [4, 12], duration: "4n" },             // comping on 2 and 4
  funk:    { name: "Funk",    hits: [2, 6, 10, 14], duration: "16n" },     // 16th off-beats (chicken scratch)
  punk:    { name: "Punk",    hits: [0, 2, 4, 6, 8, 10, 12, 14], duration: "8n" },
  ballad:  { name: "Ballad",  hits: [0, 8], duration: "2n" },              // sustained chords
  latin:   { name: "Latin",   hits: [0, 3, 6, 10, 14], duration: "8n" },
  reggae:  { name: "Reggae",  hits: [2, 6, 10, 14], duration: "16n" },     // upbeat skank
  country: { name: "Country", hits: [0, 4, 8, 12], duration: "4n" },       // boom-chick chord
};

// Build chord voicing (3 notes: root, third, fifth) at octaves 3-4 for guitar register
function getGuitarChordNotes(chordRoot: string, quality: string): string[] {
  const rootIdx = NOTE_NAMES.indexOf(chordRoot);
  if (rootIdx < 0) return [chordRoot + "3"];
  const isMinor = quality.includes("m") && !quality.includes("maj");
  const isDim = quality.includes("dim") || quality.includes("m7b5");
  const thirdInterval = isMinor || isDim ? 3 : 4;
  const fifthInterval = isDim ? 6 : 7;
  const third = NOTE_NAMES[(rootIdx + thirdInterval) % 12];
  const fifth = NOTE_NAMES[(rootIdx + fifthInterval) % 12];
  // Voice: root in octave 3, third + fifth in octave 4 (guitar-like voicing)
  const notes = [chordRoot + "3", third + "4", fifth + "4"];
  // Add seventh for jazz/blues 7-chords
  if (quality.includes("7")) {
    const seventhInterval = quality.includes("maj7") ? 11 : 10;
    const seventh = NOTE_NAMES[(rootIdx + seventhInterval) % 12];
    notes.push(seventh + "4");
  }
  return notes;
}

// Get bass note for a chord tone
function getBassNote(chordRoot: string, quality: string, tone: BassEvent["tone"]): string {
  const rootIdx = NOTE_NAMES.indexOf(chordRoot);
  if (rootIdx < 0) return chordRoot + "2";
  const isMinor = quality.includes("m") && !quality.includes("maj");
  switch (tone) {
    case "root": return chordRoot + "2";
    case "third": return NOTE_NAMES[(rootIdx + (isMinor ? 3 : 4)) % 12] + "2";
    case "fifth": return NOTE_NAMES[(rootIdx + 7) % 12] + "2";
    case "seventh": return NOTE_NAMES[(rootIdx + (quality.includes("maj7") ? 11 : 10)) % 12] + "2";
    case "octave": return chordRoot + "3";
  }
}

// Legacy genre maps kept for reference (replaced by GENRE_GROOVE_MAP)

// ── Nashville Numeral → Chord translator ──
// Parses tokens like "I", "vi", "bVII", "iim7b5", "V7b9", "IM7", "I7-VI7"
// Returns chord root (note name) + quality suffix for display.

// Scale degree semitones relative to tonic for major vs minor key context
const MAJOR_DEG_SEMI: Record<string, number> = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
const MINOR_DEG_SEMI: Record<string, number> = { I: 0, II: 2, III: 3, IV: 5, V: 7, VI: 8, VII: 10 };

interface ParsedNumeral {
  root: string;      // note name like "A", "F#", "Bb"
  quality: string;   // chord quality suffix like "", "m", "7", "maj7", "m7", "m7b5", "7b9", "dim"
  display: string;   // root + quality for display
  numeral: string;   // raw input token
}

function parseNashvilleToken(token: string, keyRoot: string, isMinorKey: boolean): ParsedNumeral {
  const original = token;
  let cursor = 0;

  // Leading accidental
  let accidental = 0;
  if (token[cursor] === "b") { accidental = -1; cursor++; }
  else if (token[cursor] === "#") { accidental = 1; cursor++; }

  // Roman numeral (greedy match I, II, III, IV, V, VI, VII in upper or lower)
  let romanRaw = "";
  while (cursor < token.length && /[IViv]/.test(token[cursor])) {
    romanRaw += token[cursor];
    cursor++;
  }
  if (!romanRaw) {
    return { root: keyRoot, quality: "", display: keyRoot, numeral: original };
  }
  const isLower = romanRaw === romanRaw.toLowerCase();
  const romanUpper = romanRaw.toUpperCase();

  // Remainder is quality modifier
  const mod = token.slice(cursor);

  // Degree semitones: use major or minor scale degrees based on KEY context.
  // In minor-key context, III/VI/VII are already the flat (minor-scale) degrees (3/8/10),
  // so an explicit `b` prefix on III/VI/VII is redundant and should be ignored —
  // otherwise "bVII" (common in minor progressions like Am-G-F-E) would incorrectly drop to F#.
  const degMap = isMinorKey ? MINOR_DEG_SEMI : MAJOR_DEG_SEMI;
  const baseSemi = degMap[romanUpper];
  if (baseSemi === undefined) {
    return { root: keyRoot, quality: "", display: keyRoot, numeral: original };
  }
  const redundantFlat = isMinorKey && accidental === -1 && (romanUpper === "III" || romanUpper === "VI" || romanUpper === "VII");
  const semitones = baseSemi + (redundantFlat ? 0 : accidental);

  // Compute chord root note
  const keyRootIdx = noteIndex(keyRoot);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(keyRoot) || isMinorKey;
  const chordRoot = noteName(keyRootIdx + semitones, useFlats);

  // Determine chord quality suffix
  // Start from roman-case default
  let quality = "";
  if (isLower) quality = "m";

  // Apply modifier — modifier overrides or extends
  if (mod) {
    // Explicit qualities
    if (mod === "M7" || mod === "maj7") quality = "maj7";
    else if (mod === "m7b5" || mod === "ø" || mod === "m7b5") quality = "m7b5";
    else if (mod === "dim" || mod === "o") quality = "dim";
    else if (mod === "7b9") quality = "7b9";
    else if (mod === "m7") quality = "m7";
    else if (mod === "m9") quality = "m9";
    else if (mod === "m") quality = "m";
    else if (mod === "7") quality = isLower ? "m7" : "7";
    else if (mod === "9") quality = isLower ? "m9" : "9";
    else if (mod === "sus4") quality = "sus4";
    else if (mod === "sus2") quality = "sus2";
    else if (mod === "5") quality = "5"; // power chord
    else if (/^M7/.test(mod)) quality = "maj7";
    else quality = mod; // fallback: pass through
  }

  const display = chordRoot + quality;
  return { root: chordRoot, quality, display, numeral: original };
}

// Expand a Nashville array (with possible "X-Y" split entries) into chord cells
function buildChordsFromNashville(
  nashville: string[],
  keyRaw: string,
): ChordDef[] {
  const isMinorKey = keyRaw.endsWith("m");
  const keyRoot = keyRaw.replace("m", "");
  const out: ChordDef[] = [];
  for (const entry of nashville) {
    const tokens = entry.split("-").map(t => t.trim()).filter(Boolean);
    for (const t of tokens) {
      const p = parseNashvilleToken(t, keyRoot, isMinorKey);
      out.push({ root: p.root, quality: p.quality, numeral: p.numeral, display: p.display });
    }
  }
  return out;
}

// Legacy JamProgression interface kept for backwards reference (unused now)
interface JamProgression {
  name: string;
  genre: string;
  numerals: string[];
  degrees: { semitones: number; quality: string; numeral: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEGACY_PROGRESSIONS_UNUSED: JamProgression[] = [
  {
    name: "12-Bar Blues", genre: "Blues",
    numerals: ["I", "I", "IV", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"],
    degrees: [
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 7, quality: "7", numeral: "V7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 7, quality: "7", numeral: "V7" },
    ],
  },
  {
    name: "Blues Shuffle", genre: "Blues",
    numerals: ["I", "IV", "I", "V"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 5, quality: "", numeral: "IV" },
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 7, quality: "", numeral: "V" },
    ],
  },
  {
    name: "Classic Rock", genre: "Rock",
    numerals: ["I", "bVII", "IV", "I"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 10, quality: "", numeral: "bVII" },
      { semitones: 5, quality: "", numeral: "IV" },
      { semitones: 0, quality: "", numeral: "I" },
    ],
  },
  {
    name: "Power Ballad", genre: "Rock",
    numerals: ["I", "V", "vi", "IV"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 7, quality: "", numeral: "V" },
      { semitones: 9, quality: "m", numeral: "vi" },
      { semitones: 5, quality: "", numeral: "IV" },
    ],
  },
  {
    name: "Jazz ii-V-I", genre: "Jazz",
    numerals: ["ii", "V", "I", "vi"],
    degrees: [
      { semitones: 2, quality: "m7", numeral: "ii" },
      { semitones: 7, quality: "7", numeral: "V7" },
      { semitones: 0, quality: "maj7", numeral: "Imaj7" },
      { semitones: 9, quality: "m7", numeral: "vi" },
    ],
  },
  {
    name: "Jazz Turnaround", genre: "Jazz",
    numerals: ["I", "vi", "ii", "V"],
    degrees: [
      { semitones: 0, quality: "maj7", numeral: "Imaj7" },
      { semitones: 9, quality: "m7", numeral: "vi" },
      { semitones: 2, quality: "m7", numeral: "ii" },
      { semitones: 7, quality: "7", numeral: "V7" },
    ],
  },
  {
    name: "Metal Power", genre: "Metal",
    numerals: ["i", "bVI", "bVII", "i"],
    degrees: [
      { semitones: 0, quality: "m", numeral: "i" },
      { semitones: 8, quality: "", numeral: "bVI" },
      { semitones: 10, quality: "", numeral: "bVII" },
      { semitones: 0, quality: "m", numeral: "i" },
    ],
  },
  {
    name: "Thrash Riff", genre: "Metal",
    numerals: ["i", "bII", "i", "bVII"],
    degrees: [
      { semitones: 0, quality: "5", numeral: "i" },
      { semitones: 1, quality: "5", numeral: "bII" },
      { semitones: 0, quality: "5", numeral: "i" },
      { semitones: 10, quality: "5", numeral: "bVII" },
    ],
  },
  {
    name: "Doom Metal", genre: "Metal",
    numerals: ["i", "iv", "bVI", "V"],
    degrees: [
      { semitones: 0, quality: "m", numeral: "i" },
      { semitones: 5, quality: "m", numeral: "iv" },
      { semitones: 8, quality: "", numeral: "bVI" },
      { semitones: 7, quality: "", numeral: "V" },
    ],
  },
  {
    name: "Funk Groove", genre: "Funk",
    numerals: ["I7", "IV7", "I7", "V7"],
    degrees: [
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 7, quality: "7", numeral: "V7" },
    ],
  },
  {
    name: "Funk Vamp", genre: "Funk",
    numerals: ["I9", "IV9"],
    degrees: [
      { semitones: 0, quality: "9", numeral: "I9" },
      { semitones: 5, quality: "9", numeral: "IV9" },
    ],
  },
  {
    name: "Pop Punk", genre: "Punk",
    numerals: ["I", "V", "vi", "IV"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 7, quality: "", numeral: "V" },
      { semitones: 9, quality: "m", numeral: "vi" },
      { semitones: 5, quality: "", numeral: "IV" },
    ],
  },
  {
    name: "Minor Ballad", genre: "Ballad",
    numerals: ["i", "bVI", "bIII", "bVII"],
    degrees: [
      { semitones: 0, quality: "m", numeral: "i" },
      { semitones: 8, quality: "", numeral: "bVI" },
      { semitones: 3, quality: "", numeral: "bIII" },
      { semitones: 10, quality: "", numeral: "bVII" },
    ],
  },
  {
    name: "Neo-Soul", genre: "R&B",
    numerals: ["Imaj7", "iii", "vi", "IV"],
    degrees: [
      { semitones: 0, quality: "maj7", numeral: "Imaj7" },
      { semitones: 4, quality: "m", numeral: "iii" },
      { semitones: 9, quality: "m7", numeral: "vi" },
      { semitones: 5, quality: "maj7", numeral: "IVmaj7" },
    ],
  },
];

// (Genres now come from JAM_STYLE_LIST imported from constants)

// Scale notes for a given key (natural minor if key ends with 'm', else major)
function getScaleNotes(key: string): { name: string; notes: string[] } {
  const isMinor = key.endsWith("m");
  const rootName = key.replace("m", "");
  const root = noteIndex(rootName);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(rootName);
  const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const notes = intervals.map(i => noteName(root + i, useFlats));
  return {
    name: isMinor ? `${rootName} Natural Minor` : `${rootName} Major`,
    notes,
  };
}

// Pentatonic scale (minor penta for minor keys, major penta for major)
function getPentatonicNotes(key: string): { name: string; notes: string[] } {
  const isMinor = key.endsWith("m");
  const rootName = key.replace("m", "");
  const root = noteIndex(rootName);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(rootName);
  const intervals = isMinor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const notes = intervals.map(i => noteName(root + i, useFlats));
  return {
    name: isMinor ? `${rootName} Minor Pentatonic` : `${rootName} Major Pentatonic`,
    notes,
  };
}

// Blues scale
function getBluesNotes(key: string): { name: string; notes: string[] } {
  const isMinor = key.endsWith("m");
  const rootName = key.replace("m", "");
  const root = noteIndex(rootName);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(rootName);
  const intervals = isMinor ? [0, 3, 5, 6, 7, 10] : [0, 2, 3, 4, 7, 9];
  const notes = intervals.map(i => noteName(root + i, useFlats));
  return {
    name: isMinor ? `${rootName} Minor Blues` : `${rootName} Major Blues`,
    notes,
  };
}

// ── Settings Persistence ──

interface JamSettings {
  key: string;
  style: JamStyleKey;
  progressionIndex: number;
  bpm: number;
  barsPerChord: number;
  loop: boolean;
  randomMode: boolean;
  metronomeVol: number;
  bassVol: number;
  drumVol: number;
  guitarVol: number;
  aiTrackVol: number;
  bassEnabled: boolean;
  drumEnabled: boolean;
  guitarEnabled: boolean;
  aiTrackEnabled: boolean;
  grooveStyle: GrooveStyleName;
  scaleType: "natural" | "pentatonic" | "blues";
  // Legacy fields kept for backwards compatibility with localStorage
  drumStyle?: DrumStyleName;
  bassStyle?: BassStyleName;
  genre?: string;
}

const DEFAULT_SETTINGS: JamSettings = {
  key: "Am",
  style: "blues",
  progressionIndex: 0,
  bpm: 100,
  barsPerChord: 2,
  loop: true,
  randomMode: false,
  metronomeVol: 0.9,
  bassVol: 0.4,
  drumVol: 0.3,
  guitarVol: 0.5,
  aiTrackVol: 0.6,
  bassEnabled: false,
  drumEnabled: false,
  guitarEnabled: false,
  aiTrackEnabled: false,
  grooveStyle: "blues",
  scaleType: "pentatonic",
};

function loadSettings(): JamSettings {
  try {
    const raw = localStorage.getItem("gf-jam-settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate legacy drumStyle/bassStyle to grooveStyle
      if (!parsed.grooveStyle && parsed.drumStyle) {
        const match = GROOVE_STYLE_LIST.find(g => GROOVE_STYLES[g].drum === parsed.drumStyle);
        parsed.grooveStyle = match || DEFAULT_SETTINGS.grooveStyle;
      }
      // Migrate legacy genre (capitalized string) to style (lowercase JamStyleKey)
      if (!parsed.style && parsed.genre) {
        const legacy = String(parsed.genre).toLowerCase();
        const map: Record<string, JamStyleKey> = {
          blues: "blues", rock: "rock", metal: "metal", jazz: "jazz",
          funk: "funk", punk: "punk", ballad: "pop", "r&b": "rnb", rnb: "rnb",
          pop: "pop", country: "country", reggae: "reggae", latin: "latin", indie: "indie",
        };
        parsed.style = map[legacy] || DEFAULT_SETTINGS.style;
        // Reset progressionIndex as progressions changed structurally
        parsed.progressionIndex = 0;
      }
      delete parsed.drumStyle;
      delete parsed.bassStyle;
      delete parsed.genre;
      // Guard: ensure style is a valid key
      if (!parsed.style || !JAM_STYLE_LIST.includes(parsed.style)) {
        parsed.style = DEFAULT_SETTINGS.style;
        parsed.progressionIndex = 0;
      }
      // Clamp progressionIndex to valid range
      const maxIdx = PROGRESSIONS_BY_STYLE[parsed.style as JamStyleKey].length - 1;
      if (typeof parsed.progressionIndex !== "number" || parsed.progressionIndex > maxIdx || parsed.progressionIndex < 0) {
        parsed.progressionIndex = 0;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: JamSettings) {
  try { localStorage.setItem("gf-jam-settings", JSON.stringify(s)); } catch {}
}

// ── Component ──

export default function JamModePage() {
  const [settings, setSettings] = useState<JamSettings>(DEFAULT_SETTINGS);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentChordIdx, setCurrentChordIdx] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [chordFlash, setChordFlash] = useState(false);
  const [toneLoaded, setToneLoaded] = useState(false);
  // Settings are always visible at top of page. State kept for future collapse UX but defaults true.
  const [showSettings, setShowSettings] = useState(true);

  // ── AI backing track (Suno) state ──
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTrackUrl, setAiTrackUrl] = useState<string | null>(null);
  const [aiTrackTitle, setAiTrackTitle] = useState<string>("");
  const [aiError, setAiError] = useState<string>("");
  const [aiPlaying, setAiPlaying] = useState(false);
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Full-jam recorder state ──
  // Captures the live mix of every Tone.js source (metronome, drums, bass,
  // guitar AI) plus the Suno backing track (when present) into a single audio
  // file.  JamLooper runs on its own AudioContext so it is NOT included — the
  // user is informed in the UI.
  const [isRecordingJam, setIsRecordingJam] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0); // seconds since record started
  const [showJamSaveDialog, setShowJamSaveDialog] = useState(false);
  const [jamSaveResult, setJamSaveResult] = useState<{ buffer: AudioBuffer; durationSec: number } | null>(null);
  const [jamSaveBusy, setJamSaveBusy] = useState<"" | "wav" | "mp3">("");
  const [jamRecordError, setJamRecordError] = useState<string>("");
  const recorderRef = useRef<JamRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartedAtRef = useRef<number>(0);

  // Tone.js refs
  const toneRef = useRef<typeof import("tone") | null>(null);
  const metronomeSynthRef = useRef<InstanceType<typeof import("tone").MembraneSynth> | null>(null);
  const bassSynthRef = useRef<InstanceType<typeof import("tone").Synth> | null>(null);
  const hihatSynthRef = useRef<InstanceType<typeof import("tone").NoiseSynth> | null>(null);
  const kickSynthRef = useRef<InstanceType<typeof import("tone").MembraneSynth> | null>(null);
  const snareSynthRef = useRef<InstanceType<typeof import("tone").NoiseSynth> | null>(null);
  const rideSynthRef = useRef<InstanceType<typeof import("tone").MetalSynth> | null>(null);
  const crashSynthRef = useRef<InstanceType<typeof import("tone").MetalSynth> | null>(null);
  const guitarSynthRef = useRef<InstanceType<typeof import("tone").PolySynth> | null>(null);
  const guitarDistortionRef = useRef<InstanceType<typeof import("tone").Distortion> | null>(null);
  const guitarFilterRef = useRef<InstanceType<typeof import("tone").Filter> | null>(null);
  const subCountRef = useRef(0);
  const loopRef = useRef<InstanceType<typeof import("tone").Loop> | null>(null);
  const beatCountRef = useRef(0);
  const chordIdxRef = useRef(0);
  const settingsRef = useRef(settings);
  const chordsRef = useRef<ChordDef[]>([]);
  const playingRef = useRef(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Keep refs in sync
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Save settings when they change (debounced)
  useEffect(() => {
    const t = setTimeout(() => saveSettings(settings), 300);
    return () => clearTimeout(t);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof JamSettings>(key: K, val: JamSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, []);

  // Derived data
  const filteredProgressions: Progression[] = PROGRESSIONS_BY_STYLE[settings.style] || [];
  const currentProgression = filteredProgressions[settings.progressionIndex] || filteredProgressions[0];
  const chords = currentProgression ? buildChordsFromNashville(currentProgression.nashville, settings.key) : [];
  chordsRef.current = chords;

  const scaleInfo = settings.scaleType === "pentatonic"
    ? getPentatonicNotes(settings.key)
    : settings.scaleType === "blues"
      ? getBluesNotes(settings.key)
      : getScaleNotes(settings.key);

  // Ensure progression index is valid when style changes
  useEffect(() => {
    const filtered = PROGRESSIONS_BY_STYLE[settings.style] || [];
    if (settings.progressionIndex >= filtered.length) {
      updateSetting("progressionIndex", 0);
    }
  }, [settings.style, settings.progressionIndex, updateSetting]);

  // Reset playback position when progression or key changes to prevent stale chord refs
  useEffect(() => {
    subCountRef.current = 0;
    chordIdxRef.current = 0;
    setCurrentChordIdx(0);
    setCurrentBeat(0);
  }, [settings.progressionIndex, settings.key]);

  // ── Tone.js initialization ──

  const initTone = useCallback(async () => {
    if (toneRef.current) return;
    const Tone = await import("tone");
    toneRef.current = Tone;

    await Tone.start();
    Tone.getTransport().bpm.value = settingsRef.current.bpm;

    // Metronome click
    metronomeSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }).toDestination();
    metronomeSynthRef.current.volume.value = volToDb(settingsRef.current.metronomeVol);

    // Bass synth
    bassSynthRef.current = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
    }).toDestination();
    bassSynthRef.current.volume.value = volToDb(settingsRef.current.bassVol);

    // Hihat (noise synth)
    hihatSynthRef.current = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).toDestination();
    hihatSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol) - 6;

    // Kick
    kickSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).toDestination();
    kickSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol);

    // Snare
    snareSynthRef.current = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).toDestination();
    snareSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol) - 3;

    // Ride cymbal
    rideSynthRef.current = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination();
    rideSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol) - 10;

    // Crash cymbal
    crashSynthRef.current = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.0, release: 0.5 },
      harmonicity: 5.1,
      modulationIndex: 40,
      resonance: 5000,
      octaves: 1.5,
    }).toDestination();
    crashSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol) - 6;

    // ── Guitar accompaniment synth (style-aware) ──
    // Chain: PolySynth -> Filter (lowpass) -> Distortion -> Destination
    // Distortion wet + filter cutoff are adjusted per style live via applyGuitarStyle.
    const groove = GROOVE_STYLES[settingsRef.current.grooveStyle];
    const isHeavy = ["metal", "rock", "punk"].includes(groove.guitar);
    guitarSynthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: isHeavy ? "sawtooth" : "triangle" },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.6 },
    });
    guitarFilterRef.current = new Tone.Filter({
      type: "lowpass",
      frequency: isHeavy ? 2800 : 3500,
      Q: 0.8,
    });
    guitarDistortionRef.current = new Tone.Distortion({
      distortion: 0.35,
      wet: isHeavy ? 0.5 : 0,
    });
    guitarSynthRef.current.chain(
      guitarFilterRef.current,
      guitarDistortionRef.current,
      Tone.Destination
    );
    guitarSynthRef.current.volume.value = volToDb(settingsRef.current.guitarVol);

    setToneLoaded(true);
  }, []);

  // Apply guitar style changes (distortion wet + filter cutoff) live when grooveStyle changes
  useEffect(() => {
    if (!guitarDistortionRef.current || !guitarFilterRef.current) return;
    const groove = GROOVE_STYLES[settings.grooveStyle];
    const isHeavy = ["metal", "rock", "punk"].includes(groove.guitar);
    const isClean = ["jazz", "ballad", "country"].includes(groove.guitar);
    guitarDistortionRef.current.wet.value = isHeavy ? 0.5 : 0;
    guitarFilterRef.current.frequency.value = isClean ? 4200 : isHeavy ? 2800 : 3500;
  }, [settings.grooveStyle]);

  function volToDb(vol: number): number {
    if (vol <= 0) return -Infinity;
    return 20 * Math.log10(vol);
  }

  // Update volumes when settings change
  useEffect(() => {
    if (metronomeSynthRef.current) metronomeSynthRef.current.volume.value = volToDb(settings.metronomeVol);
    if (bassSynthRef.current) bassSynthRef.current.volume.value = volToDb(settings.bassVol);
    if (hihatSynthRef.current) hihatSynthRef.current.volume.value = volToDb(settings.drumVol) - 6;
    if (kickSynthRef.current) kickSynthRef.current.volume.value = volToDb(settings.drumVol);
    if (snareSynthRef.current) snareSynthRef.current.volume.value = volToDb(settings.drumVol) - 3;
    if (rideSynthRef.current) rideSynthRef.current.volume.value = volToDb(settings.drumVol) - 10;
    if (crashSynthRef.current) crashSynthRef.current.volume.value = volToDb(settings.drumVol) - 6;
    if (guitarSynthRef.current) guitarSynthRef.current.volume.value = volToDb(settings.guitarVol);
  }, [settings.metronomeVol, settings.bassVol, settings.drumVol, settings.guitarVol]);

  // Update BPM live
  useEffect(() => {
    if (toneRef.current) {
      toneRef.current.getTransport().bpm.value = settings.bpm;
    }
  }, [settings.bpm]);

  // Sync AI backing-track volume to slider (separate audio element)
  useEffect(() => {
    if (aiAudioRef.current) {
      aiAudioRef.current.volume = settings.aiTrackEnabled ? settings.aiTrackVol : 0;
    }
  }, [settings.aiTrackVol, settings.aiTrackEnabled]);

  // ── AI backing-track generation (Suno) ──
  // Uses the existing /api/suno endpoint that AiCoachPage relies on.
  // Maps Jam settings → Suno params: scale = current key letter, mode =
  // "minor"/"major" inferred from key suffix, style = JAM_STYLE label, bpm.
  const generateAiTrack = useCallback(async () => {
    if (aiLoading) return;
    setAiError("");
    setAiLoading(true);

    const isMinor = settings.key.endsWith("m");
    const scale = settings.key.replace(/m$/, "");
    const mode = isMinor ? "minor" : "major";
    const style = JAM_STYLE_LABELS[settings.style];
    const title = `Jam ${scale} ${mode} ${style} ${settings.bpm}bpm`;

    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale, mode, style, bpm: settings.bpm, title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `API ${res.status}` }));
        throw new Error(err.error || `API error ${res.status}`);
      }
      const data = await res.json();
      const track = data.tracks?.[0];
      if (!track) throw new Error("No track returned from Suno");

      const audioUrl = track.audioUrl || track.streamAudioUrl;
      if (!audioUrl) throw new Error("Suno returned no audio URL");

      setAiTrackUrl(audioUrl);
      setAiTrackTitle(track.title || title);
      // Auto-enable AI track so user hears it after generate
      updateSetting("aiTrackEnabled", true);
      recordUsage(10);

      // Persist to the same library AiCoach uses (best-effort).
      try {
        let audioBlob = new Blob();
        try {
          const audioRes = await fetch(audioUrl);
          if (audioRes.ok) audioBlob = await audioRes.blob();
        } catch { /* offline / CORS — skip blob, keep streaming URL */ }
        const libTrack: LibraryTrack = {
          id: track.id || `jam-${Date.now()}`,
          audioBlob,
          audioUrl,
          title: track.title || title,
          style,
          params: { scale, mode, style, bpm: settings.bpm },
          duration: track.duration || 0,
          createdAt: Date.now(),
          source: "generate",
          favorite: false,
        };
        await saveToLibrary(libTrack);
      } catch { /* library save is non-critical */ }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  }, [settings.key, settings.style, settings.bpm, aiLoading, updateSetting]);

  // Toggle AI track playback (separate from the Tone.js transport so users can
  // jam over the AI track without the synthesised drums/bass running).
  const handleAiPlayPause = useCallback(() => {
    const el = aiAudioRef.current;
    if (!el || !aiTrackUrl) return;
    if (el.paused) {
      void el.play().then(() => setAiPlaying(true)).catch(() => {/* autoplay blocked */});
    } else {
      el.pause();
      setAiPlaying(false);
    }
  }, [aiTrackUrl]);

  // ── Transport controls ──

  const handlePlay = useCallback(async () => {
    await initTone();
    const Tone = toneRef.current!;

    if (paused) {
      Tone.getTransport().start();
      setPaused(false);
      setPlaying(true);
      return;
    }

    // Reset state
    beatCountRef.current = 0;
    subCountRef.current = 0;
    chordIdxRef.current = 0;
    setCurrentChordIdx(0);
    setCurrentBeat(0);

    Tone.getTransport().bpm.value = settings.bpm;
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;

    // Dispose old loop
    if (loopRef.current) {
      loopRef.current.dispose();
    }

    // 16th-note resolution scheduler.  Bar length depends on the progression's
    // time signature (4/4 → 16, 3/4 → 12, 6/8 → 12, …).  Drum/bass/guitar
    // sub-patterns below are 4/4-shaped (indices 0-15) so they implicitly
    // truncate when subsPerBar < 16, which is acceptable for the MVP.
    const layout0 = getTimeSigLayout(currentProgression?.timeSignature);
    const subsPerBar = layout0.subsPerBar;
    const subsPerChord = settingsRef.current.barsPerChord * subsPerBar;
    const totalSubs = chordsRef.current.length * subsPerChord;
    subCountRef.current = 0;

    loopRef.current = new Tone.Loop((time) => {
      const s = settingsRef.current;
      const cds = chordsRef.current;
      if (!cds.length) return;

      const spc = s.barsPerChord * subsPerBar;
      const total = cds.length * spc;
      const globalSub = subCountRef.current;
      const subInChord = globalSub % spc;
      const subInBar = subInChord % subsPerBar;
      const chIdx = Math.floor(globalSub / spc) % cds.length;
      const beatInChord = Math.floor(subInChord / layout0.subsPerBeat); // beat index within the chord

      // Metronome - one click per beat, accent pattern from time signature.
      // For compound meters (6/8, 7/8) some beats are silent so the click
      // emphasises the felt pulse.  Pitches: C5=accent, C4=normal, A4=mid.
      if (subInBar % layout0.subsPerBeat === 0 && metronomeSynthRef.current && s.metronomeVol > 0) {
        const beatInBar = subInBar / layout0.subsPerBeat;
        const kind = layout0.accentPattern[beatInBar] || "normal";
        if (kind !== "none") {
          const pitch = kind === "accent" ? "C5" : kind === "mid" ? "A4" : "C4";
          metronomeSynthRef.current.triggerAttackRelease(pitch, "16n", time);
        }
      }

      // ── Bass ──
      if (bassSynthRef.current && s.bassEnabled && s.bassVol > 0) {
        const groove = GROOVE_STYLES[s.grooveStyle];
        const bassPattern = BASS_PATTERNS[groove.bass];
        const chord = cds[chIdx];
        for (const ev of bassPattern.events) {
          if (subInBar === ev.sub) {
            const note = getBassNote(chord.root, chord.quality, ev.tone);
            bassSynthRef.current.triggerAttackRelease(note, ev.duration, time);
            break; // only one bass note per subdivision
          }
        }
      }

      // ── Guitar (chord accompaniment) ──
      if (guitarSynthRef.current && s.guitarEnabled && s.guitarVol > 0) {
        const grooveG = GROOVE_STYLES[s.grooveStyle];
        const guitarPattern = GUITAR_PATTERNS[grooveG.guitar];
        if (guitarPattern.hits.includes(subInBar)) {
          const chord = cds[chIdx];
          const notes = getGuitarChordNotes(chord.root, chord.quality);
          guitarSynthRef.current.triggerAttackRelease(notes, guitarPattern.duration, time);
        }
      }

      // ── Drums ──
      if (s.drumEnabled && s.drumVol > 0) {
        const grooveDrum = GROOVE_STYLES[s.grooveStyle];
        const dp = DRUM_PATTERNS[grooveDrum.drum];

        if (dp.kick.includes(subInBar) && kickSynthRef.current) {
          kickSynthRef.current.triggerAttackRelease("C1", "8n", time);
        }
        if (dp.snare.includes(subInBar) && snareSynthRef.current) {
          snareSynthRef.current.triggerAttackRelease("8n", time);
        }
        if (dp.hihat.includes(subInBar) && hihatSynthRef.current) {
          hihatSynthRef.current.triggerAttackRelease("32n", time);
        }
        if (dp.ride && dp.ride.includes(subInBar) && rideSynthRef.current) {
          rideSynthRef.current.triggerAttackRelease("32n", time);
        }
        if (dp.crash && dp.crash.includes(subInBar) && crashSynthRef.current) {
          crashSynthRef.current.triggerAttackRelease("16n", time);
        }
      }

      // Update UI state (only on beat boundaries to avoid excessive renders)
      if (subInBar % layout0.subsPerBeat === 0) {
        setCurrentBeat(beatInChord);
      }
      if (chIdx !== chordIdxRef.current) {
        chordIdxRef.current = chIdx;
        setCurrentChordIdx(chIdx);
        setChordFlash(true);
        setTimeout(() => setChordFlash(false), 200);
      }

      subCountRef.current++;

      // End of progression
      if (subCountRef.current >= total) {
        if (s.loop) {
          subCountRef.current = 0;
          chordIdxRef.current = 0;
          // Random mode: pick a new random progression in same style
          if (s.randomMode) {
            const filtered = PROGRESSIONS_BY_STYLE[s.style] || [];
            if (filtered.length > 1) {
              let newIdx: number;
              do { newIdx = Math.floor(Math.random() * filtered.length); } while (newIdx === s.progressionIndex && filtered.length > 1);
              setSettings(prev => ({ ...prev, progressionIndex: newIdx }));
            }
          }
        } else {
          // Stop
          Tone.getTransport().stop();
          setPlaying(false);
          setPaused(false);
          setCurrentBeat(0);
          setCurrentChordIdx(0);
          subCountRef.current = 0;
          chordIdxRef.current = 0;
        }
      }
    }, "16n");

    loopRef.current.start(0);
    Tone.getTransport().start();
    setPlaying(true);
    setPaused(false);
  }, [paused, settings.bpm, initTone]);

  const handlePause = useCallback(() => {
    if (toneRef.current && playing) {
      toneRef.current.getTransport().pause();
      setPaused(true);
      setPlaying(false);
    }
  }, [playing]);

  const handleStop = useCallback(() => {
    if (toneRef.current) {
      toneRef.current.getTransport().stop();
      if (loopRef.current) {
        loopRef.current.dispose();
        loopRef.current = null;
      }
    }
    setPlaying(false);
    setPaused(false);
    setCurrentBeat(0);
    setCurrentChordIdx(0);
    beatCountRef.current = 0;
    subCountRef.current = 0;
    chordIdxRef.current = 0;
  }, []);

  // ── Jam recorder controls ──

  const handleStartJamRecord = useCallback(async () => {
    if (isRecordingJam) return;
    setJamRecordError("");
    try {
      // Make sure Tone is initialised (so a context exists to record from).
      await initTone();
      const Tone = toneRef.current;
      if (!Tone) throw new Error("Tone.js not ready");

      const rec = createJamRecorder(Tone);
      // Tap the Suno backing track if it's currently mounted.
      if (aiAudioRef.current) {
        rec.attachAudioElement(aiAudioRef.current);
      }
      await rec.start();
      recorderRef.current = rec;
      recordStartedAtRef.current = performance.now();
      setRecordElapsed(0);
      setIsRecordingJam(true);

      // Tick elapsed seconds for the UI timer.
      recordTimerRef.current = window.setInterval(() => {
        setRecordElapsed(Math.floor((performance.now() - recordStartedAtRef.current) / 1000));
      }, 250);
    } catch (e) {
      setJamRecordError(e instanceof Error ? e.message : "Recording failed to start");
      recorderRef.current?.dispose();
      recorderRef.current = null;
    }
  }, [isRecordingJam, initTone]);

  const handleStopJamRecord = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || !isRecordingJam) return;

    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecordingJam(false);

    try {
      const result = await rec.stop();
      setJamSaveResult({ buffer: result.audioBuffer, durationSec: result.durationSec });
      setShowJamSaveDialog(true);
    } catch (e) {
      setJamRecordError(e instanceof Error ? e.message : "Failed to finalise recording");
    } finally {
      rec.dispose();
      recorderRef.current = null;
    }
  }, [isRecordingJam]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const buildJamFilename = useCallback((ext: "wav" | "mp3") => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;
    return `Jam Session - ${stamp}.${ext}`;
  }, []);

  const handleSaveJamWav = useCallback(async () => {
    if (!jamSaveResult || jamSaveBusy) return;
    setJamSaveBusy("wav");
    try {
      const wav = audioBufferToWav(jamSaveResult.buffer);
      downloadBlob(new Blob([wav], { type: "audio/wav" }), buildJamFilename("wav"));
    } catch (e) {
      setJamRecordError(e instanceof Error ? e.message : "WAV export failed");
    } finally {
      setJamSaveBusy("");
    }
  }, [jamSaveResult, jamSaveBusy, buildJamFilename, downloadBlob]);

  const handleSaveJamMp3 = useCallback(async () => {
    if (!jamSaveResult || jamSaveBusy) return;
    setJamSaveBusy("mp3");
    try {
      const mp3 = await audioBufferToMp3(jamSaveResult.buffer, { kbps: 192 });
      downloadBlob(new Blob([mp3], { type: "audio/mpeg" }), buildJamFilename("mp3"));
    } catch (e) {
      setJamRecordError(e instanceof Error ? e.message : "MP3 export failed");
    } finally {
      setJamSaveBusy("");
    }
  }, [jamSaveResult, jamSaveBusy, buildJamFilename, downloadBlob]);

  const closeJamSaveDialog = useCallback(() => {
    setShowJamSaveDialog(false);
    setJamSaveResult(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toneRef.current) {
        toneRef.current.getTransport().stop();
        toneRef.current.getTransport().cancel();
      }
      if (loopRef.current) loopRef.current.dispose();
      metronomeSynthRef.current?.dispose();
      bassSynthRef.current?.dispose();
      hihatSynthRef.current?.dispose();
      kickSynthRef.current?.dispose();
      snareSynthRef.current?.dispose();
      rideSynthRef.current?.dispose();
      crashSynthRef.current?.dispose();
      guitarSynthRef.current?.dispose();
      guitarFilterRef.current?.dispose();
      guitarDistortionRef.current?.dispose();
      toneRef.current = null;
      // Recorder cleanup
      if (recordTimerRef.current !== null) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      recorderRef.current?.dispose();
      recorderRef.current = null;
    };
  }, []);

  // ── Progress calculation ──
  // Beats-per-bar derives from the progression's time signature so the
  // progress strip + Bar X/Y indicator stay accurate for 3/4, 6/8, etc.
  const tsLayout = getTimeSigLayout(currentProgression?.timeSignature);
  const beatsPerBar = tsLayout.beatsPerBar;
  const beatsPerChord = settings.barsPerChord * beatsPerBar;
  const totalBeats = chords.length * beatsPerChord;
  const globalBeat = currentChordIdx * beatsPerChord + currentBeat;
  const progressPct = totalBeats > 0 ? (globalBeat / totalBeats) * 100 : 0;

  const currentChord = chords[currentChordIdx] || { display: "-", root: "A", quality: "", numeral: "" };
  const nextChordIdx = (currentChordIdx + 1) % chords.length;
  const nextChord = chords[nextChordIdx] || { display: "-", root: "A", quality: "", numeral: "" };

  return (
    <div className="w-full min-w-0 max-w-[960px] lg:max-w-[1100px] xl:max-w-[1280px] mx-auto px-2 sm:px-5 py-3 sm:py-5 pb-[72px] md:pb-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-3 sm:mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#e8e4dc] font-heading tracking-tight">Jam Mode</h1>
          <p className="hidden sm:block text-[11px] sm:text-xs text-[#6b6560] mt-0.5">Play along to chord progressions with real-time cues</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-[10px] px-2.5 py-1.5 rounded-md font-label transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "#6b6560",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          title={showSettings ? "Hide Settings" : "Show Settings"}
        >
          {showSettings ? "Hide" : "Settings"}
        </button>
      </div>

      {/* Settings Panel - always visible by default */}
      {showSettings && (
        <div
          className="rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #1a1a1e 0%, #141418 100%)",
            border: "1px solid #2a2a2e",
          }}
        >
          {/* Section: Progression */}
          <div className="text-[9px] font-label uppercase tracking-[0.15em] text-[#D4A843]/70 mb-2">Progression</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-h-[64px]">
            {/* Key */}
            <div className="min-w-0">
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Key</label>
              <select
                value={settings.key}
                onChange={e => updateSetting("key", e.target.value)}
                className="input w-full min-w-0 !rounded !px-2 !py-1.5 !text-xs font-label"
              >
                {KEYS.map(k => (
                  <optgroup key={k} label={k}>
                    <option value={k}>{k} Major</option>
                    <option value={k + "m"}>{k}m</option>
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Style */}
            <div className="min-w-0">
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Style</label>
              <select
                value={settings.style}
                onChange={e => {
                  const newStyle = e.target.value as JamStyleKey;
                  const wasPlaying = playing;
                  // Stop playback when style changes to prevent stale progression
                  if (playing || paused) handleStop();
                  updateSetting("style", newStyle);
                  updateSetting("progressionIndex", 0);
                  // Auto-select matching groove
                  const matchedGroove = JAM_STYLE_TO_GROOVE[newStyle] as GrooveStyleName | undefined;
                  if (matchedGroove) updateSetting("grooveStyle", matchedGroove);
                  // Auto-restart playback after a tick so new chords are picked up
                  if (wasPlaying) {
                    setTimeout(() => handlePlay(), 50);
                  }
                }}
                className="input w-full min-w-0 !rounded !px-2 !py-1.5 !text-xs font-label"
              >
                {JAM_STYLE_LIST.map(s => <option key={s} value={s}>{JAM_STYLE_LABELS[s]}</option>)}
              </select>
            </div>

            {/* Progression */}
            <div className="min-h-[52px] min-w-0">
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Progression</label>
              <select
                value={settings.progressionIndex}
                onChange={e => {
                  const wasPlaying = playing;
                  if (playing || paused) handleStop();
                  updateSetting("progressionIndex", Number(e.target.value));
                  // Auto-restart playback after a tick so new chords are picked up
                  if (wasPlaying) {
                    setTimeout(() => handlePlay(), 50);
                  }
                }}
                className="input w-full min-w-0 !rounded !px-2 !py-1.5 !text-xs font-label"
              >
                {filteredProgressions.map((p, i) => (
                  <option key={i} value={i}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Bars per chord */}
            <div className="min-w-0">
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Bars / Chord</label>
              <div className="flex gap-1">
                {[1, 2, 4].map(b => (
                  <button
                    key={b}
                    onClick={() => updateSetting("barsPerChord", b)}
                    className={`flex-1 rounded px-2 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-label transition-colors border ${settings.barsPerChord === b ? "bg-amber-500/20 border-amber-500 text-amber-400 font-semibold" : "text-[#9a9590] border-white/10 hover:border-white/20"}`}
                    style={settings.barsPerChord === b ? undefined : {
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Tempo */}
          <div className="h-px bg-[#2a2a2e] my-3 sm:my-4" />
          <div className="text-[9px] font-label uppercase tracking-[0.15em] text-[#D4A843]/70 mb-2">Tempo</div>

          {/* BPM Slider */}
          <div className="mt-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">BPM</label>
              <span className="text-xs text-[#D4A843] font-mono font-bold truncate ml-2">{settings.bpm} BPM</span>
            </div>
            <input
              type="range"
              min={40}
              max={220}
              value={settings.bpm}
              onChange={e => updateSetting("bpm", Number(e.target.value))}
              className="w-full accent-[#D4A843] h-1.5"
            />
            <div className="flex justify-between text-[9px] text-[#555] font-mono mt-0.5">
              <span>40</span>
              <span>220</span>
            </div>
          </div>

          {/* Section: Mixer */}
          <div className="h-px bg-[#2a2a2e] my-3 sm:my-4" />
          <div className="text-[9px] font-label uppercase tracking-[0.15em] text-[#D4A843]/70 mb-2">Mixer</div>

          {/* Audio controls row - 4-col grid on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">
            {/* Metronome volume */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1 min-w-0">
                <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider shrink-0">Click</label>
                <span className="text-[10px] text-[#9a9590] font-mono shrink-0">{Math.round(settings.metronomeVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.metronomeVol * 100)}
                onChange={e => updateSetting("metronomeVol", Number(e.target.value) / 100)}
                className="w-full accent-[#D4A843] h-1"
              />
            </div>

            {/* Bass */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider shrink-0">Bass</label>
                  <button
                    onClick={() => updateSetting("bassEnabled", !settings.bassEnabled)}
                    className="text-[9px] px-1.5 py-1.5 sm:py-0.5 min-h-[36px] sm:min-h-0 rounded font-label transition-colors"
                    style={{
                      background: settings.bassEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: settings.bassEnabled ? "#22c55e" : "#555",
                      border: `1px solid ${settings.bassEnabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {settings.bassEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <span className="text-[10px] text-[#9a9590] font-mono shrink-0">{Math.round(settings.bassVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.bassVol * 100)}
                onChange={e => updateSetting("bassVol", Number(e.target.value) / 100)}
                className="w-full accent-[#22c55e] h-1"
                disabled={!settings.bassEnabled}
              />
            </div>

            {/* Guitar */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider shrink-0">Guitar</label>
                  <button
                    onClick={() => updateSetting("guitarEnabled", !settings.guitarEnabled)}
                    className="text-[9px] px-1.5 py-1.5 sm:py-0.5 min-h-[36px] sm:min-h-0 rounded font-label transition-colors"
                    style={{
                      background: settings.guitarEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: settings.guitarEnabled ? "#22c55e" : "#555",
                      border: `1px solid ${settings.guitarEnabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {settings.guitarEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <span className="text-[10px] text-[#9a9590] font-mono shrink-0">{Math.round(settings.guitarVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.guitarVol * 100)}
                onChange={e => updateSetting("guitarVol", Number(e.target.value) / 100)}
                className="w-full accent-[#f59e0b] h-1"
                disabled={!settings.guitarEnabled}
              />
            </div>

            {/* Drums */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider shrink-0">Drums</label>
                  <button
                    onClick={() => updateSetting("drumEnabled", !settings.drumEnabled)}
                    className="text-[9px] px-1.5 py-1.5 sm:py-0.5 min-h-[36px] sm:min-h-0 rounded font-label transition-colors"
                    style={{
                      background: settings.drumEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: settings.drumEnabled ? "#22c55e" : "#555",
                      border: `1px solid ${settings.drumEnabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {settings.drumEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <span className="text-[10px] text-[#9a9590] font-mono shrink-0">{Math.round(settings.drumVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.drumVol * 100)}
                onChange={e => updateSetting("drumVol", Number(e.target.value) / 100)}
                className="w-full accent-[#22c55e] h-1"
                disabled={!settings.drumEnabled}
              />
            </div>
          </div>

          {/* Section: AI Backing Track (Suno) */}
          <div className="h-px bg-[#2a2a2e] my-3 sm:my-4" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-label uppercase tracking-[0.15em] text-[#D4A843]/70">AI Backing Track</div>
            <button
              onClick={() => setAiPanelOpen(o => !o)}
              className="text-[9px] px-2 py-1 rounded font-label transition-colors"
              style={{
                background: aiPanelOpen ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.05)",
                color: aiPanelOpen ? "#D4A843" : "#9a9590",
                border: `1px solid ${aiPanelOpen ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {aiPanelOpen ? "Hide" : "Show"}
            </button>
          </div>

          {aiPanelOpen && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Prompt preview row */}
              <div className="text-[10px] text-[#9a9590] font-label leading-snug">
                <span className="text-[#6b6560] uppercase tracking-wider">Prompt: </span>
                <span className="font-mono text-[#D4A843]">
                  {settings.key.replace(/m$/, "")} {settings.key.endsWith("m") ? "minor" : "major"}
                </span>
                <span className="text-[#6b6560]"> · </span>
                <span className="font-mono text-[#D4A843]">{JAM_STYLE_LABELS[settings.style]}</span>
                <span className="text-[#6b6560]"> · </span>
                <span className="font-mono text-[#D4A843]">{settings.bpm} BPM</span>
              </div>

              {/* Generate + Play/Pause + Volume */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={generateAiTrack}
                  disabled={aiLoading}
                  className="text-[10px] px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 rounded font-label font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: aiLoading ? "rgba(212,168,67,0.1)" : "rgba(212,168,67,0.18)",
                    color: "#D4A843",
                    border: "1px solid rgba(212,168,67,0.35)",
                  }}
                >
                  {aiLoading ? "Generating… (up to 2 min)" : aiTrackUrl ? "Regenerate" : "Generate"}
                </button>

                {aiTrackUrl && (
                  <button
                    onClick={handleAiPlayPause}
                    className="text-[10px] px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 rounded font-label transition-colors"
                    style={{
                      background: aiPlaying ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: aiPlaying ? "#22c55e" : "#9a9590",
                      border: `1px solid ${aiPlaying ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {aiPlaying ? "Pause" : "Play"}
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto min-w-[140px]">
                  <button
                    onClick={() => updateSetting("aiTrackEnabled", !settings.aiTrackEnabled)}
                    disabled={!aiTrackUrl}
                    className="text-[9px] px-1.5 py-1 rounded font-label transition-colors disabled:opacity-30"
                    style={{
                      background: settings.aiTrackEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: settings.aiTrackEnabled ? "#22c55e" : "#555",
                      border: `1px solid ${settings.aiTrackEnabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {settings.aiTrackEnabled ? "ON" : "OFF"}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.aiTrackVol * 100)}
                    onChange={e => updateSetting("aiTrackVol", Number(e.target.value) / 100)}
                    disabled={!aiTrackUrl || !settings.aiTrackEnabled}
                    className="flex-1 accent-[#D4A843] h-1"
                    title={`AI track volume: ${Math.round(settings.aiTrackVol * 100)}%`}
                  />
                  <span className="text-[10px] text-[#9a9590] font-mono shrink-0 w-9 text-right">
                    {Math.round(settings.aiTrackVol * 100)}%
                  </span>
                </div>
              </div>

              {/* Status line */}
              {aiTrackTitle && !aiError && (
                <div className="text-[10px] text-[#22c55e] font-label truncate">
                  Loaded: {aiTrackTitle}
                </div>
              )}
              {aiError && (
                <div className="text-[10px] text-[#ef4444] font-label">
                  {aiError}
                </div>
              )}

              {/* Hidden audio element — actual playback */}
              {aiTrackUrl && (
                <audio
                  ref={aiAudioRef}
                  src={aiTrackUrl}
                  loop
                  preload="auto"
                  onPlay={() => setAiPlaying(true)}
                  onPause={() => setAiPlaying(false)}
                  onEnded={() => setAiPlaying(false)}
                />
              )}
            </div>
          )}

          {/* Section: Groove */}
          <div className="h-px bg-[#2a2a2e] my-3 sm:my-4" />
          <div className="text-[9px] font-label uppercase tracking-[0.15em] text-[#D4A843]/70 mb-2">Groove Style</div>

          {/* Groove style selector (unified drum + bass) */}
          <div className="min-h-[56px]">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap min-h-[32px]">
              {GROOVE_STYLE_LIST.map(g => {
                const isActive = settings.grooveStyle === g;
                const enabled = settings.drumEnabled || settings.bassEnabled || settings.guitarEnabled;
                return (
                  <button
                    key={g}
                    onClick={() => updateSetting("grooveStyle", g)}
                    disabled={!enabled}
                    className="shrink-0 px-2 sm:px-3 py-2 sm:py-1.5 rounded text-[10px] sm:text-[11px] font-label transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: isActive ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.05)",
                      color: isActive ? "#D4A843" : "#9a9590",
                      border: `1px solid ${isActive ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {GROOVE_STYLES[g].name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles row */}
          <div className="h-px bg-[#2a2a2e] my-3 sm:my-4" />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateSetting("loop", !settings.loop)}
              className="text-[10px] px-3 py-2 sm:py-1 rounded font-label transition-colors"
              style={{
                background: settings.loop ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.05)",
                color: settings.loop ? "#D4A843" : "#6b6560",
                border: `1px solid ${settings.loop ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              Loop {settings.loop ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => updateSetting("randomMode", !settings.randomMode)}
              className="text-[10px] px-3 py-2 sm:py-1 rounded font-label transition-colors"
              style={{
                background: settings.randomMode ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
                color: settings.randomMode ? "#a78bfa" : "#6b6560",
                border: `1px solid ${settings.randomMode ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              Random {settings.randomMode ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      )}

      {/* ── Play Area ── distinct, premium card */}
      <div
        className="rounded-xl overflow-hidden relative"
        style={{
          background: "radial-gradient(ellipse at top, rgba(212,168,67,0.06) 0%, rgba(10,10,10,0.0) 60%), linear-gradient(180deg, #121214 0%, #0d0d10 100%)",
          border: "1px solid #2a2a2e",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        {/* Progress bar */}
        <div className="h-1.5 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #D4A843, #b8902e)",
            }}
          />
        </div>

        {/* Chord progression strip - fixed height prevents layout shift on style change */}
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide min-h-[44px]" style={{ background: "rgba(255,255,255,0.02)" }}>
          {chords.map((c, i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded px-2 py-1 text-[10px] sm:text-[11px] font-mono transition-all duration-150"
              style={{
                background: i === currentChordIdx
                  ? "rgba(212,168,67,0.2)"
                  : i < currentChordIdx && playing
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.04)",
                color: i === currentChordIdx ? "#D4A843" : "#6b6560",
                border: `1px solid ${i === currentChordIdx ? "rgba(212,168,67,0.4)" : "transparent"}`,
                transform: i === currentChordIdx ? "scale(1.05)" : "scale(1)",
              }}
            >
              <span className="block text-[8px] opacity-50">{c.numeral}</span>
              {c.display}
            </div>
          ))}
        </div>

        {/* Big chord display */}
        <div className="relative flex flex-col items-center justify-center py-4 sm:py-14 px-4">
          {/* Current chord numeral */}
          <div className="text-[11px] sm:text-sm text-[#6b6560] font-mono mb-2 tracking-wider">
            {currentChord.numeral}
          </div>

          {/* Current chord name */}
          <div
            className="transition-all duration-150"
            style={{
              fontSize: "clamp(3rem, 12vw, 7rem)",
              fontFamily: "'Oswald', system-ui, sans-serif",
              fontWeight: 700,
              color: chordFlash ? "#fff" : "#D4A843",
              textShadow: chordFlash
                ? "0 0 40px rgba(212,168,67,0.8), 0 0 80px rgba(212,168,67,0.4)"
                : "0 0 20px rgba(212,168,67,0.3)",
              transform: chordFlash ? "scale(1.05)" : "scale(1)",
              lineHeight: 1,
            }}
          >
            {currentChord.display}
          </div>

          {/* Next chord preview */}
          <div className="mt-4 flex items-center gap-2 text-[#555]">
            <span className="text-[10px] font-label uppercase tracking-wider">Next</span>
            <span className="text-lg sm:text-xl font-bold text-[#7a7570]" style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}>
              {nextChord.display}
            </span>
          </div>

          {/* Beat indicators - one dot per beat in the bar (varies by time sig) */}
          <div className="mt-6 flex items-center gap-3">
            {Array.from({ length: beatsPerBar }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-100"
                style={{
                  width: i === 0 ? 16 : 12,
                  height: i === 0 ? 16 : 12,
                  borderRadius: "50%",
                  background: (currentBeat % beatsPerBar) === i && (playing || paused)
                    ? i === 0
                      ? "#D4A843"
                      : "rgba(212,168,67,0.6)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: (currentBeat % beatsPerBar) === i && (playing || paused)
                    ? `0 0 12px ${i === 0 ? "rgba(212,168,67,0.6)" : "rgba(212,168,67,0.3)"}`
                    : "none",
                  border: i === 0 ? "2px solid rgba(212,168,67,0.3)" : "1px solid rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>

          {/* Bar indicator - LED-style pill */}
          <div className="mt-3 flex items-center gap-2 text-[10px] font-mono">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(212,168,67,0.08)",
                border: "1px solid rgba(212,168,67,0.2)",
                color: "#D4A843",
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  background: playing ? "#D4A843" : "#555",
                  boxShadow: playing ? "0 0 6px rgba(212,168,67,0.8)" : "none",
                }}
              />
              Bar {Math.floor(currentBeat / beatsPerBar) + 1}/{settings.barsPerChord}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-[#9a9590]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Chord {currentChordIdx + 1}/{chords.length}
            </span>
          </div>
        </div>

        {/* Transport controls - always inline, prominent, dedicated area */}
        <div
          className="flex items-center justify-center gap-4 px-4 py-5 sm:py-6"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.25) 100%)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={handleStop}
            disabled={!playing && !paused}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 hover:brightness-110"
            style={{
              background: playing || paused ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${playing || paused ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: playing || paused ? "#ef4444" : "#555",
            }}
            title="Stop"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>

          <button
            onClick={playing ? handlePause : handlePlay}
            className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 hover:brightness-110"
            style={{
              background: playing
                ? "linear-gradient(135deg, #22c55e, #16a34a)"
                : "linear-gradient(135deg, #D4A843, #b8902e)",
              border: playing
                ? "2px solid rgba(34,197,94,0.7)"
                : "2px solid rgba(212,168,67,0.7)",
              color: "#121214",
              boxShadow: playing
                ? "0 6px 28px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.25)"
                : "0 6px 28px rgba(212,168,67,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
            title={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <rect x="5" y="4" width="3.5" height="12" rx="1" />
                <rect x="11.5" y="4" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 4l10 6-10 6V4z" />
              </svg>
            )}
          </button>

          {/* Record Full Jam button */}
          <button
            onClick={isRecordingJam ? handleStopJamRecord : handleStartJamRecord}
            className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 hover:brightness-110"
            style={{
              background: isRecordingJam
                ? "rgba(239,68,68,0.85)"
                : "rgba(239,68,68,0.12)",
              border: `1px solid ${isRecordingJam ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.45)"}`,
              color: isRecordingJam ? "#fff" : "#ef4444",
              boxShadow: isRecordingJam ? "0 0 18px rgba(239,68,68,0.55)" : undefined,
              animation: isRecordingJam ? "pulse 1.6s ease-in-out infinite" : undefined,
            }}
            title={isRecordingJam ? `Recording: ${recordElapsed}s — click to stop & save` : "Record Full Jam"}
            data-testid="jam-record-btn"
          >
            {isRecordingJam ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="5" />
              </svg>
            )}
            {isRecordingJam && (
              <span
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#ef4444] whitespace-nowrap"
                aria-live="polite"
              >
                ● {Math.floor(recordElapsed / 60)}:{String(recordElapsed % 60).padStart(2, "0")}
              </span>
            )}
          </button>
        </div>
        {jamRecordError && (
          <div className="px-4 pb-3 -mt-1 text-[11px] text-[#ef4444] text-center font-label">
            {jamRecordError}
          </div>
        )}
      </div>

      {/* ── Save Jam Recording dialog ── */}
      {showJamSaveDialog && jamSaveResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={closeJamSaveDialog}
        >
          <div
            className="rounded-xl p-5 sm:p-6 w-full max-w-md"
            style={{
              background: "linear-gradient(180deg, #1a1a1e 0%, #141418 100%)",
              border: "1px solid rgba(212,168,67,0.25)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#e8e4dc] font-heading">Save Jam Recording</h3>
                <p className="text-[11px] text-[#9a9590] mt-1 font-label">
                  Duration: {jamSaveResult.durationSec.toFixed(1)}s — choose a format
                </p>
              </div>
              <button
                onClick={closeJamSaveDialog}
                className="text-[#6b6560] hover:text-[#e8e4dc] transition-colors text-lg leading-none"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="text-[10px] text-[#6b6560] font-label mb-4 leading-relaxed">
              Captures backing tracks (drums, bass, guitar AI, metronome, Suno).
              Looper recordings are saved separately in the Looper panel.
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={handleSaveJamWav}
                disabled={!!jamSaveBusy}
                className="px-3 py-2.5 rounded-md text-xs font-label transition-colors disabled:opacity-50"
                style={{
                  background: "rgba(212,168,67,0.18)",
                  border: "1px solid rgba(212,168,67,0.45)",
                  color: "#D4A843",
                }}
              >
                {jamSaveBusy === "wav" ? "Encoding…" : "Download WAV"}
              </button>
              <button
                onClick={handleSaveJamMp3}
                disabled={!!jamSaveBusy}
                className="px-3 py-2.5 rounded-md text-xs font-label transition-colors disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e8e4dc",
                }}
              >
                {jamSaveBusy === "mp3" ? "Encoding…" : "Download MP3"}
              </button>
            </div>
            <button
              onClick={closeJamSaveDialog}
              className="w-full px-3 py-2 rounded-md text-[11px] font-label text-[#9a9590] hover:text-[#e8e4dc] transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Scale Guide ── */}
      <div className="panel-secondary mt-4 sm:mt-6 rounded-lg p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#e8e4dc] font-heading">Scale Guide</h2>
          <div className="flex gap-1">
            {(["natural", "pentatonic", "blues"] as const).map(t => (
              <button
                key={t}
                onClick={() => updateSetting("scaleType", t)}
                title={`${t.charAt(0).toUpperCase() + t.slice(1)} scale for ${settings.key}`}
                className="text-[10px] px-2 py-2 sm:py-1 rounded font-label capitalize transition-colors"
                style={{
                  background: settings.scaleType === t ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.05)",
                  color: settings.scaleType === t ? "#D4A843" : "#6b6560",
                  border: `1px solid ${settings.scaleType === t ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-[#9a9590] font-label mb-2">{scaleInfo.name}</div>

        {/* Visual fretboard — scale notes + current chord highlights */}
        <div className="mb-3 -mx-1 sm:mx-0">
          <JamFretboard
            scaleNotes={scaleInfo.notes}
            rootNote={settings.key.replace("m", "")}
            chordRoot={currentChord.root}
            chordQuality={currentChord.quality}
            frets={15}
            preferFlats={["F", "Bb", "Eb", "Ab", "Db"].includes(settings.key.replace("m", ""))}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {scaleInfo.notes.map((n, i) => (
            <div
              key={i}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded flex items-center justify-center text-xs sm:text-sm font-mono font-bold transition-colors"
              style={{
                background: n === currentChord.root
                  ? "rgba(212,168,67,0.25)"
                  : "rgba(255,255,255,0.06)",
                color: n === currentChord.root ? "#D4A843" : "#9a9590",
                border: `1px solid ${n === currentChord.root ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Current chord tones highlight */}
        <div className="mt-3 text-[10px] text-[#6b6560] font-label">
          <span className="uppercase tracking-wider">Root note: </span>
          <span className="text-[#D4A843] font-mono font-bold">{currentChord.root}</span>
          {currentChord.quality && (
            <>
              <span className="mx-2 text-[#333]">|</span>
              <span className="uppercase tracking-wider">Quality: </span>
              <span className="text-[#9a9590] font-mono">{currentChord.quality || "major"}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Progression Info ── */}
      {currentProgression && (
        <div className="panel-secondary mt-4 sm:mt-6 rounded-lg p-3 sm:p-4 overflow-hidden min-h-[180px] sm:min-h-[160px]">
          <h2 className="text-sm font-bold text-[#e8e4dc] font-heading mb-2">Progression Details</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] min-w-0 overflow-hidden">
            <div className="shrink-0">
              <span className="text-[#6b6560] font-label">Name: </span>
              <span className="text-[#9a9590]">{currentProgression.name}</span>
            </div>
            <div className="shrink-0">
              <span className="text-[#6b6560] font-label">Style: </span>
              <span className="text-[#9a9590]">{JAM_STYLE_LABELS[settings.style]}</span>
            </div>
            <div className="shrink-0">
              <span className="text-[#6b6560] font-label">Time: </span>
              <span className="text-[#9a9590] font-mono">{currentProgression.timeSignature}</span>
            </div>
            <div className="shrink-0">
              <span className="text-[#6b6560] font-label">Bars: </span>
              <span className="text-[#9a9590] font-mono">{currentProgression.bars}</span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="text-[#6b6560] font-label">Chords: </span>
              <span className="text-[#D4A843] font-mono break-all">{chords.map(c => c.display).join(" - ")}</span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="text-[#6b6560] font-label">Numerals: </span>
              <span className="text-[#9a9590] font-mono break-all">{currentProgression.nashville.join(" - ")}</span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="text-[#6b6560] font-label">Mood: </span>
              <span className="text-[#9a9590]">{currentProgression.mood}</span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="text-[#6b6560] font-label">Example: </span>
              <span className="text-[#9a9590]">{currentProgression.famousExample}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Looper ── */}
      <JamLooper bpm={settings.bpm} jamPlaying={playing} />
    </div>
  );
}
