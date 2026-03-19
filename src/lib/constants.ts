/* ── GuitarForge Constants ── */

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const CATS = [
  "Warm-Up", "Shred", "Legato", "Bends", "Tapping", "Sweep",
  "Rhythm", "Fretboard", "Ear Training", "Improv", "Riffs", "Phrasing",
  "Modes", "Composition", "Songs", "Dynamics",
  "Chords", "Harmonics", "Picking", "Arpeggios", "Slide", "Tunings",
  "Keys"
];

export const COL: Record<string, string> = {
  "Warm-Up": "#f59e0b",
  "Shred": "#ef4444",
  "Legato": "#a78bfa",
  "Bends": "#ec4899",
  "Tapping": "#2dd4bf",
  "Sweep": "#34d399",
  "Rhythm": "#f97316",
  "Fretboard": "#a3e635",
  "Ear Training": "#818cf8",
  "Improv": "#5eead4",
  "Riffs": "#e11d48",
  "Phrasing": "#c084fc",
  "Modes": "#7c9aff",
  "Composition": "#facc15",
  "Songs": "#34d399",
  "Dynamics": "#a78bfa",
  "Chords": "#f9a8d4",
  "Harmonics": "#93c5fd",
  "Picking": "#fb923c",
  "Arpeggios": "#6ee7b7",
  "Slide": "#c4b5fd",
  "Tunings": "#fbbf24",
  "Keys": "#a5b4fc",
};

export const MODES = [
  "Aeolian", "Dorian", "Phrygian", "Lydian", "Mixolydian",
  "Ionian", "Locrian", "Harmonic Minor", "Phrygian Dominant",
  "Minor Pentatonic", "Minor Blues", "Whole Tone",
  "Melodic Minor", "Major Pentatonic", "Lydian Dominant", "Hungarian Minor"
];

export const SCALES = [
  "C", "Cm", "C#/Db", "C#/Dbm", "D", "Dm", "D#/Eb", "D#/Ebm",
  "E", "Em", "F", "Fm", "F#/Gb", "F#/Gbm", "G", "Gm",
  "G#/Ab", "G#/Abm", "A", "Am", "A#/Bb", "A#/Bbm", "B", "Bm"
];

export const STYLES = [
  "Metal", "Hard Rock", "Classic Rock", "Blues", "Jazz",
  "Grunge", "Stoner Rock", "Punk Rock", "Neo-Classical",
  "Funk", "Country", "Flamenco", "Acoustic",
  "Progressive Metal", "Djent", "Death Metal", "Fusion"
];

export const CAT_GROUPS: Record<string, string[]> = {
  "Technique": ["Warm-Up", "Shred", "Legato", "Tapping", "Sweep", "Picking", "Arpeggios", "Slide", "Harmonics"],
  "Rhythm & Dynamics": ["Rhythm", "Dynamics", "Chords", "Tunings"],
  "Theory": ["Fretboard", "Modes", "Keys"],
  "Musicality": ["Ear Training", "Improv", "Phrasing", "Bends"],
  "Creation": ["Riffs", "Composition", "Songs"],
};

export const STAGES = [
  { name: "Stage 1 – Decode", m: 10, d: "Listen, analyze 8-16 bars." },
  { name: "Stage 2 – Text", m: 20, d: "Text-only reading. 60%." },
  { name: "Stage 3 – Half notes", m: 20, d: "Half notes. All articulations." },
  { name: "Stage 4 – Tempo build", m: 30, d: "50 → 75 → 100%." },
  { name: "Stage 5 – Run-through", m: 15, d: "Full freedom. Reviews." },
  { name: "Stage 6 – Launch", m: 20, d: "Free jam." },
];

export const DEFAULT_DAY_CATS: Record<string, string[]> = {
  "Sunday": ["Warm-Up", "Shred", "Riffs"],
  "Monday": ["Warm-Up", "Ear Training", "Modes", "Improv"],
  "Tuesday": ["Warm-Up", "Legato", "Bends", "Phrasing"],
  "Wednesday": ["Warm-Up", "Fretboard", "Improv", "Modes"],
  "Thursday": ["Warm-Up", "Shred", "Songs"],
  "Friday": ["Warm-Up", "Rhythm", "Dynamics", "Composition"],
  "Saturday": [],
};

export const DEFAULT_DAY_HRS: Record<string, number> = {
  "Sunday": 2,
  "Monday": 2,
  "Tuesday": 2,
  "Wednesday": 2,
  "Thursday": 2,
  "Friday": 1.5,
  "Saturday": 0,
};
