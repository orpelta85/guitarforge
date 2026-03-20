"use client";
import { useState, useRef, useEffect } from "react";
import FretboardChallenge from "./FretboardChallenge";

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const TUNING = [40,45,50,55,59,64];
const STR = ["E","A","D","G","B","e"];
const FRETS = 15;
const FRET_MARKERS = [3,5,7,9,12,15];
const IV_NAMES = ["R","b2","2","b3","3","4","b5","5","b6","6","b7","7"];

const ALL_INTERVALS = [
  { name: "m2", label: "Minor 2nd", st: 1, color: "#ef4444", ref: "Jaws" },
  { name: "M2", label: "Major 2nd", st: 2, color: "#f97316", ref: "Happy Birthday" },
  { name: "m3", label: "Minor 3rd", st: 3, color: "#eab308", ref: "Greensleeves" },
  { name: "M3", label: "Major 3rd", st: 4, color: "#84cc16", ref: "When the Saints" },
  { name: "P4", label: "Perfect 4th", st: 5, color: "#22c55e", ref: "Here Comes the Bride" },
  { name: "TT", label: "Tritone", st: 6, color: "#14b8a6", ref: "Black Sabbath" },
  { name: "P5", label: "Perfect 5th", st: 7, color: "#06b6d4", ref: "Star Wars" },
  { name: "m6", label: "Minor 6th", st: 8, color: "#3b82f6", ref: "Go Down Moses" },
  { name: "M6", label: "Major 6th", st: 9, color: "#6366f1", ref: "My Bonnie" },
  { name: "m7", label: "Minor 7th", st: 10, color: "#8b5cf6", ref: "Somewhere (WSS)" },
  { name: "M7", label: "Major 7th", st: 11, color: "#a855f7", ref: "Superman Theme" },
  { name: "P8", label: "Octave", st: 12, color: "#ec4899", ref: "Over the Rainbow" },
];
const ALL_CHORDS = [
  { name: "Major", iv: [0,4,7], color: "#22c55e" },
  { name: "Minor", iv: [0,3,7], color: "#3b82f6" },
  { name: "Dim", iv: [0,3,6], color: "#ef4444" },
  { name: "Aug", iv: [0,4,8], color: "#f97316" },
  { name: "Dom7", iv: [0,4,7,10], color: "#eab308" },
  { name: "Maj7", iv: [0,4,7,11], color: "#84cc16" },
  { name: "Min7", iv: [0,3,7,10], color: "#6366f1" },
  { name: "Dim7", iv: [0,3,6,9], color: "#ec4899" },
  { name: "Sus2", iv: [0,2,7], color: "#14b8a6" },
  { name: "Sus4", iv: [0,5,7], color: "#06b6d4" },
];
const ALL_SCALES = [
  { name: "Major", notes: [0,2,4,5,7,9,11], color: "#22c55e" },
  { name: "Nat. Minor", notes: [0,2,3,5,7,8,10], color: "#3b82f6" },
  { name: "Dorian", notes: [0,2,3,5,7,9,10], color: "#8b5cf6" },
  { name: "Phrygian", notes: [0,1,3,5,7,8,10], color: "#ef4444" },
  { name: "Lydian", notes: [0,2,4,6,7,9,11], color: "#eab308" },
  { name: "Mixolydian", notes: [0,2,4,5,7,9,10], color: "#f97316" },
  { name: "Harm. Minor", notes: [0,2,3,5,7,8,11], color: "#ec4899" },
  { name: "Pent. Minor", notes: [0,3,5,7,10], color: "#06b6d4" },
  { name: "Blues", notes: [0,3,5,6,7,10], color: "#14b8a6" },
];

const SCALE_F: Record<string, { formula: number[]; desc: string }> = {
  "Major (Ionian)": { formula: [0,2,4,5,7,9,11], desc: "Bright, happy" },
  "Natural Minor (Aeolian)": { formula: [0,2,3,5,7,8,10], desc: "Sad, dark" },
  "Dorian": { formula: [0,2,3,5,7,9,10], desc: "Jazzy minor, bright 6th" },
  "Phrygian": { formula: [0,1,3,5,7,8,10], desc: "Dark, Spanish — b2" },
  "Lydian": { formula: [0,2,4,6,7,9,11], desc: "Dreamy — #4" },
  "Mixolydian": { formula: [0,2,4,5,7,9,10], desc: "Bluesy — b7" },
  "Harmonic Minor": { formula: [0,2,3,5,7,8,11], desc: "Classical, exotic" },
  "Minor Pentatonic": { formula: [0,3,5,7,10], desc: "The guitar scale" },
  "Major Pentatonic": { formula: [0,2,4,7,9], desc: "Country, happy" },
  "Blues": { formula: [0,3,5,6,7,10], desc: "Pentatonic + blue note" },
};
const CHORD_SUFFIXES = [
  { name: "major", label: "Major" },{ name: "minor", label: "Minor" },
  { name: "7", label: "7" },{ name: "maj7", label: "Maj7" },{ name: "m7", label: "m7" },
  { name: "dim", label: "Dim" },{ name: "aug", label: "Aug" },
  { name: "sus2", label: "Sus2" },{ name: "sus4", label: "Sus4" },
  { name: "9", label: "9" },{ name: "add9", label: "Add9" },{ name: "6", label: "6" },
  { name: "dim7", label: "Dim7" },{ name: "m7b5", label: "m7b5" },
];
const PROG_QUESTIONS = [
  { name: "I - IV - V - I", chords: [[0,4,7],[5,9,12],[7,11,14],[0,4,7]] },
  { name: "i - bVI - bVII - i", chords: [[0,3,7],[8,12,15],[10,14,17],[0,3,7]] },
  { name: "I - V - vi - IV", chords: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]] },
  { name: "ii - V - I", chords: [[2,5,9],[7,11,14],[0,4,7]] },
  { name: "I - vi - IV - V", chords: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]] },
  { name: "i - iv - v - i", chords: [[0,3,7],[5,8,12],[7,10,14],[0,3,7]] },
];
const PROG_PRESETS = [
  { g: "Metal", n: "i–bVI–bVII–i", ch: ["Am","F","G","Am"] },
  { g: "Blues 12-Bar", n: "I7–IV7–V7–I7", ch: ["A7","D7","E7","A7"] },
  { g: "Classic Rock", n: "I–IV–V–I", ch: ["A","D","E","A"] },
  { g: "Doom", n: "i–bII–i", ch: ["Am","Bb","Am"] },
  { g: "Pop-Punk", n: "I–V–vi–IV", ch: ["C","G","Am","F"] },
  { g: "Jazz", n: "ii–V–I", ch: ["Bm7","E7","Amaj7"] },
  { g: "Grunge", n: "i–iv–i–v", ch: ["Em","Am","Em","Bm"] },
  { g: "Ballad", n: "I–vi–IV–V", ch: ["C","Am","F","G"] },
  { g: "Progressive Metal", n: "i–bVI–bVII–iv", ch: ["Am","F","G","Dm"] },
  { g: "Neo-Classical", n: "i–bII–V–i", ch: ["Am","Bb","E","Am"] },
  { g: "Funk", n: "I7–IV7–I7–V7", ch: ["A7","D7","A7","E7"] },
  { g: "Country", n: "I–IV–V–I", ch: ["A","D","E","A"] },
];
const ACHIEVEMENTS = [
  { id: "first10", name: "First Steps", desc: "10 answers", need: 10, key: "total" },
  { id: "first50", name: "Warming Up", desc: "50 answers", need: 50, key: "total" },
  { id: "streak5", name: "On Fire", desc: "5x streak", need: 5, key: "streak" },
  { id: "streak10", name: "Unstoppable", desc: "10x streak", need: 10, key: "streak" },
  { id: "streak25", name: "Iron Ears", desc: "25x streak", need: 25, key: "streak" },
  { id: "acc90", name: "Sharp Ear", desc: "90%+ (20+ questions)", need: 90, key: "accuracy" },
  { id: "lv5", name: "Apprentice", desc: "Level 5", need: 5, key: "level" },
  { id: "lv10", name: "Journeyman", desc: "Level 10", need: 10, key: "level" },
  { id: "lv25", name: "Master", desc: "Level 25", need: 25, key: "level" },
  { id: "lv50", name: "Grand Master", desc: "Level 50", need: 50, key: "level" },
];

/* ── Chord shapes for fretboard chord exercise ── */
const CHORD_SHAPES: { name: string; iv: number[]; positions: number[][] }[] = [
  { name: "Major", iv: [0,4,7], positions: [[0,0],[1,2],[2,2],[3,1],[4,0],[5,0]] },
  { name: "Minor", iv: [0,3,7], positions: [[0,0],[1,2],[2,2],[3,0],[4,0],[5,0]] },
  { name: "Dim", iv: [0,3,6], positions: [[1,0],[2,1],[3,2],[4,1]] },
  { name: "Aug", iv: [0,4,8], positions: [[1,0],[2,1],[3,2],[4,2]] },
  { name: "Dom7", iv: [0,4,7,10], positions: [[0,0],[1,2],[2,0],[3,1],[4,0]] },
  { name: "Maj7", iv: [0,4,7,11], positions: [[0,0],[1,2],[2,1],[3,1],[4,0]] },
  { name: "Min7", iv: [0,3,7,10], positions: [[0,0],[1,2],[2,0],[3,0],[4,0]] },
];

/* ── Lessons Data ── */
type LessonCategory = "Fundamentals" | "Rhythm" | "Scales" | "Intervals" | "Chords" | "Diatonic Chords" | "Progressions" | "Advanced";
interface LessonStep {
  text: string;
  highlight?: number[]; // MIDI notes to highlight on fretboard/piano
  label?: string; // Label to show on visualization
}
interface Lesson {
  id: string; title: string; cat: LessonCategory; desc: string;
  content: string[];
  fretboardRoot?: string; fretboardNotes?: string[];
  audioDemo?: { type: "scale"|"chord"|"interval"; data: number[] };
  quiz?: { q: string; opts: string[]; ans: number };
  steps?: LessonStep[];
  visual?: "fretboard" | "piano" | "none";
}

