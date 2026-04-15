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
  "Warm-Up": "#D4A843",
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

// ── Jam Mode: Progressions by style (Nashville numerals) ──

export interface Progression {
  name: string;
  nashville: string[];
  bars: number;
  timeSignature: "4/4" | "3/4" | "6/8";
  mood: string;
  famousExample: string;
}

export type JamStyleKey =
  | "blues" | "rock" | "metal" | "funk" | "jazz" | "pop"
  | "country" | "reggae" | "latin" | "rnb" | "punk" | "indie";

export const JAM_STYLE_LIST: JamStyleKey[] = [
  "blues", "rock", "metal", "funk", "jazz", "pop",
  "country", "reggae", "latin", "rnb", "punk", "indie",
];

export const JAM_STYLE_LABELS: Record<JamStyleKey, string> = {
  blues: "Blues",
  rock: "Rock",
  metal: "Metal",
  funk: "Funk",
  jazz: "Jazz",
  pop: "Pop",
  country: "Country",
  reggae: "Reggae",
  latin: "Latin",
  rnb: "R&B",
  punk: "Punk",
  indie: "Indie",
};

export const PROGRESSIONS_BY_STYLE: Record<JamStyleKey, Progression[]> = {
  blues: [
    { name: "12 Bar Blues", nashville: ["I","I","I","I","IV","IV","I","I","V","IV","I","V"], bars: 12, timeSignature: "4/4", mood: "classic, driving, foundational", famousExample: "Johnny B. Goode (Chuck Berry)" },
    { name: "Quick Change Blues", nashville: ["I","IV","I","I","IV","IV","I","I","V","IV","I","V"], bars: 12, timeSignature: "4/4", mood: "smooth, sophisticated", famousExample: "Pride and Joy (SRV)" },
    { name: "Minor Blues", nashville: ["i","i","i","i","iv","iv","i","i","bVI","V","i","V"], bars: 12, timeSignature: "4/4", mood: "dark, moody, emotional", famousExample: "The Thrill Is Gone (B.B. King)" },
    { name: "Jazz Blues", nashville: ["I7","IV7","I7","v7-I7","IV7","iv7","I7","VI7","ii7","V7","I7-VI7","ii7-V7"], bars: 12, timeSignature: "4/4", mood: "sophisticated, chromatic", famousExample: "Billie's Bounce (Charlie Parker)" },
    { name: "8 Bar Blues", nashville: ["I","V","IV","IV","I","V","I","V"], bars: 8, timeSignature: "4/4", mood: "compact, folk-blues", famousExample: "Key to the Highway" },
    { name: "Slow Blues 12/8", nashville: ["I","IV","I","I7","IV","IV","I","I","V","IV","I","V"], bars: 12, timeSignature: "6/8", mood: "slow, soulful, weeping", famousExample: "Red House (Hendrix)" },
  ],
  rock: [
    { name: "50s Rock I-IV-V", nashville: ["I","I","IV","V","I","IV","V","I"], bars: 8, timeSignature: "4/4", mood: "energetic, classic rock", famousExample: "Jailhouse Rock (Elvis)" },
    { name: "Pop Rock I-V-vi-IV", nashville: ["I","V","vi","IV","I","V","vi","IV"], bars: 8, timeSignature: "4/4", mood: "anthemic, uplifting", famousExample: "Let It Be (Beatles)" },
    { name: "Axis vi-IV-I-V", nashville: ["vi","IV","I","V","vi","IV","I","V"], bars: 8, timeSignature: "4/4", mood: "emotional, dramatic", famousExample: "Zombie (Cranberries)" },
    { name: "12 Bar Rock", nashville: ["I","I","I","I","IV","IV","I","I","V","IV","I","I"], bars: 12, timeSignature: "4/4", mood: "driving, boogie", famousExample: "Rock and Roll (Led Zeppelin)" },
    { name: "Mixolydian Rock", nashville: ["I","bVII","IV","I","I","bVII","IV","I"], bars: 8, timeSignature: "4/4", mood: "bluesy, classic rock", famousExample: "Sweet Child O' Mine (GnR)" },
    { name: "Power Ballad", nashville: ["I","V","vi","iii","IV","I","IV","V"], bars: 8, timeSignature: "4/4", mood: "epic, emotional", famousExample: "November Rain (GnR)" },
  ],
  metal: [
    { name: "Classic Metal i-VI-VII", nashville: ["i","i","VI","VII","i","i","VI","VII"], bars: 8, timeSignature: "4/4", mood: "heavy, anthemic", famousExample: "Iron Man (Black Sabbath)" },
    { name: "Descending i-VII-VI-V", nashville: ["i","VII","VI","V","i","VII","VI","V"], bars: 8, timeSignature: "4/4", mood: "epic, descending tension", famousExample: "Hit the Lights (Metallica)" },
    { name: "Minor Metal i-iv-V", nashville: ["i","i","iv","V","i","i","iv","V"], bars: 8, timeSignature: "4/4", mood: "dark, driving", famousExample: "Master of Puppets (Metallica)" },
    { name: "Phrygian Metal i-bII", nashville: ["i","bII","i","bII","i","bII","VII","i"], bars: 8, timeSignature: "4/4", mood: "exotic, menacing", famousExample: "Wherever I May Roam (Metallica)" },
    { name: "Chromatic Descent", nashville: ["i","bVII","bVI","V","i","bVII","bVI","V"], bars: 8, timeSignature: "4/4", mood: "dark, brooding, doom", famousExample: "Black Sabbath" },
    { name: "Aeolian Epic", nashville: ["i","VI","III","VII","i","VI","III","VII"], bars: 8, timeSignature: "4/4", mood: "epic, heroic, power metal", famousExample: "Fear of the Dark (Iron Maiden)" },
    { name: "Power Drop", nashville: ["i","i","bVI","bVII","i","i","bVI","bVII"], bars: 8, timeSignature: "4/4", mood: "crushing, modern metal", famousExample: "Blackened (Metallica)" },
  ],
  funk: [
    { name: "One Chord Vamp I7", nashville: ["I7","I7","I7","I7","I7","I7","I7","I7"], bars: 8, timeSignature: "4/4", mood: "groovy, hypnotic", famousExample: "Sex Machine (James Brown)" },
    { name: "Two Chord Funk", nashville: ["i7","i7","IV7","IV7","i7","i7","IV7","IV7"], bars: 8, timeSignature: "4/4", mood: "dorian groove", famousExample: "Cissy Strut (The Meters)" },
    { name: "ii7-V7 Funk", nashville: ["ii7","V7","ii7","V7","ii7","V7","ii7","V7"], bars: 8, timeSignature: "4/4", mood: "sophisticated funk", famousExample: "Pick Up the Pieces" },
    { name: "Dorian i-IV", nashville: ["i7","IV7","i7","IV7","i7","IV7","i7","IV7"], bars: 8, timeSignature: "4/4", mood: "smooth, jazzy funk", famousExample: "So What (Miles Davis)" },
    { name: "Funk Blues", nashville: ["I7","I7","I7","I7","IV7","IV7","I7","I7","V7","IV7","I7","V7"], bars: 12, timeSignature: "4/4", mood: "funky blues", famousExample: "Superstition (Stevie Wonder)" },
  ],
  jazz: [
    { name: "ii-V-I Major", nashville: ["iim7","V7","IM7","IM7","iim7","V7","IM7","IM7"], bars: 8, timeSignature: "4/4", mood: "smooth, resolving", famousExample: "Satin Doll (Duke Ellington)" },
    { name: "ii-V-i Minor", nashville: ["iim7b5","V7b9","im7","im7","iim7b5","V7b9","im7","im7"], bars: 8, timeSignature: "4/4", mood: "melancholic, sophisticated", famousExample: "Autumn Leaves" },
    { name: "Rhythm Changes", nashville: ["IM7","vi7","iim7","V7","IM7","vi7","iim7","V7"], bars: 8, timeSignature: "4/4", mood: "bouncy, bebop", famousExample: "I Got Rhythm (Gershwin)" },
    { name: "Jazz Blues", nashville: ["I7","IV7","I7","v7-I7","IV7","iv7","I7","VI7","iim7","V7","I7-VI7","iim7-V7"], bars: 12, timeSignature: "4/4", mood: "sophisticated blues", famousExample: "Billie's Bounce" },
    { name: "Coltrane Changes", nashville: ["IM7","bIII7","bVIM7","VII7","IIIM7","V7","IM7","V7"], bars: 8, timeSignature: "4/4", mood: "modulating, advanced", famousExample: "Giant Steps (Coltrane)" },
    { name: "Autumn Leaves", nashville: ["iim7","V7","IM7","IVM7","iim7b5","III7","vim","vim"], bars: 8, timeSignature: "4/4", mood: "classic standard", famousExample: "Autumn Leaves" },
  ],
  pop: [
    { name: "Four Chords I-V-vi-IV", nashville: ["I","V","vi","IV","I","V","vi","IV"], bars: 8, timeSignature: "4/4", mood: "uplifting, universal", famousExample: "Someone Like You (Adele)" },
    { name: "50s Doo-Wop", nashville: ["I","vi","IV","V","I","vi","IV","V"], bars: 8, timeSignature: "4/4", mood: "nostalgic, sweet", famousExample: "Stand By Me (Ben E. King)" },
    { name: "Sensitive Female vi-IV-I-V", nashville: ["vi","IV","I","V","vi","IV","I","V"], bars: 8, timeSignature: "4/4", mood: "melancholic, emotional", famousExample: "Apologize (OneRepublic)" },
    { name: "Pop Ballad", nashville: ["I","IV","vi","V","I","IV","vi","V"], bars: 8, timeSignature: "4/4", mood: "heartfelt, radio-friendly", famousExample: "Perfect (Ed Sheeran)" },
    { name: "Descending vi-V-IV-V", nashville: ["vi","V","IV","V","vi","V","IV","V"], bars: 8, timeSignature: "4/4", mood: "brooding, cinematic", famousExample: "Stairway to Heaven intro" },
    { name: "Modern Pop I-iii-vi-IV", nashville: ["I","iii","vi","IV","I","iii","vi","IV"], bars: 8, timeSignature: "4/4", mood: "dreamy, modern", famousExample: "Shake It Off (Taylor Swift)" },
  ],
  country: [
    { name: "Three Chord Country", nashville: ["I","I","IV","IV","I","V","I","I"], bars: 8, timeSignature: "4/4", mood: "classic country", famousExample: "Folsom Prison Blues" },
    { name: "Country Waltz", nashville: ["I","I","IV","IV","I","I","V","V"], bars: 8, timeSignature: "3/4", mood: "waltz, nostalgic", famousExample: "Tennessee Waltz" },
    { name: "Country Pop", nashville: ["I","vi","IV","V","I","vi","IV","V"], bars: 8, timeSignature: "4/4", mood: "nostalgic, heartfelt", famousExample: "Tennessee Whiskey" },
    { name: "Modern Country", nashville: ["I","V","vi","IV","I","V","vi","IV"], bars: 8, timeSignature: "4/4", mood: "anthemic, modern", famousExample: "Cruise (Florida Georgia Line)" },
    { name: "Train Beat I-IV", nashville: ["I","I","I","I","IV","IV","I","I"], bars: 8, timeSignature: "4/4", mood: "driving train groove", famousExample: "Wabash Cannonball" },
  ],
  reggae: [
    { name: "Minor Reggae i-V", nashville: ["i","i","V","V","i","i","V","V"], bars: 8, timeSignature: "4/4", mood: "roots reggae", famousExample: "No Woman No Cry (Marley)" },
    { name: "Major Skank I-IV", nashville: ["I","I","IV","IV","I","I","IV","IV"], bars: 8, timeSignature: "4/4", mood: "upbeat, sunny", famousExample: "Three Little Birds (Marley)" },
    { name: "Roots i-bIII-IV", nashville: ["i","bIII","IV","IV","i","bIII","IV","IV"], bars: 8, timeSignature: "4/4", mood: "spiritual, roots", famousExample: "Get Up Stand Up (Marley)" },
    { name: "Reggae Pop", nashville: ["I","vi","IV","V","I","vi","IV","V"], bars: 8, timeSignature: "4/4", mood: "pop reggae", famousExample: "Red Red Wine (UB40)" },
    { name: "Dub Minor i-iv", nashville: ["i","i","iv","iv","i","i","iv","iv"], bars: 8, timeSignature: "4/4", mood: "heavy, dub", famousExample: "Israelites (Dekker)" },
  ],
  latin: [
    { name: "Andalusian Cadence", nashville: ["i","bVII","bVI","V","i","bVII","bVI","V"], bars: 8, timeSignature: "4/4", mood: "flamenco, dramatic", famousExample: "Hit the Road Jack" },
    { name: "Bossa Nova ii-V-I", nashville: ["iim7","V7","IM7","IM7","iim7","V7","IM7","IM7"], bars: 8, timeSignature: "4/4", mood: "smooth, Brazilian", famousExample: "Girl from Ipanema" },
    { name: "Latin Minor", nashville: ["i","i","iv","V","i","i","iv","V"], bars: 8, timeSignature: "4/4", mood: "passionate, tango", famousExample: "Besame Mucho" },
    { name: "Salsa I-IV-V", nashville: ["I","IV","V","IV","I","IV","V","IV"], bars: 8, timeSignature: "4/4", mood: "energetic, dance", famousExample: "Oye Como Va (Santana)" },
    { name: "Samba ii-V-I", nashville: ["iim7","V7","IM7","VI7","iim7","V7","IM7","IM7"], bars: 8, timeSignature: "4/4", mood: "festive, swinging", famousExample: "Mas Que Nada" },
    { name: "Montuno i-IV-V", nashville: ["i","IV","V","i","i","IV","V","i"], bars: 8, timeSignature: "4/4", mood: "Cuban groove", famousExample: "Guantanamera" },
  ],
  rnb: [
    { name: "Classic Soul", nashville: ["I","vi","IV","V","I","vi","IV","V"], bars: 8, timeSignature: "4/4", mood: "classic soul", famousExample: "Stand By Me" },
    { name: "Extended ii-V-I", nashville: ["iim7","V7","IM7","vi7","iim7","V7","IM7","vi7"], bars: 8, timeSignature: "4/4", mood: "smooth R&B", famousExample: "Just the Two of Us" },
    { name: "Motown", nashville: ["I","iii","IV","V","I","iii","IV","V"], bars: 8, timeSignature: "4/4", mood: "Motown, upbeat", famousExample: "I Heard It Through the Grapevine" },
    { name: "Neo-Soul", nashville: ["iim7","V7","iiim7","vim7","iim7","V7","IM7","IM7"], bars: 8, timeSignature: "4/4", mood: "modern neo-soul", famousExample: "Brown Sugar (D'Angelo)" },
    { name: "Soul Ballad", nashville: ["I","V","vi","iii","IV","I","IV","V"], bars: 8, timeSignature: "4/4", mood: "emotional, ballad", famousExample: "Let's Get It On (Marvin Gaye)" },
  ],
  punk: [
    { name: "Three Chord Punk", nashville: ["I","I","IV","IV","V","V","I","I"], bars: 8, timeSignature: "4/4", mood: "fast, raw", famousExample: "Blitzkrieg Bop (Ramones)" },
    { name: "Pop Punk", nashville: ["I","V","vi","IV","I","V","vi","IV"], bars: 8, timeSignature: "4/4", mood: "melodic punk", famousExample: "All the Small Things (Blink-182)" },
    { name: "Mixolydian Punk", nashville: ["I","bVII","IV","IV","I","bVII","IV","IV"], bars: 8, timeSignature: "4/4", mood: "raw rock punk", famousExample: "Sheena Is a Punk Rocker" },
    { name: "Dark Punk", nashville: ["i","bVI","bVII","i","i","bVI","bVII","i"], bars: 8, timeSignature: "4/4", mood: "dark, post-punk", famousExample: "Love Will Tear Us Apart" },
    { name: "Thrash Punk I-V", nashville: ["I","I","V","V","I","I","V","V"], bars: 8, timeSignature: "4/4", mood: "fast, aggressive", famousExample: "Holiday in Cambodia" },
  ],
  indie: [
    { name: "Indie Pop", nashville: ["I","V","vi","IV","I","V","vi","IV"], bars: 8, timeSignature: "4/4", mood: "dreamy indie pop", famousExample: "Mr. Brightside (Killers)" },
    { name: "Emo Indie", nashville: ["vi","IV","I","V","vi","IV","I","V"], bars: 8, timeSignature: "4/4", mood: "melancholic, emo", famousExample: "Ho Hey (Lumineers)" },
    { name: "Indie Folk", nashville: ["I","iii","IV","IV","I","iii","IV","IV"], bars: 8, timeSignature: "4/4", mood: "folky, warm", famousExample: "The Cave (Mumford & Sons)" },
    { name: "Modal Indie", nashville: ["i","bVII","IV","IV","i","bVII","IV","IV"], bars: 8, timeSignature: "4/4", mood: "modal, dorian", famousExample: "Seven Nation Army" },
    { name: "Dream Pop", nashville: ["vi","I","V","V","vi","I","V","V"], bars: 8, timeSignature: "4/4", mood: "dreamy, shoegaze", famousExample: "When You Sleep (MBV)" },
    { name: "Garage Indie", nashville: ["I","V","IV","IV","I","V","IV","IV"], bars: 8, timeSignature: "4/4", mood: "raw, garage", famousExample: "Last Nite (Strokes)" },
  ],
};

// Map Jam style → groove style (existing drum+bass patterns)
export const JAM_STYLE_TO_GROOVE: Record<JamStyleKey, string> = {
  blues: "blues",
  rock: "rock",
  metal: "metal",
  funk: "funk",
  jazz: "jazz",
  pop: "rock",
  country: "country",
  reggae: "reggae",
  latin: "latin",
  rnb: "funk",
  punk: "punk",
  indie: "rock",
};
