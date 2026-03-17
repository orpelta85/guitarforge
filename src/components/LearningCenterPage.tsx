"use client";
import { useState, useRef, useEffect, useCallback } from "react";
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
  { name: "m3", label: "Minor 3rd", st: 3, color: "#eab308", ref: "Smoke on the Water" },
  { name: "M3", label: "Major 3rd", st: 4, color: "#84cc16", ref: "When the Saints" },
  { name: "P4", label: "Perfect 4th", st: 5, color: "#22c55e", ref: "Here Comes the Bride" },
  { name: "TT", label: "Tritone", st: 6, color: "#14b8a6", ref: "Black Sabbath" },
  { name: "P5", label: "Perfect 5th", st: 7, color: "#06b6d4", ref: "Star Wars" },
  { name: "m6", label: "Minor 6th", st: 8, color: "#3b82f6", ref: "The Entertainer" },
  { name: "M6", label: "Major 6th", st: 9, color: "#6366f1", ref: "My Bonnie" },
  { name: "m7", label: "Minor 7th", st: 10, color: "#8b5cf6", ref: "Somewhere (WSS)" },
  { name: "M7", label: "Major 7th", st: 11, color: "#a855f7", ref: "Take On Me" },
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
type LessonCategory = "יסודות" | "קצב" | "סקאלות" | "אינטרוולים" | "אקורדים" | "אקורדים דיאטוניים" | "פרוגרסיות" | "מתקדם";
interface Lesson {
  id: string; title: string; cat: LessonCategory; desc: string;
  content: string[];
  fretboardRoot?: string; fretboardNotes?: string[];
  audioDemo?: { type: "scale"|"chord"|"interval"; data: number[] };
  quiz?: { q: string; opts: string[]; ans: number };
}

