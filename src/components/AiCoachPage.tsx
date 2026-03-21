"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
  actions?: ParsedAction[];
}

interface ParsedAction {
  type: string;
  params: string[];
  label: string;
  executed?: boolean;
}

interface UserProfile {
  name: string; instrument: string; level: string; yearsPlaying: number;
  genres: string[]; goals: string; practiceHoursPerDay: number;
  favoriteArtists: string; equipment: string;
}

interface BYOKSettings {
  provider: "gemini" | "openai" | "anthropic";
  apiKey: string;
}

// ── Rich context builder ──

function getCoachContext(): string {
  const parts: string[] = [];

  // Profile
  try {
    const raw = localStorage.getItem("gf-profile");
    if (raw) {
      const p: UserProfile = JSON.parse(raw);
      parts.push(`Player: ${p.name || "Unknown"}, Level: ${p.level}, ${p.yearsPlaying} years experience, practices ${p.practiceHoursPerDay}h/day.`);
      if (p.genres.length) parts.push(`Preferred genres: ${p.genres.join(", ")}.`);
      if (p.goals) parts.push(`Goals: ${p.goals}.`);
      if (p.favoriteArtists) parts.push(`Favorite artists: ${p.favoriteArtists}.`);
      if (p.equipment) parts.push(`Equipment: ${p.equipment}.`);
    }
  } catch {}

  // Current channel & exercise data
  try {
    const raw = localStorage.getItem("gf30");
    if (raw) {
      const d = JSON.parse(raw);
      parts.push(`\nCurrent channel: Scale=${d.scale || "Am"}, Mode=${d.mode || "Aeolian"}, Style=${d.style || "Metal"}, Week ${d.week || 1}.`);

      // Done exercises this week
      const doneMap = d.doneMap || {};
      const doneKeys = Object.keys(doneMap).filter(k => doneMap[k]);
      const doneExercises = doneKeys.map(k => {
        const id = parseInt(k.split("-")[1]);
        return EXERCISES.find(e => e.id === id);
      }).filter(Boolean);

      // Category completion analysis
      const allCats = [...new Set(EXERCISES.map(e => e.c))];
      const doneCats: Record<string, number> = {};
      const totalCats: Record<string, number> = {};
      allCats.forEach(c => { doneCats[c] = 0; totalCats[c] = 0; });
      EXERCISES.forEach(e => { totalCats[e.c] = (totalCats[e.c] || 0) + 1; });
      doneExercises.forEach(e => { if (e) doneCats[e.c] = (doneCats[e.c] || 0) + 1; });

      // Strengths (>60% done) and weaknesses (<20% done or 0)
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const neglected: string[] = [];
      allCats.forEach(c => {
        const pct = totalCats[c] > 0 ? doneCats[c] / totalCats[c] : 0;
        if (pct > 0.6) strengths.push(`${c} (${Math.round(pct * 100)}%)`);
        else if (pct === 0) neglected.push(c);
        else if (pct < 0.2) weaknesses.push(`${c} (${Math.round(pct * 100)}%)`);
      });

      parts.push(`Exercises completed this week: ${doneKeys.length} out of ${EXERCISES.length}.`);
      if (doneExercises.length) {
        const names = doneExercises.slice(0, 8).map(e => e!.n);
        parts.push(`Recently completed: ${names.join(", ")}.`);
      }
      if (strengths.length) parts.push(`Strong categories: ${strengths.join(", ")}.`);
      if (weaknesses.length) parts.push(`Weak categories: ${weaknesses.join(", ")}.`);
      if (neglected.length) parts.push(`NOT practiced at all: ${neglected.join(", ")}.`);

      // BPM log with progression
      const bpmLog = d.bpmLog || {};
      const bpmEntries = Object.entries(bpmLog);
      if (bpmEntries.length) {
        const bpmLines = bpmEntries.slice(0, 10).map(([k, v]) => {
          const id = parseInt(k.split("-")[1]);
          const ex = EXERCISES.find(e => e.id === id);
          return `${ex?.n || "Ex#" + id}: ${v} BPM (target: ${ex?.b || "?"})`;
        });
        parts.push(`\nBPM log:\n${bpmLines.join("\n")}`);
      }

      // Notes
      const noteLog = d.noteLog || {};
      const noteEntries = Object.entries(noteLog).filter(([, v]) => v);
      if (noteEntries.length) {
        const noteLines = noteEntries.slice(0, 5).map(([k, v]) => {
          const id = parseInt(k.split("-")[1]);
          const ex = EXERCISES.find(e => e.id === id);
          return `${ex?.n || "Ex#" + id}: "${v}"`;
        });
        parts.push(`\nUser notes on exercises:\n${noteLines.join("\n")}`);
      }
    }
  } catch {}

  // Streak data
  try {
    const raw = localStorage.getItem("gf-streak");
    if (raw) {
      const s = JSON.parse(raw);
      parts.push(`\nStreak: ${s.currentStreak || 0} consecutive days (longest ever: ${s.longestStreak || 0}, total practice days: ${s.totalDays || 0}).`);
      if (s.lastDate) parts.push(`Last practice: ${s.lastDate}.`);
    }
  } catch {}

  // Learning progress
  try {
    const raw = localStorage.getItem("gf-learn");
    if (raw) {
      const l = JSON.parse(raw);
      if (l.xp) parts.push(`Learning progress: ${l.xp} XP, level ${l.level || 1}.`);
      if (l.completedLessons && l.completedLessons.length) {
        parts.push(`Completed lessons: ${l.completedLessons.length}.`);
      }
    }
  } catch {}

  // Song library stats
  try {
    const songProgress = JSON.parse(localStorage.getItem("gf-song-progress") || "{}");
    const songsDone = Object.values(songProgress).filter((v: unknown) => (v as { done?: boolean })?.done).length;
    if (songsDone > 0 || SONG_LIBRARY.length > 0) {
      parts.push(`\nSong library: ${SONG_LIBRARY.length} songs available, ${songsDone} completed.`);
    }
  } catch {}

  // Available exercises summary
  const catCounts = EXERCISES.reduce((acc, e) => {
    acc[e.c] = (acc[e.c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  parts.push(`\nAvailable exercise categories: ${Object.entries(catCounts).map(([c, n]) => `${c}(${n})`).join(", ")}.`);

  return parts.join("\n") || "No user data available yet. Profile not set up.";
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

function getProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem("gf-profile");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getBYOKSettings(): BYOKSettings | null {
  try {
    const raw = localStorage.getItem("gf-byok");
    if (raw) {
      const s = JSON.parse(raw);
      if (s.apiKey && s.provider) return s;
    }
  } catch {}
  return null;
}

// ── Welcome message ──

function getWelcomeMessage(): CoachMessage {
  const profile = getProfile();
  const name = profile?.name || "guitarist";

  let greeting = `Hey ${name}! I'm your GuitarForge AI Coach. `;

  if (profile) {
    greeting += `I see you play ${profile.instrument || "guitar"} at the ${profile.level} level`;
    if (profile.genres.length > 0) greeting += `, focusing on ${profile.genres.slice(0, 3).join(", ")}`;
    greeting += ".\n\n";
  } else {
    greeting += "Set up your profile so I can give you personalized recommendations.\n\n";
  }

  greeting += "I can help with practice plans, exercise suggestions, technique tips, theory, and more. What would you like to work on?";

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
    label: "Suggest exercises for my weak areas",
    query: "Analyze my practice data and suggest exercises for my weakest categories. Be specific about which exercises I should do and why.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /><line x1="9" y1="8" x2="16" y2="8" /><line x1="9" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  {
    label: "Explain a technique",
    query: "Pick a guitar technique I should improve based on my practice data, and explain it in detail with practice tips.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Build a practice routine",
    query: "Build me a complete weekly practice routine based on my level, goals, and what I've been practicing. Include specific exercises with durations and BPM targets for each day.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" />
      </svg>
    ),
  },
  {
    label: "What should I practice today?",
    query: "Based on my practice history, streak, and weak areas — what exactly should I practice today? Give me a focused session plan with specific exercises and times.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: "Generate backing track",
    query: "I want a backing track to jam with. Suggest the best settings for my current practice focus and generate one.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /><path d="M8 17V5l12-2v12" />
      </svg>
    ),
  },
  {
    label: "Analyze my progress",
    query: "Give me a detailed analysis of my practice progress: strengths, weaknesses, BPM trends, category coverage, and what I should focus on next.",
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
    const line = lines[i];

    // Bold + inline code
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

// ── Action label generator ──

function actionToLabel(action: { type: string; params: string[] }): string {
  switch (action.type) {
    case "navigate":
      const viewNames: Record<string, string> = {
        practice: "Go to Practice", daily: "Go to Practice",
        learn: "Go to Learning", studio: "Go to Studio",
        songs: "Go to Songs", lib: "Go to Library",
        coach: "Go to Coach", profile: "Go to Profile",
      };
      return viewNames[action.params[0]] || `Navigate to ${action.params[0]}`;
    case "suggest_exercises":
      return `Show ${action.params[0] || ""} exercises`;
    case "generate_backing":
      return `Generate ${action.params.join(" ")} backing track`;
    default:
      return action.type;
  }
}

// ── Main Component ──

const HISTORY_KEY = "gf-coach-history";
const MAX_MESSAGES = 50;

interface AiCoachPageProps {
  onNavigate?: (view: string) => void;
}

export default function AiCoachPage({ onNavigate }: AiCoachPageProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [coachTrackUrl, setCoachTrackUrl] = useState<string | null>(null);
  const [coachTrackLoading, setCoachTrackLoading] = useState(false);
  const [channelSettings, setChannelSettings] = useState({ scale: "Am", mode: "Aeolian", style: "Metal", week: 1 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  // Load history + channel settings
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

  // ── Send message to AI ──
  const sendMessage = useCallback(async (text: string) => {
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
    setErrorMsg(null);

    try {
      const history = [...messages, userMsg].slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      }));
      const context = getCoachContext();
      const byok = getBYOKSettings();

      const reqBody: Record<string, unknown> = {
        message: text.trim(),
        context,
        history,
      };

      // Add BYOK if configured
      if (byok) {
        reqBody.provider = byok.provider;
        reqBody.byokKey = byok.apiKey;
      }

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `API error: ${res.status}`);
      }

      const data = await res.json();

      // Parse actions from API response
      const parsedActions: ParsedAction[] = (data.actions || []).map((a: { type: string; params: string[] }) => ({
        type: a.type,
        params: a.params,
        label: actionToLabel(a),
      }));

      const assistantMsg: CoachMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.content || "I couldn't generate a response. Please try again.",
        timestamp: Date.now(),
        actions: parsedActions.length > 0 ? parsedActions : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(errText);
      const errorMsgObj: CoachMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${errText}\n\nPlease try again. If this persists, check AI settings in your Profile.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsgObj]);
    }

    setIsTyping(false);
  }, [messages]);

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

  // ── Execute action from coach response ──
  function executeAction(action: ParsedAction, msgId: string) {
    switch (action.type) {
      case "navigate": {
        const viewMap: Record<string, string> = {
          practice: "daily", daily: "daily",
          learn: "learn", learning: "learn",
          studio: "studio", songs: "songs",
          library: "lib", lib: "lib",
          profile: "profile",
        };
        const target = viewMap[action.params[0]] || action.params[0];
        if (onNavigate) {
          onNavigate(target);
        } else {
          window.location.hash = `#${target}`;
        }
        break;
      }
      case "suggest_exercises": {
        const category = action.params[0] || "";
        if (onNavigate) {
          onNavigate("daily");
        } else {
          window.location.hash = "#daily";
        }
        // Store the suggestion for the practice page to pick up
        try {
          localStorage.setItem("gf-coach-suggestion", JSON.stringify({
            type: "filter_category",
            category,
            timestamp: Date.now(),
          }));
        } catch {}
        break;
      }
      case "generate_backing": {
        const [style, key, bpm] = action.params;
        handleGenerateBacking({
          style: style || channelSettings.style,
          scale: key || channelSettings.scale,
          mode: channelSettings.mode,
          bpm: parseInt(bpm) || 120,
        });
        break;
      }
    }

    // Mark action as executed
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.actions) {
        return {
          ...m,
          actions: m.actions.map(a =>
            a === action ? { ...a, executed: true } : a
          ),
        };
      }
      return m;
    }));
  }

  // ── Generate backing track ──
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
        const audioUrl = track.audioUrl || track.streamAudioUrl;
        setCoachTrackUrl(audioUrl);
        recordUsage(10);

        // Download actual audio blob (fix empty blob bug)
        try {
          let audioBlob = new Blob();
          if (audioUrl) {
            try {
              const audioRes = await fetch(audioUrl);
              if (audioRes.ok) audioBlob = await audioRes.blob();
            } catch {}
          }

          const libTrack: LibraryTrack = {
            id: track.id || `coach-${Date.now()}`,
            audioBlob,
            audioUrl,
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
          content: `Backing track ready! **${track.title || "Backing Track"}** (${Math.round((track.duration || 0))}s)\n\nSaved to your library. Use the player below to jam along!`,
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
        content: `Could not generate backing track: ${err instanceof Error ? err.message : "Unknown error"}.\n\nMake sure SUNO_API_KEY is configured.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setCoachTrackLoading(false);
    }
  }

  const showQuickActions = messages.length <= 2 && !isTyping;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)", minHeight: 400 }}>

      {/* ── Coach Header ── */}
      <div className="flex-shrink-0 mb-3">
        <div className="relative overflow-hidden rounded-xl border border-[#1a1a1a] bg-gradient-to-br from-[#141214] via-[#121014] to-[#0e0c10]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#D4A843]/5 blur-3xl rounded-full pointer-events-none" />

          <div className="relative px-4 sm:px-6 py-5 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 border border-[#D4A843]/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#D4A843]/5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                    Powered by AI — ask anything about guitar, technique, or practice
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[#555]">{getBYOKSettings() ? `BYOK: ${getBYOKSettings()!.provider}` : "Gemini Free"}</span>
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

              {/* Action buttons from AI */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3" style={{ direction: "ltr" }}>
                  {msg.actions.map((action, ai) => (
                    <button key={ai}
                      onClick={() => executeAction(action, msg.id)}
                      disabled={action.executed}
                      className={`font-label text-[11px] border px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                        action.executed
                          ? "text-[#555] border-[#222] bg-[#111] cursor-default"
                          : "text-[#D4A843] border-[#D4A843]/30 hover:border-[#D4A843]/60 hover:bg-[#D4A843]/10"
                      }`}>
                      {action.executed ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                          Done
                        </>
                      ) : (
                        <>
                          {action.type === "navigate" && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                          )}
                          {action.type === "suggest_exercises" && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                          )}
                          {action.type === "generate_backing" && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>
                          )}
                          {action.label}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Inline audio player for generated tracks */}
              {coachTrackUrl && msg.id.startsWith("a-done-") && (
                <div className="mt-3" style={{ direction: "ltr" }}>
                  <DarkAudioPlayer src={coachTrackUrl} title="AI Backing Track" compact />
                </div>
              )}
              <div className="font-readout text-[9px] text-[#333] mt-2" style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
                {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
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
              placeholder="Ask about technique, theory, practice plans..."
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
        <div className="font-label text-[9px] text-[#333] text-center mt-2">
          AI Coach is free for all users. Add your own API key in Profile for alternative providers.
        </div>
      </div>
    </div>
  );
}
