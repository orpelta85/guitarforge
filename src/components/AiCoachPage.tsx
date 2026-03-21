"use client";
import { useState, useEffect, useRef } from "react";
import { EXERCISES } from "@/lib/exercises";
import { CATS, COL } from "@/lib/constants";
import { SONG_LIBRARY } from "@/lib/songs-data";
import type { SongEntry } from "@/lib/types";
import { buildStyle, recordUsage, saveToLibrary } from "@/lib/suno";
import type { LibraryTrack } from "@/lib/suno";
import DarkAudioPlayer from "./DarkAudioPlayer";

// ── Types ──

interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  actions?: MessageAction[];
}

interface MessageAction {
  label: string;
  type: "apply-plan" | "add-song" | "quick-action";
  data?: unknown;
}

interface UserProfile {
  name: string; instrument: string; level: string; yearsPlaying: number;
  genres: string[]; goals: string; practiceHoursPerDay: number;
  favoriteArtists: string; equipment: string;
}

// ── Context builder ──

function getCoachContext(): string {
  const parts: string[] = [];

  try {
    const raw = localStorage.getItem("gf-profile");
    if (raw) {
      const p: UserProfile = JSON.parse(raw);
      parts.push(`Player: ${p.name || "Unknown"}, ${p.level}, ${p.yearsPlaying}y exp, ${p.practiceHoursPerDay}h/day.`);
      parts.push(`Genres: ${p.genres.join(", ")}. Goals: ${p.goals || "none set"}.`);
      if (p.favoriteArtists) parts.push(`Fav artists: ${p.favoriteArtists}.`);
      if (p.equipment) parts.push(`Gear: ${p.equipment}.`);
    }
  } catch {}

  try {
    const raw = localStorage.getItem("gf30");
    if (raw) {
      const d = JSON.parse(raw);
      const doneKeys = Object.keys(d.doneMap || {}).filter(k => d.doneMap[k]);
      const cats = [...new Set(doneKeys.map(k => {
        const id = parseInt(k.split("-")[1]);
        const ex = EXERCISES.find(e => e.id === id);
        return ex?.c || "Unknown";
      }))];
      parts.push(`Week ${d.week || 1}. Mode: ${d.mode || "Aeolian"}, Scale: ${d.scale || "Am"}, Style: ${d.style || "Metal"}.`);
      parts.push(`Exercises done this week: ${doneKeys.length}. Categories: ${cats.join(", ") || "none"}.`);

      // BPM highlights
      const bpmLog = d.bpmLog || {};
      const bpmEntries = Object.entries(bpmLog).slice(0, 5).map(([k, v]) => {
        const id = parseInt(k.split("-")[1]);
        const ex = EXERCISES.find(e => e.id === id);
        return `${ex?.n || "Ex#" + id}: ${v} BPM`;
      });
      if (bpmEntries.length) parts.push(`BPM log: ${bpmEntries.join(", ")}.`);
    }
  } catch {}

  try {
    const raw = localStorage.getItem("gf-streak");
    if (raw) {
      const s = JSON.parse(raw);
      parts.push(`Streak: ${s.currentStreak || 0}d (longest: ${s.longestStreak || 0}d, total: ${s.totalDays || 0}d).`);
    }
  } catch {}

  try {
    const raw = localStorage.getItem("gf-learn");
    if (raw) {
      const l = JSON.parse(raw);
      if (l.xp) parts.push(`Learning: ${l.xp} XP, level ${l.level || 1}.`);
    }
  } catch {}

  return parts.join(" ") || "No user data available yet. Profile not set up.";
}

// ── Channel settings reader ──

function getChannelSettings(): { scale: string; mode: string; style: string; week: number } {
  try {
    const raw = localStorage.getItem("gf30");
    if (raw) {
      const d = JSON.parse(raw);
      return {
        scale: d.scale || "Am",
        mode: d.mode || "Aeolian",
        style: d.style || "Metal",
        week: d.week || 1,
      };
    }
  } catch {}
  return { scale: "Am", mode: "Aeolian", style: "Metal", week: 1 };
}

// ── Demo response engine ──

function getProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem("gf-profile");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function matchSongs(profile: UserProfile | null, count: number = 6): SongEntry[] {
  if (!profile) return SONG_LIBRARY.slice(0, count);
  const genres = profile.genres.map(g => g.toLowerCase());
  const level = profile.level.toLowerCase();
  let diff: string | null = null;
  if (level.includes("beginner")) diff = "Beginner";
  else if (level.includes("intermediate")) diff = "Intermediate";
  else if (level.includes("advanced") || level.includes("expert")) diff = "Advanced";

  const scored = SONG_LIBRARY.map(s => {
    let score = 0;
    const sg = (s.genre || "").toLowerCase();
    if (genres.some(g => sg.includes(g) || g.includes(sg))) score += 3;
    if (diff && s.difficulty === diff) score += 2;
    if (diff === "Advanced" && s.difficulty === "Intermediate") score += 1;
    if (diff === "Intermediate" && s.difficulty === "Beginner") score += 1;
    score += Math.random() * 0.5;
    return { song: s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.song);
}

function generateRoutine(profile: UserProfile | null): string {
  const hours = profile?.practiceHoursPerDay || 1.5;
  const totalMin = Math.round(hours * 60);
  const level = (profile?.level || "").toLowerCase();
  const genres = profile?.genres || ["Metal"];

  const isAdv = level.includes("advanced") || level.includes("expert");
  const isBeg = level.includes("beginner");

  const warmUps = EXERCISES.filter(e => e.c === "Warm-Up");
  const technique = EXERCISES.filter(e => ["Shred", "Legato", "Picking", "Tapping", "Sweep", "Arpeggios"].includes(e.c));
  const musical = EXERCISES.filter(e => ["Improv", "Phrasing", "Ear Training", "Modes"].includes(e.c));
  const rhythm = EXERCISES.filter(e => ["Rhythm", "Riffs", "Chords"].includes(e.c));
  const creative = EXERCISES.filter(e => ["Composition", "Songs", "Bends", "Dynamics"].includes(e.c));

  const pick = (arr: typeof EXERCISES, n: number) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  const DAYS_HEB = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  let plan = `**תוכנית תרגול שבועית** (${totalMin} דק׳/יום)\n\n`;

  for (let i = 0; i < 7; i++) {
    const dayExercises: string[] = [];
    const wu = pick(warmUps, 1)[0];
    if (wu) dayExercises.push(`- Warm-Up: ${wu.n} (${wu.m} דק׳)`);

    if (i % 2 === 0) {
      const techs = pick(technique, isAdv ? 2 : 1);
      techs.forEach(t => dayExercises.push(`- ${t.c}: ${t.n} (${t.m} דק׳)`));
    } else {
      const mus = pick(musical, isAdv ? 2 : 1);
      mus.forEach(m => dayExercises.push(`- ${m.c}: ${m.n} (${m.m} דק׳)`));
    }

    if (i < 5) {
      const rhy = pick(rhythm, 1)[0];
      if (rhy) dayExercises.push(`- ${rhy.c}: ${rhy.n} (${rhy.m} דק׳)`);
    }

    if (i === 5 || i === 6) {
      const cr = pick(creative, 1)[0];
      if (cr) dayExercises.push(`- ${cr.c}: ${cr.n} (${cr.m} דק׳)`);
    }

    if (!isBeg && i % 3 === 0) {
      dayExercises.push(`- Songs: תרגול שיר מהספרייה (15 דק׳)`);
    }

    plan += `**יום ${DAYS_HEB[i]}:**\n${dayExercises.join("\n")}\n\n`;
  }

  plan += `*התוכנית מותאמת לרמת ${profile?.level || "Intermediate"} ולז׳אנרים ${genres.join(", ")}.*`;
  return plan;
}

function getDemoResponse(input: string): { content: string; actions?: MessageAction[] } {
  const lower = input.toLowerCase();
  const profile = getProfile();
  const name = profile?.name || "גיטריסט";

  // Backing track / jam
  if (/backing|track|jam|play along|תרגול עם/.test(lower)) {
    let currentScale = "Am";
    let currentMode = "Aeolian";
    let currentStyle = "Metal";
    try {
      const raw = localStorage.getItem("gf30");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.scale) currentScale = d.scale;
        if (d.mode) currentMode = d.mode;
        if (d.style) currentStyle = d.style;
      }
    } catch {}
    const stylePreview = buildStyle(currentScale, currentMode, currentStyle, 120);
    return {
      content: `אני יכול ליצור backing track מותאם להגדרות שלך!\n\n**Current Settings:**\n- Scale: ${currentScale}\n- Mode: ${currentMode}\n- Style: ${currentStyle}\n\n**Style prompt:** ${stylePreview}\n\nלחץ על הכפתור למטה כדי לייצר backing track.`,
      actions: [{ label: "Generate Backing Track", type: "quick-action" as const, data: { scale: currentScale, mode: currentMode, style: currentStyle, bpm: 120 } }],
    };
  }

  // Routine / plan
  if (/routine|plan|schedule|תוכנית|לוח|תרגול יומי/.test(lower)) {
    return {
      content: `${name}, הנה תוכנית תרגול מותאמת אישית:\n\n${generateRoutine(profile)}`,
    };
  }

  // Song recommendations
  if (/song|recommend|שיר|המלצ/.test(lower)) {
    const songs = matchSongs(profile, 6);
    let resp = `הנה המלצות שירים שמתאימות לרמה ולסגנון שלך:\n\n`;
    songs.forEach((s, i) => {
      resp += `**${i + 1}. ${s.title}** — ${s.artist}\n`;
      resp += `   Difficulty: ${s.difficulty || "?"} · Genre: ${s.genre || "?"} · Tuning: ${s.tuning || "Standard"}\n\n`;
    });
    resp += `*רוצה שאמליץ על עוד שירים? ספר לי איזה סגנון בא לך.*`;
    return { content: resp };
  }

  // Progress / stats
  if (/progress|stats|התקדמות|סטטיסטיק/.test(lower)) {
    const ctx = getCoachContext();
    let resp = `הנה סיכום ההתקדמות שלך:\n\n`;

    try {
      const raw = localStorage.getItem("gf-streak");
      if (raw) {
        const s = JSON.parse(raw);
        resp += `**Streak:** ${s.currentStreak || 0} ימים רצופים (שיא: ${s.longestStreak || 0})\n`;
        resp += `**סה״כ ימי תרגול:** ${s.totalDays || 0}\n\n`;
      }
    } catch {}

    try {
      const raw = localStorage.getItem("gf30");
      if (raw) {
        const d = JSON.parse(raw);
        const done = Object.keys(d.doneMap || {}).filter(k => d.doneMap[k]).length;
        resp += `**תרגילים שהושלמו השבוע:** ${done}\n`;
        const bpmEntries = Object.entries(d.bpmLog || {});
        if (bpmEntries.length > 0) {
          resp += `**BPM Log:**\n`;
          bpmEntries.slice(0, 5).forEach(([k, v]) => {
            const id = parseInt(k.split("-")[1]);
            const ex = EXERCISES.find(e => e.id === id);
            resp += `- ${ex?.n || "Exercise"}: ${v} BPM\n`;
          });
        }
      }
    } catch {}

    resp += `\n*המשך להתאמן בעקביות! כל יום שאתה מתרגל הוא צעד קדימה.*`;
    return { content: resp };
  }

  // Theory
  if (/theory|scale|chord|mode|תאוריה|סולם|אקורד/.test(lower)) {
    const tips = [
      `**Minor Pentatonic** הוא הסולם הראשון שכל גיטריסט צריך לשלוט בו. 5 תווים, 5 פוזיציות. בהרבה מקרים זה כל מה שאתה צריך לסולו מעולה.\n\n**טיפ:** תתרגל את הסולם בכל 5 הפוזיציות על פני הצוואר. רוב הגיטריסטים נתקעים בפוזיציה אחת — אל תהיה אחד מהם.\n\nתרגילים רלוונטיים מהספרייה: "Two-Octave Scale Am Pentatonic" ו-"Fretboard Note Names".`,
      `**Modes — מה הם ולמה זה חשוב:**\n\n- **Aeolian** (Natural Minor) — עצוב, Metal, Rock\n- **Dorian** — Minor עם Maj6, Funk, Jazz\n- **Phrygian** — אפלולי, Flamenco, Metal\n- **Mixolydian** — Major עם b7, Blues, Rock\n- **Lydian** — חולמני, Satriani, Film Music\n\nהתחל עם Aeolian ו-Dorian — הם הכי שימושיים ב-Rock/Metal.`,
      `**Circle of Fifths — הכלי הכי חשוב בתאוריה:**\n\nכל טונליות נמצאת ב-circle. זזים ימינה = מוסיפים #, זזים שמאלה = מוסיפים b.\n\n**שימוש מעשי:** אם אתה ב-Am, האקורדים הנפוצים יהיו Am, Dm, Em, C, G, F. ה-Circle מסביר למה.\n\nתסתכל על הכלי Circle of 5ths בעמוד Learning!`,
    ];
    return { content: tips[Math.floor(Math.random() * tips.length)] };
  }

  // Technique
  if (/technique|picking|legato|sweep|tap|shred|טכניק/.test(lower)) {
    const tips = [
      `**Alternate Picking — הטכניקה הבסיסית ביותר:**\n\nDown-Up-Down-Up בלי חריגות. גם כשעוברים מיתר.\n\n**3 כללים:**\n1. תנועה קטנה — ככל שהתנועה קטנה יותר, אתה מהיר יותר\n2. תמיד עם מטרונום\n3. 3 טעויות רצופות = הורד 10 BPM\n\nתרגיל מומלץ: "Alternate Picking Full Pentatonic Speed Build"`,
      `**Legato — הקול הנקי של הגיטרה:**\n\nHammer-ons ו-Pull-offs בווליום שווה. הסוד: Pull-off זה לא רק להרים את האצבע — תמשוך את המיתר קצת הצידה.\n\n**תרגול:** 10 דקות בנייה איטית + 10 דקות זרימה רצופה. כשזה זורם — אתה יודע שזה עובד.\n\nתרגיל: "Basic Legato 2H + 2P Pentatonic"`,
      `**Sweep Picking — טכניקה מתקדמת שנשמעת מדהים:**\n\nהפיק "נופל" על המיתרים בתנועה אחת רציפה. כל אצבע מרימה את המיתר הקודם.\n\n**טיפ קריטי:** אל תנגן sweep כמו strum! כל תו צריך להישמע בנפרד.\n\nהתחל ב-3 מיתרים לפני שעולה ל-5. תרגיל: "3-String Minor Arpeggio Sweep"`,
    ];
    return { content: tips[Math.floor(Math.random() * tips.length)] };
  }

  // Default — general tips
  const defaults = [
    `היי ${name}! יש לי כמה טיפים כלליים:\n\n1. **תמיד התחל עם חימום** — 5-10 דקות של stretching וכרומטיקה\n2. **תנגן עם מטרונום** — בלעדיו אתה רק מתרגל טעויות\n3. **הקלט את עצמך** — זה מפתיע כמה אתה שומע דברים שלא שמת לב אליהם בזמן אמת\n4. **גיוון** — אל תתרגל רק את מה שאתה כבר טוב בו\n\nמה אתה רוצה לעבוד עליו? אני יכול לבנות לך תוכנית, להמליץ על שירים, או לעזור עם תאוריה.`,
    `שלום ${name}! אני כאן לעזור.\n\n**הנה כמה דברים שאני יכול לעשות:**\n- לבנות תוכנית תרגול שבועית מותאמת אישית\n- להמליץ על שירים מהספרייה שמתאימים לרמה שלך\n- לנתח את ההתקדמות שלך ולתת פידבק\n- לעזור עם תאוריה מוזיקלית, סולמות ואקורדים\n- לתת טיפים לטכניקות ספציפיות\n\nפשוט שאל!`,
    `טיפ היום: **The 80/20 Rule for Guitar**\n\n80% מההתקדמות שלך מגיעה מ-20% מהתרגול. מה ה-20% הזה?\n\n1. **תרגול איטי ונקי** — יותר חשוב מלנגן מהר עם טעויות\n2. **זיהוי נקודות חולשה** — תתרגל את מה שקשה, לא את מה שקל\n3. **עקביות** — 30 דקות כל יום עדיף על 4 שעות פעם בשבוע\n\nרוצה שאבנה לך תוכנית שמתמקדת ב-20% הנכונים?`,
  ];
  return { content: defaults[Math.floor(Math.random() * defaults.length)] };
}

