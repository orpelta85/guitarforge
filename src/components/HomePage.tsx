"use client";
import { useState, useCallback, useMemo, useRef } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, ExEditMap, SongEntry } from "@/lib/types";
import { DAYS, CATS, COL, MODES, SCALES, STYLES, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { SONG_LIBRARY } from "@/lib/songs-data";
import WeeklyCharts from "./WeeklyCharts";
import DarkAudioPlayer from "./DarkAudioPlayer";
import type { View } from "./Navbar";

interface HomePageProps {
  // State
  week: number;
  mode: string;
  scale: string;
  style: string;
  dayCats: DayCats;
  dayHrs: DayHrs;
  dayExMap: DayExMap;
  doneMap: BoolMap;
  bpmLog: StringMap;
  selDay: string;
  songs: Song[];
  newSongName: string;
  newSongUrl: string;
  showEditor: boolean;
  collapsedGroups: Record<string, boolean>;
  settingsOpen: boolean;
  showAnalytics: boolean;
  calendarData: Record<string, { exercisesDone: number; minutesPracticed: number }>;
  streak: { currentStreak: number; longestStreak: number; lastPracticeDate: string; totalDays: number };
  sunoSuggestUrl: string | null;
  sunoSuggestLoading: boolean;
  sunoSuggestDismissed: boolean;
  user: { id: string } | null;
  authBannerDismissed: boolean;
  // Setters
  setView: (v: View) => void;
  setWeek: (n: number) => void;
  setMode: (s: string) => void;
  setScale: (s: string) => void;
  setStyle: (s: string) => void;
  setDayCats: React.Dispatch<React.SetStateAction<DayCats>>;
  setDayHrs: React.Dispatch<React.SetStateAction<DayHrs>>;
  setDayExMap: React.Dispatch<React.SetStateAction<DayExMap>>;
  setDoneMap: React.Dispatch<React.SetStateAction<BoolMap>>;
  setBpmLog: React.Dispatch<React.SetStateAction<StringMap>>;
  setSelDay: (s: string) => void;
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  setNewSongName: (s: string) => void;
  setNewSongUrl: (s: string) => void;
  setShowEditor: (b: boolean) => void;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAnalytics: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAuthPage: (b: boolean) => void;
  setAuthBannerDismissed: (b: boolean) => void;
  setSunoSuggestUrl: (s: string | null) => void;
  setSunoSuggestLoading: (b: boolean) => void;
  setSunoSuggestDismissed: (b: boolean) => void;
  // Computed
  curExList: Exercise[];
  curDone: number;
  curMin: number;
  curCats: string[];
  wTot: number;
  wDn: number;
  wPct: number;
  wMin: number;
  setSongModal: (s: SongEntry | null) => void;
  setModal: (e: Exercise | null) => void;
  // Functions
  buildAll: () => void;
  getSuggestions: () => { icon: string; text: string }[];
}

export default function HomePage(props: HomePageProps) {
  const {
    week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog,
    selDay, songs, newSongName, newSongUrl, showEditor, collapsedGroups,
    settingsOpen, showAnalytics, calendarData, streak,
    sunoSuggestUrl, sunoSuggestLoading, sunoSuggestDismissed,
    user, authBannerDismissed,
    setView, setWeek, setMode, setScale, setStyle, setDayCats, setDayHrs,
    setDayExMap, setDoneMap, setBpmLog, setSelDay, setSongs, setNewSongName,
    setNewSongUrl, setShowEditor, setCollapsedGroups, setSettingsOpen,
    setShowAnalytics, setShowAuthPage, setAuthBannerDismissed,
    setSunoSuggestUrl, setSunoSuggestLoading, setSunoSuggestDismissed,
    setSongModal, setModal,
    curExList, curDone, curMin, curCats, wTot, wDn, wPct, wMin,
    buildAll, getSuggestions,
  } = props;

  // Song library search state
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [songSearchResults, setSongSearchResults] = useState<SongEntry[]>([]);
  const [songSearchActive, setSongSearchActive] = useState(false);

  // Copy/Paste clipboard for weekly schedule editor
  const [copiedDay, setCopiedDay] = useState<{ cats: string[]; hrs: number } | null>(null);

  // Quick Jam state
  const [jamStyle, setJamStyle] = useState(style);
  const [jamScale, setJamScale] = useState(scale);
  const [jamKey, setJamKey] = useState("Am");
  const [jamYtUrl, setJamYtUrl] = useState<string | null>(null);
  const [jamYtLoading, setJamYtLoading] = useState(false);
  const [jamSunoLoading, setJamSunoLoading] = useState(false);
  const [jamOpen, setJamOpen] = useState(false);

  const KEYS_LIST = ["C", "Cm", "C#", "C#m", "D", "Dm", "Eb", "Ebm", "E", "Em", "F", "Fm", "F#", "F#m", "G", "Gm", "Ab", "Abm", "A", "Am", "Bb", "Bbm", "B", "Bm"];

  // Song library search handler
  const handleSongSearch = useCallback((q: string) => {
    setSongSearchQuery(q);
    if (!q.trim()) {
      setSongSearchResults([]);
      setSongSearchActive(false);
      return;
    }
    setSongSearchActive(true);
    const lower = q.toLowerCase();
    const results = SONG_LIBRARY.filter(s =>
      s.title.toLowerCase().includes(lower) ||
      s.artist.toLowerCase().includes(lower) ||
      (s.genre && s.genre.toLowerCase().includes(lower))
    ).slice(0, 15);
    setSongSearchResults(results);
  }, []);

  const addSongFromLibrary = useCallback((song: SongEntry) => {
    setSongs(prev => {
      if (prev.some(s => s.id === song.id)) return prev;
      return [...prev, {
        name: `${song.artist} - ${song.title}`,
        url: song.songsterrUrl || "",
        id: song.id,
      }];
    });
    setSongSearchQuery("");
    setSongSearchResults([]);
    setSongSearchActive(false);
  }, [setSongs]);

  const [jamVideoId, setJamVideoId] = useState<string | null>(null);
  const [jamSearchFailed, setJamSearchFailed] = useState(false);
  const searchJamBacking = useCallback(async () => {
    setJamYtLoading(true);
    setJamVideoId(null);
    setJamSearchFailed(false);
    const query = `${jamKey} ${jamScale} ${jamStyle} backing track guitar`;
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const videoId = data.items?.[0]?.videoId;
      if (videoId) {
        setJamVideoId(videoId);
      } else {
        setJamSearchFailed(true);
      }
      setJamYtUrl(searchUrl);
    } catch {
      setJamSearchFailed(true);
      setJamYtUrl(searchUrl);
    }
    setJamYtLoading(false);
  }, [jamKey, jamScale, jamStyle]);

  // Quick Jam Suno generate
  const [sunoError, setSunoError] = useState<string | null>(null);
  const generateJamSuno = useCallback(async () => {
    setJamSunoLoading(true);
    setSunoError(null);
    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale: jamKey, mode: jamScale, style: jamStyle, bpm: 120, title: `${jamKey} ${jamScale} ${jamStyle} Jam` }),
      });
      const data = await res.json();
      if (data.error) {
        setSunoError(data.error);
      } else if (data.tracks?.[0]?.audioUrl) {
        setSunoSuggestUrl(data.tracks[0].audioUrl);
      } else {
        setSunoError("Generation timed out. Try again.");
      }
    } catch { setSunoError("Network error. Check your connection."); }
    finally { setJamSunoLoading(false); }
  }, [jamKey, jamScale, jamStyle, setSunoSuggestUrl]);

  // Today's date info (stable ref to avoid re-render loops)
  const todayDateRef = useRef(new Date());
  const todayDate = todayDateRef.current;
  const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = todayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dayPct = curExList.length > 0 ? Math.round((curDone / curExList.length) * 100) : 0;
  const todayCats = curCats.length > 0 ? curCats.join(", ") : "Rest Day";

  // Exercise previews for hero card (up to 3 undone exercises)
  const exercisePreviews = useMemo(() => {
    return curExList.filter(e => !doneMap[week + "-" + selDay + "-" + e.id]).slice(0, 3);
  }, [curExList, doneMap, week, selDay]);

  // Song of the week - pull first song found in this week's schedule
  const songOfTheWeek = useMemo(() => {
    // Check dayExMap for any song exercise across this week's days
    for (const day of DAYS) {
      const exs = dayExMap[day] || [];
      const songEx = exs.find(e => e.c === "Songs" && e.songId);
      if (songEx) {
        const entry = SONG_LIBRARY.find(s => s.id === songEx.songId);
        if (entry) return entry;
        return { id: songEx.songId!, title: songEx.songName || songEx.n, artist: "" };
      }
    }
    // Fallback: pick from user's song list
    if (songs.length > 0) {
      const idx = week % songs.length;
      const song = songs[idx];
      return SONG_LIBRARY.find(s => s.id === song.id) || { id: song.id, title: song.name, artist: "" };
    }
    const popularSongs = SONG_LIBRARY.filter(s => s.popularity && s.popularity > 70).slice(0, 20);
    if (popularSongs.length > 0) return popularSongs[week % popularSongs.length];
    if (SONG_LIBRARY.length > 0) return SONG_LIBRARY[week % SONG_LIBRARY.length];
    return null;
  }, [songs, week, dayExMap]);

  const todayDayOfWeek = todayDate.getDay();

  const coachTip = useMemo(() => {
    const tips = [
      "Slow is smooth, smooth is fast. Drop your BPM by 20% and focus on clean execution.",
      "Record yourself today - you'll catch mistakes your ears miss in real-time.",
      "Try practicing your weakest category first while your focus is fresh.",
      "Alternate picking exercises with legato passages to build versatility.",
      "Listen to a new song in your style this week - steal one lick from it.",
      "Your streak is your most powerful tool. Even 10 minutes counts.",
      "Warm up with chromatic runs before jumping into shred patterns.",
    ];
    const suggestions = getSuggestions();
    if (suggestions.length > 0) return suggestions[0].text;
    return tips[todayDayOfWeek % tips.length];
  }, [getSuggestions, todayDayOfWeek]);

  return (
    <div className="animate-fade-in">
      {/* Auth banner for guests */}
      {!user && !authBannerDismissed && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-3 rounded-lg" style={{ background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.2)" }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="text-[13px]" style={{ color: "#D4A843" }}>Sign in to sync your progress across devices</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowAuthPage(true)} className="text-[12px] font-medium px-3 py-1 rounded-md" style={{ background: "#D4A843", color: "#121214" }}>Sign In</button>
            <button type="button" aria-label="Dismiss" onClick={() => setAuthBannerDismissed(true)} className="text-[12px] px-1.5 py-1 rounded" style={{ color: "#666" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HERO ZONE - Today's Session Card                                 */}
      {/* ================================================================ */}
      <div className="relative mb-5 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(212,168,67,0.15)", background: "linear-gradient(145deg, #1a1708 0%, #121214 40%, #0f1014 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 20%, rgba(212,168,67,0.06) 0%, transparent 60%)" }} />

        <div className="relative p-6 sm:p-8">
          {/* Top row: date + streak */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <div className="text-[13px] text-[#666] font-medium">{dayName}, {dateStr}</div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#eee] mt-1 tracking-tight">Today&apos;s Focus</h1>
              <div className="text-[13px] text-[#555] mt-1">{curExList.length} exercises &middot; {curMin} min &middot; {todayCats}</div>
            </div>
            {/* Streak badge with flame animation */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: streak.currentStreak > 0 ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${streak.currentStreak > 0 ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.05)"}` }}>
              <span className={`${streak.currentStreak > 0 ? "streak-flame" : ""}`} style={{ display: "inline-flex" }}>
                {streak.currentStreak > 0 ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#EDCF72"/>
                        <stop offset="50%" stopColor="#D4A843"/>
                        <stop offset="100%" stopColor="#B8922E"/>
                      </linearGradient>
                    </defs>
                    <path d="M12 2C12 2 7.5 8 7.5 12.5C7.5 15 9 17 10.5 18C9.5 16.5 9.5 14 11 12C11 12 12 15 12 17C13.5 15.5 15.5 13 15.5 10.5C15.5 8 14 5 12 2Z" fill="url(#flameGrad)" opacity="0.9"/>
                    <path d="M12 7C12 7 10 10 10 12.5C10 14.5 11 16 12 17C13 16 14 14.5 14 12.5C14 10 12 7 12 7Z" fill="#EDCF72" opacity="0.6"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                )}
              </span>
              <div className="text-right">
                <div className="font-bold text-lg leading-none" style={{ color: streak.currentStreak > 0 ? "#D4A843" : "#555" }}>{streak.currentStreak}</div>
                <div className="text-[9px] text-[#666] mt-0.5">day streak</div>
              </div>
            </div>
          </div>

          {/* Exercise previews */}
          {exercisePreviews.length > 0 ? (
            <div className="flex flex-col gap-2 mb-6">
              {exercisePreviews.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setModal(ex)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-white/[0.04]"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COL[ex.c] || "#888" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#ccc] truncate">{ex.n}</div>
                    <div className="text-[11px] text-[#555]">{ex.c} &middot; {ex.m} min</div>
                  </div>
                  <div className="text-[12px] text-[#D4A843] font-medium flex-shrink-0">{ex.b} BPM</div>
                </button>
              ))}
              {curExList.length > 3 && (
                <div className="text-[11px] text-[#555] px-4">+ {curExList.length - 3} more exercises</div>
              )}
            </div>
          ) : (
            <div className="mb-6 px-4 py-5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[14px] text-[#666] mb-1">{curCats.length > 0 ? "No exercises built yet" : "Rest day - take it easy"}</div>
              {curCats.length > 0 && (
                <button type="button" onClick={buildAll} className="text-[12px] text-[#D4A843] hover:text-[#DFBD69] transition-colors mt-1">
                  Build today&apos;s routine
                </button>
              )}
            </div>
          )}

          {/* Progress bar + CTA */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setView("daily")}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-[15px] transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #D4A843, #DFBD69)", color: "#121214", boxShadow: "0 4px 20px rgba(212,168,67,0.25)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Start Practice
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[13px] font-bold ${dayPct >= 100 && curExList.length > 0 ? "text-[#22c55e]" : "text-[#D4A843]"}`}>
                  {dayPct}% complete
                </span>
                <span className="text-[11px] text-[#555]">{curDone}/{curExList.length}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: dayPct + "%", background: dayPct >= 100 && curExList.length > 0 ? "#22c55e" : "linear-gradient(90deg, #D4A843, #DFBD69)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Flame animation CSS */}
        <style>{`
          .streak-flame {
            animation: flame-pulse 1.5s ease-in-out infinite;
          }
          @keyframes flame-pulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.15); filter: brightness(1.3); }
          }
        `}</style>
      </div>

      {/* Mobile-only logo (desktop logo is in sidebar) */}
      <div className="flex justify-center mb-4 md:hidden">
        <img src="/logo.png" alt="GuitarForge" className="h-16 object-contain logo-blend" />
      </div>

      {/* ================================================================ */}
      {/* Quick Jam (collapsible)                                          */}
      {/* ================================================================ */}
      <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#111114" }}>
        <button onClick={() => setJamOpen(p => !p)} className="panel-header flex items-center gap-2 w-full cursor-pointer bg-transparent border-0 text-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          <span className="flex-1">Quick Jam</span>
          <span className="font-readout text-[10px] text-[#555]">
            {!jamOpen && `${jamKey} ${jamScale} \u00B7 ${jamStyle}`}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className={`transition-transform ${jamOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {jamOpen && (
          <div className="p-4 sm:p-5">
            <div className="font-readout text-[10px] text-[#555] mb-3">Find a backing track to jam over</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
              <label className="font-label text-[11px] text-[#666]">
                Style
                <select value={jamStyle} onChange={(e) => setJamStyle(e.target.value)} className="input w-full mt-1 text-[12px]">
                  {STYLES.map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="font-label text-[11px] text-[#666]">
                Scale
                <select value={jamScale} onChange={(e) => setJamScale(e.target.value)} className="input w-full mt-1 text-[12px]">
                  {MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="font-label text-[11px] text-[#666]">
                Key
                <select value={jamKey} onChange={(e) => setJamKey(e.target.value)} className="input w-full mt-1 text-[12px]">
                  {KEYS_LIST.map(k => <option key={k}>{k}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={searchJamBacking} disabled={jamYtLoading}
                className="btn-gold !text-[11px] flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                {jamYtLoading ? "Searching..." : "Search YouTube"}
              </button>
              <button onClick={generateJamSuno} disabled={jamSunoLoading}
                className="btn-ghost !text-[11px] flex items-center gap-2 !border-[#D4A843]/30 !text-[#D4A843]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 6v6l4 2"/>
                </svg>
                {jamSunoLoading ? "Generating (up to 2 min)..." : "Generate with Suno AI"}
              </button>
              <button onClick={() => setView("jam")}
                className="btn-ghost !text-[11px] flex items-center gap-2">
                Open Full Jam Mode
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
            {sunoError && (
              <div className="text-[12px] px-3 py-2 rounded-lg mb-3" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                {sunoError}
              </div>
            )}
            {jamSunoLoading && (
              <div className="text-[12px] px-3 py-2 rounded-lg mb-3 animate-pulse" style={{ background: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                Generating backing track with Suno AI... This can take up to 2 minutes.
              </div>
            )}
            {jamYtLoading && (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-[#0e0e10] mb-3 flex items-center justify-center">
                <div className="font-label text-[12px] text-[#555] animate-pulse">Searching YouTube...</div>
              </div>
            )}
            {jamVideoId && !jamYtLoading && (
              <div className="mb-3">
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                  <iframe
                    key={jamVideoId}
                    src={`https://www.youtube.com/embed/${jamVideoId}?modestbranding=1&rel=0&autoplay=1`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title="Jam Backing Track"
                  />
                </div>
              </div>
            )}
            {jamSearchFailed && !jamYtLoading && (
              <div className="text-[12px] px-3 py-2 rounded-lg mb-3" style={{ background: "rgba(255,255,255,0.03)", color: "#666" }}>
                No videos found. Try a different key or style, or search directly on YouTube.
              </div>
            )}
            {jamYtUrl && !jamYtLoading && (
              <a href={jamYtUrl} target="_blank" rel="noopener noreferrer"
                className="font-label text-[11px] text-[#D4A843] hover:text-[#DFBD69] mb-3 inline-block no-underline">
                Search more on YouTube &rarr;
              </a>
            )}
          </div>
        )}
      </div>

      {/* Suno player (if generated) */}
      {sunoSuggestUrl && (
        <div className="rounded-xl p-3 mb-4" style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#111114" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="font-label text-[10px] text-[#D4A843]">AI Backing Track</div>
            <span className="font-readout text-[9px] text-[#555]">{scale} {mode} &middot; {style}</span>
          </div>
          <DarkAudioPlayer src={sunoSuggestUrl} title={`${scale} ${mode} \u00B7 ${style}`} loop />
        </div>
      )}

      {/* ================================================================ */}
      {/* Three-column grid: Song of the Week + Weekly Progress + Coach    */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">

        {/* Song of the Week */}
        <div className="rounded-xl p-4 transition-all hover:border-white/10" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[10px] font-semibold text-[#D4A843] uppercase tracking-wider mb-3">Song of the Week</div>
          {songOfTheWeek ? (
            <button type="button" onClick={() => setSongModal(songOfTheWeek)} className="w-full text-left">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-[#ccc] font-medium truncate">{songOfTheWeek.title}</div>
                  <div className="text-[11px] text-[#555] truncate">{songOfTheWeek.artist}</div>
                  {songOfTheWeek.difficulty && (
                    <span className={`text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded ${songOfTheWeek.difficulty === "Beginner" ? "text-[#22c55e] bg-[#22c55e10]" : songOfTheWeek.difficulty === "Intermediate" ? "text-[#D4A843] bg-[#D4A84310]" : "text-[#ef4444] bg-[#ef444410]"}`}>
                      {songOfTheWeek.difficulty}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ) : (
            <div className="text-[12px] text-[#444]">Add songs to your library</div>
          )}
        </div>

        {/* Weekly Progress mini */}
        <div className="rounded-xl p-4 transition-all hover:border-white/10" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[10px] font-semibold text-[#D4A843] uppercase tracking-wider mb-3">This Week</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-bold text-xl text-[#D4A843]">{wPct}%</div>
              <div className="text-[9px] text-[#555]">Progress</div>
            </div>
            <div>
              <div className="font-bold text-xl text-[#eee]">{wMin}</div>
              <div className="text-[9px] text-[#555]">Minutes</div>
            </div>
            <div>
              <div className="font-bold text-xl text-[#eee]">{wDn}/{wTot}</div>
              <div className="text-[9px] text-[#555]">Exercises</div>
            </div>
            <div>
              <div className="font-bold text-xl text-[#eee]">{DAYS.filter(d => (dayExMap[d] || []).some(e => doneMap[week + "-" + d + "-" + e.id])).length}/7</div>
              <div className="text-[9px] text-[#555]">Days Active</div>
            </div>
          </div>
        </div>

        {/* AI Coach Suggestion */}
        <div className="rounded-xl p-4 transition-all hover:border-white/10" style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[10px] font-semibold text-[#D4A843] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><path d="M9 18h6M10 22h4M12 2a7 7 0 015 11.9V17H7v-3.1A7 7 0 0112 2z"/></svg>
            Coach Tip
          </div>
          <p className="text-[12px] text-[#999] leading-relaxed mb-3">{coachTip}</p>
          <button type="button" onClick={() => setView("coach")} className="text-[11px] text-[#D4A843] hover:text-[#DFBD69] transition-colors">
            Ask the Coach &rarr;
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Week Schedule + Day Grid                                         */}
      {/* ================================================================ */}
      <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#111114" }}>
        {/* Weekly Focus toggle */}
        <button onClick={() => setSettingsOpen(p => !p)} className="flex items-center gap-3 w-full cursor-pointer bg-transparent border-0 text-left px-5 py-4 transition-colors hover:bg-white/[0.02]">
          <div className="led led-gold" />
          <span className="font-label text-[13px] font-semibold text-[#D4A843] flex-1">Weekly Focus</span>
          <span className="font-readout text-[12px] px-3 py-1.5 rounded-lg" style={{ background: settingsOpen ? "transparent" : "rgba(212,168,67,0.06)", color: "#D4A843", border: settingsOpen ? "none" : "1px solid rgba(212,168,67,0.12)" }}>
            {!settingsOpen && `W${week} \u00B7 ${mode} \u00B7 ${scale} \u00B7 ${style}`}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {settingsOpen && (
          <div className="px-5 pb-4">
            <div className="font-readout text-[10px] text-[#555] mb-3">What are you focusing on this week?</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {[
                { l: "Week", v: <div className="segment-display text-center mt-1"><input type="number" value={week} min={1} onChange={(e) => setWeek(Number(e.target.value))} className="bg-transparent border-none outline-none text-center w-full font-mono font-bold text-[#D4A843]" style={{ boxShadow: 'none' }} /></div> },
                { l: "Mode", v: <select value={mode} onChange={(e) => setMode(e.target.value)} className="input w-full text-[12px] sm:text-[14px]">{MODES.map((m) => <option key={m}>{m}</option>)}</select> },
                { l: "Key", v: <select value={scale} onChange={(e) => setScale(e.target.value)} className="input w-full">{SCALES.map((s) => <option key={s}>{s}</option>)}</select> },
                { l: "Style", v: <select value={style} onChange={(e) => setStyle(e.target.value)} className="input w-full text-[12px] sm:text-[14px]">{STYLES.map((s) => <option key={s}>{s}</option>)}</select> },
              ].map(({ l, v }) => <label key={l} className="font-label text-[11px] text-[#666]">{l}<div className="mt-1">{v}</div></label>)}
            </div>
          </div>
        )}

        {/* Day grid */}
        <div className="border-t border-white/5 px-5 py-4">
          <div className="flex justify-between items-center mb-3">
            <span className="font-label text-[11px] text-[#D4A843] flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              Week {week} Schedule
            </span>
            <button onClick={() => setShowEditor(!showEditor)} className="font-readout text-[10px] text-[#555] hover:text-[#888] transition-colors flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {showEditor ? "Close" : "Edit"}
            </button>
          </div>

          {showEditor && (
            <div className="mb-4 p-4 bg-[#0e0e10] border border-[#1a1a1a] rounded-lg">
              {DAYS.map((day) => {
                const ac = dayCats[day] || [], hrs = dayHrs[day] || 0;
                return (
                  <div key={day} className="mb-3 pb-3 border-b border-[#1a1a1a] last:border-0 last:mb-0 last:pb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-label text-[11px] w-[50px] text-[#aaa]">{day}</span>
                      <input type="number" value={hrs} min={0} max={8} step={0.5}
                        onChange={(e) => setDayHrs((p) => ({ ...p, [day]: Number(e.target.value) }))}
                        className="input input-gold w-14 text-center !py-1" />
                      <span className="font-label text-[9px] text-[#444]">hrs</span>
                      <div className="flex gap-1 ml-auto">
                        <button type="button" title="Copy day" onClick={() => setCopiedDay({ cats: [...ac], hrs })}
                          className="text-[9px] px-1.5 py-0.5 rounded border transition-all bg-transparent cursor-pointer"
                          style={{ borderColor: "#333", color: "#666" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                        <button type="button" title="Paste day" onClick={() => {
                          if (!copiedDay) return;
                          setDayCats(p => ({ ...p, [day]: [...copiedDay.cats] }));
                          setDayHrs(p => ({ ...p, [day]: copiedDay.hrs }));
                        }}
                          className="text-[9px] px-1.5 py-0.5 rounded border transition-all bg-transparent cursor-pointer"
                          style={{ borderColor: copiedDay ? "#D4A843" + "40" : "#222", color: copiedDay ? "#D4A843" : "#333" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="pr-[62px]">
                      {Object.entries(CAT_GROUPS).map(([group, cats]) => {
                        const isCollapsed = collapsedGroups[group] === true;
                        return (
                          <div key={group} className="mb-1.5">
                            <button onClick={() => setCollapsedGroups((p) => ({ ...p, [group]: !isCollapsed }))}
                              className="flex items-center gap-1 mb-0.5 cursor-pointer text-[9px] font-semibold text-[#666] hover:text-[#aaa] transition-colors bg-transparent border-0 p-0">
                              <span className="text-[8px]">{isCollapsed ? "\u25B6" : "\u25BC"}</span> {group}
                            </button>
                            {!isCollapsed && (
                              <div className="flex flex-wrap gap-1 mr-3">
                                {cats.map((cat) => {
                                  const on = ac.includes(cat), c = COL[cat] || "#888";
                                  return (
                                    <span key={cat} onClick={() => setDayCats((p) => {
                                      const a = (p[day] || []).slice(), i = a.indexOf(cat);
                                      i >= 0 ? a.splice(i, 1) : a.push(cat); return { ...p, [day]: a };
                                    })} className="tag cursor-pointer transition-all" style={{
                                      border: `1px solid ${on ? c : "#2a2a2a"}`, color: on ? c : "#444",
                                      background: on ? c + "10" : "transparent",
                                    }}>{cat}</span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2 mt-4 pt-3 border-t border-[#1a1a1a]">
                <button onClick={buildAll} className="btn-gold !text-[10px]">Build Routine</button>
                <button onClick={() => {
                  try {
                    const archive = JSON.parse(localStorage.getItem("gf-archive") || "[]");
                    archive.push({ week, mode, scale, style, doneMap, bpmLog, dayExMap, date: new Date().toLocaleDateString("he-IL") });
                    localStorage.setItem("gf-archive", JSON.stringify(archive.slice(-52)));
                  } catch {}
                  setWeek(week + 1); setDoneMap({}); setBpmLog({});
                }} className="btn-ghost !text-[10px]">Finish Week &amp; Archive</button>
                <button onClick={() => { setWeek(week + 1); setDoneMap({}); setBpmLog({}); setDayExMap({}); }}
                  className="btn-ghost !text-[10px] !text-[#C41E3A] !border-[#C41E3A]/30">Reset All</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {DAYS.map((day) => {
              const ac = dayCats[day] || [], hrs = dayHrs[day] || 0, exs = dayExMap[day] || [];
              const d2 = exs.filter((e) => doneMap[week + "-" + day + "-" + e.id]).length;
              const off = !ac.length, pct = exs.length ? Math.round((d2 / exs.length) * 100) : 0;
              return (
                <div key={day} onClick={() => { setSelDay(day); setView("daily"); }}
                  className={`p-2 cursor-pointer text-center transition-all rounded-lg ${off ? "bg-[#0e0e10] border border-[#1a1a1a]" : "panel hover:border-[#D4A843]/30"} ${selDay === day ? "!border-[#D4A843] ring-1 ring-[#D4A843]/30 !bg-[#1a1708]" : ""}`}>
                  <div className={`font-label text-[10px] ${off ? "text-[#444]" : selDay === day ? "text-[#D4A843]" : "text-[#bbb]"}`}>
                    <span className="sm:hidden">{day.slice(0, 3)}</span><span className="hidden sm:inline">{day}</span>
                  </div>
                  <div className="font-readout text-[9px] text-[#555]">{hrs}h</div>
                  {exs.length > 0 && <>
                    <div className="vu mt-1 !h-[3px]"><div className="vu-fill" style={{ width: pct + "%" }} /></div>
                    <div className={`font-readout text-[8px] mt-0.5 ${pct >= 100 ? "text-[#33CC33]" : "text-[#666]"}`}>{d2}/{exs.length}</div>
                  </>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Songs for This Week                                              */}
      {/* ================================================================ */}
      <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#111114" }}>
        <div className="px-5 py-4">
          <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Songs for This Week
            <span className="font-readout text-[9px] text-[#555]">({songs.length} songs)</span>
          </div>
          {songs.length === 0 && (
            <div className="text-center py-3 text-[12px] text-[#444]">No songs added yet. Search your library below.</div>
          )}
          {songs.map((song) => {
            const libraryEntry = SONG_LIBRARY.find(s => s.id === song.id);
            return (
              <div key={song.id} className="flex items-center gap-3 px-3 py-2 bg-[#0e0e10] border border-[#1a1a1a] rounded-lg mb-1.5">
                <button type="button" onClick={() => setSongModal(libraryEntry || { id: song.id, title: song.name, artist: "" })}
                  className="flex-1 min-w-0 text-left cursor-pointer hover:text-[#D4A843] transition-colors">
                  <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate text-[#ccc]">{song.name}</div>
                </button>
                {song.url && <a href={song.url} target="_blank" rel="noopener noreferrer" className="font-label text-[9px] text-[#D4A843] no-underline hover:text-[#DFBD69] flex-shrink-0">Tab</a>}
                <button type="button" title="Remove song" onClick={() => setSongs((p) => p.filter((s) => s.id !== song.id))} className="text-[10px] text-[#666] hover:text-[#C41E3A] transition-colors flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            );
          })}

          {/* Song search from library */}
          <div className="mt-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search songs from library..."
                value={songSearchQuery}
                onChange={(e) => handleSongSearch(e.target.value)}
                className="input w-full !pl-9 !text-[12px]"
              />
            </div>
            {songSearchActive && songSearchResults.length > 0 && (
              <div className="mt-1 max-h-[200px] overflow-y-auto bg-[#0e0e10] border border-[#1a1a1a] rounded-lg">
                {songSearchResults.map((song) => (
                  <button key={song.id} type="button"
                    onClick={() => addSongFromLibrary(song)}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 hover:bg-[#1a1708] transition-colors border-b border-[#111] last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[#ccc] truncate">{song.title}</div>
                      <div className="text-[10px] text-[#555]">{song.artist} {song.genre ? `\u00B7 ${song.genre}` : ""}</div>
                    </div>
                    {song.difficulty && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${song.difficulty === "Beginner" ? "text-[#22c55e] bg-[#22c55e10]" : song.difficulty === "Intermediate" ? "text-[#D4A843] bg-[#D4A84310]" : "text-[#ef4444] bg-[#ef444410]"}`}>
                        {song.difficulty}
                      </span>
                    )}
                    {song.gp && (
                      <span className="text-[8px] text-[#D4A843] bg-[#D4A84310] px-1 py-0.5 rounded">GP</span>
                    )}
                    <span className="font-label text-[10px] text-[#D4A843] flex-shrink-0">+ Add</span>
                  </button>
                ))}
              </div>
            )}
            {songSearchActive && songSearchResults.length === 0 && songSearchQuery.trim() && (
              <div className="mt-1 text-center py-3 text-[11px] text-[#444] bg-[#0e0e10] border border-[#1a1a1a] rounded-lg">No songs found for &ldquo;{songSearchQuery}&rdquo;</div>
            )}
          </div>

          {/* Manual add (collapsed) */}
          <details className="mt-2">
            <summary className="text-[11px] text-[#555] cursor-pointer hover:text-[#D4A843] transition-colors">Add manually...</summary>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-2">
              <input placeholder="Song name..." value={newSongName} onChange={(e) => setNewSongName(e.target.value)} className="input min-w-0 !text-[12px]" />
              <input placeholder="Tab URL (optional)..." value={newSongUrl} onChange={(e) => setNewSongUrl(e.target.value)} className="input min-w-0 !text-[12px]" />
              <button onClick={() => { if (!newSongName.trim()) return; setSongs((p) => [...p, { name: newSongName.trim(), url: newSongUrl.trim(), id: Date.now() }]); setNewSongName(""); setNewSongUrl(""); }} className="btn-gold !text-[11px]">Add</button>
            </div>
          </details>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Week Analytics (collapsible)                                     */}
      {/* ================================================================ */}
      <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#111114" }}>
        <button onClick={() => setShowAnalytics(p => !p)} className="panel-header flex items-center gap-2 w-full cursor-pointer bg-transparent border-0 text-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <span className="flex-1">Week Analytics</span>
          <span className="font-readout text-[10px] text-[#555]">
            {!showAnalytics && `${wDn}/${wTot} done \u00B7 ${wPct}%`}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className={`transition-transform ${showAnalytics ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {showAnalytics && (
          <div className="p-3 sm:p-5">
            {/* Calendar Heatmap */}
            <div className="mb-5 pb-4 border-b border-[#1a1a1a]">
              <div className="font-label text-[10px] text-[#555] mb-2 flex items-center gap-2">
                <div className="led led-on" style={{ width: 6, height: 6 }} /> Practice Activity
              </div>
              <div className="flex gap-1" style={{ direction: "ltr" }}>
                <div className="flex flex-col gap-[2px] text-[8px] text-[#444] font-readout pt-0" style={{ width: "20px" }}>
                  <div style={{ height: "12px" }}></div>
                  <div style={{ height: "12px", lineHeight: "12px" }}>Mon</div>
                  <div style={{ height: "12px" }}></div>
                  <div style={{ height: "12px", lineHeight: "12px" }}>Wed</div>
                  <div style={{ height: "12px" }}></div>
                  <div style={{ height: "12px", lineHeight: "12px" }}>Fri</div>
                  <div style={{ height: "12px" }}></div>
                </div>
                <div className="flex gap-[2px] flex-1 overflow-hidden justify-end">
                  {(() => {
                    const weeks: { date: string; count: number }[][] = [];
                    const today = new Date();
                    const start = new Date(today);
                    start.setDate(start.getDate() - 83);
                    start.setDate(start.getDate() - start.getDay());
                    let cur = new Date(start);
                    let curWeekArr: { date: string; count: number }[] = [];
                    while (cur <= today) {
                      const ds = cur.toISOString().slice(0, 10);
                      const cd = calendarData[ds];
                      curWeekArr.push({ date: ds, count: cd?.exercisesDone || 0 });
                      if (curWeekArr.length === 7) { weeks.push(curWeekArr); curWeekArr = []; }
                      cur.setDate(cur.getDate() + 1);
                    }
                    if (curWeekArr.length > 0) weeks.push(curWeekArr);
                    return weeks.map((wk, wi) => (
                      <div key={wi} className="flex flex-col gap-[2px]">
                        {wk.map((day, di) => {
                          const bg = day.count === 0 ? "#111" : day.count <= 3 ? "#1a4a1a" : day.count <= 8 ? "#2d8a2d" : "#33CC33";
                          return (
                            <div key={di} title={`${day.date}: ${day.count} exercises`}
                              className="cal-cell rounded-[2px]"
                              style={{ width: "12px", height: "12px", background: bg }} />
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 justify-end">
                <span className="font-readout text-[8px] text-[#444]">Less</span>
                {["#111", "#1a4a1a", "#2d8a2d", "#33CC33"].map((c, i) => (
                  <div key={i} className="rounded-[2px]" style={{ width: 10, height: 10, background: c }} />
                ))}
                <span className="font-readout text-[8px] text-[#444]">More</span>
              </div>
            </div>

            {/* Streak stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-5 pb-4 border-b border-[#1a1a1a]">
              <div>
                <div className="font-stat text-xl text-[#D4A843]">{streak.currentStreak}</div>
                <div className="font-label text-[9px] text-[#555]">Current Streak</div>
              </div>
              <div>
                <div className="font-stat text-xl text-[#D4A843]">{streak.longestStreak}</div>
                <div className="font-label text-[9px] text-[#555]">Longest Streak</div>
              </div>
              <div>
                <div className="font-stat text-xl text-[#D4A843]">{streak.totalDays}</div>
                <div className="font-label text-[9px] text-[#555]">Total Days</div>
              </div>
              <div>
                <div className="font-readout text-sm text-[#666] mt-1">{streak.lastPracticeDate || "\u2014"}</div>
                <div className="font-label text-[9px] text-[#555]">Last Practice</div>
              </div>
            </div>

            {/* Weekly Charts */}
            <WeeklyCharts week={week} dayExMap={dayExMap} doneMap={doneMap} bpmLog={bpmLog} />
          </div>
        )}
      </div>


      {/* ================================================================ */}
      {/* Recent Activity                                                  */}
      {/* ================================================================ */}
      {(() => {
        const recentItems: { name: string; bpm: string; day: string }[] = [];
        for (const d of DAYS) {
          const exs = dayExMap[d] || [];
          for (const ex of exs) {
            const k = week + "-" + d + "-" + ex.id;
            if (doneMap[k]) {
              recentItems.push({ name: ex.n, bpm: bpmLog[k] || "", day: d });
            }
          }
        }
        const recent = recentItems.slice(-10).reverse();
        if (recent.length === 0) return null;
        return (
          <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#111114" }}>
            <div className="font-label text-[10px] text-[#666] mb-3 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Recent Activity
            </div>
            <div className="flex flex-col gap-1">
              {recent.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[#0a0a0a] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#ccc] truncate">{item.name}</div>
                  </div>
                  <span className="font-readout text-[9px] text-[#555] flex-shrink-0">{item.day}</span>
                  {item.bpm && <span className="font-readout text-[9px] text-[#D4A843] flex-shrink-0">{item.bpm} BPM</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