const LESSONS: Lesson[] = [
  // ═══ יסודות (6 lessons) ═══
  { id: "b1", title: "מהי תו?", cat: "יסודות", desc: "תדר, גובה צליל ושמות התווים",
    content: ["תו מוזיקלי הוא צליל בגובה מסוים. ב-Western Music יש 12 תווים שונים שחוזרים על עצמם באוקטבות.","12 התווים: C, C#, D, D#, E, F, F#, G, G#, A, A#, B","המרחק בין כל שני תווים סמוכים הוא חצי-טון (semitone). שני חצאי-טון = טון שלם (whole tone)."],
    quiz: { q: "כמה תווים שונים יש בסולם הכרומטי?", opts: ["7","10","12","14"], ans: 2 } },
  { id: "b2", title: "הסולם הכרומטי", cat: "יסודות", desc: "12 התווים וסדר החצאי-טונים",
    content: ["הסולם הכרומטי כולל את כל 12 התווים ברצף של חצאי-טונים.","על הגיטרה, כל פרט (fret) = חצי טון. 12 פרטים = אוקטבה שלמה.","שימו לב: בין E-F ובין B-C אין דיאז (#). אלה כבר במרחק חצי-טון."],
    fretboardRoot: "C", fretboardNotes: NOTES,
    quiz: { q: "בין אילו תווים אין דיאז?", opts: ["C-D ו-F-G","E-F ו-B-C","A-B ו-D-E","G-A ו-C-D"], ans: 1 } },
  { id: "b3", title: "דיאזים ובמולים", cat: "יסודות", desc: "Sharp (#) ו-Flat (b) — אותו תו, שם אחר",
    content: ["דיאז (#) מעלה תו בחצי-טון. במול (b) מוריד תו בחצי-טון.","C# = Db — אותו צליל בדיוק, שני שמות (enharmonic equivalents).","על הגיטרה זה פשוט: פרט אחד למעלה = #, פרט אחד למטה = b."],
    quiz: { q: "מהו השם האנהרמוני של F#?", opts: ["Eb","Gb","G","E"], ans: 1 } },
  { id: "b4", title: "האוקטבה", cat: "יסודות", desc: "למה C נשמע כמו C, רק גבוה יותר",
    content: ["אוקטבה = 12 חצאי-טונים. תו באוקטבה גבוהה יותר נשמע \"אותו דבר\" אבל גבוה יותר.","הסיבה: יחס התדרים הוא 2:1. A4 = 440Hz, A5 = 880Hz.","על הגיטרה: אוקטבה = 12 פרטים, או 2 מיתרים למעלה + 2 פרטים ימינה."],
    audioDemo: { type: "interval", data: [12] },
    quiz: { q: "כמה חצאי-טונים באוקטבה?", opts: ["7","10","12","24"], ans: 2 } },
  { id: "b5", title: "משכי תווים", cat: "יסודות", desc: "שלמה, חצי, רבע, שמינית, שש-עשרית",
    content: ["כל תו מוזיקלי יש לו שני מאפיינים: גובה (pitch) ומשך (duration).","תו שלם (whole note) = 4 פעימות. חצי (half) = 2. רבע (quarter) = 1. שמינית (eighth) = 0.5. שש-עשרית (sixteenth) = 0.25.","נקודה (dot) אחרי תו מוסיפה 50% מהערך שלו. רבע מנוקד = 1.5 פעימות. שמינית מנוקדת = 0.75 פעימות.","במטאל, שש-עשריות (16th notes) הן הבסיס ל-tremolo picking ול-double bass drumming. gallop rhythm = שמינית + 2 שש-עשריות."],
    quiz: { q: "כמה שמיניות נכנסות בתו שלם?", opts: ["4","6","8","16"], ans: 2 } },
  { id: "b6", title: "צעדים ואקצידנטלים", cat: "יסודות", desc: "Half steps, whole steps, enharmonic equivalents",
    content: ["Half step (חצי-טון) = המרחק הקטן ביותר בין שני תווים. על הגיטרה = פרט אחד.","Whole step (טון שלם) = שני חצאי-טונים. על הגיטרה = שני פרטים.","Enharmonic equivalents: שני שמות לאותו צליל. C# = Db, D# = Eb, F# = Gb, G# = Ab, A# = Bb.","Double sharp (x) מעלה בשני חצאי-טונים. Double flat (bb) מוריד בשני חצאי-טונים. Fx = G, Abb = G.","הרעיון חשוב כי באותו סולם לא יופיעו שני תווים עם אותו אות. ב-D Major כותבים F# ולא Gb."],
    quiz: { q: "מהו Enharmonic Equivalent של D#?", opts: ["Db","E","Eb","Fb"], ans: 2 } },

  // ═══ קצב (4 lessons) ═══
  { id: "r1", title: "קצב בסיסי", cat: "קצב", desc: "פעימות, טמפו ומשקל",
    content: ["קצב = ארגון צלילים בזמן. BPM (beats per minute) = מהירות.","משקל 4/4 = 4 פעימות בכל תיבה. הנפוץ ביותר ברוק ומטאל.","הפעימה הראשונה (downbeat) היא הכי חזקה. ספירה: 1-2-3-4."],
    quiz: { q: "מה המשמעות של 120 BPM?", opts: ["120 תיבות לדקה","120 פעימות לדקה","120 תווים לדקה","120 אקורדים לדקה"], ans: 1 } },
  { id: "r2", title: "ערכי תווים", cat: "קצב", desc: "שלמה, חצי, רבע, שמינית, שש-עשרית",
    content: ["תו שלם = 4 פעימות. חצי = 2. רבע = 1. שמינית = 0.5. שש-עשרית = 0.25.","במטאל, שש-עשריות (16th notes) הן הבסיס ל-tremolo picking ו-double bass.","נקודה (.) אחרי תו מוסיפה 50% מהערך שלו. רבע מנוקד = 1.5 פעימות."],
    quiz: { q: "כמה שמיניות נכנסות בתיבת 4/4?", opts: ["4","6","8","16"], ans: 2 } },
  { id: "r3", title: "סינקופה", cat: "קצב", desc: "הדגשה על הפעימות החלשות — groove",
    content: ["סינקופה = הדגשת off-beats (פעימות חלשות). זה מה שיוצר groove.","במקום 1-2-3-4, ההדגשה על ה-\"ו\": 1-וְ-2-וְ-3-וְ-4-וְ.","דוגמאות: funk rhythm guitar, reggae skank, metal breakdowns עם דגש לא צפוי."] },
  { id: "r4", title: "משקלים מורכבים", cat: "קצב", desc: "5/4, 7/8, 7/4 — Odd Meter בפרוג ובמטאל",
    content: ["Odd meter = משקלים עם מספר אי-זוגי של פעימות או חלוקות לא סימטריות.","5/4: מרגיש כמו 3+2 או 2+3. דוגמה מפורסמת: Take Five (Dave Brubeck), Lateralus (Tool).","7/8: חלוקה נפוצה 2+2+3 או 3+2+2. דוגמה: Money (Pink Floyd), Schism (Tool).","7/4: מרגיש כמו 4+3 או 3+4. דוגמה: All You Need Is Love (Beatles).","במטאל פרוגרסיבי (Meshuggah, Dream Theater, Tool) משלבים משקלים מורכבים כדי ליצור polyrhythm וmeter changes.","טיפ לתרגול: ספרו בקול 1-2-3-4-5 על 5/4. הדגישו את 1 ואת 4. נגנו ריף פשוט במשקל הזה."],
    quiz: { q: "מה החלוקה הנפוצה ביותר של 7/8?", opts: ["4+3","3+3+1","2+2+3","7 שווים"], ans: 2 } },

  // ═══ סקאלות (5 lessons) ═══
  { id: "s1", title: "נוסחת הסולם המז'ורי", cat: "סקאלות", desc: "W-W-H-W-W-W-H — הבסיס לכל השאר",
    content: ["הסולם המז'ורי = 7 תווים לפי הנוסחה: Whole-Whole-Half-Whole-Whole-Whole-Half.","C Major: C-D-E-F-G-A-B — בלי דיאזים או במולים.","כל סולם מז'ורי אחר עוקב אחרי אותה נוסחה מתו שורש אחר."],
    fretboardRoot: "C", fretboardNotes: ["C","D","E","F","G","A","B"],
    audioDemo: { type: "scale", data: [0,2,4,5,7,9,11,12] },
    quiz: { q: "מה הנוסחה של סולם Major?", opts: ["W-H-W-W-H-W-W","W-W-H-W-W-W-H","H-W-W-W-H-W-W","W-W-W-H-W-W-H"], ans: 1 } },
  { id: "s2", title: "סולמות מינוריים", cat: "סקאלות", desc: "Natural Minor, Harmonic Minor, Melodic Minor",
    content: ["Natural Minor = W-H-W-W-H-W-W. הצליל העצוב הקלאסי.","Harmonic Minor = Natural Minor עם מעלה 7 מוגבהת. צליל מזרחי/קלאסי.","A Natural Minor: A-B-C-D-E-F-G. A Harmonic Minor: A-B-C-D-E-F-G#."],
    fretboardRoot: "A", fretboardNotes: ["A","B","C","D","E","F","G"],
    audioDemo: { type: "scale", data: [0,2,3,5,7,8,10,12] },
    quiz: { q: "מה ההבדל בין Natural Minor ל-Harmonic Minor?", opts: ["מעלה 3 מוגבהת","מעלה 5 מוגבהת","מעלה 7 מוגבהת","מעלה 2 מוגבהת"], ans: 2 } },
  { id: "s3", title: "פנטטוני מינורי", cat: "סקאלות", desc: "5 תווים — הסולם הכי חשוב לגיטרה",
    content: ["Minor Pentatonic = 5 תווים מתוך Natural Minor: 1-b3-4-5-b7.","A Minor Pentatonic: A-C-D-E-G. אין חצאי-טונים — הכל נשמע טוב.","זה הסולם הראשון שכל גיטריסט לומד. בסיס לבלוז, רוק, מטאל."],
    fretboardRoot: "A", fretboardNotes: ["A","C","D","E","G"],
    audioDemo: { type: "scale", data: [0,3,5,7,10,12] },
    quiz: { q: "כמה תווים בסולם פנטטוני?", opts: ["4","5","6","7"], ans: 1 } },
  { id: "s4", title: "סולם הבלוז", cat: "סקאלות", desc: "פנטטוני + Blue Note",
    content: ["Blues Scale = Minor Pentatonic + b5 (blue note): 1-b3-4-b5-5-b7.","A Blues: A-C-D-Eb-E-G. ה-Eb הוא ה-blue note שנותן את הצליל המיוחד.","ה-blue note יוצר מתח שנפתר כשעוברים ל-4 או ל-5."],
    fretboardRoot: "A", fretboardNotes: ["A","C","D","D#","E","G"],
    audioDemo: { type: "scale", data: [0,3,5,6,7,10,12] } },
  { id: "s5", title: "מעלות הסולם", cat: "סקאלות", desc: "Tonic, Dominant, Leading Tone — שמות ותפקידים",
    content: ["לכל תו בסולם יש שם ותפקיד. אלה מעלות הסולם (Scale Degrees):","מעלה 1 — Tonic (טוניקה): \"הבית\", מרכז הכובד. מעלה 2 — Supertonic: מעל הטוניקה. מעלה 3 — Mediant: באמצע בין טוניקה לדומיננטה.","מעלה 4 — Subdominant: מתחת לדומיננטה. מעלה 5 — Dominant (דומיננטה): הכי חזקה אחרי הטוניקה, יוצרת מתח. מעלה 6 — Submediant: באמצע בין סאבדומיננטה לאוקטבה.","מעלה 7 — Leading Tone: חצי-טון מתחת לטוניקה, \"מושכת\" אליה. ב-Natural Minor היא Subtonic (טון שלם מתחת).","ב-C Major: C=Tonic, D=Supertonic, E=Mediant, F=Subdominant, G=Dominant, A=Submediant, B=Leading Tone."],
    fretboardRoot: "C", fretboardNotes: ["C","D","E","F","G","A","B"],
    audioDemo: { type: "scale", data: [0,2,4,5,7,9,11,12] },
    quiz: { q: "איזו מעלה נקראת Dominant?", opts: ["מעלה 3","מעלה 4","מעלה 5","מעלה 7"], ans: 2 } },

  // ═══ אינטרוולים (4 lessons) ═══
  { id: "i1", title: "מה זה אינטרוול?", cat: "אינטרוולים", desc: "המרחק בין שני תווים",
    content: ["אינטרוול = המרחק (במספר חצאי-טונים) בין שני תווים.","יש 12 אינטרוולים בסיסיים, מ-minor 2nd (1 חצי-טון) עד Octave (12 חצאי-טונים).","אינטרוולים הם הבסיס להבנת אקורדים, סקאלות ומלודיות."],
    quiz: { q: "מה הוא אינטרוול?", opts: ["אקורד","מרחק בין שני תווים","סוג סולם","קצב"], ans: 1 } },
  { id: "i2", title: "Perfect Intervals", cat: "אינטרוולים", desc: "P4, P5, P8 — יציבים וחזקים",
    content: ["Perfect Intervals נשמעים יציבים ו\"ריקים\". הם הבסיס ל-power chords.","P4 (5 חצאי-טונים) — צליל פתוח. P5 (7) — power chord. P8 (12) — אוקטבה.","על הגיטרה: P5 = אותו פרט על המיתר הבא (למעט מיתר G-B)."],
    audioDemo: { type: "interval", data: [5,7,12] },
    quiz: { q: "כמה חצאי-טונים ב-Perfect 5th?", opts: ["5","6","7","8"], ans: 2 } },
  { id: "i3", title: "Major & Minor Intervals", cat: "אינטרוולים", desc: "2nds, 3rds, 6ths, 7ths — צבע ורגש",
    content: ["Major Intervals נשמעים שמחים/בהירים. Minor Intervals נשמעים עצובים/כהים.","M3 (4 חצאי-טונים) = אקורד מז'ורי. m3 (3) = אקורד מינורי.","M7 (11) = צליל חלומי. m7 (10) = צליל בלוזי/ג'אזי."],
    audioDemo: { type: "interval", data: [3,4] },
    quiz: { q: "מה ההבדל בין Major 3rd ל-Minor 3rd?", opts: ["1 חצי-טון","2 חצאי-טונים","3 חצאי-טונים","אין הבדל"], ans: 0 } },
  { id: "i4", title: "הטריטון", cat: "אינטרוולים", desc: "Tritone — Diabolus in Musica",
    content: ["Tritone = 6 חצאי-טונים. בדיוק חצי אוקטבה. הצליל הכי לא יציב.","בימי הביניים קראו לו \"the Devil's Interval\". הוא בסיס הצליל של Black Sabbath.","הוא מופיע באקורד דומיננטי (V7) ויוצר מתח שדורש פתרון."],
    audioDemo: { type: "interval", data: [6] },
    quiz: { q: "כמה חצאי-טונים בטריטון?", opts: ["5","6","7","8"], ans: 1 } },

  // ═══ אקורדים (6 lessons) ═══
  { id: "c1", title: "איך בונים אקורד?", cat: "אקורדים", desc: "שלישיות (Triads) — 3 תווים",
    content: ["אקורד = 3+ תווים שנשמעים יחד. הבסיסי ביותר הוא טריאד (3 תווים).","טריאד = שורש (Root) + טרצה (3rd) + קווינטה (5th).","Major triad: R-M3-P5 (0-4-7). Minor triad: R-m3-P5 (0-3-7)."],
    audioDemo: { type: "chord", data: [0,4,7] },
    quiz: { q: "כמה תווים בטריאד?", opts: ["2","3","4","5"], ans: 1 } },
  { id: "c2", title: "Major vs Minor", cat: "אקורדים", desc: "ההבדל של חצי-טון אחד שמשנה הכל",
    content: ["ההבדל היחיד: Major = M3 (4 חצאי-טונים). Minor = m3 (3 חצאי-טונים).","A Major: A-C#-E. A Minor: A-C-E. רק תו אחד משתנה!","Major = שמח/בהיר. Minor = עצוב/כהה. זה הבסיס לכל האקורדים."],
    audioDemo: { type: "chord", data: [0,3,7] },
    quiz: { q: "מה ההבדל בין Major ל-Minor triad?", opts: ["ה-5th","ה-Root","ה-3rd","הכל שונה"], ans: 2 } },
  { id: "c3", title: "Dim & Aug", cat: "אקורדים", desc: "Diminished ו-Augmented — מתח וצבע",
    content: ["Diminished: R-m3-b5 (0-3-6). צליל מתוח, לא יציב. נפוץ במטאל ובג'אז.","Augmented: R-M3-#5 (0-4-8). צליל מוזר, חלומי. שימוש קלאסי ופסיכדלי.","שניהם סימטריים: Dim = minor 3rds שווים. Aug = major 3rds שוות."],
    audioDemo: { type: "chord", data: [0,3,6] } },
  { id: "c4", title: "אקורדי 7", cat: "אקורדים", desc: "Dom7, Maj7, Min7, Dim7 — 4 תווים",
    content: ["אקורד 7 = טריאד + מעלה 7. Dom7 = Major + m7 (0-4-7-10). הנפוץ ביותר.","Maj7 = Major + M7 (0-4-7-11). צליל חלומי, ג'אזי.","Min7 = Minor + m7 (0-3-7-10). צליל עצוב אך רך. Dim7 = Dim + dim7 (0-3-6-9)."],
    audioDemo: { type: "chord", data: [0,4,7,10] },
    quiz: { q: "מה מוסיפים לטריאד כדי לקבל אקורד 7?", opts: ["מעלה 2","מעלה 4","מעלה 6","מעלה 7"], ans: 3 } },
  { id: "c5", title: "אקורדי שביעית", cat: "אקורדים", desc: "Maj7, m7, dom7, m7b5, dim7 — כל הסוגים",
    content: ["חמש סוגי אקורדי שביעית עיקריים:","1) Dominant 7 (dom7) = Major + m7: 0-4-7-10. הנפוץ ביותר בבלוז ורוק. דוגמה: A7 = A-C#-E-G.","2) Major 7 (Maj7) = Major + M7: 0-4-7-11. צליל חם ורומנטי. דוגמה: Amaj7 = A-C#-E-G#.","3) Minor 7 (m7) = Minor + m7: 0-3-7-10. צליל ג'אזי עצוב. דוגמה: Am7 = A-C-E-G.","4) Half-diminished (m7b5) = Dim + m7: 0-3-6-10. צליל מתוח. דוגמה: Am7b5 = A-C-Eb-G.","5) Fully-diminished (dim7) = Dim + dim7: 0-3-6-9. סימטרי לחלוטין, 4 minor 3rds. דוגמה: Adim7 = A-C-Eb-Gb."],
    audioDemo: { type: "chord", data: [0,4,7,11] },
    quiz: { q: "מה ההבדל בין dom7 ל-Maj7?", opts: ["ה-3rd","ה-5th","ה-7th — m7 vs M7","ה-Root"], ans: 2 } },
  { id: "c6", title: "היפוכים (Inversions)", cat: "אקורדים", desc: "אותו אקורד, Bass שונה — על הגיטרה",
    content: ["Inversion = האקורד עם תו שאינו השורש ב-Bass.","Root position: C-E-G. 1st inversion: E-G-C. 2nd inversion: G-C-E.","היפוכים משנים את הצבע והתנועה של הפרוגרסיה. נפוצים בפסנתר ובגיטרה קלאסית.","על הגיטרה: slash chords. C/E = C עם E ב-Bass. Am/C = Am עם C ב-Bass.","דוגמה פרקטית: C → C/B → Am → Am/G. ה-Bass יורד כרומטית: C-B-A-G. זה ה-walkdown הקלאסי."],
    quiz: { q: "ב-1st inversion, מה ב-Bass?", opts: ["Root","3rd","5th","7th"], ans: 1 } },

  // ═══ אקורדים דיאטוניים (4 lessons) ═══
  { id: "dc1", title: "טריאדות דיאטוניות", cat: "אקורדים דיאטוניים", desc: "איך תווי הסולם יוצרים אקורדים — I ii iii IV V vi vii°",
    content: ["אקורד דיאטוני = אקורד שבנוי רק מתווים של הסולם.","לוקחים כל מעלה בסולם ובונים טריאד בדילוג: מעלה 1-3-5, מעלה 2-4-6, וכו'.","ב-C Major: C-E-G = C (I), D-F-A = Dm (ii), E-G-B = Em (iii), F-A-C = F (IV), G-B-D = G (V), A-C-E = Am (vi), B-D-F = Bdim (vii°).","התבנית קבועה לכל סולם מז'ורי: Major-minor-minor-Major-Major-minor-diminished.","הרומאים הגדולים (I, IV, V) הם Major. הרומאים הקטנים (ii, iii, vi) הם Minor. vii° הוא Diminished."],
    quiz: { q: "מה סוג האקורד על מעלה vi בסולם Major?", opts: ["Major","Minor","Diminished","Augmented"], ans: 1 } },
  { id: "dc2", title: "ניתוח בספרות רומיות", cat: "אקורדים דיאטוניים", desc: "Roman Numeral Analysis ומערכת Nashville Number",
    content: ["ספרות רומיות מתארות את תפקיד האקורד בטונאליות, לא את השם שלו.","אות גדולה = Major. אות קטנה = Minor. ° = Diminished. + = Augmented.","I = טוניקה (מרכז). IV = סאבדומיננטה. V = דומיננטה (מתח). vi = relative minor.","Nashville Number System: אותו רעיון, אבל עם מספרים רגילים: 1-4-5 במקום I-IV-V.","היתרון: אפשר לתמלל שיר פעם אחת ולנגן אותו בכל טונאליות. 1-5-6m-4 = I-V-vi-IV.","דוגמה: \"הוד השיר\" = 6m-4-1-5. לא משנה באיזה key אתם מנגנים, הספרות נשארות."],
    quiz: { q: "מה מסמנת ספרה רומית קטנה (ii)?", opts: ["Major","Minor","Diminished","Dominant"], ans: 1 } },
  { id: "dc3", title: "אקורדי שביעית דיאטוניים", cat: "אקורדים דיאטוניים", desc: "Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7",
    content: ["אם ממשיכים את הדילוג למעלה 7 (1-3-5-7), מקבלים אקורדי שביעית דיאטוניים.","ב-C Major: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5 (Bø7).","התבנית: Maj7 - m7 - m7 - Maj7 - dom7 - m7 - m7b5 (half-diminished).","שימו לב: רק V הוא dom7! זה מה שנותן לו את המתח המיוחד (יש לו tritone בפנים).","בג'אז, כמעט תמיד מנגנים אקורדי שביעית במקום טריאדות. זה נותן צליל עשיר יותר."],
    quiz: { q: "איזה אקורד שביעית יושב על מעלה V?", opts: ["Maj7","m7","dom7","m7b5"], ans: 2 } },
  { id: "dc4", title: "הלחנה עם סולמות מינוריים", cat: "אקורדים דיאטוניים", desc: "Natural vs Harmonic Minor בפרוגרסיות",
    content: ["ב-Natural Minor, האקורדים הדיאטוניים הם: i-ii°-III-iv-v-VI-VII.","הבעיה: אקורד v הוא Minor, ולכן אין מתח דומיננטי חזק (אין leading tone).","הפתרון: Harmonic Minor מעלה את מעלה 7, מה שהופך את v ל-V (Major!). עכשיו V→i נשמע חזק.","ב-A Minor: Am-Bdim-C-Dm-Em-F-G (Natural). Am-Bdim-C+-Dm-E-F-G#dim (Harmonic).","בפועל, מטאל וקלאסיקה משלבים בין שניהם באותו שיר: VI-VII-i (Natural) → V-i (Harmonic).","דוגמה קלאסית מטאלית: Am-F-G-Am (Natural Minor), ואז E-Am בסיום (Harmonic Minor)."],
    quiz: { q: "למה משתמשים ב-Harmonic Minor בפרוגרסיות?", opts: ["כי הוא נשמע יפה","כדי לקבל V Major במקום v minor","כי יש בו פחות תווים","כדי להימנע מ-tritone"], ans: 1 } },

  // ═══ פרוגרסיות (5 lessons) ═══
  { id: "p1", title: "I - IV - V", cat: "פרוגרסיות", desc: "הפרוגרסיה הבסיסית ביותר — רוק, בלוז, קאנטרי",
    content: ["I-IV-V = 3 האקורדים הראשיים של כל טונאליות Major.","ב-C Major: C-F-G. ב-A Major: A-D-E. ב-G Major: G-C-D.","זו הפרוגרסיה של 90% משירי הרוק, הבלוז והקאנטרי בהיסטוריה."],
    audioDemo: { type: "chord", data: [0,4,7] },
    quiz: { q: "מה האקורדים של I-IV-V ב-G Major?", opts: ["G-C-D","G-B-D","G-A-B","G-D-E"], ans: 0 } },
  { id: "p2", title: "ii - V - I", cat: "פרוגרסיות", desc: "הפרוגרסיה הנפוצה ביותר בג'אז",
    content: ["ii-V-I = הפרוגרסיה הקלאסית של ג'אז. ii = minor, V = dominant, I = major.","ב-C Major: Dm7-G7-Cmaj7. נותנת תחושה של \"הביתה\".","כל ג'אז סטנדרט מבוסס על ii-V-I. לימוד הפרוגרסיה הזו = הבנת ג'אז."] },
  { id: "p3", title: "I - V - vi - IV", cat: "פרוגרסיות", desc: "פרוגרסיית הפופ — Axis of Awesome",
    content: ["I-V-vi-IV = הפרוגרסיה של מאות שירי פופ מצליחים.","ב-C: C-G-Am-F. ב-G: G-D-Em-C.","דוגמאות: Let It Be, No Woman No Cry, Someone Like You, With or Without You."] },
  { id: "p4", title: "משפטים וקדנצות", cat: "פרוגרסיות", desc: "Authentic, Plagal, Half, Deceptive — איך לסיים פרזה",
    content: ["קדנצה (cadence) = הסיום של פרזה מוזיקלית. כמו נקודה בסוף משפט.","Authentic Cadence: V → I. הסיום הכי חזק ומשכנע. \"הגענו הביתה\". דוגמה: G → C.","Plagal Cadence: IV → I. הסיום ה\"אמן\" מהכנסייה. רך יותר. דוגמה: F → C.","Half Cadence: X → V. סיום על מתח — \"יש המשך\". הפרזה לא באמת נגמרה.","Deceptive Cadence: V → vi. במקום לחזור הביתה (I), הולכים ל-vi. הפתעה! G → Am במקום G → C.","במטאל: Power chord cadences. E5-F5-E5 = Phrygian half cadence. אופייני ל-thrash ו-death metal."],
    quiz: { q: "מהי Authentic Cadence?", opts: ["IV → I","V → I","I → V","V → vi"], ans: 1 } },
  { id: "p5", title: "פרוגרסיות מעגל", cat: "פרוגרסיות", desc: "Circle Progressions — תנועה בחמישיות",
    content: ["Circle Progression = כל אקורד הוא P5 (או P4) מהקודם. תנועת שורשים במעגל החמישיות.","הדוגמה הקלאסית: iii → vi → ii → V → I. ב-C: Em-Am-Dm-G-C. כל שורש יורד P5.","Autumn Leaves, Fly Me to the Moon — מבוססים על circle progression.","למה זה עובד? תנועה של P5 למטה (= P4 למעלה) נשמעת הכי \"טבעית\" לאוזן.","Circle of fifths progressions נפוצות גם ברוק: The Beatles, Led Zeppelin.","יישום במטאל: i → iv → VII → III → VI → ii° → V → i. מינורי circle progression מלא."],
    quiz: { q: "בcircle progression, מה המרחק בין שורשי אקורדים עוקבים?", opts: ["M2","m3","P4/P5","Tritone"], ans: 2 } },

  // ═══ מתקדם (5 lessons) ═══
  { id: "a1", title: "CAGED System", cat: "מתקדם", desc: "5 צורות לכל הצוואר",
    content: ["CAGED = 5 צורות פתוחות (C-A-G-E-D) שמכסות את כל צוואר הגיטרה.","כל צורה מתחברת לזו שאחריה. Together הן מכסות את כל הפרטים.","ללמוד CAGED = לראות את אותו אקורד/סולם ב-5 מקומות שונים."] },
  { id: "a2", title: "Modes בפועל", cat: "מתקדם", desc: "איך לשמוע ולהשתמש במודים",
    content: ["הטריק: אל תחשבו על מודים כ\"סולם שמתחיל ממקום אחר\".","חשבו על הצבע: Dorian = minor + major 6th. Mixolydian = major + minor 7th.","להתאמן: נגנו drone note (שורש) וסולם מעליו. שימו לב לצליל המיוחד של כל מוד."] },
  { id: "a3", title: "Chord Melody", cat: "מתקדם", desc: "מלודיה + הרמוניה — סולו גיטרה מלא",
    content: ["Chord Melody = שילוב אקורדים עם קו מלודי. כל תו מלודי הוא חלק מאקורד.","הגישה: קחו מלודיה פשוטה, הרמוניזו כל תו עם אקורד מתאים.","זו טכניקה מתקדמת שמשלבת ידע תיאורטי עם שליטה טכנית בגיטרה."] },
  { id: "a4", title: "Chord Voicings", cat: "מתקדם", desc: "Open vs Closed, Drop-2, Drop-3 — על הגיטרה",
    content: ["Voicing = הסידור הספציפי של תווי האקורד (אילו אוקטבות, איזה סדר).","Close voicing: כל התווים צמודים ככל האפשר. צליל צפוף ו\"שמן\".","Open voicing: התווים מפוזרים על פני אוקטבות. צליל פתוח ומרווח.","Drop-2: לוקחים את התו השני מלמעלה ב-close voicing ומורידים אוקטבה. הvoicing הנפוץ ביותר בגיטרת ג'אז!","Drop-3: אותו רעיון, התו השלישי מלמעלה יורד אוקטבה. יוצר voicings רחבים.","על הגיטרה, close voicings קשים לנגינה (מרווחי אצבעות קטנים מדי). Drop-2 ו-Drop-3 מתאימים מצוין."],
    quiz: { q: "מהו Drop-2 voicing?", opts: ["מורידים את ה-Bass אוקטבה","מורידים את התו השני מלמעלה אוקטבה","מורידים שני תווים","מוסיפים תו שני"], ans: 1 } },
  { id: "a5", title: "תווים לא-הרמוניים", cat: "מתקדם", desc: "Passing tones, neighbor tones, suspensions, appoggiaturas",
    content: ["Nonharmonic tones = תווים שלא שייכים לאקורד הנוכחי אבל יוצרים תנועה מלודית.","Passing Tone: תו מעבר בין שני תווים של האקורד. דוגמה: על Cmaj, E-F-G. ה-F הוא passing tone.","Neighbor Tone: תו שיוצא מתו של האקורד וחוזר אליו. E-F-E. ה-F הוא upper neighbor.","Suspension (sus): תו מהאקורד הקודם שנשאר ואז נפתר. 4-3 sus = ה-4 נשאר ואז יורד ל-3.","Appoggiatura: תו לא-הרמוני שנכנס בקפיצה (לא בצעד) ונפתר בצעד. \"הנחיתה\" על תו זר ואז תיקון.","בסולו גיטרה, כל bend, slide-in, hammer-on לתו \"לא נכון\" שנפתר — הוא nonharmonic tone. זה מה שיוצר ביטוי מוזיקלי."],
    quiz: { q: "מהו Passing Tone?", opts: ["תו של האקורד","תו שעובר בין שני תווים הרמוניים","תו שחוזר על עצמו","תו בס"], ans: 1 } },
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
type ToolTab = "scales" | "chords" | "fretboard" | "progressions" | "circle" | "intervals" | "tempo" | "iv-calc" | "piano";
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
                        style={{ width: 20, height: 20, background: isR ? "#D4A843" : "#2a2a2a", color: isR ? "#0A0A0A" : "#ddd", border: isR ? "none" : "1px solid #444" }}>
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
    <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 text-center cursor-pointer hover:border-[#333] transition-all" onClick={onPlay} dir="ltr">
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
              {fingers[s] > 0 && <text x={18 + s * 14.8} y={df * 22 + 4.5} textAnchor="middle" fill="#0A0A0A" fontSize="8" fontWeight="bold">{fingers[s]}</text>}
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
              color: isHl ? "#0a0a0a" : "#555" }}>
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
              color: isHl ? "#0a0a0a" : "#666",
              border: isHl ? "1px solid #f59e0b" : "1px solid #333" }}>
            {k.label}
          </div>
        );
      })}
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
  const [lessonCat, setLessonCat] = useState<LessonCategory>("יסודות");
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [quizPicked, setQuizPicked] = useState<number | null>(null);

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
  const LESSON_CATS: LessonCategory[] = ["יסודות","קצב","סקאלות","אינטרוולים","אקורדים","אקורדים דיאטוניים","פרוגרסיות","מתקדם"];

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
    <div dir="rtl">
      {/* ── Header ── */}
      <div className="panel p-5 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-heading text-xl font-bold text-[#D4A843]">מרכז למידה</div>
            <div className="font-label text-[10px] text-[#555] mt-0.5">שיעורים, תרגילים וכלים מוזיקליים</div>
          </div>
          <div className="text-left">
            <div className="font-readout text-2xl font-bold text-[#D4A843]">LV.{ls.level}</div>
            <div className="font-readout text-[10px] text-[#555]">{ls.xp} XP</div>
          </div>
        </div>
        <div className="vu !h-[4px] mt-2"><div className="vu-fill" style={{ width: (ls.xp % 100) + "%" }} /></div>
        <div className="flex justify-between mt-1">
          <span className="font-readout text-[9px] text-[#444]">{100 - ls.xp % 100} XP to next</span>
          <span className="font-readout text-[9px] text-[#444]">Best streak: {ls.bestStreak}</span>
        </div>
      </div>

      {/* ── Main Tabs ── */}
      <div className="flex gap-1 mb-3">
        {([["lessons","שיעורים"],["exercises","תרגילים"],["tools","כלים"]] as [MainTab,string][]).map(([k,lbl]) => (
          <button key={k} onClick={() => setMainTab(k)}
            className={`font-label text-[11px] px-4 py-2 rounded-sm cursor-pointer transition-all flex-1 ${mainTab === k ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{lbl}</button>
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
              className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${lessonCat === cat ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{cat}</button>
          ))}
        </div>

        {!activeLessonObj ? (
          /* Lesson list */
          <div className="space-y-1.5">
            {filteredLessons.map(l => {
              const done = ls.lessonsCompleted.includes(l.id);
              return (
                <div key={l.id} onClick={() => { setOpenLesson(l.id); setQuizPicked(null); }}
                  className={`panel p-4 cursor-pointer hover:border-[#333] transition-all ${done ? "border-[#D4A843]/20" : ""}`}>
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
            <button onClick={() => setOpenLesson(null)} className="btn-ghost !text-[10px] !px-3 mb-3">חזרה לרשימה</button>
            <div className="panel p-5 mb-3">
              <div className="font-heading text-lg font-bold text-[#D4A843] mb-1">{activeLessonObj.title}</div>
              <div className="font-label text-[10px] text-[#555] mb-4">{activeLessonObj.desc}</div>
              {activeLessonObj.content.map((block, i) => (
                <p key={i} className="text-[12px] text-[#bbb] mb-3 leading-relaxed">{block}</p>
              ))}
              {activeLessonObj.audioDemo && (
                <button onClick={() => playLessonAudio(activeLessonObj.audioDemo)} className="btn-gold !text-[10px] mt-2 mb-4">
                  &#9654; השמע דוגמה
                </button>
              )}
              {activeLessonObj.fretboardRoot && activeLessonObj.fretboardNotes && (
                <div className="mt-3 mb-4">
                  <div className="font-label text-[9px] text-[#555] mb-1">Fretboard — {activeLessonObj.fretboardRoot}</div>
                  <LCFretboard highlightNotes={activeLessonObj.fretboardNotes} rootNote={activeLessonObj.fretboardRoot} maxFret={12} />
                </div>
              )}
            </div>

            {/* Quiz */}
            {activeLessonObj.quiz && (
              <div className="panel p-5 mb-3">
                <div className="font-label text-[10px] text-[#D4A843] mb-3">בחן את עצמך</div>
                <div className="text-[12px] text-[#ccc] mb-3">{activeLessonObj.quiz.q}</div>
                <div className="grid grid-cols-2 gap-2">
                  {activeLessonObj.quiz.opts.map((opt, i) => {
                    const isCorrect = i === activeLessonObj.quiz!.ans;
                    const isPicked = quizPicked === i;
                    return (
                      <button key={i} onClick={() => setQuizPicked(i)}
                        className="py-2.5 px-3 rounded-sm text-[11px] border cursor-pointer transition-all"
                        style={quizPicked !== null
                          ? (isCorrect ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
                            : isPicked ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                            : { background: "#141414", borderColor: "#222", color: "#666" })
                          : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizPicked !== null && quizPicked === activeLessonObj.quiz.ans && (
                  <div className="text-[11px] text-[#22c55e] mt-2 text-center">נכון!</div>
                )}
                {quizPicked !== null && quizPicked !== activeLessonObj.quiz.ans && (
                  <div className="text-[11px] text-[#C41E3A] mt-2 text-center">לא נכון — נסו שוב</div>
                )}
              </div>
            )}

            {/* Complete button */}
            {!ls.lessonsCompleted.includes(activeLessonObj.id) ? (
              <button onClick={() => completeLesson(activeLessonObj.id)} className="btn-gold w-full justify-center !py-3">
                סיום שיעור (+50 XP)
              </button>
            ) : (
              <div className="text-center font-label text-[11px] text-[#D4A843] py-3">שיעור הושלם ✓</div>
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
              className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${exMode === m ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{lbl}</button>
          ))}
        </div>

        {/* Sub tabs */}
        {hasSubTabs && (
          <div className="flex gap-1 mb-3">
            {([["exercise","Exercise"],["achievements","Achievements"],["reference","Reference"]] as [SubTab,string][]).map(([t,lbl]) => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border flex-1 transition-all ${subTab === t ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{lbl}</button>
            ))}
          </div>
        )}

        {/* ── Construction Mode (expanded with sub-modes) ── */}
        {isConstructionMode && (
          <div>
            <div className="panel p-4 mb-3">
              <div className="font-label text-[10px] text-[#D4A843] mb-3">בנייה — בחר מצב</div>
              <div className="flex gap-1 mb-4">
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
                      className={`font-readout text-[10px] w-8 h-7 rounded-sm cursor-pointer border flex items-center justify-center ${conRoot === n ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
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
                בחרו: {conSelected.size > 0 ? [...conSelected].join(", ") : "—"}
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
                    if (selected && inScale) { bg = "#22c55e"; col = "#0A0A0A"; brd = "#22c55e"; }
                    else if (selected && !inScale) { bg = "#C41E3A"; col = "#fff"; brd = "#C41E3A"; }
                    else if (!selected && inScale) { bg = "#1a1a1a"; col = "#D4A843"; brd = "#D4A843"; }
                  } else if (selected) { bg = "#D4A843"; col = "#0A0A0A"; brd = "#D4A843"; }
                  return (
                    <button key={n} onClick={() => { if (conRevealed) return; const ns = new Set(conSelected); if (ns.has(n)) ns.delete(n); else ns.add(n); setConSelected(ns); }}
                      className="w-10 h-10 rounded-sm flex items-center justify-center font-readout text-sm cursor-pointer transition-all border"
                      style={{ background: bg, color: col, borderColor: brd }}>{n}</button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={checkConstruction} className="btn-gold !text-[10px]" disabled={conRevealed}>בדוק</button>
                <button onClick={() => { setConSelected(new Set()); setConRevealed(false); }} className="btn-ghost !text-[10px]">נקה</button>
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
                }} className="btn-ghost !text-[10px]">הצג תשובה</button>
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
                      ? <div className="font-heading text-lg text-[#22c55e]">נכון! +{conSubMode === "scale" ? 25 : conSubMode === "interval" ? 15 : 20} XP</div>
                      : <div className="font-heading text-lg text-[#C41E3A]">לא מדויק — התווים הנכונים מסומנים</div>
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

            <div className="panel p-4 mb-3">
              <div className="flex justify-between items-center mb-4">
                <div className="font-label text-[10px] text-[#555]">
                  {exMode === "fb-intervals" ? "מה האינטרוול בין שתי הנקודות?" :
                   exMode === "fb-scales" ? "מהו הסולם המסומן?" :
                   "מהו סוג האקורד?"}
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
                        style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
                <div className="font-label text-[10px] text-[#555] mb-2">זהה את התו שנשמע</div>
              </div>
              <div className="flex justify-center gap-3 mb-6">
                <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                  <span className="text-[#0A0A0A] text-xl font-bold ml-0.5">&#9654;</span>
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
                        style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
                  <span className="text-[#0A0A0A] text-xl font-bold ml-0.5">&#9654;</span>
                </button>
                {ivConRoot && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                  style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
              </div>

              {!ivConRoot && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}

              {ivConRoot && ivConInterval && (
                <div className="text-center mb-4">
                  <div className="font-heading text-2xl text-[#D4A843]">Build {ivConInterval} from {ivConRoot}</div>
                  <div className="text-[11px] text-[#555] mt-1">בחר את התו שנמצא {ivConInterval} מעל {ivConRoot}</div>
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
                        style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
                  <span className="text-[#0A0A0A] text-xl font-bold ml-0.5">&#9654;</span>
                </button>
                {chConRoot && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                  style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
              </div>

              {!chConRoot && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}

              {chConRoot && chConType && (
                <div className="text-center mb-4">
                  <div className="font-heading text-2xl text-[#D4A843]">Build: {chConRoot} {chConType}</div>
                  <div className="text-[11px] text-[#555] mt-1">בחר את כל התווים של האקורד</div>
                  <div className="text-[10px] text-[#666] mt-1">
                    בחרת: {chConSelected.size > 0 ? [...chConSelected].join(", ") : "—"}
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
                        if (selected && inChord) { bg = "#22c55e"; col = "#0A0A0A"; brd = "#22c55e"; }
                        else if (selected && !inChord) { bg = "#C41E3A"; col = "#fff"; brd = "#C41E3A"; }
                        else if (!selected && inChord) { bg = "#1a1a1a"; col = "#D4A843"; brd = "#D4A843"; }
                      } else if (selected) { bg = "#D4A843"; col = "#0A0A0A"; brd = "#D4A843"; }
                      return (
                        <button key={n} onClick={() => { if (chConRevealed) return; const ns = new Set(chConSelected); if (ns.has(n)) ns.delete(n); else ns.add(n); setChConSelected(ns); }}
                          className="w-10 h-10 rounded-sm flex items-center justify-center font-readout text-sm cursor-pointer transition-all border"
                          style={{ background: bg, color: col, borderColor: brd }}>{n}</button>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-2">
                    <button onClick={checkChordConstruction} className="btn-gold !text-[10px]" disabled={chConRevealed || chConSelected.size === 0}>בדוק</button>
                    <button onClick={() => { setChConSelected(new Set()); setChConRevealed(false); }} className="btn-ghost !text-[10px]">נקה</button>
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
                <span className="text-[#0A0A0A] text-xl font-bold ml-0.5">&#9654;</span>
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
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
                      style={isCor ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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
            <div className="panel p-4 mb-3">
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
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${autoAdvance ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{autoAdvance ? "✓" : ""}</div>
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
                <span className="text-[#0A0A0A] text-xl font-bold ml-0.5">&#9654;</span>
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
                      style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
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

          <div className="panel p-4 mb-3">
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
          <div className="panel p-5">
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
          <div className="panel p-4">
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
          {([["scales","Scales"],["chords","Chords"],["fretboard","Fretboard"],["progressions","Progressions"],["circle","Circle of 5ths"],["intervals","Intervals"],["tempo","Tempo Tap"],["iv-calc","IV Calc"],["piano","Piano"]] as [ToolTab,string][]).map(([t,lbl]) => (
            <button key={t} onClick={() => setToolTab(t)}
              className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${toolTab === t ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{lbl}</button>
          ))}
        </div>

        {/* Root selector (not for tempo tapper) */}
        {toolTab !== "tempo" && toolTab !== "piano" && (
          <div className="panel p-3 mb-3">
            <div className="font-label text-[9px] text-[#555] mb-1.5">Root Note</div>
            <div className="flex gap-1 flex-wrap">
              {NOTES.map(n => (
                <button key={n} onClick={() => setRoot(n)}
                  className={`font-readout text-[11px] w-9 h-8 rounded-sm cursor-pointer border flex items-center justify-center transition-all ${root === n ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
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
          <div className="panel p-5 mb-3">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-heading text-lg font-bold text-[#D4A843]">{root} {selScale}</div>
                <div className="text-[11px] text-[#666] italic">{scInfo.desc}</div>
                <div className="font-readout text-sm text-[#aaa] mt-1">{scNotes.join(" — ")}</div>
              </div>
              <button onClick={() => scInfo.formula.forEach((s, i) => playNote(57 + ri + s, i * 0.18))} className="btn-gold">Play</button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3" onClick={() => setShowIv(!showIv)}>
              <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${showIv ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{showIv ? "✓" : ""}</div>
              <span className="font-label text-[10px] text-[#666]">Show intervals</span>
            </label>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {scInfo.formula.map((s, i) => (
                <div key={i} className="text-center cursor-pointer hover:scale-105 transition-all" onClick={() => playNote(57 + ri + s)}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: s === 0 ? "#D4A843" : "#1a1a1a", color: s === 0 ? "#0A0A0A" : "#ccc", border: `1px solid ${s === 0 ? "#D4A843" : "#333"}` }}>
                    {scNotes[i]}
                  </div>
                  <div className="font-readout text-[8px] text-[#555] mt-0.5">{IV_NAMES[s]}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-4">
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
          <div className="panel p-5">
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
          <div className="panel p-4">
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
          <div className="panel p-5 mb-3">
            <div className="font-label text-[11px] text-[#D4A843] mb-3">Chord Progression Builder</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {progChords.map((ch, i) => (
                <div key={i} className="bg-[#0A0A0A] border border-[#222] rounded-sm px-3 py-2 cursor-pointer hover:border-[#444] transition-all"
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
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${progLoop ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{progLoop ? "✓" : ""}</div>
                <span className="font-label text-[10px] text-[#666]">Loop</span>
              </label>
            </div>
          </div>
          <div className="panel p-5">
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
          <div className="panel p-5 mb-3">
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
                      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={sel ? "#0A0A0A" : "#ccc"} fontSize={sel ? "11" : "10"} fontWeight="bold" fontFamily="monospace">{k}</text>
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
          <div className="panel p-5">
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
                <div key={i.n} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-2.5 cursor-pointer hover:border-[#333] transition-all"
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
          <div className="panel p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-4">Tempo Tapper</div>
            <div className="text-center mb-4">
              <div className="text-[11px] text-[#666] mb-3">הקש על הכפתור בקצב שאתה רוצה למדוד</div>
              <button onClick={handleTap}
                className="w-32 h-32 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center mx-auto"
                style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "3px solid #DFBD69", boxShadow: "0 6px 24px rgba(212,168,67,0.3)" }}>
                <span className="text-[#0A0A0A] text-2xl font-bold">TAP</span>
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
          <div className="panel p-5">
            <div className="font-label text-[11px] text-[#D4A843] mb-4">Interval Calculator</div>
            <div className="text-[11px] text-[#666] mb-3">בחר תו התחלה ואינטרוול — רואה ושומע את התוצאה</div>

            <div className="mb-3">
              <div className="font-label text-[9px] text-[#555] mb-1">Starting Note</div>
              <div className="flex gap-1 flex-wrap">
                {NOTES.map(n => (
                  <button key={n} onClick={() => setCalcNote(n)}
                    className={`font-readout text-[11px] w-9 h-8 rounded-sm cursor-pointer border flex items-center justify-center ${calcNote === n ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
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
        {toolTab === "piano" && (<div>
          <div className="panel p-5 mb-3">
            <div className="font-heading text-lg font-bold text-[#D4A843] mb-3">Piano</div>
            <div className="text-[11px] text-[#555] mb-4">לחצו על מקשים כדי לנגן. בחרו שורש + סקאלה להדגשה.</div>

            {/* Root + Scale selectors */}
            <div className="mb-3">
              <div className="font-label text-[9px] text-[#555] mb-1">Root</div>
              <div className="flex gap-1 flex-wrap">
                {NOTES.map(n => (
                  <button key={n} onClick={() => { setPianoRoot(n); }}
                    className={`font-readout text-[10px] w-8 h-7 rounded-sm cursor-pointer border flex items-center justify-center ${pianoRoot === n ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
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