// ── Welcome message ──

function getWelcomeMessage(): CoachMessage {
  const profile = getProfile();
  const name = profile?.name || "גיטריסט";
  const ctx = getCoachContext();

  let greeting = `היי ${name}! אני ה-Coach של GuitarForge. `;

  if (profile) {
    greeting += `אני רואה שאתה מנגן ${profile.instrument || "גיטרה"} ברמת ${profile.level}`;
    if (profile.genres.length > 0) greeting += ` עם דגש על ${profile.genres.slice(0, 3).join(", ")}`;
    greeting += ".\n\n";
  } else {
    greeting += "מומלץ למלא את הפרופיל כדי שאוכל לתת המלצות מותאמות אישית.\n\n";
  }

  greeting += "אני יכול לעזור עם תוכניות תרגול, המלצות שירים, טיפים לטכניקה ותאוריה מוזיקלית. מה בא לך?";

  return {
    id: "welcome",
    role: "assistant",
    content: greeting,
    timestamp: Date.now(),
  };
}

// ── Quick actions (2x3 grid) ──

const QUICK_ACTIONS = [
  {
    label: "Suggest exercises for my level",
    query: "Suggest exercises that match my current skill level",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /><line x1="9" y1="8" x2="16" y2="8" /><line x1="9" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  {
    label: "Explain a technique",
    query: "Explain a guitar technique — picking, legato, or sweep",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Build a practice routine",
    query: "Build me a practice routine",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" />
      </svg>
    ),
  },
  {
    label: "What should I practice today?",
    query: "What should I practice today based on my progress?",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: "Generate backing track",
    query: "Generate a backing track for my current settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /><path d="M8 17V5l12-2v12" />
      </svg>
    ),
  },
  {
    label: "Analyze my progress",
    query: "Analyze my progress and stats",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

// ── Markdown-lite renderer ──

function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Bold
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const boldRe = /\*\*(.+?)\*\*/g;
    let match;
    while ((match = boldRe.exec(line)) !== null) {
      if (match.index > lastIdx) parts.push(line.slice(lastIdx, match.index));
      parts.push(<strong key={`b-${i}-${match.index}`} className="text-[#D4A843] font-semibold">{match[1]}</strong>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    if (parts.length === 0) parts.push(line);

    // List items
    if (line.startsWith("- ") || line.startsWith("  - ") || /^\d+\.\s/.test(line.trimStart())) {
      const indent = line.startsWith("  ") ? "mr-4" : "";
      elements.push(<div key={i} className={`${indent} py-0.5`}>{parts}</div>);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      elements.push(<div key={i} className="text-[#555] italic text-[12px] mt-1">{line.slice(1, -1)}</div>);
    } else {
      elements.push(<div key={i}>{parts}</div>);
    }
  }
  return <>{elements}</>;
}

// ── Main Component ──

const HISTORY_KEY = "gf-coach-history";
const MAX_MESSAGES = 50;

export default function AiCoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [coachTrackUrl, setCoachTrackUrl] = useState<string | null>(null);
  const [coachTrackLoading, setCoachTrackLoading] = useState(false);
  const [channelSettings, setChannelSettings] = useState({ scale: "Am", mode: "Aeolian", style: "Metal", week: 1 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  // Load history + API key + channel settings
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setChannelSettings(getChannelSettings());

    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed: CoachMessage[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}

    setMessages([getWelcomeMessage()]);
  }, []);

  // Save history
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const toSave = messages.slice(-MAX_MESSAGES);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
    } catch {}
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Load API key
  useEffect(() => {
    try {
      const key = localStorage.getItem("gf-coach-apikey") || "";
      setApiKey(key);
    } catch {}
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: CoachMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const key = localStorage.getItem("gf-coach-apikey") || "";

    if (key && key.startsWith("sk-")) {
      try {
        const history = [...messages, userMsg].slice(-20).map(m => ({
          role: m.role,
          content: m.content,
        }));
        const context = getCoachContext();

        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), context, history, apiKey: key }),
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        const assistantMsg: CoachMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.content || "Sorry, I couldn't generate a response.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: CoachMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `שגיאה בחיבור ל-API. חוזר למצב Demo.\n\n${getDemoResponse(text).content}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } else {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
      const demo = getDemoResponse(text);
      const assistantMsg: CoachMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: demo.content,
        timestamp: Date.now(),
        actions: demo.actions,
      };
      setMessages(prev => [...prev, assistantMsg]);
    }

    setIsTyping(false);
  }

  function clearChat() {
    const welcome = getWelcomeMessage();
    setMessages([welcome]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleGenerateBacking(actionData: { scale: string; mode: string; style: string; bpm: number }) {
    if (coachTrackLoading) return;
    setCoachTrackLoading(true);
    setCoachTrackUrl(null);

    const genMsg: CoachMessage = {
      id: `a-gen-${Date.now()}`,
      role: "assistant",
      content: `Generating backing track: **${actionData.scale} ${actionData.mode} ${actionData.style}** at ${actionData.bpm} BPM...\n\nThis may take up to 2 minutes.`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, genMsg]);

    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scale: actionData.scale,
          mode: actionData.mode,
          style: actionData.style,
          bpm: actionData.bpm,
          title: `${actionData.scale} ${actionData.mode} ${actionData.style} Backing Track`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `API error ${res.status}`);
      }

      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        const track = data.tracks[0];
        setCoachTrackUrl(track.audioUrl || track.streamAudioUrl);
        recordUsage(10);

        try {
          const libTrack: LibraryTrack = {
            id: track.id || `coach-${Date.now()}`,
            audioBlob: new Blob(),
            audioUrl: track.audioUrl || track.streamAudioUrl,
            title: track.title || `${actionData.scale} ${actionData.mode} Backing`,
            style: actionData.style,
            params: actionData,
            duration: track.duration || 0,
            createdAt: Date.now(),
            source: "generate",
            favorite: false,
          };
          await saveToLibrary(libTrack);
        } catch {}

        const doneMsg: CoachMessage = {
          id: `a-done-${Date.now()}`,
          role: "assistant",
          content: `Backing track ready! **${track.title || "Backing Track"}** (${Math.round((track.duration || 0))}s)\n\nThe track has been saved to your library. Use the player above to jam along!`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, doneMsg]);
      } else {
        throw new Error("No tracks returned — generation may still be processing");
      }
    } catch (err) {
      const errMsg: CoachMessage = {
        id: `a-err-${Date.now()}`,
        role: "assistant",
        content: `Could not generate backing track: ${err instanceof Error ? err.message : "Unknown error"}.\n\nMake sure SUNO_API_KEY is configured in your environment.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setCoachTrackLoading(false);
    }
  }

  const isDemo = !apiKey || !apiKey.startsWith("sk-");
  const showQuickActions = messages.length <= 2 && !isTyping;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)", minHeight: 400 }}>

      {/* ── Coach Header ── */}
      <div className="flex-shrink-0 mb-3">
        <div className="relative overflow-hidden rounded-xl border border-[#1a1a1a] bg-gradient-to-br from-[#141214] via-[#121014] to-[#0e0c10]">
          {/* Subtle glow effect behind the icon */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#D4A843]/5 blur-3xl rounded-full pointer-events-none" />

          <div className="relative px-4 sm:px-6 py-5 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Coach avatar — amp/guitar icon */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 border border-[#D4A843]/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#D4A843]/5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Guitar amp icon */}
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="12" cy="10" r="3" />
                    <line x1="7" y1="16" x2="7.01" y2="16" strokeWidth="2" />
                    <line x1="10" y1="16" x2="10.01" y2="16" strokeWidth="2" />
                    <line x1="14" y1="16" x2="14.01" y2="16" strokeWidth="2" />
                    <line x1="17" y1="16" x2="17.01" y2="16" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#D4A843] tracking-wide">
                    AI Guitar Coach
                  </h1>
                  <p className="text-[13px] text-[#666] mt-0.5">
                    Ask me anything about guitar technique, theory, or practice
                  </p>
                </div>
              </div>
              <button onClick={clearChat}
                className="font-label text-[10px] text-[#555] hover:text-[#999] border border-[#222] hover:border-[#444] px-3 py-1.5 rounded-lg transition-all flex-shrink-0 mt-1">
                Clear Chat
              </button>
            </div>

            {/* Context tags + status */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-label bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 px-2.5 py-1 rounded-md">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                {channelSettings.scale}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-label bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 px-2.5 py-1 rounded-md">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20" /><path d="M12 2v20" /></svg>
                {channelSettings.mode}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-label bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 px-2.5 py-1 rounded-md">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                {channelSettings.style}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-[#555] px-2 py-1">
                Week {channelSettings.week}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-label">
                <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? "bg-[#555]" : "bg-emerald-500"}`} />
                <span className="text-[#555]">{isDemo ? "Demo Mode" : "API Connected"}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Grid (above chat) ── */}
      {showQuickActions && (
        <div className="flex-shrink-0 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(qa => (
              <button key={qa.label} onClick={() => sendMessage(qa.query)}
                className="group flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-[#1a1a1a] bg-[#111013] hover:border-[#D4A843]/40 hover:bg-[#D4A843]/5 transition-all text-left cursor-pointer">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1a1a1e] group-hover:bg-[#D4A843]/15 flex items-center justify-center text-[#666] group-hover:text-[#D4A843] transition-all">
                  {qa.icon}
                </div>
                <span className="text-[12px] sm:text-[13px] text-[#888] group-hover:text-[#ccc] leading-snug transition-colors font-label mt-0.5">
                  {qa.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages area ── */}
      <div ref={scrollRef}
        className="flex-1 overflow-y-auto px-1 sm:px-2 space-y-4 pb-3"
        style={{ scrollBehavior: "smooth" }}>

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] sm:max-w-[78%] ${
              msg.role === "user"
                ? "bg-[#1a1a1e] border border-[#252528] rounded-2xl rounded-br-md"
                : "bg-[#141214] border-l-2 border-[#D4A843]/30 border-t border-r border-b border-t-[#1a1a1a] border-r-[#1a1a1a] border-b-[#1a1a1a] rounded-2xl rounded-bl-md"
            } px-4 py-3`}>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-md bg-[#D4A843]/15 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#D4A843" stroke="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="12" cy="10" r="2.5" fill="#0a0a0a" />
                    </svg>
                  </div>
                  <span className="font-label text-[10px] text-[#D4A843] font-medium">Coach</span>
                </div>
              )}
              <div className={`text-[14px] leading-relaxed ${msg.role === "user" ? "text-[#ccc]" : "text-[#999]"}`}>
                {renderContent(msg.content)}
              </div>
              {/* Action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3" style={{ direction: "ltr" }}>
                  {msg.actions.map((action, ai) => (
                    <button key={ai}
                      onClick={() => {
                        if (action.data && typeof action.data === "object" && "scale" in action.data) {
                          handleGenerateBacking(action.data as { scale: string; mode: string; style: string; bpm: number });
                        }
                      }}
                      disabled={coachTrackLoading}
                      className="font-label text-[11px] text-[#D4A843] border border-[#D4A843]/30 hover:border-[#D4A843]/60 hover:bg-[#D4A843]/10 px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                      {coachTrackLoading ? (
                        <>
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" /></svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>
                          {action.label}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {/* Inline audio player */}
              {coachTrackUrl && msg.id.startsWith("a-done-") && (
                <div className="mt-3" style={{ direction: "ltr" }}>
                  <DarkAudioPlayer src={coachTrackUrl} title="AI Backing Track" compact />
                </div>
              )}
              <div className="font-readout text-[9px] text-[#333] mt-2" style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
                {new Date(msg.timestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator — animated dots */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#141214] border-l-2 border-[#D4A843]/30 border-t border-r border-b border-t-[#1a1a1a] border-r-[#1a1a1a] border-b-[#1a1a1a] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#D4A843]/15 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#D4A843" stroke="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="12" cy="10" r="2.5" fill="#0a0a0a" />
                  </svg>
                </div>
                <div className="flex gap-1.5 items-center h-5">
                  <div className="w-2 h-2 bg-[#D4A843]/60 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "0.8s" }} />
                  <div className="w-2 h-2 bg-[#D4A843]/60 rounded-full animate-bounce" style={{ animationDelay: "150ms", animationDuration: "0.8s" }} />
                  <div className="w-2 h-2 bg-[#D4A843]/60 rounded-full animate-bounce" style={{ animationDelay: "300ms", animationDuration: "0.8s" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input Area ── */}
      <div className="flex-shrink-0 px-2 sm:px-3 py-3 border-t border-[#1a1a1a] bg-[#0c0c0e]">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a question..."
              className="w-full bg-[#111113] border border-[#222] focus:border-[#D4A843]/50 rounded-xl px-4 py-3 text-[14px] text-[#ccc] placeholder-[#444] outline-none transition-all shadow-inner"
              disabled={isTyping}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            title="Send"
            aria-label="Send message"
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              input.trim() && !isTyping
                ? "bg-[#D4A843] hover:bg-[#c49a3a] text-[#121214] shadow-md shadow-[#D4A843]/20"
                : "bg-[#1a1a1a] text-[#333] cursor-not-allowed"
            }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {isDemo && (
          <div className="font-label text-[9px] text-[#444] text-center mt-2">
            Demo Mode — Pre-built responses. Set Claude API Key in Profile for real AI.
          </div>
        )}
      </div>
    </div>
  );
}