const LESSONS: Lesson[] = [
  // ═══ Fundamentals (6 lessons) ═══
  { id: "b1", title: "What Is a Note?", cat: "Fundamentals", desc: "Frequency, pitch and note names",
    content: ["A musical note is a sound at a specific pitch. In Western Music there are 12 different notes that repeat in octaves.","The 12 notes: C, C#, D, D#, E, F, F#, G, G#, A, A#, B","The distance between any two adjacent notes is a semitone (half step). Two semitones = whole tone (whole step)."],
    visual: "fretboard",
    steps: [
      { text: "A musical note is a sound at a specific pitch. Let's start with C — the most basic note.", highlight: [48, 60], label: "C" },
      { text: "D — a whole step (2 frets) above C.", highlight: [50, 62], label: "D" },
      { text: "E — a whole step above D.", highlight: [52, 64], label: "E" },
      { text: "F — only a half step above E! Between E and F there is no sharp.", highlight: [53, 65], label: "F" },
      { text: "G — a whole step above F.", highlight: [55, 67], label: "G" },
      { text: "A — a whole step above G. This is the reference note (A4 = 440Hz).", highlight: [57, 69], label: "A" },
      { text: "B — a whole step above A.", highlight: [59, 71], label: "B" },
      { text: "Back to C — one octave up! Same name, double the frequency.", highlight: [48, 60, 72], label: "C (Octave)" },
      { text: "12 different notes total, including sharps: C, C#, D, D#, E, F, F#, G, G#, A, A#, B.", highlight: [48,49,50,51,52,53,54,55,56,57,58,59], label: "Chromatic" },
    ],
    quiz: { q: "How many different notes are in the chromatic scale?", opts: ["7","10","12","14"], ans: 2 } },
  { id: "b2", title: "The Chromatic Scale", cat: "Fundamentals", desc: "All 12 notes in semitone order",
    content: ["The chromatic scale contains all 12 notes in a sequence of semitones.","On the guitar, each fret = one semitone. 12 frets = one full octave.","Note: between E-F and B-C there is no sharp (#). They are already a semitone apart."],
    fretboardRoot: "C", fretboardNotes: NOTES,
    visual: "fretboard",
    steps: [
      { text: "The chromatic scale starts from C. Each fret on the guitar = one semitone.", highlight: [48], label: "C (Root)" },
      { text: "C# — a semitone above C. One fret up.", highlight: [48, 49], label: "C → C#" },
      { text: "D — a semitone above C#.", highlight: [48, 49, 50], label: "C → D" },
      { text: "D# — continuing in semitones.", highlight: [48, 49, 50, 51], label: "C → D#" },
      { text: "E — note: the next note (F) is only a semitone away!", highlight: [48, 49, 50, 51, 52], label: "C → E" },
      { text: "F — between E and F there is no sharp! They are already a semitone apart.", highlight: [48, 49, 50, 51, 52, 53], label: "E→F: no #!" },
      { text: "F# → G → G# → A → A# — continuing in semitones.", highlight: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58], label: "F# → A#" },
      { text: "B — between B and the next C there is no sharp either!", highlight: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59], label: "B→C: no #!" },
      { text: "Back to C! 12 semitones = one full octave.", highlight: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60], label: "Full Octave" },
    ],
    quiz: { q: "Between which notes is there no sharp?", opts: ["C-D and F-G","E-F and B-C","A-B and D-E","G-A and C-D"], ans: 1 } },
  { id: "b3", title: "Sharps and Flats", cat: "Fundamentals", desc: "Sharp (#) and Flat (b) — same note, different name",
    content: ["Sharp (#) raises a note by a semitone. Flat (b) lowers a note by a semitone.","C# = Db — the exact same pitch, two names (enharmonic equivalents).","On guitar it's simple: one fret up = #, one fret down = b."],
    quiz: { q: "What is the enharmonic name for F#?", opts: ["Eb","Gb","G","E"], ans: 1 } },
  { id: "b4", title: "The Octave", cat: "Fundamentals", desc: "Why C sounds like C, just higher",
    content: ["Octave = 12 semitones. A note an octave higher sounds \"the same\" but higher.","The reason: the frequency ratio is 2:1. A4 = 440Hz, A5 = 880Hz.","On guitar: octave = 12 frets, or 2 strings up + 2 frets over."],
    audioDemo: { type: "interval", data: [12] },
    visual: "piano",
    steps: [
      { text: "Octave = 12 semitones. Same note, double the frequency.", highlight: [48], label: "C3" },
      { text: "C3 (low) and C4 (high). Sound \"the same\" but C4 is higher.", highlight: [48, 60], label: "C3 → C4" },
      { text: "Frequency ratio: 2:1. If C3 = 131Hz, then C4 = 262Hz.", highlight: [48, 60], label: "2:1 Ratio" },
      { text: "Count: 12 semitones from C to C. All keys — white and black.", highlight: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60], label: "12 Semitones" },
      { text: "A4 = 440Hz (the reference note). A5 = 880Hz. A3 = 220Hz.", highlight: [57, 69], label: "A4=440Hz, A5=880Hz" },
      { text: "On guitar: fret 12 = same note as the open string, one octave up.", highlight: [40, 52, 45, 57], label: "Fret 12 = Octave" },
    ],
    quiz: { q: "How many semitones in an octave?", opts: ["7","10","12","24"], ans: 2 } },
  { id: "b5", title: "Note Durations", cat: "Fundamentals", desc: "Whole, half, quarter, eighth, sixteenth",
    content: ["Every musical note has two properties: pitch and duration.","Whole note = 4 beats. Half = 2. Quarter = 1. Eighth = 0.5. Sixteenth = 0.25.","A dot after a note adds 50% of its value. Dotted quarter = 1.5 beats. Dotted eighth = 0.75 beats.","In metal, sixteenth notes (16th notes) are the basis for tremolo picking and double bass drumming. Gallop rhythm = eighth + 2 sixteenths."],
    quiz: { q: "How many eighth notes fit in a whole note?", opts: ["4","6","8","16"], ans: 2 } },
  { id: "b6", title: "Steps and Accidentals", cat: "Fundamentals", desc: "Half steps, whole steps, enharmonic equivalents",
    content: ["Half step = the smallest distance between two notes. On guitar = one fret.","Whole step = two semitones. On guitar = two frets.","Enharmonic equivalents: two names for the same pitch. C# = Db, D# = Eb, F# = Gb, G# = Ab, A# = Bb.","Double sharp (x) raises by two semitones. Double flat (bb) lowers by two semitones. Fx = G, Abb = G.","This matters because in any scale, no two notes share the same letter name. In D Major we write F# not Gb."],
    quiz: { q: "What is the enharmonic equivalent of D#?", opts: ["Db","E","Eb","Fb"], ans: 2 } },

  // ═══ Rhythm (4 lessons) ═══
  { id: "r1", title: "Basic Rhythm", cat: "Rhythm", desc: "Beats, tempo and time signatures",
    content: ["Rhythm = organizing sounds in time. BPM (beats per minute) = speed.","4/4 time = 4 beats per bar. The most common in rock and metal.","The first beat (downbeat) is the strongest. Count: 1-2-3-4."],
    quiz: { q: "What does 120 BPM mean?", opts: ["120 bars per minute","120 beats per minute","120 notes per minute","120 chords per minute"], ans: 1 } },
  { id: "r2", title: "Note Values", cat: "Rhythm", desc: "Whole, half, quarter, eighth, sixteenth",
    content: ["Whole note = 4 beats. Half = 2. Quarter = 1. Eighth = 0.5. Sixteenth = 0.25.","In metal, sixteenth notes are the basis for tremolo picking and double bass.","A dot (.) after a note adds 50% of its value. Dotted quarter = 1.5 beats."],
    quiz: { q: "How many eighth notes fit in a 4/4 bar?", opts: ["4","6","8","16"], ans: 2 } },
  { id: "r3", title: "Syncopation", cat: "Rhythm", desc: "Emphasis on weak beats — groove",
    content: ["Syncopation = emphasizing off-beats (weak beats). This is what creates groove.","Instead of 1-2-3-4, the emphasis on the \"and\": 1-and-2-and-3-and-4-and.","Examples: funk rhythm guitar, reggae skank, metal breakdowns with unexpected emphasis."] },
  { id: "r4", title: "Complex Time Signatures", cat: "Rhythm", desc: "5/4, 7/8, 7/4 — Odd Meter in prog and metal",
    content: ["Odd meter = time signatures with an odd number of beats or asymmetric groupings.","5/4: feels like 3+2 or 2+3. Famous example: Take Five (Dave Brubeck), Lateralus (Tool).","7/8: common grouping 2+2+3 or 3+2+2. Example: Money (Pink Floyd), Schism (Tool).","7/4: feels like 4+3 or 3+4. Example: All You Need Is Love (Beatles).","Progressive metal (Meshuggah, Dream Theater, Tool) combines complex meters to create polyrhythm and meter changes.","Practice tip: count aloud 1-2-3-4-5 in 5/4. Accent beats 1 and 4. Play a simple riff in that meter."],
    quiz: { q: "What is the most common grouping of 7/8?", opts: ["4+3","3+3+1","2+2+3","7 equal"], ans: 2 } },

  // ═══ Scales (5 lessons) ═══
  { id: "s1", title: "The Major Scale Formula", cat: "Scales", desc: "W-W-H-W-W-W-H — the foundation of everything",
    content: ["The Major scale = 7 notes following the formula: Whole-Whole-Half-Whole-Whole-Whole-Half.","C Major: C-D-E-F-G-A-B — no sharps or flats.","Every other Major scale follows the same formula from a different root note."],
    fretboardRoot: "C", fretboardNotes: ["C","D","E","F","G","A","B"],
    audioDemo: { type: "scale", data: [0,2,4,5,7,9,11,12] },
    visual: "fretboard",
    steps: [
      { text: "The Major scale has 7 notes. Starting from C — the root (1).", highlight: [48, 60], label: "C — Root (1)" },
      { text: "Whole step up → D. Degree 2 (Supertonic).", highlight: [48, 50, 60, 62], label: "D — W (2)" },
      { text: "Another whole step → E. Degree 3 (Mediant). The 3rd determines Major/Minor!", highlight: [48, 50, 52, 60, 62, 64], label: "E — W (3)" },
      { text: "Only a half step → F. Degree 4 (Subdominant). Here the formula changes!", highlight: [48, 50, 52, 53, 60, 62, 64, 65], label: "F — H (4)" },
      { text: "Whole step → G. Degree 5 (Dominant). Power chord = 1+5.", highlight: [48, 50, 52, 53, 55, 60, 62, 64, 65, 67], label: "G — W (5)" },
      { text: "Whole step → A. Degree 6 (Submediant).", highlight: [48, 50, 52, 53, 55, 57, 60, 62, 64, 65, 67, 69], label: "A — W (6)" },
      { text: "Whole step → B. Degree 7 (Leading Tone). A semitone below C!", highlight: [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71], label: "B — W (7)" },
      { text: "Half step → C! Back home. The formula: W-W-H-W-W-W-H.", highlight: [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72], label: "C — H (8) ✓" },
    ],
    quiz: { q: "What is the Major scale formula?", opts: ["W-H-W-W-H-W-W","W-W-H-W-W-W-H","H-W-W-W-H-W-W","W-W-W-H-W-W-H"], ans: 1 } },
  { id: "s2", title: "Minor Scales", cat: "Scales", desc: "Natural Minor, Harmonic Minor, Melodic Minor",
    content: ["Natural Minor = W-H-W-W-H-W-W. The classic sad sound.","Harmonic Minor = Natural Minor with a raised 7th degree. Eastern/classical sound.","A Natural Minor: A-B-C-D-E-F-G. A Harmonic Minor: A-B-C-D-E-F-G#."],
    fretboardRoot: "A", fretboardNotes: ["A","B","C","D","E","F","G"],
    audioDemo: { type: "scale", data: [0,2,3,5,7,8,10,12] },
    visual: "fretboard",
    steps: [
      { text: "A Natural Minor: the basic minor scale. Formula: W-H-W-W-H-W-W.", highlight: [57, 59, 60, 62, 64, 65, 67, 69], label: "A Natural Minor" },
      { text: "A — the root. B — degree 2.", highlight: [57, 59], label: "A→B (W)" },
      { text: "C — degree b3. The minor 3rd is what makes the scale minor!", highlight: [57, 59, 60], label: "C = b3 (H)" },
      { text: "D — degree 4. E — degree 5.", highlight: [57, 59, 60, 62, 64], label: "D, E (W-W)" },
      { text: "F — degree b6. G — degree b7. The minor scale is complete.", highlight: [57, 59, 60, 62, 64, 65, 67], label: "F=b6, G=b7" },
      { text: "A Harmonic Minor: raised 7th degree! G becomes G#. Eastern sound.", highlight: [57, 59, 60, 62, 64, 65, 68, 69], label: "A Harmonic Minor" },
      { text: "Compare: G (Natural) vs G# (Harmonic). The difference — just one note!", highlight: [67, 68], label: "G vs G#" },
      { text: "The G# creates a leading tone — a semitone below A, pulling back to the tonic.", highlight: [68, 69], label: "G#→A: Leading Tone" },
    ],
    quiz: { q: "What is the difference between Natural Minor and Harmonic Minor?", opts: ["Raised 3rd","Raised 5th","Raised 7th","Raised 2nd"], ans: 2 } },
  { id: "s3", title: "Pentatonic Scales", cat: "Scales", desc: "Minor & Major Pentatonic + Blues Scale — 5 notes",
    content: ["Pentatonic = 5 notes. Two main types: Minor Pentatonic and Major Pentatonic.","Minor Pentatonic: 1-b3-4-5-b7. A Minor Pent: A-C-D-E-G. The first scale every guitarist learns.","Major Pentatonic: 1-2-3-5-6. C Major Pent: C-D-E-G-A. Happy, country sound. Note — same notes as A Minor Pent!","Blues Scale = Minor Pentatonic + b5 (blue note): 1-b3-4-b5-5-b7. A Blues: A-C-D-Eb-E-G.","No semitones in the pentatonic — everything sounds good. That's why it's perfect for improvisation."],
    fretboardRoot: "A", fretboardNotes: ["A","C","D","E","G"],
    audioDemo: { type: "scale", data: [0,3,5,7,10,12] },
    visual: "fretboard",
    steps: [
      { text: "A Minor Pentatonic — 5 notes. The first scale every guitarist learns!", highlight: [57], label: "A — Root" },
      { text: "A → C (b3). 3 semitones. The minor sound.", highlight: [57, 60], label: "A → C (b3)" },
      { text: "C → D (4). Perfect 4th from the root.", highlight: [57, 60, 62], label: "+ D (4)" },
      { text: "D → E (5). Perfect 5th from the root. The foundation.", highlight: [57, 60, 62, 64], label: "+ E (5)" },
      { text: "E → G (b7). Minor 7th. The pentatonic scale is complete: A-C-D-E-G.", highlight: [57, 60, 62, 64, 67], label: "A Min Pent complete" },
      { text: "Blues Scale = Pentatonic + blue note (Eb)! A-C-D-Eb-E-G.", highlight: [57, 60, 62, 63, 64, 67], label: "A Blues Scale" },
      { text: "The blue note (Eb/D#) is the b5 — Tritone from the root. Adds bluesy color.", highlight: [57, 63], label: "Blue Note = b5" },
      { text: "C Major Pentatonic = the exact same notes! C-D-E-G-A. Different starting point.", highlight: [48, 50, 52, 55, 57], label: "C Maj Pent = A Min Pent" },
    ],
    quiz: { q: "How many notes in a pentatonic scale?", opts: ["4","5","6","7"], ans: 1 } },
  { id: "s4", title: "Introduction to Modes", cat: "Scales", desc: "Modes — 7 scales from the same notes",
    content: ["A Mode = a scale starting from a different degree of the Major scale. 7 degrees = 7 modes.","Ionian (I) = Major Scale. Dorian (ii) = minor with major 6th. Phrygian (iii) = minor with b2, Spanish sound.","Lydian (IV) = major with #4, dreamy. Mixolydian (V) = major with b7, bluesy.","Aeolian (vi) = Natural Minor. Locrian (vii) = minor with b2 and b5, the darkest.","All modes of C Major use the same notes: C-D-E-F-G-A-B. The difference is only the starting point.","The trick: don't think \"D Dorian = C Major from D\". Think \"Dorian = minor scale with raised 6th\". That's how you hear the color."],
    fretboardRoot: "D", fretboardNotes: ["C","D","E","F","G","A","B"],
    audioDemo: { type: "scale", data: [0,2,3,5,7,9,10,12] },
    visual: "fretboard",
    steps: [
      { text: "7 modes from the same notes (C Major). The difference = where you start.", highlight: [48, 50, 52, 53, 55, 57, 59, 60], label: "C Major = Ionian" },
      { text: "C Ionian (I) = C Major Scale. The bright, happy sound.", highlight: [48, 50, 52, 53, 55, 57, 59, 60], label: "C Ionian (Major)" },
      { text: "D Dorian (ii) = Minor + Major 6th. Jazzy sound. Santana, Pink Floyd.", highlight: [50, 52, 53, 55, 57, 59, 60, 62], label: "D Dorian (minor+M6)" },
      { text: "E Phrygian (iii) = Minor + b2. Spanish/metal sound. Metallica!", highlight: [52, 53, 55, 57, 59, 60, 62, 64], label: "E Phrygian (minor+b2)" },
      { text: "F Lydian (IV) = Major + #4. Dreamy, floating. Joe Satriani, Steve Vai.", highlight: [53, 55, 57, 59, 60, 62, 64, 65], label: "F Lydian (major+#4)" },
      { text: "G Mixolydian (V) = Major + b7. Bluesy, funky. AC/DC.", highlight: [55, 57, 59, 60, 62, 64, 65, 67], label: "G Mixolydian (major+b7)" },
      { text: "A Aeolian (vi) = Natural Minor. The classic sad sound.", highlight: [57, 59, 60, 62, 64, 65, 67, 69], label: "A Aeolian (Nat. Minor)" },
      { text: "B Locrian (vii) = Minor + b2 + b5. The darkest and most unstable.", highlight: [59, 60, 62, 64, 65, 67, 69, 71], label: "B Locrian (darkest)" },
    ],
    quiz: { q: "What is Dorian mode?", opts: ["Major with b7","Minor with #6","Minor with b2","Major with #4"], ans: 1 } },
  { id: "s5", title: "Scale Degrees", cat: "Scales", desc: "Tonic, Dominant, Leading Tone — names and functions",
    content: ["Every note in a scale has a name and function. These are the Scale Degrees:","Degree 1 — Tonic: \"home\", center of gravity. Degree 2 — Supertonic: above the tonic. Degree 3 — Mediant: between tonic and dominant.","Degree 4 — Subdominant: below the dominant. Degree 5 — Dominant: strongest after the tonic, creates tension. Degree 6 — Submediant: between subdominant and octave.","Degree 7 — Leading Tone: a semitone below the tonic, \"pulls\" toward it. In Natural Minor it's the Subtonic (a whole tone below).","In C Major: C=Tonic, D=Supertonic, E=Mediant, F=Subdominant, G=Dominant, A=Submediant, B=Leading Tone."],
    fretboardRoot: "C", fretboardNotes: ["C","D","E","F","G","A","B"],
    audioDemo: { type: "scale", data: [0,2,4,5,7,9,11,12] },
    visual: "piano",
    steps: [
      { text: "Degree 1 — Tonic: \"home\", the gravitational center of the scale. C.", highlight: [48, 60], label: "1 — Tonic (C)" },
      { text: "Degree 2 — Supertonic: above the tonic. D.", highlight: [50, 62], label: "2 — Supertonic (D)" },
      { text: "Degree 3 — Mediant: between tonic and dominant. E.", highlight: [52, 64], label: "3 — Mediant (E)" },
      { text: "Degree 4 — Subdominant: below the dominant. F.", highlight: [53, 65], label: "4 — Subdominant (F)" },
      { text: "Degree 5 — Dominant: strongest after the tonic! Creates tension. G.", highlight: [55, 67], label: "5 — Dominant (G)" },
      { text: "Degree 6 — Submediant: between subdominant and octave. A.", highlight: [57, 69], label: "6 — Submediant (A)" },
      { text: "Degree 7 — Leading Tone: a semitone below the tonic, \"pulls\" toward it. B.", highlight: [59, 71], label: "7 — Leading Tone (B)" },
      { text: "All 7 scale degrees together. Each degree has a unique harmonic function.", highlight: [48, 50, 52, 53, 55, 57, 59, 60], label: "C Major — All Degrees" },
    ],
    quiz: { q: "Which degree is called Dominant?", opts: ["Degree 3","Degree 4","Degree 5","Degree 7"], ans: 2 } },

  // ═══ Intervals (4 lessons) ═══
  { id: "i1", title: "What Is an Interval?", cat: "Intervals", desc: "The distance between two notes",
    content: ["An interval = the distance (in semitones) between two notes.","There are 12 basic intervals, from minor 2nd (1 semitone) to Octave (12 semitones).","Intervals are the foundation for understanding chords, scales and melodies."],
    visual: "fretboard",
    steps: [
      { text: "An interval = the distance between two notes. Starting from C as root.", highlight: [48], label: "C — Root" },
      { text: "Minor 2nd (m2) — one semitone. C → C#. The most dissonant sound.", highlight: [48, 49], label: "m2 — 1 st" },
      { text: "Major 2nd (M2) — whole tone. C → D.", highlight: [48, 50], label: "M2 — 2 st" },
      { text: "Minor 3rd (m3) — 3 semitones. C → Eb. The minor sound.", highlight: [48, 51], label: "m3 — 3 st" },
      { text: "Major 3rd (M3) — 4 semitones. C → E. The major sound.", highlight: [48, 52], label: "M3 — 4 st" },
      { text: "Perfect 4th (P4) — 5 semitones. C → F.", highlight: [48, 53], label: "P4 — 5 st" },
      { text: "Tritone (TT) — 6 semitones. C → F#. \"The Devil's Interval\".", highlight: [48, 54], label: "TT — 6 st" },
      { text: "Perfect 5th (P5) — 7 semitones. C → G. The basis of the Power Chord!", highlight: [48, 55], label: "P5 — 7 st" },
      { text: "Octave (P8) — 12 semitones. C → C. Same note, double the frequency.", highlight: [48, 60], label: "P8 — 12 st" },
    ],
    quiz: { q: "What is an interval?", opts: ["A chord","Distance between two notes","A type of scale","A rhythm"], ans: 1 } },
  { id: "i2", title: "Interval Quality", cat: "Intervals", desc: "Perfect, Major, Minor, Augmented, Diminished",
    content: ["Every interval has a number (2nd, 3rd, 4th...) and a quality (Perfect, Major, Minor, Augmented, Diminished).","Perfect Intervals: P1 (Unison), P4 (5 st), P5 (7 st), P8 (12 st). Sound stable and \"open\". They are the basis for power chords.","Major Intervals: M2 (2 st), M3 (4 st), M6 (9 st), M7 (11 st). Sound happy/bright.","Minor Intervals: m2 (1 st), m3 (3 st), m6 (8 st), m7 (10 st). Sound sad/dark.","Augmented = a semitone above Perfect/Major. Diminished = a semitone below Perfect/Minor.","Tritone (TT) = 6 semitones. Aug 4th or Dim 5th. \"The Devil's Interval\" — the foundation of the Black Sabbath sound."],
    audioDemo: { type: "interval", data: [5,7,3,4] },
    visual: "piano",
    steps: [
      { text: "Perfect Intervals — sound stable, \"open\". Basis for Power Chords.", highlight: [48], label: "Perfect Intervals" },
      { text: "P1 (Unison) — same note. P4 — 5 semitones: C → F.", highlight: [48, 53], label: "P4 — C→F (5 st)" },
      { text: "P5 — 7 semitones: C → G. This is the Power Chord!", highlight: [48, 55], label: "P5 — C→G (7 st)" },
      { text: "Major Intervals — sound happy, bright.", highlight: [48], label: "Major Intervals" },
      { text: "M3 — 4 semitones: C → E. The \"happy\" sound of a Major chord.", highlight: [48, 52], label: "M3 — C→E (4 st)" },
      { text: "Minor Intervals — sound sad, dark.", highlight: [48], label: "Minor Intervals" },
      { text: "m3 — 3 semitones: C → Eb. The \"sad\" sound of a Minor chord.", highlight: [48, 51], label: "m3 — C→Eb (3 st)" },
      { text: "Compare: M3 (happy) vs m3 (sad). A difference of just one semitone!", highlight: [48, 51, 52], label: "M3 vs m3" },
      { text: "Tritone — 6 semitones: C → F#. Aug 4th = Dim 5th. \"The Devil's Interval\".", highlight: [48, 54], label: "TT — C→F# (6 st)" },
    ],
    quiz: { q: "What is the quality of a 4th interval with 5 semitones?", opts: ["Major","Minor","Perfect","Augmented"], ans: 2 } },
  { id: "i3", title: "Interval Inversion", cat: "Intervals", desc: "What happens when you flip an interval",
    content: ["Inversion = put the bottom note an octave up (or the top note an octave down).","The rule: interval + its inversion = octave (12 semitones). M3 (4) + m6 (8) = 12.","Perfect stays Perfect: P4 ↔ P5. Major becomes Minor: M3 ↔ m6, M2 ↔ m7.","Augmented becomes Diminished: Aug4 ↔ Dim5 (both = Tritone!).","The numerical rule: interval + inversion = 9. 3rd ↔ 6th (3+6=9). 2nd ↔ 7th (2+7=9). 4th ↔ 5th.","On guitar: if M3 up = 4 frets, then m6 down = 8 frets. Both arrive at the same pitch class."],
    audioDemo: { type: "interval", data: [4,8] },
    quiz: { q: "What is the inversion of a Major 3rd?", opts: ["Minor 3rd","Major 6th","Minor 6th","Perfect 5th"], ans: 2 } },
  { id: "i4", title: "Compound Intervals", cat: "Intervals", desc: "Intervals beyond the octave",
    content: ["Compound Interval = an interval larger than an octave. 9th, 10th, 11th, 13th.","9th = octave + 2nd (14 st). 10th = octave + 3rd (16 st). 11th = octave + 4th (17 st). 13th = octave + 6th (21 st).","In extended chords: C9 = C7 + 9th. C11 = C7 + 9th + 11th. C13 = C7 + 9th + 11th + 13th.","In practice, on guitar, compound intervals are played in open voicings. The 9th of a chord is simply the 2nd an octave higher.","Jazz and fusion use 9th, 11th, 13th chords extensively. In metal, 9th chords are common in djent and progressive."],
    audioDemo: { type: "interval", data: [14] },
    quiz: { q: "What is a 9th interval?", opts: ["Octave + Unison","Octave + 2nd","Octave + 3rd","Octave + 4th"], ans: 1 } },

  // ═══ Chords (6 lessons) ═══
  { id: "c1", title: "Triads", cat: "Chords", desc: "3 notes: Major, Minor, Dim, Aug",
    content: ["A chord = 3+ notes sounding together. The most basic is a triad (3 notes).","Triad = Root + 3rd + 5th.","Major triad: R-M3-P5 (0-4-7). Happy/bright. Minor triad: R-m3-P5 (0-3-7). Sad/dark.","Diminished: R-m3-b5 (0-3-6). Tense, unstable. Augmented: R-M3-#5 (0-4-8). Dreamy, strange.","Major and Minor are 90% of chords you'll hear. Dim and Aug add color and tension."],
    audioDemo: { type: "chord", data: [0,4,7] },
    visual: "piano",
    steps: [
      { text: "Triad = 3 notes: Root + 3rd + 5th. Starting with C as root.", highlight: [48], label: "C — Root" },
      { text: "C Major Triad: C-E-G (0-4-7). Happy, bright sound.", highlight: [48, 52, 55], label: "C Major (0-4-7)" },
      { text: "C Minor Triad: C-Eb-G (0-3-7). Sad, dark sound. The 3rd dropped a semitone!", highlight: [48, 51, 55], label: "C Minor (0-3-7)" },
      { text: "The difference between Major and Minor: only the 3rd! E (Major) vs Eb (Minor).", highlight: [51, 52], label: "M3 vs m3" },
      { text: "C Diminished: C-Eb-Gb (0-3-6). The 5th dropped too! Tense, unstable sound.", highlight: [48, 51, 54], label: "C Dim (0-3-6)" },
      { text: "C Augmented: C-E-G# (0-4-8). The 5th raised! Dreamy, strange sound.", highlight: [48, 52, 56], label: "C Aug (0-4-8)" },
      { text: "Summary — 4 types of triads. Major and Minor = 90% of music.", highlight: [48, 52, 55], label: "4 Types" },
    ],
    quiz: { q: "How many notes in a triad?", opts: ["2","3","4","5"], ans: 1 } },
  { id: "c2", title: "Inversions", cat: "Chords", desc: "Root position, 1st & 2nd inversion",
    content: ["Inversion = the chord with a non-root note in the bass.","Root position: C-E-G. 1st inversion: E-G-C (3rd in bass). 2nd inversion: G-C-E (5th in bass).","Inversions change the color and movement of progressions. Common in piano and classical guitar.","On guitar: slash chords. C/E = C with E in bass. Am/C = Am with C in bass.","Practical example: C → C/B → Am → Am/G. The bass descends chromatically: C-B-A-G. The classic walkdown."],
    quiz: { q: "In 1st inversion, what's in the bass?", opts: ["Root","3rd","5th","7th"], ans: 1 } },
  { id: "c3", title: "Power Chords", cat: "Chords", desc: "Root + 5th — the foundation of rock and metal",
    content: ["Power chord = Root + Perfect 5th only (0-7). No 3rd, so it's neither Major nor Minor.","Notation: A5, E5, D5. On guitar: two notes on two adjacent strings at the same fret (except G-B).","Power chords are the foundation of all rock and metal music. With distortion they sound full and aggressive.","You can add an octave: Root-5th-Octave (0-7-12). That's a 3-note power chord. Very common in punk-rock and metal.","Palm muting + power chords = the basic sound of thrash metal (Metallica, Megadeth, Slayer)."],
    audioDemo: { type: "chord", data: [0,7,12] },
    visual: "fretboard",
    steps: [
      { text: "Power Chord = Root + Perfect 5th. No 3rd — neither Major nor Minor!", highlight: [40], label: "Root (E)" },
      { text: "E5 Power Chord: E + B. Only two notes. Simple and effective.", highlight: [40, 47], label: "E5: E + B" },
      { text: "E5 with octave: E + B + E. 3 notes. Fuller sound.", highlight: [40, 47, 52], label: "E5: E+B+E" },
      { text: "A5 Power Chord: A + E. Same finger shape, one string up.", highlight: [45, 52], label: "A5: A + E" },
      { text: "D5 Power Chord: D + A. Continuing with the same shape.", highlight: [50, 57], label: "D5: D + A" },
      { text: "Power Chords move along the neck. E5 → F5 → G5 — one fret = one semitone.", highlight: [40, 47, 41, 48, 43, 50], label: "E5→F5→G5" },
      { text: "With Distortion, the Power Chord sounds full and aggressive. The foundation of all rock and metal.", highlight: [40, 47, 52], label: "Rock & Metal!" },
    ],
    quiz: { q: "What's missing in a power chord compared to a triad?", opts: ["Root","3rd","5th","Octave"], ans: 1 } },
  { id: "c4", title: "Suspended Chords", cat: "Chords", desc: "Sus2 and Sus4 — tension without Major/Minor",
    content: ["Suspended chord = the 3rd is replaced by another note. The sound is \"suspended\" — neither Major nor Minor.","Sus4: Root-P4-P5 (0-5-7). The 4th \"wants\" to resolve down to the 3rd. Tension requiring resolution.","Sus2: Root-M2-P5 (0-2-7). Open, modern sound. Common in alternative rock and post-rock.","Classic resolution: Asus4 → A. The 4th (D) resolves down to the 3rd (C#). Creates melodic motion.","In practice: Dsus2 = D-E-A. Dsus4 = D-G-A. Both sound \"open\" and neutralize the major/minor quality.","The Who, Pete Townshend — the king of sus chords. Jimi Hendrix also used sus alternatives extensively."],
    audioDemo: { type: "chord", data: [0,5,7] },
    quiz: { q: "What replaces the 3rd in a Sus4 chord?", opts: ["2nd","4th","5th","7th"], ans: 1 } },
  { id: "c5", title: "Seventh Chords", cat: "Chords", desc: "Dom7, Maj7, Min7, m7b5, Dim7 — all types",
    content: ["7th chord = triad + 7th degree. Five main types:","1) Dominant 7 (dom7) = Major + m7: 0-4-7-10. Most common in blues and rock. Example: A7 = A-C#-E-G.","2) Major 7 (Maj7) = Major + M7: 0-4-7-11. Warm, romantic sound. Example: Amaj7 = A-C#-E-G#.","3) Minor 7 (m7) = Minor + m7: 0-3-7-10. Jazzy, sad sound. Example: Am7 = A-C-E-G.","4) Half-diminished (m7b5) = Dim + m7: 0-3-6-10. Tense sound. Example: Am7b5 = A-C-Eb-G.","5) Fully-diminished (dim7) = Dim + dim7: 0-3-6-9. Completely symmetrical. Example: Adim7 = A-C-Eb-Gb."],
    audioDemo: { type: "chord", data: [0,4,7,10] },
    visual: "piano",
    steps: [
      { text: "Seventh chord = triad + 7th degree. Building from C as root.", highlight: [48], label: "C — Root" },
      { text: "C Dominant 7 (C7): C-E-G-Bb (0-4-7-10). Most common in blues.", highlight: [48, 52, 55, 58], label: "C7 (dom7)" },
      { text: "C Major 7 (Cmaj7): C-E-G-B (0-4-7-11). Warm, romantic sound.", highlight: [48, 52, 55, 59], label: "Cmaj7" },
      { text: "Difference between dom7 and Maj7: only the 7th! Bb (m7) vs B (M7).", highlight: [58, 59], label: "m7 vs M7" },
      { text: "C Minor 7 (Cm7): C-Eb-G-Bb (0-3-7-10). Jazzy, sad sound.", highlight: [48, 51, 55, 58], label: "Cm7" },
      { text: "C Half-Diminished (Cø7): C-Eb-Gb-Bb (0-3-6-10). Tense, unstable.", highlight: [48, 51, 54, 58], label: "Cø7 (m7b5)" },
      { text: "C Fully-Diminished (Cdim7): C-Eb-Gb-A (0-3-6-9). Completely symmetrical.", highlight: [48, 51, 54, 57], label: "Cdim7" },
      { text: "Summary: 5 types of seventh chords. The difference is in the 3rd, 5th and 7th.", highlight: [48, 52, 55, 58], label: "5 Types" },
    ],
    quiz: { q: "What is the difference between dom7 and Maj7?", opts: ["The 3rd","The 5th","The 7th — m7 vs M7","The Root"], ans: 2 } },
  { id: "c6", title: "Inversions on Guitar", cat: "Chords", desc: "Slash chords, voice leading, walkdowns",
    content: ["On guitar, inversions are mainly done through slash chords — changing the bass note.","C/E = C Major with E in bass (1st inversion). C/G = C Major with G in bass (2nd inversion).","Voice leading: smooth movement between chords. Instead of jumps, notes move by step.","Classic walkdown: C → C/B → Am → Am/G → F. Bass descends: C-B-A-G-F. Sounds amazing.","With seventh chords: Cmaj7/E, Am7/C. Each inversion gives a different color.","Practical tip: when playing a progression, try inverting one chord. The overall sound will change dramatically."],
    quiz: { q: "What is C/E?", opts: ["E Major","C Major with E in bass","E Minor","C Minor"], ans: 1 } },

  // ═══ Diatonic Chords (4 lessons) ═══
  { id: "dc1", title: "Diatonic Triads", cat: "Diatonic Chords", desc: "How scale notes form chords — I ii iii IV V vi vii°",
    content: ["A diatonic chord = a chord built only from notes of the scale.","Take each scale degree and build a triad by skipping: degrees 1-3-5, degrees 2-4-6, etc.","In C Major: C-E-G = C (I), D-F-A = Dm (ii), E-G-B = Em (iii), F-A-C = F (IV), G-B-D = G (V), A-C-E = Am (vi), B-D-F = Bdim (vii°).","The pattern is fixed for every Major scale: Major-minor-minor-Major-Major-minor-diminished.","The uppercase Roman numerals (I, IV, V) are Major. The lowercase (ii, iii, vi) are Minor. vii° is Diminished."],
    visual: "piano",
    steps: [
      { text: "Building diatonic triads from C Major notes only: C-D-E-F-G-A-B.", highlight: [48, 50, 52, 53, 55, 57, 59], label: "C Major Scale" },
      { text: "I — C Major: C-E-G (1-3-5). Tonic. Home.", highlight: [48, 52, 55], label: "I — C Major" },
      { text: "ii — D Minor: D-F-A (2-4-6). Mild subdominant.", highlight: [50, 53, 57], label: "ii — Dm" },
      { text: "iii — E Minor: E-G-B (3-5-7). Mediant.", highlight: [52, 55, 59], label: "iii — Em" },
      { text: "IV — F Major: F-A-C (4-6-1). Subdominant.", highlight: [53, 57, 60], label: "IV — F Major" },
      { text: "V — G Major: G-B-D (5-7-2). Dominant — tension!", highlight: [55, 59, 62], label: "V — G Major" },
      { text: "vi — A Minor: A-C-E (6-1-3). Relative Minor of C Major.", highlight: [57, 60, 64], label: "vi — Am" },
      { text: "vii° — B Diminished: B-D-F (7-2-4). Contains a Tritone (B-F)!", highlight: [59, 62, 65], label: "vii° — Bdim" },
      { text: "The pattern: I-ii-iii-IV-V-vi-vii°. Major-minor-minor-Major-Major-minor-dim.", highlight: [48, 52, 55, 50, 53, 57, 52, 55, 59, 53, 57, 60, 55, 59, 62, 57, 60, 64, 59, 62, 65], label: "All 7 Triads" },
    ],
    quiz: { q: "What type of chord sits on degree vi in Major?", opts: ["Major","Minor","Diminished","Augmented"], ans: 1 } },
  { id: "dc2", title: "Roman Numeral Analysis", cat: "Diatonic Chords", desc: "Roman Numeral Analysis and Nashville Number System",
    content: ["Roman numerals describe the chord's function in a key, not its name.","Uppercase = Major. Lowercase = Minor. ° = Diminished. + = Augmented.","I = tonic (center). IV = subdominant. V = dominant (tension). vi = relative minor.","Nashville Number System: same idea, but with regular numbers: 1-4-5 instead of I-IV-V.","The advantage: you can chart a song once and play it in any key. 1-5-6m-4 = I-V-vi-IV.","Example: the same progression works regardless of key — the numbers stay the same."],
    quiz: { q: "What does a lowercase Roman numeral (ii) indicate?", opts: ["Major","Minor","Diminished","Dominant"], ans: 1 } },
  { id: "dc3", title: "Diatonic Seventh Chords", cat: "Diatonic Chords", desc: "Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7",
    content: ["If you continue stacking thirds to the 7th (1-3-5-7), you get diatonic seventh chords.","In C Major: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5 (Bø7).","The pattern: Maj7 - m7 - m7 - Maj7 - dom7 - m7 - m7b5 (half-diminished).","Note: only V is dom7! That's what gives it its special tension (it contains a tritone).","In jazz, seventh chords are almost always played instead of triads. It gives a richer sound."],
    quiz: { q: "Which seventh chord sits on degree V?", opts: ["Maj7","m7","dom7","m7b5"], ans: 2 } },
  { id: "dc4", title: "Composing with Minor Scales", cat: "Diatonic Chords", desc: "Natural vs Harmonic Minor in progressions",
    content: ["In Natural Minor, the diatonic chords are: i-ii°-III-iv-v-VI-VII.","The problem: chord v is Minor, so there's no strong dominant tension (no leading tone).","The solution: Harmonic Minor raises the 7th degree, turning v into V (Major!). Now V→i sounds strong.","In A Minor: Am-Bdim-C-Dm-Em-F-G (Natural). Am-Bdim-C+-Dm-E-F-G#dim (Harmonic).","In practice, metal and classical music combine both in the same song: VI-VII-i (Natural) → V-i (Harmonic).","Classic metal example: Am-F-G-Am (Natural Minor), then E-Am at the end (Harmonic Minor)."],
    quiz: { q: "Why use Harmonic Minor in progressions?", opts: ["Because it sounds nice","To get V Major instead of v minor","Because it has fewer notes","To avoid the tritone"], ans: 1 } },

  // ═══ Progressions (5 lessons) ═══
  { id: "p1", title: "I - IV - V", cat: "Progressions", desc: "The most basic progression — rock, blues, country",
    content: ["I-IV-V = the 3 main chords of any Major key.","In C Major: C-F-G. In A Major: A-D-E. In G Major: G-C-D.","This is the progression of 90% of rock, blues and country songs in history."],
    audioDemo: { type: "chord", data: [0,4,7] },
    quiz: { q: "What are the I-IV-V chords in G Major?", opts: ["G-C-D","G-B-D","G-A-B","G-D-E"], ans: 0 } },
  { id: "p2", title: "Circle Progressions", cat: "Progressions", desc: "Movement in fifths",
    content: ["Circle Progression = each chord is a P5 (or P4) from the previous. Root movement through the circle of fifths.","ii-V-I = the classic jazz progression. In C: Dm7-G7-Cmaj7. Roots: D→G→C = each a P5 down.","The extended example: iii → vi → ii → V → I. In C: Em-Am-Dm-G-C. Each root descends by P5.","Autumn Leaves, Fly Me to the Moon — based on circle progressions.","Why does it work? P5 down movement (= P4 up) sounds the most \"natural\" to the ear."],
    quiz: { q: "In a circle progression, what is the distance between chord roots?", opts: ["M2","m3","P4/P5","Tritone"], ans: 2 } },
  { id: "p3", title: "I - V - vi - IV", cat: "Progressions", desc: "The pop progression — Axis of Awesome",
    content: ["I-V-vi-IV = the progression of hundreds of successful pop songs.","In C: C-G-Am-F. In G: G-D-Em-C.","Examples: Let It Be, No Woman No Cry, Someone Like You, With or Without You."] },
  { id: "p4", title: "Phrases and Cadences", cat: "Progressions", desc: "Authentic, Plagal, Half, Deceptive — how to end a phrase",
    content: ["Cadence = the ending of a musical phrase. Like a period at the end of a sentence.","Authentic Cadence: V → I. The strongest, most convincing ending. \"We're home\". Example: G → C.","Plagal Cadence: IV → I. The \"Amen\" cadence from church. Softer. Example: F → C.","Half Cadence: X → V. Ending on tension — \"to be continued\". The phrase hasn't really ended.","Deceptive Cadence: V → vi. Instead of going home (I), you go to vi. Surprise! G → Am instead of G → C.","In metal: Power chord cadences. E5-F5-E5 = Phrygian half cadence. Typical of thrash and death metal."],
    quiz: { q: "What is an Authentic Cadence?", opts: ["IV → I","V → I","I → V","V → vi"], ans: 1 } },
  { id: "p5", title: "Progression Analysis", cat: "Progressions", desc: "How to analyze songs",
    content: ["Progression analysis = identifying the key, Roman numerals, and cadences in a song.","Step 1: Find the tonic (I). Usually the first or last chord.","Step 2: Label each chord with Roman numerals. Am-F-C-G in C Major = vi-IV-I-V.","Step 3: Identify patterns — is it I-IV-V? ii-V-I? Circle progression?","Step 4: Find cadences — Authentic (V→I), Plagal (IV→I), Deceptive (V→vi).","Example — Hotel California (Eagles): i-V-VII-IV-VI-III-iv-V. Minor with circle-of-fifths motion."],
    quiz: { q: "Am-F-C-G in the key of C Major are:", opts: ["I-IV-V-vi","vi-IV-I-V","ii-IV-I-V","vi-V-I-IV"], ans: 1 } },

  // ═══ Advanced (5 lessons) ═══
  { id: "a1", title: "Modes in Depth", cat: "Advanced", desc: "Modes Deep Dive — color, usage and improvisation",
    content: ["The trick: don't think of modes as \"a scale starting from a different place\". Think about the unique color.","Dorian: minor + major 6th. The jazzy sound. Carlos Santana, Pink Floyd.","Phrygian: minor + b2. Spanish, eastern, metal. Metallica (Wherever I May Roam), Megadeth.","Lydian: major + #4. Dreamy, floating. Joe Satriani (Flying in a Blue Dream), Steve Vai.","Mixolydian: major + b7. Bluesy, funky. AC/DC, Lynyrd Skynyrd, Grateful Dead.","Practice: play a drone note (root) and a scale over it. Notice the characteristic note of each mode."],
    quiz: { q: "What is the characteristic note of Lydian?", opts: ["b2","b3","#4","b7"], ans: 2 } },
  { id: "a2", title: "Modal Interchange", cat: "Advanced", desc: "Borrowing chords from a parallel mode",
    content: ["Modal Interchange = using chords from a parallel mode. For example, using a chord from C Minor in a song in C Major.","The classic example: bVI-bVII-I. In C Major: Ab-Bb-C. The Ab and Bb come from C Minor (Aeolian).","Common uses: bIII (Eb in C Major), bVI (Ab), bVII (Bb), iv (Fm). All \"borrowed\" from minor.","Radiohead uses this extensively: Creep = I-III-IV-iv. The iv (Fm) is modal interchange from C Minor.","In metal: i-bVI-bVII-i sound familiar? That's modal interchange! The classic metal progression.","Tip: when a Major progression sounds \"too dark\" — there's probably modal interchange involved."],
    quiz: { q: "bVI in the key of C Major is:", opts: ["A Major","Ab Major","F Major","Bb Major"], ans: 1 } },
  { id: "a3", title: "Advanced Harmony", cat: "Advanced", desc: "Extended chords, alterations, reharmonization",
    content: ["Extended chords: 9th, 11th, 13th. Add color beyond seventh chords.","C9 = C-E-G-Bb-D. C11 = C-E-G-Bb-D-F. C13 = C-E-G-Bb-D-F-A. In practice, some notes are omitted.","Altered chords: b9, #9, #11, b13. Jimi Hendrix chord (7#9) = E7#9 = E-G#-B-D-G. Happy and sad simultaneously.","Reharmonization: replacing a chord with another that serves the same function. ii instead of IV, Tritone substitution (bII7 instead of V7).","Tritone sub: G7 → Db7. Both share the same tritone (B-F). Creates a chromatic bass line: Dm7-Db7-Cmaj7 = ii-bII7-I.","In practice: start with ii-V-I and try different reharmonizations. Each gives a different color."],
    quiz: { q: "What is Tritone Substitution?", opts: ["Replacing V with IV","Replacing V7 with bII7","Replacing I with vi","Replacing ii with IV"], ans: 1 } },
  { id: "a4", title: "Chord Voicings", cat: "Advanced", desc: "Open vs Closed, Drop-2, Drop-3 — on guitar",
    content: ["Voicing = the specific arrangement of chord tones (which octaves, what order).","Close voicing: all notes as close together as possible. Dense, \"thick\" sound.","Open voicing: notes spread across octaves. Open, spacious sound.","Drop-2: take the second note from the top in close voicing and drop it an octave. The most common voicing in jazz guitar!","Drop-3: same idea, the third note from the top drops an octave. Creates wide voicings.","On guitar, close voicings are hard to play (finger spans too small). Drop-2 and Drop-3 work perfectly."],
    quiz: { q: "What is a Drop-2 voicing?", opts: ["Drop the bass an octave","Drop the second note from top an octave","Drop two notes","Add a second note"], ans: 1 } },
  { id: "a5", title: "Non-Harmonic Tones", cat: "Advanced", desc: "Passing tones, neighbor tones, suspensions, appoggiaturas",
    content: ["Nonharmonic tones = notes that don't belong to the current chord but create melodic movement.","Passing Tone: a transition note between two chord tones. Example: over Cmaj, E-F-G. The F is a passing tone.","Neighbor Tone: a note that leaves a chord tone and returns to it. E-F-E. The F is an upper neighbor.","Suspension (sus): a note from the previous chord that stays and then resolves. 4-3 sus = the 4 stays then descends to 3.","Appoggiatura: a non-harmonic tone approached by leap (not step) and resolved by step. \"Landing\" on a foreign note then correcting.","In guitar solos, every bend, slide-in, hammer-on to a \"wrong\" note that resolves — is a nonharmonic tone. That's what creates musical expression."],
    quiz: { q: "What is a Passing Tone?", opts: ["A chord tone","A note that passes between two harmonic tones","A repeated note","A bass note"], ans: 1 } },
];

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */
type MainTab = "lessons" | "exercises" | "tools";
type ExMode = "intervals" | "chords" | "scales" | "fretboard" | "progressions" | "construction"
  | "fb-intervals" | "fb-scales" | "fb-chords" | "note-ear" | "iv-construction" | "chord-construction"
  | "kb-notes" | "kb-intervals" | "kb-scales" | "kb-chords" | "kb-ear";
type Direction = "ascending" | "descending" | "harmonic";
type SubTab = "exercise" | "achievements" | "reference";
type ToolTab = "scales" | "chords" | "fretboard" | "progressions" | "circle" | "intervals" | "tempo" | "iv-calc" | "piano" | "tuner";
type ConSubMode = "scale" | "interval" | "chord";

interface LearnState {
  xp: number; level: number; bestStreak: number; unlocked: string[];
  history: Record<string, { c: number; t: number }>;
  lessonsCompleted: string[];
}

interface ChordPosition { frets: string; fingers: string; barres?: number; capo?: boolean; }
interface ChordData { key: string; suffix: string; positions: ChordPosition[]; }

function freq(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }

function toggleSet<T>(s: Set<T>, i: T): Set<T> {
  const n = new Set(s);
  if (n.has(i)) { if (n.size > 2) n.delete(i); } else n.add(i);
  return n;
}

/* ═══════════════════════════════════════════════════════════
   FRETBOARD
   ═══════════════════════════════════════════════════════════ */
function LCFretboard({ highlightNotes, rootNote, showIntervals, onClick, maxFret = FRETS, highlightMidi }: {
  highlightNotes: string[]; rootNote: string; showIntervals?: boolean;
  onClick?: (str: number, fret: number) => void; maxFret?: number;
  highlightMidi?: Set<number>;
}) {
  const ri = NOTES.indexOf(rootNote);
  const ctxRef = useRef<AudioContext | null>(null);
  function play(midi: number) {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const c = ctxRef.current, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq(midi);
    g.gain.setValueAtTime(0.2, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    o.start(c.currentTime); o.stop(c.currentTime + 0.6);
  }
  return (
    <div className="overflow-x-auto" dir="ltr">
      <div style={{ minWidth: Math.max(500, maxFret * 42) }}>
        <div className="flex mb-0.5">
          <div className="w-8 flex-shrink-0" />
          {Array.from({ length: maxFret + 1 }, (_, f) => (
            <div key={f} className={`flex-1 text-center font-readout text-[9px] ${FRET_MARKERS.includes(f) ? "text-[#D4A843]" : "text-[#333]"}`}>{f}</div>
          ))}
        </div>
        {[...Array(6)].map((_, si) => {
          const s = 5 - si;
          return (
            <div key={s} className="flex items-center" style={{ height: 28 }}>
              <div className="w-8 flex-shrink-0 font-readout text-[10px] text-[#555] text-center">{STR[s]}</div>
              {Array.from({ length: maxFret + 1 }, (_, f) => {
                const midi = TUNING[s] + f;
                const n = NOTES[midi % 12];
                const inSet = highlightMidi ? highlightMidi.has(midi) : highlightNotes.includes(n);
                const isR = n === rootNote;
                const semi = (midi - (ri % 12) + 120) % 12;
                const isNut = f === 0;
                return (
                  <div key={f}
                    onClick={() => { if (onClick) onClick(s, f); else if (inSet) play(midi); }}
                    className={`flex-1 flex items-center justify-center ${inSet || onClick ? "cursor-pointer" : ""} ${inSet ? "hover:scale-110" : ""} transition-all`}
                    style={{ height: 28, borderRight: f > 0 ? "1px solid #1a1a1a" : "none", borderLeft: isNut ? "3px solid #D4A843" : "none", borderBottom: si < 5 ? `1px solid ${si < 3 ? "#333" : "#444"}` : "1px solid #555", background: isNut ? "#0d0d0d" : "transparent" }}>
                    {inSet && (
                      <div className="rounded-full flex items-center justify-center text-[7px] font-bold"
                        style={{ width: 20, height: 20, background: isR ? "#D4A843" : "#2a2a2a", color: isR ? "#121214" : "#ddd", border: isR ? "none" : "1px solid #444" }}>
                        {showIntervals ? IV_NAMES[semi] : n}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="flex mt-0.5">
          <div className="w-8 flex-shrink-0" />
          {Array.from({ length: maxFret + 1 }, (_, f) => (
            <div key={f} className="flex-1 flex justify-center">
              {FRET_MARKERS.includes(f) && (
                <div className="flex gap-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${f === 12 ? "bg-[#D4A843]/50" : "bg-[#333]"}`} />
                  {f === 12 && <div className="w-1.5 h-1.5 rounded-full bg-[#D4A843]/50" />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHORD DIAGRAM
   ═══════════════════════════════════════════════════════════ */
function ChordDiagram({ pos, onPlay }: { pos: ChordPosition; onPlay: () => void }) {
  const frets = pos.frets.split("").map(f => f === "x" ? -1 : parseInt(f, 16));
  const fingers = pos.fingers.split("").map(f => parseInt(f));
  const playable = frets.filter(f => f > 0);
  const minF = playable.length ? Math.min(...playable) : 1;
  const maxF = playable.length ? Math.max(...playable) : 1;
  const base = maxF <= 5 ? 1 : minF;
  return (
    <div className="bg-[#121214] border border-[#1a1a1a] rounded-sm p-3 text-center cursor-pointer hover:border-[#333] transition-all" onClick={onPlay} dir="ltr">
      <div className="font-readout text-[9px] text-[#555] mb-1">{base > 1 ? `Fret ${base}` : "Open"}</div>
      <svg viewBox="0 0 110 130" className="w-24 h-28 mx-auto">
        {base === 1 && <rect x="18" y="10" width="74" height="3" fill="#D4A843" rx="1" />}
        {base > 1 && <text x="8" y="26" fill="#D4A843" fontSize="10" fontFamily="monospace">{base}</text>}
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1="18" y1={12 + i * 22} x2="92" y2={12 + i * 22} stroke="#2a2a2a" strokeWidth="1" />)}
        {[0,1,2,3,4,5].map(s => <line key={s} x1={18 + s * 14.8} y1="12" x2={18 + s * 14.8} y2={12 + 5 * 22} stroke={s < 3 ? "#666" : "#888"} strokeWidth={2.5 - s * 0.3} />)}
        {pos.barres && (() => {
          const bf = (typeof pos.barres === "number" ? pos.barres : 0) - base + 1;
          if (bf < 1 || bf > 5) return null;
          const first = frets.indexOf(pos.barres as number), last = frets.lastIndexOf(pos.barres as number);
          if (first < 0 || first === last) return null;
          return <rect x={18 + first * 14.8 - 6} y={bf * 22 - 3} width={(last - first) * 14.8 + 12} height="8" rx="4" fill="#D4A843" opacity="0.5" />;
        })()}
        {frets.map((f, s) => {
          if (f === -1) return <text key={s} x={18 + s * 14.8} y="7" textAnchor="middle" fill="#C41E3A" fontSize="10">x</text>;
          if (f === 0) return <circle key={s} cx={18 + s * 14.8} cy="7" r="3.5" fill="none" stroke="#888" strokeWidth="1.5" />;
          const df = f - base + 1;
          if (df < 1 || df > 5) return null;
          return (
            <g key={s}>
              <circle cx={18 + s * 14.8} cy={df * 22 + 1} r="6" fill={fingers[s] === 1 ? "#D4A843" : "#ddd"} />
              {fingers[s] > 0 && <text x={18 + s * 14.8} y={df * 22 + 4.5} textAnchor="middle" fill="#121214" fontSize="8" fontWeight="bold">{fingers[s]}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIANO KEYBOARD
   ═══════════════════════════════════════════════════════════ */
const PIANO_WHITE_KEYS = [0,2,4,5,7,9,11]; // C D E F G A B semitone offsets
const PIANO_BLACK_KEYS = [1,3,6,8,10]; // C# D# F# G# A#
const PIANO_C3 = 48;

function PianoKeyboard({ highlighted, onClick, disabled }: {
  highlighted?: number[]; onClick?: (midi: number) => void; disabled?: boolean;
}) {
  const hlSet = new Set(highlighted || []);
  const whiteKeys: { midi: number; label: string }[] = [];
  const blackKeys: { midi: number; label: string; leftOffset: number }[] = [];
  for (let oct = 0; oct < 2; oct++) {
    const base = PIANO_C3 + oct * 12;
    PIANO_WHITE_KEYS.forEach((semi, i) => {
      whiteKeys.push({ midi: base + semi, label: NOTES[semi] + (oct === 0 ? "3" : "4") });
    });
    const blackPositions = [0.65, 1.75, 3.6, 4.7, 5.8];
    PIANO_BLACK_KEYS.forEach((semi, i) => {
      blackKeys.push({ midi: base + semi, label: NOTES[semi], leftOffset: (oct * 7 + blackPositions[i]) * 40 });
    });
  }
  return (
    <div className="relative select-none" dir="ltr" style={{ width: whiteKeys.length * 40, height: 120, margin: "0 auto" }}>
      {whiteKeys.map((k, i) => {
        const isHl = hlSet.has(k.midi);
        return (
          <div key={k.midi}
            onClick={() => { if (!disabled && onClick) onClick(k.midi); }}
            className={`absolute border border-[#333] rounded-b-sm flex items-end justify-center pb-1 text-[8px] font-bold transition-all ${!disabled && onClick ? "cursor-pointer hover:brightness-110" : ""}`}
            style={{ left: i * 40, top: 0, width: 38, height: 120,
              background: isHl ? "#f59e0b" : "#e8e8e8",
              color: isHl ? "#121214" : "#555" }}>
            {k.label}
          </div>
        );
      })}
      {blackKeys.map(k => {
        const isHl = hlSet.has(k.midi);
        return (
          <div key={k.midi}
            onClick={() => { if (!disabled && onClick) onClick(k.midi); }}
            className={`absolute rounded-b-sm flex items-end justify-center pb-1 text-[7px] font-bold z-10 transition-all ${!disabled && onClick ? "cursor-pointer hover:brightness-125" : ""}`}
            style={{ left: k.leftOffset, top: 0, width: 24, height: 80,
              background: isHl ? "#f59e0b" : "#1a1a1a",
              color: isHl ? "#121214" : "#666",
              border: isHl ? "1px solid #f59e0b" : "1px solid #333" }}>
            {k.label}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHROMATIC TUNER (Web Audio API)
   ═══════════════════════════════════════════════════════════ */
const TUNER_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const STD_TUNING_REF = [
  { note: "E", octave: 2, freq: 82.41 },
  { note: "A", octave: 2, freq: 110.00 },
  { note: "D", octave: 3, freq: 146.83 },
  { note: "G", octave: 3, freq: 196.00 },
  { note: "B", octave: 3, freq: 246.94 },
  { note: "E", octave: 4, freq: 329.63 },
];

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thres) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }

  const trimmed = buf.slice(r1, r2);
  SIZE = trimmed.length;
  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let sum = 0;
    for (let j = 0; j < SIZE - i; j++) sum += trimmed[j] * trimmed[j + i];
    c[i] = sum;
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxVal = -1, maxPos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }

  let T0 = maxPos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

function freqToNote(freq: number): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log2(freq / 440));
  const noteIdx = Math.round(noteNum) + 69;
  const cents = Math.round((noteNum - Math.round(noteNum)) * 100);
  const note = TUNER_NOTES[((noteIdx % 12) + 12) % 12];
  const octave = Math.floor(noteIdx / 12) - 1;
  return { note, octave, cents };
}

function ChromaticTuner() {
  const [listening, setListening] = useState(false);
  const [detected, setDetected] = useState<{ note: string; octave: number; cents: number; freq: number } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const startTuner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      src.connect(analyser);
      analyserRef.current = analyser;
      setListening(true);

      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, ctx.sampleRate);
        if (freq > 50 && freq < 1500) {
          const info = freqToNote(freq);
          setDetected({ ...info, freq: Math.round(freq * 10) / 10 });
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic permission denied
    }
  };

  const stopTuner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (ctxRef.current) ctxRef.current.close();
    setListening(false);
    setDetected(null);
  };

  useEffect(() => { return () => { stopTuner(); }; }, []);

  const cents = detected?.cents ?? 0;
  const absCents = Math.abs(cents);
  const tuneClass = absCents <= 5 ? "tuner-in-tune" : absCents <= 15 ? "tuner-close" : "tuner-off";
  const tuneColor = absCents <= 5 ? "#33CC33" : absCents <= 15 ? "#FFAA00" : "#FF3333";
  const needleLeft = detected ? 50 + (cents / 50) * 50 : 50;

  return (
    <div className="panel p-3 sm:p-5 mb-3">
      <div className="font-heading text-lg font-bold text-[#D4A843] mb-3">Chromatic Tuner</div>
      <div className="text-[11px] text-[#555] mb-4">Use your microphone for real-time pitch detection.</div>

      <div className="flex justify-center mb-6">
        <button onClick={listening ? stopTuner : startTuner} className={listening ? "btn-danger" : "btn-gold"}>
          {listening ? "Stop" : "Start Tuner"}
        </button>
      </div>

      {listening && (
        <div className="flex flex-col items-center gap-4">
          {/* Note display */}
          <div className="text-center">
            <div className="font-heading text-6xl font-bold" style={{ color: detected ? tuneColor : "#333" }}>
              {detected ? detected.note : "--"}
            </div>
            <div className="font-readout text-lg text-[#888] mt-1">
              {detected ? `${detected.octave} · ${detected.freq} Hz` : "Waiting..."}
            </div>
          </div>

          {/* Cents display */}
          <div className="font-readout text-2xl font-bold" style={{ color: detected ? tuneColor : "#333" }}>
            {detected ? (cents > 0 ? "+" : "") + cents + " cents" : ""}
          </div>

          {/* Visual meter */}
          <div className="tuner-meter">
            <div className="tuner-meter-center" />
            <div className={`tuner-needle ${detected ? tuneClass : ""}`} style={{ left: `calc(${needleLeft}% - 2px)` }} />
          </div>
          <div className="flex justify-between w-full max-w-[320px] font-readout text-[9px] text-[#444]">
            <span>-50</span><span>0</span><span>+50</span>
          </div>

          {/* Standard tuning reference */}
          <div className="w-full mt-4">
            <div className="font-label text-[10px] text-[#555] mb-2">Standard Tuning Reference</div>
            <div className="grid grid-cols-6 gap-2">
              {STD_TUNING_REF.map((ref, i) => {
                const isMatch = detected && detected.note === ref.note && detected.octave === ref.octave;
                return (
                  <div key={i} className="text-center panel p-2" style={isMatch ? { borderColor: tuneColor + "60" } : {}}>
                    <div className="font-heading text-lg" style={{ color: isMatch ? tuneColor : "#888" }}>{ref.note}{ref.octave}</div>
                    <div className="font-readout text-[9px] text-[#555]">{ref.freq} Hz</div>
                    <div className="font-readout text-[8px] text-[#444] mt-0.5">String {6 - i}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function LearningCenterPage() {
  /* ── Main tab ── */
  const [mainTab, setMainTab] = useState<MainTab>("lessons");

  /* ── Lessons state ── */
  const [lessonCat, setLessonCat] = useState<LessonCategory>("Fundamentals");
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [quizPicked, setQuizPicked] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  /* ── Exercises state ── */
  const [exMode, setExMode] = useState<ExMode>("intervals");
  const [subTab, setSubTab] = useState<SubTab>("exercise");
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
  const [answer, setAnswer] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [direction, setDirection] = useState<Direction>("ascending");
  const [enabledIntervals, setEnabledIntervals] = useState<Set<number>>(new Set([3,4,5,7,12]));
  const [enabledChords, setEnabledChords] = useState<Set<string>>(new Set(["Major","Minor","Dim"]));
  const [enabledScales, setEnabledScales] = useState<Set<string>>(new Set(["Major","Nat. Minor","Pent. Minor"]));
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [fbTarget, setFbTarget] = useState<string | null>(null);
  const [fbFeedback, setFbFeedback] = useState<{ fret: number; str: number; ok: boolean } | null>(null);

  /* ── Construction exercise state ── */
  const [conSubMode, setConSubMode] = useState<ConSubMode>("scale");
  const [conScale, setConScale] = useState("Dorian");
  const [conRoot, setConRoot] = useState("A");
  const [conSelected, setConSelected] = useState<Set<string>>(new Set());
  const [conRevealed, setConRevealed] = useState(false);
  const [conIvName, setConIvName] = useState("P5");
  const [conChordType, setConChordType] = useState("Major");

  /* ── Fretboard exercise states (new modes) ── */
  const [fbExDots, setFbExDots] = useState<number[]>([]);
  const [fbExAnswer, setFbExAnswer] = useState<string | null>(null);
  const [fbExPicked, setFbExPicked] = useState<string | null>(null);
  const [fbExRevealed, setFbExRevealed] = useState(false);

  /* ── Note ear training state ── */
  const [noteEarMidi, setNoteEarMidi] = useState<number | null>(null);

  /* ── Interval construction state ── */
  const [ivConRoot, setIvConRoot] = useState<string | null>(null);
  const [ivConInterval, setIvConInterval] = useState<string | null>(null);
  const [ivConAnswer, setIvConAnswer] = useState<string | null>(null);
  const [ivConPicked, setIvConPicked] = useState<string | null>(null);
  const [ivConRevealed, setIvConRevealed] = useState(false);

  /* ── Chord construction state ── */
  const [chConRoot, setChConRoot] = useState<string | null>(null);
  const [chConType, setChConType] = useState<string | null>(null);
  const [chConExpected, setChConExpected] = useState<Set<string>>(new Set());
  const [chConSelected, setChConSelected] = useState<Set<string>>(new Set());
  const [chConRevealed, setChConRevealed] = useState(false);

  /* ── Keyboard exercise state ── */
  const [kbHighlight, setKbHighlight] = useState<number[]>([]);
  const [kbAnswer, setKbAnswer] = useState<string | null>(null);
  const [kbPicked, setKbPicked] = useState<string | null>(null);
  const [kbRevealed, setKbRevealed] = useState(false);
  const [kbEarMidi, setKbEarMidi] = useState<number | null>(null);

  /* ── Piano tool state ── */
  const [pianoRoot, setPianoRoot] = useState("C");
  const [pianoScale, setPianoScale] = useState<string | null>(null);

  /* ── Tools state ── */
  const [toolTab, setToolTab] = useState<ToolTab>("scales");
  const [root, setRoot] = useState("A");
  const [selScale, setSelScale] = useState("Minor Pentatonic");
  const [selChord, setSelChord] = useState("minor");
  const [chordData, setChordData] = useState<ChordData | null>(null);
  const [chordLoading, setChordLoading] = useState(false);
  const [showIv, setShowIv] = useState(false);
  const [fbMode, setFbMode] = useState<"notes"|"scale"|"chord">("notes");
  const [fbScale, setFbScale] = useState("Minor Pentatonic");
  const [progChords, setProgChords] = useState<string[]>(["Am","F","C","G"]);
  const [newChord, setNewChord] = useState("");
  const [progPlaying, setProgPlaying] = useState(false);
  const [progLoop, setProgLoop] = useState(false);

  /* ── Tempo Tapper state ── */
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);

  /* ── Interval Calculator state ── */
  const [calcNote, setCalcNote] = useState("C");
  const [calcIv, setCalcIv] = useState(7);

  /* ── Persistence ── */
  const [ls, setLs] = useState<LearnState>({ xp: 0, level: 1, bestStreak: 0, unlocked: [], history: {}, lessonsCompleted: [] });

  /* ── Refs ── */
  const ctxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Load / migrate ── */
  useEffect(() => {
    try {
      const existing = localStorage.getItem("gf-learn");
      if (existing) {
        const d = JSON.parse(existing) as LearnState;
        setLs(d);
        setScore(p => ({ ...p, bestStreak: d.bestStreak || 0 }));
        return;
      }
      const old = localStorage.getItem("gf-ear3");
      if (old) {
        const d = JSON.parse(old);
        const migrated: LearnState = { xp: d.xp || 0, level: d.level || 1, bestStreak: d.bestStreak || 0, unlocked: d.unlocked || [], history: d.history || {}, lessonsCompleted: [] };
        setLs(migrated);
        setScore(p => ({ ...p, bestStreak: migrated.bestStreak || 0 }));
        persist(migrated);
      }
    } catch { /* ignore */ }
  }, []);

  function persist(st: LearnState) { setLs(st); try { localStorage.setItem("gf-learn", JSON.stringify(st)); } catch {} }

  /* ── Chord data fetch ── */
  useEffect(() => {
    if (mainTab !== "tools" || toolTab !== "chords") return;
    setChordLoading(true);
    fetch(`/api/chords?key=${encodeURIComponent(root)}&suffix=${encodeURIComponent(selChord)}`)
      .then(r => r.ok ? r.json() : null).then(d => setChordData(d)).catch(() => setChordData(null))
      .finally(() => setChordLoading(false));
  }, [root, selChord, mainTab, toolTab]);

  /* ── Cleanup ── */
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); if (progRef.current) clearInterval(progRef.current); }, []);

  /* ═══════════════════════════════════════════════════════════
     AUDIO
     ═══════════════════════════════════════════════════════════ */
  function ctx() { if (!ctxRef.current) ctxRef.current = new AudioContext(); return ctxRef.current; }
  function tone(midi: number, dur = 0.6, delay = 0, type: OscillatorType = "triangle") {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = type; o.frequency.value = freq(midi);
    g.gain.setValueAtTime(0.22, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.1);
  }
  function playIv(st: number, dir: Direction) {
    const r = 55 + Math.floor(Math.random() * 12);
    if (dir === "harmonic") { tone(r); tone(r + st); }
    else if (dir === "descending") { tone(r + st, 0.6, 0); tone(r, 0.6, 0.7); }
    else { tone(r, 0.6, 0); tone(r + st, 0.6, 0.7); }
  }
  function playChordAudio(iv: number[]) { const r = 55 + Math.floor(Math.random() * 12); iv.forEach(s => tone(r + s, 1.2)); }
  function playScaleNotes(ns: number[]) { const r = 55 + Math.floor(Math.random() * 12); ns.forEach((n, i) => tone(r + n, 0.35, i * 0.2)); }
  function playProg(chords: number[][]) { chords.forEach((ch, i) => { const r = 48; ch.forEach(n => tone(r + n, 0.8, i * 1.0)); }); }
  function playNote(midi: number, delay = 0) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq(midi);
    g.gain.setValueAtTime(0.2, c.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.5);
    o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.6);
  }
  function playChordByName(name: string, delay = 0) {
    const r = name.replace(/[m7b5#addimaugsuj9]+.*$/, "");
    const rIdx = NOTES.indexOf(r);
    if (rIdx < 0) return;
    const isMinor = name.includes("m") && !name.includes("maj");
    const third = isMinor ? 3 : 4;
    [0, third, 7].forEach(s => playNote(48 + rIdx + s, delay));
  }
  function playLessonAudio(demo: Lesson["audioDemo"]) {
    if (!demo) return;
    const ri = NOTES.indexOf(root);
    if (demo.type === "scale") demo.data.forEach((s, i) => playNote(57 + ri + s, i * 0.18));
    else if (demo.type === "chord") demo.data.forEach(s => playNote(57 + ri + s));
    else if (demo.type === "interval") demo.data.forEach((st, i) => { playNote(57 + ri, i * 1.5); playNote(57 + ri + st, i * 1.5 + 0.5); });
  }

  /* ── Progression player ── */
  function playProgression() {
    if (progPlaying) { if (progRef.current) clearInterval(progRef.current); setProgPlaying(false); return; }
    setProgPlaying(true);
    let i = 0;
    const play = () => { if (i < progChords.length) { playChordByName(progChords[i]); i++; } else if (progLoop) { i = 0; playChordByName(progChords[0]); i = 1; } else { if (progRef.current) clearInterval(progRef.current); setProgPlaying(false); } };
    play();
    progRef.current = setInterval(play, 1200);
  }

  /* ═══════════════════════════════════════════════════════════
     EAR TRAINING LOGIC
     ═══════════════════════════════════════════════════════════ */
  const activeIv = ALL_INTERVALS.filter(i => enabledIntervals.has(i.st));
  const activeCh = ALL_CHORDS.filter(c => enabledChords.has(c.name));
  const activeSc = ALL_SCALES.filter(s => enabledScales.has(s.name));

  function newQ() {
    setPicked(null); setRevealed(false); setFbFeedback(null);
    setFbExPicked(null); setFbExRevealed(false);
    setIvConPicked(null); setIvConRevealed(false);
    setChConRevealed(false); setChConSelected(new Set());
    setKbPicked(null); setKbRevealed(false); setKbHighlight([]); setKbEarMidi(null);
    if (exMode === "intervals") { const it = activeIv[Math.floor(Math.random() * activeIv.length)]; if (it) { setAnswer(it.name); playIv(it.st, direction); } }
    else if (exMode === "chords") { const it = activeCh[Math.floor(Math.random() * activeCh.length)]; if (it) { setAnswer(it.name); playChordAudio(it.iv); } }
    else if (exMode === "scales") { const it = activeSc[Math.floor(Math.random() * activeSc.length)]; if (it) { setAnswer(it.name); playScaleNotes(it.notes); } }
    else if (exMode === "fretboard") { const n = NOTES[Math.floor(Math.random() * 12)]; setFbTarget(n); setAnswer(n); tone(60 + NOTES.indexOf(n)); }
    else if (exMode === "progressions") { const p = PROG_QUESTIONS[Math.floor(Math.random() * PROG_QUESTIONS.length)]; setAnswer(p.name); playProg(p.chords); }
    else if (exMode === "fb-intervals") { genFbIntervalQ(); }
    else if (exMode === "fb-scales") { genFbScaleQ(); }
    else if (exMode === "fb-chords") { genFbChordQ(); }
    else if (exMode === "note-ear") { genNoteEarQ(); }
    else if (exMode === "iv-construction") { genIvConstructionQ(); }
    else if (exMode === "chord-construction") { genChordConstructionQ(); }
    else if (exMode === "kb-notes") { genKbNotesQ(); }
    else if (exMode === "kb-intervals") { genKbIntervalsQ(); }
    else if (exMode === "kb-scales") { genKbScalesQ(); }
    else if (exMode === "kb-chords") { genKbChordsQ(); }
    else if (exMode === "kb-ear") { genKbEarQ(); }
  }

  /* ── Fretboard Intervals question ── */
  function genFbIntervalQ() {
    const s1 = Math.floor(Math.random() * 6);
    const f1 = Math.floor(Math.random() * 13);
    const midi1 = TUNING[s1] + f1;
    const ivPool = [
      { name: "Unison", st: 0 }, ...ALL_INTERVALS.map(i => ({ name: i.name, st: i.st }))
    ];
    const iv = ivPool[Math.floor(Math.random() * ivPool.length)];
    const midi2 = midi1 + iv.st;
    if (midi2 > 84 || midi2 < 40) { genFbIntervalQ(); return; }
    setFbExDots([midi1, midi2]);
    setFbExAnswer(iv.name);
    setFbExPicked(null); setFbExRevealed(false);
    setAnswer(iv.name);
    tone(midi1, 0.5, 0); tone(midi2, 0.5, 0.6);
  }

  /* ── Fretboard Scales question ── */
  function genFbScaleQ() {
    const rootIdx = Math.floor(Math.random() * 12);
    const sc = ALL_SCALES[Math.floor(Math.random() * ALL_SCALES.length)];
    const baseMidi = 40 + rootIdx;
    const midiSet = new Set<number>();
    for (let oct = 0; oct < 3; oct++) {
      sc.notes.forEach(n => {
        const m = baseMidi + oct * 12 + n;
        if (m >= 40 && m <= 79) midiSet.add(m);
      });
    }
    setFbExDots([...midiSet]);
    setFbExAnswer(sc.name);
    setFbExPicked(null); setFbExRevealed(false);
    setAnswer(sc.name);
    const sorted = [...midiSet].sort((a, b) => a - b).slice(0, 8);
    sorted.forEach((m, i) => tone(m, 0.3, i * 0.15));
  }

  /* ── Fretboard Chords question ── */
  function genFbChordQ() {
    const ch = CHORD_SHAPES[Math.floor(Math.random() * CHORD_SHAPES.length)];
    const rootIdx = Math.floor(Math.random() * 12);
    const offset = rootIdx;
    const midis: number[] = [];
    ch.positions.forEach(([s, fOff]) => {
      const midi = TUNING[s] + fOff + offset;
      if (midi >= 40 && midi <= 84) midis.push(midi);
    });
    setFbExDots(midis);
    setFbExAnswer(ch.name);
    setFbExPicked(null); setFbExRevealed(false);
    setAnswer(ch.name);
    midis.forEach(m => tone(m, 1.0));
  }

  /* ── Note Ear Training question ── */
  function genNoteEarQ() {
    const noteIdx = Math.floor(Math.random() * 12);
    const octave = 60 + noteIdx;
    setNoteEarMidi(octave);
    setAnswer(NOTES[noteIdx]);
    setPicked(null); setRevealed(false);
    tone(octave, 1.0);
  }

  /* ── Interval Construction question ── */
  function genIvConstructionQ() {
    const rootIdx = Math.floor(Math.random() * 12);
    const iv = ALL_INTERVALS[Math.floor(Math.random() * ALL_INTERVALS.length)];
    const targetIdx = (rootIdx + iv.st) % 12;
    setIvConRoot(NOTES[rootIdx]);
    setIvConInterval(iv.name);
    setIvConAnswer(NOTES[targetIdx]);
    setIvConPicked(null); setIvConRevealed(false);
    setAnswer(NOTES[targetIdx]);
    tone(60 + rootIdx, 0.6);
  }

  /* ── Chord Construction question ── */
  function genChordConstructionQ() {
    const rootIdx = Math.floor(Math.random() * 12);
    const chTypes = [
      { name: "Major", iv: [0,4,7] }, { name: "Minor", iv: [0,3,7] },
      { name: "Dim", iv: [0,3,6] }, { name: "Aug", iv: [0,4,8] },
      { name: "Dom7", iv: [0,4,7,10] }, { name: "Maj7", iv: [0,4,7,11] },
      { name: "Min7", iv: [0,3,7,10] },
    ];
    const ch = chTypes[Math.floor(Math.random() * chTypes.length)];
    const expected = new Set(ch.iv.map(s => NOTES[(rootIdx + s) % 12]));
    setChConRoot(NOTES[rootIdx]);
    setChConType(ch.name);
    setChConExpected(expected);
    setChConSelected(new Set());
    setChConRevealed(false);
    setAnswer(ch.name);
    ch.iv.forEach(s => tone(60 + rootIdx + s, 1.0));
  }

  /* ── Keyboard Notes question ── */
  function genKbNotesQ() {
    const midi = PIANO_C3 + Math.floor(Math.random() * 24);
    setKbHighlight([midi]);
    const noteName = NOTES[midi % 12];
    setKbAnswer(noteName);
    setKbPicked(null); setKbRevealed(false);
    setAnswer(noteName);
  }

  /* ── Keyboard Intervals question ── */
  function genKbIntervalsQ() {
    const midi1 = PIANO_C3 + Math.floor(Math.random() * 20);
    const iv = ALL_INTERVALS[Math.floor(Math.random() * ALL_INTERVALS.length)];
    const midi2 = midi1 + iv.st;
    if (midi2 > PIANO_C3 + 23) { genKbIntervalsQ(); return; }
    setKbHighlight([midi1, midi2]);
    setKbAnswer(iv.name);
    setKbPicked(null); setKbRevealed(false);
    setAnswer(iv.name);
    tone(midi1, 0.5, 0); tone(midi2, 0.5, 0.6);
  }

  /* ── Keyboard Scales question ── */
  function genKbScalesQ() {
    const rootIdx = Math.floor(Math.random() * 12);
    const sc = ALL_SCALES[Math.floor(Math.random() * ALL_SCALES.length)];
    const base = PIANO_C3 + rootIdx;
    const midis: number[] = [];
    for (let oct = 0; oct < 2; oct++) {
      sc.notes.forEach(n => {
        const m = base + oct * 12 + n;
        if (m >= PIANO_C3 && m <= PIANO_C3 + 23) midis.push(m);
      });
    }
    setKbHighlight(midis);
    setKbAnswer(sc.name);
    setKbPicked(null); setKbRevealed(false);
    setAnswer(sc.name);
    const sorted = [...midis].sort((a, b) => a - b).slice(0, 8);
    sorted.forEach((m, i) => tone(m, 0.3, i * 0.15));
  }

  /* ── Keyboard Chords question ── */
  function genKbChordsQ() {
    const rootIdx = Math.floor(Math.random() * 12);
    const ch = ALL_CHORDS[Math.floor(Math.random() * ALL_CHORDS.length)];
    const base = PIANO_C3 + rootIdx;
    const midis = ch.iv.map(s => base + s).filter(m => m <= PIANO_C3 + 23);
    setKbHighlight(midis);
    setKbAnswer(ch.name);
    setKbPicked(null); setKbRevealed(false);
    setAnswer(ch.name);
    midis.forEach(m => tone(m, 1.0));
  }

  /* ── Keyboard Ear question (play note, user clicks key) ── */
  function genKbEarQ() {
    const midi = PIANO_C3 + Math.floor(Math.random() * 24);
    setKbHighlight([]);
    setKbEarMidi(midi);
    setKbAnswer(String(midi));
    setKbPicked(null); setKbRevealed(false);
    setAnswer(String(midi));
    tone(midi, 1.0);
  }

  function replay() {
    if (!answer) return;
    if (exMode === "intervals") { const it = ALL_INTERVALS.find(i => i.name === answer); if (it) playIv(it.st, direction); }
    else if (exMode === "chords") { const it = ALL_CHORDS.find(c => c.name === answer); if (it) playChordAudio(it.iv); }
    else if (exMode === "scales") { const it = ALL_SCALES.find(s => s.name === answer); if (it) playScaleNotes(it.notes); }
    else if (exMode === "fretboard") { const i = NOTES.indexOf(answer); if (i >= 0) tone(60 + i); }
    else if (exMode === "progressions") { const p = PROG_QUESTIONS.find(q => q.name === answer); if (p) playProg(p.chords); }
    else if (exMode === "fb-intervals" && fbExDots.length >= 2) { tone(fbExDots[0], 0.5, 0); tone(fbExDots[1], 0.5, 0.6); }
    else if (exMode === "fb-scales" && fbExDots.length > 0) { const sorted = [...fbExDots].sort((a, b) => a - b).slice(0, 8); sorted.forEach((m, i) => tone(m, 0.3, i * 0.15)); }
    else if (exMode === "fb-chords" && fbExDots.length > 0) { fbExDots.forEach(m => tone(m, 1.0)); }
    else if (exMode === "note-ear" && noteEarMidi) { tone(noteEarMidi, 1.0); }
    else if (exMode === "iv-construction" && ivConRoot) { tone(60 + NOTES.indexOf(ivConRoot), 0.6); }
    else if (exMode === "chord-construction" && chConRoot && chConType) {
      const chTypes: Record<string, number[]> = { Major: [0,4,7], Minor: [0,3,7], Dim: [0,3,6], Aug: [0,4,8], Dom7: [0,4,7,10], Maj7: [0,4,7,11], Min7: [0,3,7,10] };
      const iv = chTypes[chConType] || [0,4,7];
      const cri = NOTES.indexOf(chConRoot);
      iv.forEach(s => tone(60 + cri + s, 1.0));
    }
    else if (exMode === "kb-notes" && kbHighlight.length > 0) { tone(kbHighlight[0], 0.6); }
    else if (exMode === "kb-intervals" && kbHighlight.length >= 2) { tone(kbHighlight[0], 0.5, 0); tone(kbHighlight[1], 0.5, 0.6); }
    else if (exMode === "kb-scales" && kbHighlight.length > 0) { const sorted = [...kbHighlight].sort((a, b) => a - b).slice(0, 8); sorted.forEach((m, i) => tone(m, 0.3, i * 0.15)); }
    else if (exMode === "kb-chords" && kbHighlight.length > 0) { kbHighlight.forEach(m => tone(m, 1.0)); }
    else if (exMode === "kb-ear" && kbEarMidi) { tone(kbEarMidi, 1.0); }
  }

  /* ── handleAnswer for keyboard exercises ── */
  function handleKbAnswer(name: string) {
    if (kbRevealed || !kbAnswer) return;
    setKbPicked(name); setKbRevealed(true);
    const correct = name === kbAnswer;
    const ns = correct ? score.streak + 1 : 0;
    const best = Math.max(score.bestStreak, ns, ls.bestStreak);
    const earned = correct ? (10 + Math.min(ns, 20) * 2) : 0;
    const nx = ls.xp + earned;
    const nl = Math.floor(nx / 100) + 1;
    const hKey = exMode + "-" + kbAnswer;
    const prev = ls.history[hKey] || { c: 0, t: 0 };
    const newH = { ...ls.history, [hKey]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } };
    const unlocked = [...ls.unlocked];
    const pct = (score.correct + (correct ? 1 : 0)) / (score.total + 1) * 100;
    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.key === "total" && score.total + 1 >= a.need) unlocked.push(a.id);
      if (a.key === "streak" && ns >= a.need) unlocked.push(a.id);
      if (a.key === "accuracy" && score.total + 1 >= 20 && pct >= a.need) unlocked.push(a.id);
      if (a.key === "level" && nl >= a.need) unlocked.push(a.id);
    });
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1, streak: ns, bestStreak: best });
    persist({ ...ls, xp: nx, level: nl, bestStreak: best, unlocked, history: newH });
    if (autoAdvance && correct) timeoutRef.current = setTimeout(newQ, 900);
  }

  /* ── handleAnswer for kb-ear (clicking piano key) ── */
  function handleKbEarClick(midi: number) {
    if (kbRevealed || !kbEarMidi) return;
    const correct = midi === kbEarMidi;
    setKbHighlight(correct ? [midi] : [midi, kbEarMidi]);
    setKbPicked(String(midi)); setKbRevealed(true);
    tone(midi, 0.5);
    const ns = correct ? score.streak + 1 : 0;
    const best = Math.max(score.bestStreak, ns, ls.bestStreak);
    const earned = correct ? (10 + Math.min(ns, 20) * 2) : 0;
    const nx = ls.xp + earned;
    const nl = Math.floor(nx / 100) + 1;
    const hKey = "kb-ear-" + kbEarMidi;
    const prev = ls.history[hKey] || { c: 0, t: 0 };
    const newH = { ...ls.history, [hKey]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } };
    const unlocked = [...ls.unlocked];
    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.key === "total" && score.total + 1 >= a.need) unlocked.push(a.id);
      if (a.key === "streak" && ns >= a.need) unlocked.push(a.id);
    });
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1, streak: ns, bestStreak: best });
    persist({ ...ls, xp: nx, level: nl, bestStreak: best, unlocked, history: newH });
    if (autoAdvance && correct) timeoutRef.current = setTimeout(newQ, 900);
  }

  function handleAnswer(name: string) {
    if (revealed || !answer) return;
    setPicked(name); setRevealed(true);
    const correct = name === answer;
    const ns = correct ? score.streak + 1 : 0;
    const best = Math.max(score.bestStreak, ns, ls.bestStreak);
    const earned = correct ? (10 + Math.min(ns, 20) * 2) : 0;
    const nx = ls.xp + earned;
    const nl = Math.floor(nx / 100) + 1;
    const hKey = exMode + "-" + answer;
    const prev = ls.history[hKey] || { c: 0, t: 0 };
    const newH = { ...ls.history, [hKey]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } };
    const unlocked = [...ls.unlocked];
    const pct = (score.correct + (correct ? 1 : 0)) / (score.total + 1) * 100;
    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.key === "total" && score.total + 1 >= a.need) unlocked.push(a.id);
      if (a.key === "streak" && ns >= a.need) unlocked.push(a.id);
      if (a.key === "accuracy" && score.total + 1 >= 20 && pct >= a.need) unlocked.push(a.id);
      if (a.key === "level" && nl >= a.need) unlocked.push(a.id);
    });
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1, streak: ns, bestStreak: best });
    persist({ ...ls, xp: nx, level: nl, bestStreak: best, unlocked, history: newH });
    if (autoAdvance && correct) timeoutRef.current = setTimeout(newQ, 900);
  }

  /* ── handleAnswer for fretboard-visual exercises ── */
  function handleFbExAnswer(name: string) {
    if (fbExRevealed || !fbExAnswer) return;
    setFbExPicked(name); setFbExRevealed(true);
    const correct = name === fbExAnswer;
    const ns = correct ? score.streak + 1 : 0;
    const best = Math.max(score.bestStreak, ns, ls.bestStreak);
    const earned = correct ? (10 + Math.min(ns, 20) * 2) : 0;
    const nx = ls.xp + earned;
    const nl = Math.floor(nx / 100) + 1;
    const hKey = exMode + "-" + fbExAnswer;
    const prev = ls.history[hKey] || { c: 0, t: 0 };
    const newH = { ...ls.history, [hKey]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } };
    const unlocked = [...ls.unlocked];
    const pct = (score.correct + (correct ? 1 : 0)) / (score.total + 1) * 100;
    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.key === "total" && score.total + 1 >= a.need) unlocked.push(a.id);
      if (a.key === "streak" && ns >= a.need) unlocked.push(a.id);
      if (a.key === "accuracy" && score.total + 1 >= 20 && pct >= a.need) unlocked.push(a.id);
      if (a.key === "level" && nl >= a.need) unlocked.push(a.id);
    });
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1, streak: ns, bestStreak: best });
    persist({ ...ls, xp: nx, level: nl, bestStreak: best, unlocked, history: newH });
    if (autoAdvance && correct) timeoutRef.current = setTimeout(newQ, 900);
  }

  function handleFbClick(s: number, f: number) {
    if (!fbTarget || revealed) return;
    const note = NOTES[(TUNING[s] + f) % 12]; const ok = note === fbTarget;
    setFbFeedback({ str: s, fret: f, ok });
    handleAnswer(ok ? fbTarget : "__wrong");
  }

  /* ── Lesson complete ── */
  function completeLesson(id: string) {
    if (ls.lessonsCompleted.includes(id)) return;
    const nx = ls.xp + 50;
    const nl = Math.floor(nx / 100) + 1;
    persist({ ...ls, xp: nx, level: nl, lessonsCompleted: [...ls.lessonsCompleted, id] });
  }

  /* ── Construction check ── */
  function checkConstruction() {
    setConRevealed(true);
    if (conSubMode === "scale") {
      const scaleObj = ALL_SCALES.find(s => s.name === conScale);
      if (!scaleObj) return;
      const cri = NOTES.indexOf(conRoot);
      const expected = new Set(scaleObj.notes.map(s => NOTES[(cri + s) % 12]));
      const correct = conSelected.size === expected.size && [...conSelected].every(n => expected.has(n));
      if (correct) { const nx = ls.xp + 25; persist({ ...ls, xp: nx, level: Math.floor(nx / 100) + 1 }); }
    } else if (conSubMode === "interval") {
      const iv = ALL_INTERVALS.find(i => i.name === conIvName);
      if (!iv) return;
      const cri = NOTES.indexOf(conRoot);
      const expected = NOTES[(cri + iv.st) % 12];
      const correct = conSelected.size === 1 && conSelected.has(expected);
      if (correct) { const nx = ls.xp + 15; persist({ ...ls, xp: nx, level: Math.floor(nx / 100) + 1 }); }
    } else if (conSubMode === "chord") {
      const ch = ALL_CHORDS.find(c => c.name === conChordType);
      if (!ch) return;
      const cri = NOTES.indexOf(conRoot);
      const expected = new Set(ch.iv.map(s => NOTES[(cri + s) % 12]));
      const correct = conSelected.size === expected.size && [...conSelected].every(n => expected.has(n));
      if (correct) { const nx = ls.xp + 20; persist({ ...ls, xp: nx, level: Math.floor(nx / 100) + 1 }); }
    }
  }

  /* ── Check chord construction exercise ── */
  function checkChordConstruction() {
    setChConRevealed(true);
    const correct = chConSelected.size === chConExpected.size && [...chConSelected].every(n => chConExpected.has(n));
    if (correct) {
      const ns = score.streak + 1;
      const best = Math.max(score.bestStreak, ns, ls.bestStreak);
      const earned = 15 + Math.min(ns, 20) * 2;
      const nx = ls.xp + earned;
      const nl = Math.floor(nx / 100) + 1;
      setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1, streak: ns, bestStreak: best }));
      persist({ ...ls, xp: nx, level: nl, bestStreak: best });
      if (autoAdvance) timeoutRef.current = setTimeout(newQ, 1200);
    } else {
      setScore(prev => ({ ...prev, total: prev.total + 1, streak: 0 }));
    }
  }

  /* ── Tempo Tapper ── */
  function handleTap() {
    const now = Date.now();
    const newTaps = [...tapTimes, now].slice(-10);
    setTapTimes(newTaps);
    if (newTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTaps.length; i++) intervals.push(newTaps[i] - newTaps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setTapBpm(Math.round(60000 / avg));
    }
  }

  /* ── Derived ── */
  const pool = exMode === "intervals" ? activeIv : exMode === "chords" ? activeCh : exMode === "scales" ? activeSc : exMode === "progressions" ? PROG_QUESTIONS.map(p => ({ name: p.name, color: "#D4A843" })) : [];
  const scorePct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const ri = NOTES.indexOf(root);
  const scInfo = SCALE_F[selScale] || { formula: [], desc: "" };
  const scNotes = scInfo.formula.map(s => NOTES[(ri + s) % 12]);
  const fbScInfo = SCALE_F[fbScale] || { formula: [], desc: "" };
  const fbScNotes = fbScInfo.formula.map(s => NOTES[(ri + s) % 12]);
  const FIFTH_ORDER = [0,7,2,9,4,11,6,1,8,3,10,5];
  const MAJOR_KEYS = ["C","G","D","A","E","B","F#/Gb","Db","Ab","Eb","Bb","F"];
  const MINOR_KEYS = ["Am","Em","Bm","F#m","C#m","G#m","Ebm","Bbm","Fm","Cm","Gm","Dm"];
  const filteredLessons = LESSONS.filter(l => l.cat === lessonCat);
  const activeLessonObj = openLesson ? LESSONS.find(l => l.id === openLesson) : null;
  const LESSON_CATS: LessonCategory[] = ["Fundamentals","Rhythm","Scales","Intervals","Chords","Diatonic Chords","Progressions","Advanced"];

  /* ── Exercise modes that use the generic ear training UI ── */
  const isStandardEarMode = ["intervals","chords","scales","progressions"].includes(exMode);
  const isFbVisualMode = ["fb-intervals","fb-scales","fb-chords"].includes(exMode);
  const isConstructionMode = exMode === "construction";
  const isNoteEarMode = exMode === "note-ear";
  const isIvConMode = exMode === "iv-construction";
  const isChConMode = exMode === "chord-construction";
  const isFretboardMode = exMode === "fretboard";
  const isKbMode = ["kb-notes","kb-intervals","kb-scales","kb-chords","kb-ear"].includes(exMode);
  const hasSubTabs = isStandardEarMode || isFretboardMode || isFbVisualMode || isNoteEarMode || isIvConMode || isKbMode;

  /* ── Interval buttons for fb-intervals ── */
  const FB_IV_BUTTONS = [
    { name: "Unison", st: 0 },
    { name: "m2", st: 1 },{ name: "M2", st: 2 },{ name: "m3", st: 3 },{ name: "M3", st: 4 },
    { name: "P4", st: 5 },{ name: "TT", st: 6 },{ name: "P5", st: 7 },
    { name: "m6", st: 8 },{ name: "M6", st: 9 },{ name: "m7", st: 10 },{ name: "M7", st: 11 },
    { name: "P8", st: 12 },
  ];

  /* ── Scale buttons for fb-scales ── */
  const FB_SCALE_BUTTONS = ALL_SCALES.map(s => s.name);

  /* ── Chord buttons for fb-chords ── */
  const FB_CHORD_BUTTONS = ["Major","Minor","Dim","Aug","Dom7","Maj7","Min7"];

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* ── Header (compact) ── */}
      <div className="panel p-3 sm:px-5 sm:py-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="font-heading text-base sm:text-lg font-bold text-[#D4A843] flex-shrink-0">Learning Center</div>
          <div className="flex-1 min-w-0">
            <div className="vu !h-[3px]"><div className="vu-fill" style={{ width: (ls.xp % 100) + "%" }} /></div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-readout text-[11px] font-bold text-[#D4A843]">LV.{ls.level}</span>
            <span className="font-readout text-[10px] text-[#555]">{ls.xp} XP</span>
            {ls.bestStreak > 0 && <span className="font-readout text-[9px] text-[#444]">Streak: {ls.bestStreak}</span>}
          </div>
        </div>
      </div>

      {/* ── Main Tabs ── */}
      <div className="flex gap-1 mb-3">
        {([["lessons","Lessons"],["exercises","Exercises"],["tools","Tools"]] as [MainTab,string][]).map(([k,lbl]) => (
          <button key={k} onClick={() => setMainTab(k)}
            className={`font-label text-[11px] px-3 sm:px-4 py-2.5 sm:py-2 rounded-sm cursor-pointer transition-all flex-1 min-h-[36px] ${mainTab === k ? "bg-[#D4A843] text-[#121214]" : "text-[#555] border border-[#222]"}`}>{lbl}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
         TAB 1: LESSONS
         ══════════════════════════════════════════════════════ */}
      {mainTab === "lessons" && (<>
        {/* Category chips */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {LESSON_CATS.map(cat => (
            <button key={cat} onClick={() => { setLessonCat(cat); setOpenLesson(null); }}
              className={`font-label text-[10px] px-3 py-2 sm:py-1.5 rounded-sm cursor-pointer transition-all min-h-[36px] ${lessonCat === cat ? "bg-[#D4A843] text-[#121214]" : "text-[#555] border border-[#222]"}`}>{cat}</button>
          ))}
        </div>

        {!activeLessonObj ? (
          /* Lesson list */
          <div className="space-y-1.5">
            {filteredLessons.map(l => {
              const done = ls.lessonsCompleted.includes(l.id);
              return (
                <div key={l.id} onClick={() => { setOpenLesson(l.id); setQuizPicked(null); setCurrentStep(0); }}
                  className={`panel p-3 sm:p-4 cursor-pointer hover:border-[#333] transition-all ${done ? "border-[#D4A843]/20" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`led ${done ? "led-gold" : "led-off"}`} />
                    <div className="flex-1">
                      <div className={`font-label text-[11px] ${done ? "text-[#D4A843]" : "text-[#ccc]"}`}>{l.title}</div>
                      <div className="text-[10px] text-[#555]">{l.desc}</div>
                    </div>
                    {done && <span className="font-readout text-[9px] text-[#D4A843]">+50 XP</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Single lesson view */
          <div>
            <button onClick={() => setOpenLesson(null)} className="btn-ghost !text-[10px] !px-3 mb-3">Back to list</button>
            <div className="panel p-3 sm:p-5 mb-3">
              <div className="font-heading text-base sm:text-lg font-bold text-[#D4A843] mb-1">{activeLessonObj.title}</div>
              <div className="font-label text-[10px] text-[#555] mb-3 sm:mb-4">{activeLessonObj.desc}</div>
              {activeLessonObj.content.map((block, i) => (
                <p key={i} className="text-[12px] text-[#bbb] mb-3 leading-relaxed">{block}</p>
              ))}
              {activeLessonObj.audioDemo && !activeLessonObj.steps && (
                <button onClick={() => playLessonAudio(activeLessonObj.audioDemo)} className="btn-gold !text-[10px] mt-2 mb-4">
                  &#9654; Play example
                </button>
              )}
              {!activeLessonObj.steps && activeLessonObj.fretboardRoot && activeLessonObj.fretboardNotes && (
                <div className="mt-3 mb-4">
                  <div className="font-label text-[9px] text-[#555] mb-1">Fretboard — {activeLessonObj.fretboardRoot}</div>
                  <LCFretboard highlightNotes={activeLessonObj.fretboardNotes} rootNote={activeLessonObj.fretboardRoot} maxFret={12} />
                </div>
              )}
            </div>

            {/* ── Interactive Steps Mode ── */}
            {activeLessonObj.steps && activeLessonObj.steps.length > 0 && (() => {
              const steps = activeLessonObj.steps!;
              const step = steps[currentStep] || steps[0];
              const hlMidi = new Set(step.highlight || []);
              const rootMidi = step.highlight && step.highlight.length > 0 ? step.highlight[0] : 48;
              const rootNote = NOTES[rootMidi % 12];
              const vis = activeLessonObj.visual || "fretboard";
              return (
                <div className="panel p-3 sm:p-5 mb-3">
                  <div className="font-label text-[10px] text-[#D4A843] mb-3">Interactive learning — Step {currentStep + 1} / {steps.length}</div>

                  {/* Visualization area */}
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-sm p-2 sm:p-3 mb-3 overflow-x-auto">
                    {step.label && (
                      <div className="text-center font-readout text-[13px] text-[#D4A843] mb-2">{step.label}</div>
                    )}
                    {vis === "fretboard" ? (
                      <LCFretboard highlightNotes={[]} rootNote={rootNote} maxFret={12} highlightMidi={hlMidi} />
                    ) : (
                      <PianoKeyboard highlighted={step.highlight || []} />
                    )}
                  </div>

                  {/* Step text */}
                  <div className="text-[12px] text-[#ccc] leading-relaxed mb-4 min-h-[40px]">{step.text}</div>

                  {/* Navigation buttons */}
                  <div className="flex gap-2 items-center mb-4 flex-wrap">
                    <button
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                      className={`font-label text-[10px] px-3 sm:px-4 py-2.5 sm:py-2 rounded-sm border transition-all min-h-[36px] ${currentStep === 0 ? "border-[#1a1a1a] text-[#333] cursor-not-allowed" : "border-[#333] text-[#aaa] cursor-pointer hover:border-[#D4A843] hover:text-[#D4A843]"}`}>
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        if (step.highlight && step.highlight.length > 0) {
                          step.highlight.forEach((midi, i) => playNote(midi, i * 0.12));
                        }
                      }}
                      className="font-label text-[10px] px-3 sm:px-4 py-2.5 sm:py-2 rounded-sm bg-[#D4A843] text-[#121214] cursor-pointer hover:bg-[#e5b84a] transition-all min-h-[36px]">
                      &#9654; Play
                    </button>
                    <button
                      onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                      disabled={currentStep === steps.length - 1}
                      className={`font-label text-[10px] px-3 sm:px-4 py-2.5 sm:py-2 rounded-sm border transition-all min-h-[36px] ${currentStep === steps.length - 1 ? "border-[#1a1a1a] text-[#333] cursor-not-allowed" : "border-[#333] text-[#aaa] cursor-pointer hover:border-[#D4A843] hover:text-[#D4A843]"}`}>
                      Next
                    </button>
                    <div className="flex-1" />
                    <div className="font-readout text-[9px] text-[#444]">{currentStep + 1}/{steps.length}</div>
                  </div>

                  {/* Step list */}
                  <div className="border-t border-[#1a1a1a] pt-3">
                    <div className="font-label text-[9px] text-[#555] mb-2">All steps</div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {steps.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => setCurrentStep(i)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer transition-all ${i === currentStep ? "bg-[#D4A843]/10 border border-[#D4A843]/30" : "hover:bg-[#141414] border border-transparent"}`}>
                          <div className={`font-readout text-[9px] w-5 text-center flex-shrink-0 ${i === currentStep ? "text-[#D4A843]" : i < currentStep ? "text-[#22c55e]" : "text-[#444]"}`}>
                            {i < currentStep ? "✓" : i + 1}
                          </div>
                          <div className={`text-[10px] leading-tight ${i === currentStep ? "text-[#ccc]" : "text-[#666]"}`}>
                            {s.label || s.text.substring(0, 50) + (s.text.length > 50 ? "..." : "")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Quiz */}
            {activeLessonObj.quiz && (
              <div className="panel p-3 sm:p-5 mb-3">
                <div className="font-label text-[10px] text-[#D4A843] mb-3">Test yourself</div>
                <div className="text-[12px] text-[#ccc] mb-3">{activeLessonObj.quiz.q}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeLessonObj.quiz.opts.map((opt, i) => {
                    const isCorrect = i === activeLessonObj.quiz!.ans;
                    const isPicked = quizPicked === i;
                    return (
                      <button key={i} onClick={() => setQuizPicked(i)}
                        className="py-3 sm:py-2.5 px-3 rounded-sm text-[11px] border cursor-pointer transition-all min-h-[40px]"
                        style={quizPicked !== null
                          ? (isCorrect ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                            : isPicked ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                            : { background: "#141414", borderColor: "#222", color: "#666" })
                          : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizPicked !== null && quizPicked === activeLessonObj.quiz.ans && (
                  <div className="text-[11px] text-[#22c55e] mt-2 text-center">Correct!</div>
                )}
                {quizPicked !== null && quizPicked !== activeLessonObj.quiz.ans && (
                  <div className="text-[11px] text-[#C41E3A] mt-2 text-center">Incorrect — try again</div>
                )}
              </div>
            )}

            {/* Complete button */}
            {!ls.lessonsCompleted.includes(activeLessonObj.id) ? (
              <button onClick={() => completeLesson(activeLessonObj.id)} className="btn-gold w-full justify-center !py-3">
                Complete Lesson (+50 XP)
              </button>
            ) : (
              <div className="text-center font-label text-[11px] text-[#D4A843] py-3">Lesson completed ✓</div>
            )}
          </div>
        )}
      </>)}

      {/* ══════════════════════════════════════════════════════
         TAB 2: EXERCISES
         ══════════════════════════════════════════════════════ */}
      {mainTab === "exercises" && (<>
        {/* Exercise mode chips */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {([
            ["intervals","Intervals"],["chords","Chords"],["scales","Scales"],["progressions","Progressions"],
            ["fretboard","Fretboard"],["construction","Construction"],
            ["fb-intervals","FB Intervals"],["fb-scales","FB Scales"],["fb-chords","FB Chords"],
            ["note-ear","Note Ear"],["iv-construction","IV Build"],["chord-construction","Chord Build"],
            ["kb-notes","KB Notes"],["kb-intervals","KB Intervals"],["kb-scales","KB Scales"],["kb-chords","KB Chords"],["kb-ear","KB Ear"],
          ] as [ExMode,string][]).map(([m,lbl]) => (
            <button key={m} onClick={() => { setExMode(m); setRevealed(false); setAnswer(null); setFbTarget(null); setFbExAnswer(null); setFbExRevealed(false); }}
              className={`font-label text-[10px] px-3 py-2 sm:py-1.5 rounded-sm cursor-pointer transition-all min-h-[36px] ${exMode === m ? "bg-[#D4A843] text-[#121214]" : "text-[#555] border border-[#222]"}`}>{lbl}</button>
          ))}
        </div>

        {/* Sub tabs */}
        {hasSubTabs && (
          <div className="flex gap-1 mb-3">
            {([["exercise","Exercise"],["achievements","Achievements"],["reference","Reference"]] as [SubTab,string][]).map(([t,lbl]) => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`font-label text-[10px] px-3 py-2 sm:py-1 rounded-sm cursor-pointer border flex-1 transition-all min-h-[36px] ${subTab === t ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{lbl}</button>
            ))}
          </div>
        )}

        {/* ── Construction Mode (expanded with sub-modes) ── */}
        {isConstructionMode && (
          <div>
            <div className="panel p-3 sm:p-4 mb-3">
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Construction — choose mode</div>
              <div className="flex gap-1 mb-4 flex-wrap">
                {(["scale","interval","chord"] as ConSubMode[]).map(m => (
                  <button key={m} onClick={() => { setConSubMode(m); setConSelected(new Set()); setConRevealed(false); }}
                    className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer border ${conSubMode === m ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#222] text-[#555]"}`}>
                    {m === "scale" ? "Scale" : m === "interval" ? "Interval" : "Chord"}
                  </button>
                ))}
              </div>

              {/* Root selector */}
              <div className="mb-3">
                <div className="font-label text-[9px] text-[#555] mb-1">Root</div>
                <div className="flex gap-1 flex-wrap">
                  {NOTES.map(n => (
                    <button key={n} onClick={() => { setConRoot(n); setConSelected(new Set()); setConRevealed(false); }}
                      className={`font-readout text-[10px] w-8 h-7 rounded-sm cursor-pointer border flex items-center justify-center ${conRoot === n ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Scale sub-mode */}
              {conSubMode === "scale" && (
                <div className="mb-3">
                  <div className="font-label text-[9px] text-[#555] mb-1">Scale</div>
                  <div className="flex gap-1 flex-wrap">
                    {ALL_SCALES.map(s => (
                      <button key={s.name} onClick={() => { setConScale(s.name); setConSelected(new Set()); setConRevealed(false); }}
                        className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${conScale === s.name ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{s.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Interval sub-mode */}
              {conSubMode === "interval" && (
                <div className="mb-3">
                  <div className="font-label text-[9px] text-[#555] mb-1">Interval</div>
                  <div className="flex gap-1 flex-wrap">
                    {ALL_INTERVALS.map(iv => (
                      <button key={iv.name} onClick={() => { setConIvName(iv.name); setConSelected(new Set()); setConRevealed(false); }}
                        className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${conIvName === iv.name ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{iv.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chord sub-mode */}
              {conSubMode === "chord" && (
                <div className="mb-3">
                  <div className="font-label text-[9px] text-[#555] mb-1">Chord Type</div>
                  <div className="flex gap-1 flex-wrap">
                    {ALL_CHORDS.map(c => (
                      <button key={c.name} onClick={() => { setConChordType(c.name); setConSelected(new Set()); setConRevealed(false); }}
                        className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${conChordType === c.name ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{c.name}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="font-label text-[11px] text-[#ccc] mb-2">
                Build: {conRoot} {conSubMode === "scale" ? conScale : conSubMode === "interval" ? conIvName : conChordType}
              </div>
              <div className="text-[10px] text-[#555] mb-3">
                Selected: {conSelected.size > 0 ? [...conSelected].join(", ") : "—"}
              </div>

              {/* Clickable note grid */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                {NOTES.map(n => {
                  const selected = conSelected.has(n);
                  let bg = "#141414"; let col = "#888"; let brd = "#222";
                  if (conRevealed) {
                    let expected = new Set<string>();
                    if (conSubMode === "scale") {
                      const scaleObj = ALL_SCALES.find(s => s.name === conScale);
                      const cri = NOTES.indexOf(conRoot);
                      expected = new Set(scaleObj ? scaleObj.notes.map(s => NOTES[(cri + s) % 12]) : []);
                    } else if (conSubMode === "interval") {
                      const iv = ALL_INTERVALS.find(i => i.name === conIvName);
                      const cri = NOTES.indexOf(conRoot);
                      if (iv) expected = new Set([NOTES[(cri + iv.st) % 12]]);
                    } else {
                      const ch = ALL_CHORDS.find(c => c.name === conChordType);
                      const cri = NOTES.indexOf(conRoot);
                      expected = new Set(ch ? ch.iv.map(s => NOTES[(cri + s) % 12]) : []);
                    }
                    const inScale = expected.has(n);
                    if (selected && inScale) { bg = "#22c55e"; col = "#121214"; brd = "#22c55e"; }
                    else if (selected && !inScale) { bg = "#C41E3A"; col = "#fff"; brd = "#C41E3A"; }
                    else if (!selected && inScale) { bg = "#1a1a1a"; col = "#D4A843"; brd = "#D4A843"; }
                  } else if (selected) { bg = "#D4A843"; col = "#121214"; brd = "#D4A843"; }
                  return (
                    <button key={n} onClick={() => { if (conRevealed) return; const ns = new Set(conSelected); if (ns.has(n)) ns.delete(n); else ns.add(n); setConSelected(ns); }}
                      className="w-10 h-10 rounded-sm flex items-center justify-center font-readout text-sm cursor-pointer transition-all border"
                      style={{ background: bg, color: col, borderColor: brd }}>{n}</button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={checkConstruction} className="btn-gold !text-[10px]" disabled={conRevealed}>Check</button>
                <button onClick={() => { setConSelected(new Set()); setConRevealed(false); }} className="btn-ghost !text-[10px]">Clear</button>
                <button onClick={() => {
                  let expected = new Set<string>();
                  const cri = NOTES.indexOf(conRoot);
                  if (conSubMode === "scale") {
                    const scaleObj = ALL_SCALES.find(s => s.name === conScale);
                    if (scaleObj) expected = new Set(scaleObj.notes.map(s => NOTES[(cri + s) % 12]));
                  } else if (conSubMode === "interval") {
                    const iv = ALL_INTERVALS.find(i => i.name === conIvName);
                    if (iv) expected = new Set([NOTES[(cri + iv.st) % 12]]);
                  } else {
                    const ch = ALL_CHORDS.find(c => c.name === conChordType);
                    if (ch) expected = new Set(ch.iv.map(s => NOTES[(cri + s) % 12]));
                  }
                  setConSelected(expected);
                  setConRevealed(true);
                }} className="btn-ghost !text-[10px]">Show answer</button>
              </div>

              {conRevealed && (() => {
                let expected = new Set<string>();
                const cri = NOTES.indexOf(conRoot);
                if (conSubMode === "scale") {
                  const scaleObj = ALL_SCALES.find(s => s.name === conScale);
                  if (scaleObj) expected = new Set(scaleObj.notes.map(s => NOTES[(cri + s) % 12]));
                } else if (conSubMode === "interval") {
                  const iv = ALL_INTERVALS.find(i => i.name === conIvName);
                  if (iv) expected = new Set([NOTES[(cri + iv.st) % 12]]);
                } else {
                  const ch = ALL_CHORDS.find(c => c.name === conChordType);
                  if (ch) expected = new Set(ch.iv.map(s => NOTES[(cri + s) % 12]));
                }
                const correct = conSelected.size === expected.size && [...conSelected].every(n => expected.has(n));
                return (
                  <div className="mt-3 text-center">
                    {correct
                      ? <div className="font-heading text-lg text-[#22c55e]">Correct! +{conSubMode === "scale" ? 25 : conSubMode === "interval" ? 15 : 20} XP</div>
                      : <div className="font-heading text-lg text-[#C41E3A]">Not quite — the correct notes are highlighted</div>
                    }
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Fretboard Visual Exercise Modes (fb-intervals, fb-scales, fb-chords) ── */}
        {isFbVisualMode && subTab === "exercise" && (
          <div>
            {/* Stats bar */}
            <div className="panel p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                    <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                    {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                  </div>
                  {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
                </div>
                <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setFbExAnswer(null); setFbExRevealed(false); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
              </div>
            </div>

            <div className="panel p-3 sm:p-4 mb-3">
              <div className="flex justify-between items-center mb-4">
                <div className="font-label text-[10px] text-[#555]">
                  {exMode === "fb-intervals" ? "What is the interval between the two points?" :
                   exMode === "fb-scales" ? "What is the highlighted scale?" :
                   "What type of chord is this?"}
                </div>
                <div className="flex gap-2">
                  <button onClick={newQ} className="btn-gold !text-[10px]">New</button>
                  {fbExAnswer && <button onClick={replay} className="btn-ghost !text-[10px]">Replay</button>}
                </div>
              </div>

              {/* Fretboard with highlighted dots */}
              {fbExDots.length > 0 && (
                <LCFretboard
                  highlightNotes={[]}
                  rootNote={NOTES[fbExDots[0] % 12]}
                  highlightMidi={new Set(fbExDots)}
                  maxFret={15}
                />
              )}

              {!fbExAnswer && <div className="text-center font-label text-sm text-[#333] py-4 mt-2">Press New to begin</div>}

              {/* Answer buttons */}
              {fbExAnswer && (
                <div className={`grid gap-1.5 mt-4 ${exMode === "fb-intervals" ? "grid-cols-4 sm:grid-cols-5" : "grid-cols-3"}`}>
                  {(exMode === "fb-intervals" ? FB_IV_BUTTONS.map(b => b.name) :
                    exMode === "fb-scales" ? FB_SCALE_BUTTONS :
                    FB_CHORD_BUTTONS
                  ).map(name => {
                    const ok = fbExRevealed && name === fbExAnswer;
                    const wrong = fbExRevealed && name === fbExPicked && name !== fbExAnswer;
                    return (
                      <button key={name} onClick={() => handleFbExAnswer(name)} disabled={fbExRevealed}
                        className="py-2.5 rounded-sm text-center transition-all cursor-pointer border"
                        style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                          : wrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                          : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                        <div className="font-label text-[11px]">{name}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {fbExRevealed && (
                <div className="mt-4 text-center">
                  {fbExPicked === fbExAnswer
                    ? <><div className="font-heading text-lg text-[#22c55e]">Correct!</div><div className="font-readout text-[11px] text-[#D4A843] mt-1">+{10 + Math.min(score.streak, 20) * 2} XP</div></>
                    : <div className="font-heading text-lg text-[#C41E3A]">Answer: {fbExAnswer}</div>
                  }
                  {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Note Ear Training Mode ── */}
        {isNoteEarMode && subTab === "exercise" && (
          <div>
            <div className="panel p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                    <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                    {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                  </div>
                  {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
                </div>
                <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setAnswer(null); setRevealed(false); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
              </div>
            </div>

            <div className="panel p-6 mb-3">
              <div className="text-center mb-4">
                <div className="font-label text-[10px] text-[#555] mb-2">Identify the note you hear</div>
              </div>
              <div className="flex justify-center gap-3 mb-6">
                <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                  <span className="text-[#121214] text-xl font-bold ml-0.5">&#9654;</span>
                </button>
                {answer && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                  style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
              </div>
              {!answer && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}
              {answer && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {NOTES.map(n => {
                    const ok = revealed && n === answer;
                    const wrong = revealed && n === picked && n !== answer;
                    return (
                      <button key={n} onClick={() => handleAnswer(n)} disabled={revealed}
                        className="py-3 rounded-sm text-center transition-all cursor-pointer border"
                        style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                          : wrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                          : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                        <div className="font-readout text-base font-bold">{n}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              {revealed && (
                <div className="mt-4 text-center">
                  {picked === answer
                    ? <><div className="font-heading text-lg text-[#22c55e]">Correct!</div><div className="font-readout text-[11px] text-[#D4A843] mt-1">+{10 + Math.min(score.streak, 20) * 2} XP</div></>
                    : <div className="font-heading text-lg text-[#C41E3A]">Answer: {answer}</div>
                  }
                  {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Interval Construction Exercise Mode ── */}
        {isIvConMode && subTab === "exercise" && (
          <div>
            <div className="panel p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                    <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                    {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                  </div>
                  {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
                </div>
                <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setIvConRoot(null); setIvConRevealed(false); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
              </div>
            </div>

            <div className="panel p-6 mb-3">
              <div className="flex justify-center gap-3 mb-4">
                <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                  <span className="text-[#121214] text-xl font-bold ml-0.5">&#9654;</span>
                </button>
                {ivConRoot && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                  style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
              </div>

              {!ivConRoot && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}

              {ivConRoot && ivConInterval && (
                <div className="text-center mb-4">
                  <div className="font-heading text-2xl text-[#D4A843]">Build {ivConInterval} from {ivConRoot}</div>
                  <div className="text-[11px] text-[#555] mt-1">Select the note that is {ivConInterval} above {ivConRoot}</div>
                </div>
              )}

              {ivConRoot && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {NOTES.map(n => {
                    const ok = ivConRevealed && n === ivConAnswer;
                    const wrong = ivConRevealed && n === ivConPicked && n !== ivConAnswer;
                    return (
                      <button key={n} onClick={() => {
                        if (ivConRevealed || !ivConAnswer) return;
                        setIvConPicked(n); setIvConRevealed(true);
                        const correct = n === ivConAnswer;
                        handleAnswer(correct ? ivConAnswer : "__wrong_iv");
                        if (correct) { const rootMidi = 60 + NOTES.indexOf(ivConRoot!); const iv = ALL_INTERVALS.find(i => i.name === ivConInterval); if (iv) { tone(rootMidi, 0.5, 0); tone(rootMidi + iv.st, 0.5, 0.5); } }
                      }} disabled={ivConRevealed}
                        className="py-3 rounded-sm text-center transition-all cursor-pointer border"
                        style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                          : wrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                          : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                        <div className="font-readout text-base font-bold">{n}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {ivConRevealed && (
                <div className="mt-4 text-center">
                  {ivConPicked === ivConAnswer
                    ? <div className="font-heading text-lg text-[#22c55e]">Correct! {ivConRoot} + {ivConInterval} = {ivConAnswer}</div>
                    : <div className="font-heading text-lg text-[#C41E3A]">Answer: {ivConRoot} + {ivConInterval} = {ivConAnswer}</div>
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Chord Construction Exercise Mode ── */}
        {isChConMode && (
          <div>
            <div className="panel p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                    <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                    {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                  </div>
                  {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
                </div>
                <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setChConRoot(null); setChConRevealed(false); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
              </div>
            </div>

            <div className="panel p-6 mb-3">
              <div className="flex justify-center gap-3 mb-4">
                <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                  <span className="text-[#121214] text-xl font-bold ml-0.5">&#9654;</span>
                </button>
                {chConRoot && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                  style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
              </div>

              {!chConRoot && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}

              {chConRoot && chConType && (
                <div className="text-center mb-4">
                  <div className="font-heading text-2xl text-[#D4A843]">Build: {chConRoot} {chConType}</div>
                  <div className="text-[11px] text-[#555] mt-1">Select all notes of the chord</div>
                  <div className="text-[10px] text-[#666] mt-1">
                    Selected: {chConSelected.size > 0 ? [...chConSelected].join(", ") : "—"}
                  </div>
                </div>
              )}

              {chConRoot && (
                <>
                  <div className="flex gap-1.5 flex-wrap justify-center mb-4">
                    {NOTES.map(n => {
                      const selected = chConSelected.has(n);
                      let bg = "#141414"; let col = "#888"; let brd = "#222";
                      if (chConRevealed) {
                        const inChord = chConExpected.has(n);
                        if (selected && inChord) { bg = "#22c55e"; col = "#121214"; brd = "#22c55e"; }
                        else if (selected && !inChord) { bg = "#C41E3A"; col = "#fff"; brd = "#C41E3A"; }
                        else if (!selected && inChord) { bg = "#1a1a1a"; col = "#D4A843"; brd = "#D4A843"; }
                      } else if (selected) { bg = "#D4A843"; col = "#121214"; brd = "#D4A843"; }
                      return (
                        <button key={n} onClick={() => { if (chConRevealed) return; const ns = new Set(chConSelected); if (ns.has(n)) ns.delete(n); else ns.add(n); setChConSelected(ns); }}
                          className="w-10 h-10 rounded-sm flex items-center justify-center font-readout text-sm cursor-pointer transition-all border"
                          style={{ background: bg, color: col, borderColor: brd }}>{n}</button>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-2">
                    <button onClick={checkChordConstruction} className="btn-gold !text-[10px]" disabled={chConRevealed || chConSelected.size === 0}>Check</button>
                    <button onClick={() => { setChConSelected(new Set()); setChConRevealed(false); }} className="btn-ghost !text-[10px]">Clear</button>
                  </div>
                </>
              )}

              {chConRevealed && (() => {
                const correct = chConSelected.size === chConExpected.size && [...chConSelected].every(n => chConExpected.has(n));
                return (
                  <div className="mt-4 text-center">
                    {correct
                      ? <div className="font-heading text-lg text-[#22c55e]">Correct! {chConRoot} {chConType} = {[...chConExpected].join(", ")}</div>
                      : <div className="font-heading text-lg text-[#C41E3A]">Answer: {chConRoot} {chConType} = {[...chConExpected].join(", ")}</div>
                    }
                    {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Keyboard Exercises ── */}
        {isKbMode && subTab === "exercise" && (<>
          {/* Stats */}
          <div className="panel p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                  <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                  {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                </div>
                {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
              </div>
              <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setKbAnswer(null); setKbRevealed(false); setKbHighlight([]); setKbEarMidi(null); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
            </div>
          </div>

          <div className="panel p-6 mb-3">
            {/* Play / Replay */}
            <div className="flex justify-center gap-3 mb-4">
              <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                <span className="text-[#121214] text-xl font-bold ml-0.5">&#9654;</span>
              </button>
              {(kbAnswer || kbEarMidi) && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
            </div>

            {!kbAnswer && !kbEarMidi && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}

            {/* Piano visual (shown for all kb modes except kb-ear before answer) */}
            {(kbAnswer || kbEarMidi) && (
              <div className="mb-4 overflow-x-auto">
                <PianoKeyboard
                  highlighted={exMode === "kb-ear" ? (kbRevealed ? kbHighlight : []) : kbHighlight}
                  onClick={exMode === "kb-ear" && !kbRevealed ? handleKbEarClick : undefined}
                  disabled={kbRevealed && exMode === "kb-ear"}
                />
              </div>
            )}

            {/* Answer buttons for kb-notes */}
            {exMode === "kb-notes" && kbAnswer && (
              <div className="flex gap-1.5 flex-wrap justify-center mt-4">
                {NOTES.map(n => {
                  const isCor = kbRevealed && n === kbAnswer;
                  const isWrong = kbRevealed && n === kbPicked && n !== kbAnswer;
                  return (
                    <button key={n} onClick={() => handleKbAnswer(n)}
                      className="w-11 h-11 rounded-sm flex items-center justify-center font-readout text-sm cursor-pointer transition-all border"
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                        : isWrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : kbRevealed ? { background: "#141414", borderColor: "#222", color: "#555" }
                        : { background: "#141414", borderColor: "#222", color: "#888" }}>{n}</button>
                  );
                })}
              </div>
            )}

            {/* Answer buttons for kb-intervals */}
            {exMode === "kb-intervals" && kbAnswer && (
              <div className="flex gap-1.5 flex-wrap justify-center mt-4">
                {ALL_INTERVALS.map(iv => {
                  const isCor = kbRevealed && iv.name === kbAnswer;
                  const isWrong = kbRevealed && iv.name === kbPicked && iv.name !== kbAnswer;
                  return (
                    <button key={iv.name} onClick={() => handleKbAnswer(iv.name)}
                      className="px-3 py-2 rounded-sm font-label text-[10px] cursor-pointer transition-all border"
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                        : isWrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : kbRevealed ? { background: "#141414", borderColor: "#222", color: "#555" }
                        : { background: "#141414", borderColor: "#222", color: "#888" }}>{iv.name}</button>
                  );
                })}
              </div>
            )}

            {/* Answer buttons for kb-scales */}
            {exMode === "kb-scales" && kbAnswer && (
              <div className="flex gap-1.5 flex-wrap justify-center mt-4">
                {ALL_SCALES.map(sc => {
                  const isCor = kbRevealed && sc.name === kbAnswer;
                  const isWrong = kbRevealed && sc.name === kbPicked && sc.name !== kbAnswer;
                  return (
                    <button key={sc.name} onClick={() => handleKbAnswer(sc.name)}
                      className="px-3 py-2 rounded-sm font-label text-[10px] cursor-pointer transition-all border"
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                        : isWrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : kbRevealed ? { background: "#141414", borderColor: "#222", color: "#555" }
                        : { background: "#141414", borderColor: "#222", color: "#888" }}>{sc.name}</button>
                  );
                })}
              </div>
            )}

            {/* Answer buttons for kb-chords */}
            {exMode === "kb-chords" && kbAnswer && (
              <div className="flex gap-1.5 flex-wrap justify-center mt-4">
                {ALL_CHORDS.map(ch => {
                  const isCor = kbRevealed && ch.name === kbAnswer;
                  const isWrong = kbRevealed && ch.name === kbPicked && ch.name !== kbAnswer;
                  return (
                    <button key={ch.name} onClick={() => handleKbAnswer(ch.name)}
                      className="px-3 py-2 rounded-sm font-label text-[10px] cursor-pointer transition-all border"
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                        : isWrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : kbRevealed ? { background: "#141414", borderColor: "#222", color: "#555" }
                        : { background: "#141414", borderColor: "#222", color: "#888" }}>{ch.name}</button>
                  );
                })}
              </div>
            )}

            {/* kb-ear: feedback after clicking */}
            {exMode === "kb-ear" && kbRevealed && kbEarMidi && (
              <div className="mt-4 text-center">
                {kbPicked === String(kbEarMidi)
                  ? <div className="font-heading text-lg text-[#22c55e]">Correct! {NOTES[kbEarMidi % 12]}{kbEarMidi < 60 ? "3" : "4"}</div>
                  : <div className="font-heading text-lg text-[#C41E3A]">Answer: {NOTES[kbEarMidi % 12]}{kbEarMidi < 60 ? "3" : "4"}</div>
                }
                {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
              </div>
            )}

            {/* Generic revealed feedback for non-ear kb modes */}
            {kbRevealed && exMode !== "kb-ear" && (
              <div className="mt-4 text-center">
                {kbPicked === kbAnswer
                  ? <div className="font-heading text-lg text-[#22c55e]">Correct!</div>
                  : <div className="font-heading text-lg text-[#C41E3A]">Answer: {kbAnswer}</div>
                }
                {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
              </div>
            )}
          </div>
        </>)}

        {/* ── Standard Ear Training Exercise ── */}
        {isStandardEarMode && subTab === "exercise" && (<>
          {/* Stats */}
          <div className="panel p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                  <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                  {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                </div>
                {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShowSettings(!showSettings)} className={`btn-ghost !text-[10px] !px-2 ${showSettings ? "active" : ""}`}>Settings</button>
                <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setRevealed(false); setAnswer(null); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
              </div>
            </div>
          </div>

          {/* Settings */}
          {showSettings && (
            <div className="panel p-3 sm:p-4 mb-3">
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Exercise Settings</div>
              {exMode === "intervals" && (<>
                <div className="mb-3"><div className="font-label text-[9px] text-[#555] mb-1">Direction</div>
                  <div className="flex gap-1">{(["ascending","descending","harmonic"] as const).map(d => (
                    <button key={d} onClick={() => setDirection(d)} className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${direction === d ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{d}</button>
                  ))}</div></div>
                <div className="font-label text-[9px] text-[#555] mb-1">Active Intervals</div>
                <div className="flex flex-wrap gap-1">{ALL_INTERVALS.map(i => (
                  <button key={i.name} onClick={() => setEnabledIntervals(toggleSet(enabledIntervals, i.st))}
                    className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                    style={enabledIntervals.has(i.st) ? { borderColor: i.color, color: i.color, background: i.color + "12" } : { borderColor: "#222", color: "#444" }}>{i.name}</button>
                ))}</div>
              </>)}
              {exMode === "chords" && (<><div className="font-label text-[9px] text-[#555] mb-1">Active Chords</div>
                <div className="flex flex-wrap gap-1">{ALL_CHORDS.map(c => (
                  <button key={c.name} onClick={() => setEnabledChords(toggleSet(enabledChords, c.name))}
                    className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                    style={enabledChords.has(c.name) ? { borderColor: c.color, color: c.color, background: c.color + "12" } : { borderColor: "#222", color: "#444" }}>{c.name}</button>
                ))}</div></>)}
              {exMode === "scales" && (<><div className="font-label text-[9px] text-[#555] mb-1">Active Scales</div>
                <div className="flex flex-wrap gap-1">{ALL_SCALES.map(s => (
                  <button key={s.name} onClick={() => setEnabledScales(toggleSet(enabledScales, s.name))}
                    className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                    style={enabledScales.has(s.name) ? { borderColor: s.color, color: s.color, background: s.color + "12" } : { borderColor: "#222", color: "#444" }}>{s.name}</button>
                ))}</div></>)}
              <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAutoAdvance(!autoAdvance)}>
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${autoAdvance ? "border-[#D4A843] bg-[#D4A843] text-[#121214]" : "border-[#444]"}`}>{autoAdvance ? "✓" : ""}</div>
                  <span className="font-label text-[10px] text-[#666]">Auto-advance on correct</span>
                </label>
              </div>
            </div>
          )}

          {/* Play area */}
          <div className="panel p-6 mb-3">
            <div className="flex justify-center gap-3 mb-6">
              <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                <span className="text-[#121214] text-xl font-bold ml-0.5">&#9654;</span>
              </button>
              {answer && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
            </div>
            {!answer && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}
            {answer && (
              <div className={`grid gap-1.5 ${pool.length <= 6 ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
                {pool.map(item => {
                  const n = item.name, ok = revealed && n === answer, wrong = revealed && n === picked && n !== answer;
                  const hk = exMode + "-" + n, hist = ls.history[hk];
                  const weak = hist && hist.t >= 3 && (hist.c / hist.t) < 0.6;
                  return (
                    <button key={n} onClick={() => handleAnswer(n)} disabled={revealed}
                      className="py-3 rounded-sm text-center transition-all cursor-pointer border relative overflow-hidden"
                      style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#121214" }
                        : wrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                      {!revealed && "color" in item && <div className="absolute bottom-0 left-0 h-[2px] w-full" style={{ background: (item as { color: string }).color }} />}
                      {weak && !revealed && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#C41E3A]" />}
                      <div className="font-label text-sm">{n}</div>
                      {"label" in item && <div className="text-[8px] opacity-50 mt-0.5">{(item as typeof ALL_INTERVALS[0]).label}</div>}
                    </button>
                  );
                })}
              </div>
            )}
            {revealed && (
              <div className="mt-4 text-center">
                {picked === answer
                  ? <><div className="font-heading text-lg text-[#22c55e]">Correct!</div><div className="font-readout text-[11px] text-[#D4A843] mt-1">+{10 + Math.min(score.streak, 20) * 2} XP</div></>
                  : <div className="font-heading text-lg text-[#C41E3A]">Answer: {answer}</div>
                }
                {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
              </div>
            )}
          </div>
        </>)}

        {/* ── Fretboard exercise mode ── */}
        {isFretboardMode && subTab === "exercise" && (<>
          <div className="panel p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className={`led ${scorePct >= 80 ? "led-on" : scorePct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                  <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                  {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({scorePct}%)</span>}
                </div>
                {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
              </div>
              <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: ls.bestStreak }); setRevealed(false); setAnswer(null); setFbTarget(null); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
            </div>
          </div>

          <div className="panel p-3 sm:p-4 mb-3">
            <div className="flex justify-between items-center mb-4">
              <div>
                {fbTarget
                  ? <><span className="font-label text-[10px] text-[#555]">Find:</span><span className="font-heading text-3xl text-[#D4A843] mr-3">{fbTarget}</span></>
                  : <span className="font-label text-sm text-[#333]">Press New Note</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={newQ} className="btn-gold !text-[10px]">New Note</button>
                {fbTarget && <button onClick={replay} className="btn-ghost !text-[10px]">Replay</button>}
              </div>
            </div>
            <div className="overflow-x-auto" dir="ltr">
              <div className="min-w-[550px]">
                <div className="flex mb-1"><div className="w-6" />{Array.from({length: 13}, (_,f) => <div key={f} className="flex-1 text-center font-readout text-[8px] text-[#333]">{f}</div>)}</div>
                {[...Array(6)].map((_, si) => {
                  const s = 5 - si;
                  return (
                    <div key={s} className="flex items-center h-7">
                      <div className="w-6 font-readout text-[9px] text-[#444] text-center">{STR[s]}</div>
                      {Array.from({length: 13}, (_,f) => {
                        const hit = fbFeedback && fbFeedback.str === s && fbFeedback.fret === f;
                        return (
                          <div key={f} onClick={() => handleFbClick(s, f)}
                            className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-all h-full"
                            style={{ borderRight: "1px solid #1a1a1a", borderBottom: si < 5 ? "1px solid #2a2a2a" : "1px solid #333" }}>
                            {hit && <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                              style={{ background: fbFeedback.ok ? "#22c55e" : "#C41E3A", color: "#fff" }}>{NOTES[(TUNING[s] + f) % 12]}</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            {revealed && <div className="mt-3 text-center">{fbFeedback?.ok ? <div className="font-heading text-lg text-[#22c55e]">Correct!</div> : <div className="font-heading text-lg text-[#C41E3A]">The note was {fbTarget}</div>}</div>}
          </div>

          {/* Timed Fretboard Challenge */}
          <div className="mt-3"><div className="divider-gold mb-3" /><div className="font-label text-[10px] text-[#D4A843] mb-2">Timed Challenge</div><FretboardChallenge /></div>
        </>)}

        {/* Achievements */}
        {hasSubTabs && subTab === "achievements" && (
          <div className="panel p-3 sm:p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-4">Achievements ({ls.unlocked.length}/{ACHIEVEMENTS.length})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACHIEVEMENTS.map(a => {
                const done = ls.unlocked.includes(a.id);
                return (
                  <div key={a.id} className={`p-3 rounded-sm border ${done ? "border-[#D4A843]/40 bg-[#D4A843]/5" : "border-[#1a1a1a]"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`led ${done ? "led-gold" : "led-off"}`} />
                      <div><div className={`font-label text-[11px] ${done ? "text-[#D4A843]" : "text-[#555]"}`}>{a.name}</div><div className="text-[10px] text-[#444]">{a.desc}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reference */}
        {hasSubTabs && subTab === "reference" && (
          <div className="panel p-3 sm:p-4">
            {exMode === "intervals" && (
              <div>
                <div className="font-label text-[10px] text-[#D4A843] mb-3">Interval Reference — Click to hear</div>
                {ALL_INTERVALS.map(i => (
                  <div key={i.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] transition-all px-1 -mx-1 rounded-sm"
                    onClick={() => { tone(60, 0.5, 0); tone(60 + i.st, 0.5, 0.6); }}>
                    <div className="w-2 h-5 rounded-sm" style={{ background: i.color }} />
                    <div className="w-8 font-readout text-sm" style={{ color: i.color }}>{i.name}</div>
                    <div className="flex-1"><div className="text-[11px] text-[#aaa]">{i.label}</div><div className="text-[9px] text-[#555] italic">{i.ref}</div></div>
                    <div className="font-readout text-[10px] text-[#444]">{i.st}st</div>
                    {ls.history["intervals-" + i.name] && (() => {
                      const h = ls.history["intervals-" + i.name]; const p = Math.round((h.c / h.t) * 100);
                      return <span className="font-readout text-[9px]" style={{ color: p >= 80 ? "#33CC33" : p >= 50 ? "#D4A843" : "#C41E3A" }}>{p}%</span>;
                    })()}
                  </div>
                ))}
              </div>
            )}
            {exMode === "chords" && (
              <div>
                <div className="font-label text-[10px] text-[#D4A843] mb-3">Chord Reference — Click to hear</div>
                {ALL_CHORDS.map(c => (
                  <div key={c.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] px-1 -mx-1 rounded-sm"
                    onClick={() => playChordAudio(c.iv)}>
                    <div className="w-2 h-5 rounded-sm" style={{ background: c.color }} />
                    <span className="font-label text-sm flex-1" style={{ color: c.color }}>{c.name}</span>
                    <span className="font-readout text-[10px] text-[#444]">{c.iv.join("-")}</span>
                  </div>
                ))}
              </div>
            )}
            {exMode === "scales" && (
              <div>
                <div className="font-label text-[10px] text-[#D4A843] mb-3">Scale Reference — Click to hear</div>
                {ALL_SCALES.map(s => (
                  <div key={s.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] px-1 -mx-1 rounded-sm"
                    onClick={() => playScaleNotes(s.notes)}>
                    <div className="w-2 h-5 rounded-sm" style={{ background: s.color }} />
                    <span className="font-label text-sm flex-1" style={{ color: s.color }}>{s.name}</span>
                    <span className="font-readout text-[10px] text-[#444]">{s.notes.join("-")}</span>
                  </div>
                ))}
              </div>
            )}
            {(exMode === "fretboard" || exMode === "progressions" || isFbVisualMode || isNoteEarMode || isIvConMode) && (
              <div className="py-4 text-center font-label text-sm text-[#444]">
                {exMode === "fretboard" ? "Use the fretboard exercise and timed challenge above" :
                 exMode === "progressions" ? "Listen for root movement and chord qualities in progressions" :
                 isNoteEarMode ? "Train your ear to identify individual notes by their pitch" :
                 isIvConMode ? "Given a root and interval name, find the target note" :
                 "Identify intervals, scales, and chords visually on the fretboard"}
              </div>
            )}
          </div>
        )}
      </>)}

      {/* ══════════════════════════════════════════════════════
         TAB 3: TOOLS
         ══════════════════════════════════════════════════════ */}
      {mainTab === "tools" && (<>
        {/* Tool selector */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {([["scales","Scales"],["chords","Chords"],["fretboard","Fretboard"],["progressions","Progressions"],["circle","Circle of 5ths"],["intervals","Intervals"],["tempo","Tempo Tap"],["iv-calc","IV Calc"],["piano","Piano"],["tuner","Tuner"]] as [ToolTab,string][]).map(([t,lbl]) => (
            <button key={t} onClick={() => setToolTab(t)}
              className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${toolTab === t ? "bg-[#D4A843] text-[#121214]" : "text-[#555] border border-[#222]"}`}>{lbl}</button>
          ))}
        </div>

        {/* Root selector (not for tempo tapper) */}
        {toolTab !== "tempo" && toolTab !== "piano" && toolTab !== "tuner" && (
          <div className="panel p-3 mb-3">
            <div className="font-label text-[9px] text-[#555] mb-1.5">Root Note</div>
            <div className="flex gap-1 flex-wrap">
              {NOTES.map(n => (
                <button key={n} onClick={() => setRoot(n)}
                  className={`font-readout text-[11px] w-9 h-8 rounded-sm cursor-pointer border flex items-center justify-center transition-all ${root === n ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Scales Tool ── */}
        {toolTab === "scales" && (<div>
          <div className="panel p-3 mb-3">
            <div className="flex gap-1 flex-wrap">
              {Object.keys(SCALE_F).map(s => (
                <button key={s} onClick={() => setSelScale(s)}
                  className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${selScale === s ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#1a1a1a] text-[#555]"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="panel p-3 sm:p-5 mb-3">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-heading text-lg font-bold text-[#D4A843]">{root} {selScale}</div>
                <div className="text-[11px] text-[#666] italic">{scInfo.desc}</div>
                <div className="font-readout text-sm text-[#aaa] mt-1">{scNotes.join(" — ")}</div>
              </div>
              <button onClick={() => scInfo.formula.forEach((s, i) => playNote(57 + ri + s, i * 0.18))} className="btn-gold">Play</button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3" onClick={() => setShowIv(!showIv)}>
              <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${showIv ? "border-[#D4A843] bg-[#D4A843] text-[#121214]" : "border-[#444]"}`}>{showIv ? "✓" : ""}</div>
              <span className="font-label text-[10px] text-[#666]">Show intervals</span>
            </label>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {scInfo.formula.map((s, i) => (
                <div key={i} className="text-center cursor-pointer hover:scale-105 transition-all" onClick={() => playNote(57 + ri + s)}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: s === 0 ? "#D4A843" : "#1a1a1a", color: s === 0 ? "#121214" : "#ccc", border: `1px solid ${s === 0 ? "#D4A843" : "#333"}` }}>
                    {scNotes[i]}
                  </div>
                  <div className="font-readout text-[8px] text-[#555] mt-0.5">{IV_NAMES[s]}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-3 sm:p-4">
            <LCFretboard highlightNotes={scNotes} rootNote={root} showIntervals={showIv} />
          </div>
        </div>)}

        {/* ── Chords Tool ── */}
        {toolTab === "chords" && (<div>
          <div className="panel p-3 mb-3">
            <div className="flex gap-1 flex-wrap">
              {CHORD_SUFFIXES.map(({ name, label }) => (
                <button key={name} onClick={() => setSelChord(name)}
                  className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${selChord === name ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#1a1a1a] text-[#555]"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="panel p-3 sm:p-5">
            <div className="font-heading text-lg font-bold text-[#D4A843] mb-1">{root}{selChord === "major" ? "" : " " + selChord}</div>
            {chordLoading && <div className="font-label text-[10px] text-[#444] py-4">Loading...</div>}
            {chordData?.positions && (
              <div>
                <div className="font-label text-[9px] text-[#555] mb-2 mt-2">{chordData.positions.length} voicings — click to hear</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {chordData.positions.map((pos, i) => (
                    <ChordDiagram key={i} pos={pos} onPlay={() => {
                      const fr = pos.frets.split("").map(f => f === "x" ? -1 : parseInt(f, 16));
                      fr.forEach((f, s) => { if (f >= 0) playNote(TUNING[s] + f); });
                    }} />
                  ))}
                </div>
              </div>
            )}
            {!chordLoading && !chordData && <div className="text-[11px] text-[#444] py-4">No data for this chord</div>}
          </div>
        </div>)}

        {/* ── Fretboard Tool ── */}
        {toolTab === "fretboard" && (<div>
          <div className="panel p-3 mb-3">
            <div className="font-label text-[9px] text-[#555] mb-1.5">Display Mode</div>
            <div className="flex gap-1 mb-2">
              {(["notes","scale","chord"] as const).map(m => (
                <button key={m} onClick={() => setFbMode(m)}
                  className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${fbMode === m ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{m}</button>
              ))}
            </div>
            {fbMode === "scale" && (
              <div className="flex gap-1 flex-wrap">
                {Object.keys(SCALE_F).map(s => (
                  <button key={s} onClick={() => setFbScale(s)}
                    className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${fbScale === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#1a1a1a] text-[#444]"}`}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="panel p-3 sm:p-4">
            <div className="font-label text-[9px] text-[#555] mb-2">
              {fbMode === "notes" ? `All notes — ${root} highlighted — click to hear` :
               fbMode === "scale" ? `${root} ${fbScale} — click to hear` :
               `${root} chord tones`}
            </div>
            <LCFretboard
              highlightNotes={fbMode === "notes" ? NOTES : fbMode === "scale" ? fbScNotes : [root, NOTES[(ri + 4) % 12], NOTES[(ri + 7) % 12]]}
              rootNote={root}
              showIntervals={fbMode !== "notes"}
            />
          </div>
        </div>)}

        {/* ── Progressions Tool ── */}
        {toolTab === "progressions" && (<div>
          <div className="panel p-3 sm:p-5 mb-3">
            <div className="font-label text-[11px] text-[#D4A843] mb-3">Chord Progression Builder</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {progChords.map((ch, i) => (
                <div key={i} className="bg-[#121214] border border-[#222] rounded-sm px-3 py-2 cursor-pointer hover:border-[#444] transition-all"
                  onClick={() => playChordByName(ch)}>
                  <span className="font-heading text-base text-[#D4A843]">{ch}</span>
                  <button onClick={(e) => { e.stopPropagation(); setProgChords(p => p.filter((_, j) => j !== i)); }}
                    className="text-[#C41E3A] text-[10px] mr-2 cursor-pointer">x</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input value={newChord} onChange={e => setNewChord(e.target.value)} placeholder="e.g. Am, F, G7"
                onKeyDown={e => { if (e.key === "Enter" && newChord.trim()) { setProgChords(p => [...p, newChord.trim()]); setNewChord(""); } }}
                className="input !w-40 !text-xs" dir="ltr" />
              <button onClick={() => { if (newChord.trim()) { setProgChords(p => [...p, newChord.trim()]); setNewChord(""); } }} className="btn-gold !text-[10px]">Add</button>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={playProgression} className={progPlaying ? "btn-danger" : "btn-gold"}>
                {progPlaying ? "Stop" : "Play Progression"}
              </button>
              <label className="flex items-center gap-2 cursor-pointer" onClick={() => setProgLoop(!progLoop)}>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${progLoop ? "border-[#D4A843] bg-[#D4A843] text-[#121214]" : "border-[#444]"}`}>{progLoop ? "✓" : ""}</div>
                <span className="font-label text-[10px] text-[#666]">Loop</span>
              </label>
            </div>
          </div>
          <div className="panel p-3 sm:p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-3">Presets — click to load</div>
            {PROG_PRESETS.map(p => (
              <div key={p.g} className="flex items-center gap-3 py-2.5 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] rounded-sm px-2 -mx-2 transition-all"
                onClick={() => setProgChords(p.ch)}>
                <span className="font-label text-[11px] text-[#D4A843] w-24">{p.g}</span>
                <span className="font-readout text-xs text-[#aaa] flex-1" dir="ltr">{p.n}</span>
                <div className="flex gap-1">{p.ch.map((c, i) => <span key={i} className="font-readout text-[10px] text-[#888] px-1.5 py-0.5 border border-[#222] rounded-sm">{c}</span>)}</div>
              </div>
            ))}
          </div>
        </div>)}

        {/* ── Circle of Fifths ── */}
        {toolTab === "circle" && (<div>
          <div className="panel p-3 sm:p-5 mb-3">
            <div className="font-label text-[11px] text-[#D4A843] mb-4">Circle of Fifths</div>
            <div className="flex justify-center">
              <svg viewBox="0 0 340 340" className="w-72 h-72">
                {MAJOR_KEYS.map((k, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180);
                  const x = 170 + 130 * Math.cos(angle), y = 170 + 130 * Math.sin(angle);
                  const noteClean = k.split("/")[0];
                  const sel = noteClean === root || k.includes(root);
                  return (
                    <g key={i} onClick={() => setRoot(NOTES[FIFTH_ORDER[i]])} className="cursor-pointer">
                      <circle cx={x} cy={y} r={sel ? 22 : 18} fill={sel ? "#D4A843" : "#1a1a1a"} stroke={sel ? "#DFBD69" : "#333"} strokeWidth="1.5" />
                      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={sel ? "#121214" : "#ccc"} fontSize={sel ? "11" : "10"} fontWeight="bold" fontFamily="monospace">{k}</text>
                    </g>
                  );
                })}
                {MINOR_KEYS.map((k, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180);
                  const x = 170 + 82 * Math.cos(angle), y = 170 + 82 * Math.sin(angle);
                  const noteClean = k.replace("m", "");
                  const sel = noteClean === root;
                  return (
                    <g key={i} onClick={() => setRoot(NOTES[FIFTH_ORDER[i]])} className="cursor-pointer">
                      <circle cx={x} cy={y} r={sel ? 18 : 14} fill={sel ? "#6366f1" : "#111"} stroke={sel ? "#818cf8" : "#222"} strokeWidth="1" />
                      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={sel ? "#fff" : "#888"} fontSize={sel ? "9" : "8"} fontWeight="bold" fontFamily="monospace">{k}</text>
                    </g>
                  );
                })}
                <text x="170" y="168" textAnchor="middle" fill="#333" fontSize="8" fontFamily="monospace">Major</text>
                <text x="170" y="180" textAnchor="middle" fill="#333" fontSize="8" fontFamily="monospace">Minor</text>
              </svg>
            </div>
          </div>
        </div>)}

        {/* ── Intervals Tool ── */}
        {toolTab === "intervals" && (<div>
          <div className="panel p-3 sm:p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-3">Intervals from {root} — click to hear</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { n: "m2", st: 1, f: "Tense" },{ n: "M2", st: 2, f: "Whole step" },
                { n: "m3", st: 3, f: "Minor" },{ n: "M3", st: 4, f: "Major" },
                { n: "P4", st: 5, f: "Open" },{ n: "TT", st: 6, f: "Devil's interval" },
                { n: "P5", st: 7, f: "Power chord" },{ n: "m6", st: 8, f: "Bittersweet" },
                { n: "M6", st: 9, f: "Sweet" },{ n: "m7", st: 10, f: "Bluesy" },
                { n: "M7", st: 11, f: "Dreamy" },{ n: "P8", st: 12, f: "Octave" },
              ].map(i => (
                <div key={i.n} className="bg-[#121214] border border-[#1a1a1a] rounded-sm p-2.5 cursor-pointer hover:border-[#333] transition-all"
                  onClick={() => { playNote(57 + ri); playNote(57 + ri + i.st, 0.5); }}>
                  <div className="flex justify-between items-center">
                    <span className="font-readout font-bold text-[#D4A843]">{i.n}</span>
                    <span className="font-readout text-[10px] text-[#888]">{root} → {NOTES[(ri + i.st) % 12]}</span>
                  </div>
                  <div className="text-[9px] text-[#444] italic">{i.f}</div>
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ── Tempo Tapper Tool ── */}
        {toolTab === "tempo" && (<div>
          <div className="panel p-3 sm:p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-4">Tempo Tapper</div>
            <div className="text-center mb-4">
              <div className="text-[11px] text-[#666] mb-3">Tap the button at the tempo you want to measure</div>
              <button onClick={handleTap}
                className="w-32 h-32 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center mx-auto"
                style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "3px solid #DFBD69", boxShadow: "0 6px 24px rgba(212,168,67,0.3)" }}>
                <span className="text-[#121214] text-2xl font-bold">TAP</span>
              </button>
            </div>
            <div className="text-center">
              {tapBpm ? (
                <div>
                  <div className="font-readout text-5xl font-bold text-[#D4A843]">{tapBpm}</div>
                  <div className="font-label text-[11px] text-[#555] mt-1">BPM</div>
                </div>
              ) : (
                <div className="font-label text-sm text-[#333]">Tap at least twice</div>
              )}
            </div>
            <div className="flex justify-center mt-4">
              <button onClick={() => { setTapTimes([]); setTapBpm(null); }} className="btn-ghost !text-[10px]">Reset</button>
            </div>
          </div>
        </div>)}

        {/* ── Interval Calculator Tool ── */}
        {toolTab === "iv-calc" && (<div>
          <div className="panel p-3 sm:p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-4">Interval Calculator</div>
            <div className="text-[11px] text-[#666] mb-3">Choose a starting note and interval — see and hear the result</div>

            <div className="mb-3">
              <div className="font-label text-[9px] text-[#555] mb-1">Starting Note</div>
              <div className="flex gap-1 flex-wrap">
                {NOTES.map(n => (
                  <button key={n} onClick={() => setCalcNote(n)}
                    className={`font-readout text-[11px] w-9 h-8 rounded-sm cursor-pointer border flex items-center justify-center ${calcNote === n ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="font-label text-[9px] text-[#555] mb-1">Interval</div>
              <div className="flex gap-1 flex-wrap">
                {ALL_INTERVALS.map(iv => (
                  <button key={iv.name} onClick={() => setCalcIv(iv.st)}
                    className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${calcIv === iv.st ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#222] text-[#555]"}`}>{iv.name}</button>
                ))}
              </div>
            </div>

            {(() => {
              const startIdx = NOTES.indexOf(calcNote);
              const resultNote = NOTES[(startIdx + calcIv) % 12];
              const ivObj = ALL_INTERVALS.find(i => i.st === calcIv);
              return (
                <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-sm p-4 text-center">
                  <div className="font-heading text-2xl text-[#D4A843] mb-1">{calcNote} + {ivObj?.name || calcIv + "st"} = {resultNote}</div>
                  <div className="text-[11px] text-[#555]">{ivObj?.label} — {calcIv} semitones</div>
                  <button onClick={() => { const m = 60 + startIdx; playNote(m); playNote(m + calcIv, 0.5); }} className="btn-gold !text-[10px] mt-3">
                    Play Both Notes
                  </button>
                </div>
              );
            })()}
          </div>
        </div>)}

        {/* ── Piano Tool ── */}
        {toolTab === "tuner" && (<div>
          <ChromaticTuner />
        </div>)}

        {toolTab === "piano" && (<div>
          <div className="panel p-3 sm:p-5 mb-3">
            <div className="font-heading text-lg font-bold text-[#D4A843] mb-3">Piano</div>
            <div className="text-[11px] text-[#555] mb-4">Click keys to play. Choose a root + scale to highlight.</div>

            {/* Root + Scale selectors */}
            <div className="mb-3">
              <div className="font-label text-[9px] text-[#555] mb-1">Root</div>
              <div className="flex gap-1 flex-wrap">
                {NOTES.map(n => (
                  <button key={n} onClick={() => { setPianoRoot(n); }}
                    className={`font-readout text-[10px] w-8 h-7 rounded-sm cursor-pointer border flex items-center justify-center ${pianoRoot === n ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="font-label text-[9px] text-[#555] mb-1">Scale (highlight)</div>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setPianoScale(null)}
                  className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${pianoScale === null ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#222] text-[#555]"}`}>None</button>
                {ALL_SCALES.map(s => (
                  <button key={s.name} onClick={() => setPianoScale(s.name)}
                    className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${pianoScale === s.name ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#222] text-[#555]"}`}>{s.name}</button>
                ))}
              </div>
            </div>

            {/* Piano keyboard */}
            <div className="overflow-x-auto py-4">
              <PianoKeyboard
                highlighted={pianoScale ? (() => {
                  const sc = ALL_SCALES.find(s => s.name === pianoScale);
                  if (!sc) return [];
                  const rIdx = NOTES.indexOf(pianoRoot);
                  const midis: number[] = [];
                  for (let oct = 0; oct < 2; oct++) {
                    sc.notes.forEach(n => {
                      const m = PIANO_C3 + oct * 12 + ((rIdx + n) % 12);
                      if (m >= PIANO_C3 && m <= PIANO_C3 + 23) midis.push(m);
                    });
                  }
                  return midis;
                })() : []}
                onClick={(midi) => tone(midi, 0.6)}
              />
            </div>

            {pianoScale && (() => {
              const sc = ALL_SCALES.find(s => s.name === pianoScale);
              if (!sc) return null;
              const rIdx = NOTES.indexOf(pianoRoot);
              const scaleNotes = sc.notes.map(n => NOTES[(rIdx + n) % 12]);
              return <div className="font-readout text-sm text-[#aaa] text-center mt-2">{pianoRoot} {pianoScale}: {scaleNotes.join(" — ")}</div>;
            })()}
          </div>
        </div>)}
      </>)}
    </div>
  );
}
