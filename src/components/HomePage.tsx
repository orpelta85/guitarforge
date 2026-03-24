"use client";
import { useState, useCallback, useMemo } from "react";
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
    setSongModal,
    curExList, curDone, curMin, curCats, wTot, wDn, wPct, wMin,
    buildAll, getSuggestions,
  } = props;

  // Song library search state
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [songSearchResults, setSongSearchResults] = useState<SongEntry[]>([]);
  const [songSearchActive, setSongSearchActive] = useState(false);

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

  // Quick Jam YouTube search — fetch first result and embed inline
  const [jamVideoId, setJamVideoId] = useState<string | null>(null);
  const searchJamBacking = useCallback(async () => {
    setJamYtLoading(true);
    setJamVideoId(null);
    const query = `${jamKey} ${jamScale} ${jamStyle} backing track guitar`;
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.items?.length > 0) {
        setJamVideoId(data.items[0].videoId);
      }
      setJamYtUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    } catch {
      setJamYtUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
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
      {/* SECTION 1: Quick Shortcuts (moved first - short & general)      */}
      {/* ================================================================ */}
      {/* ================================================================ */}
      {/* MAIN HUB: Quick Actions toolbar + Practice Hub (unified box)    */}
      {/* ================================================================ */}
      <div className="mb-4" style={{ border: "1px solid #D4A84340", borderRadius: 12, overflow: "hidden" }}>

        {/* Quick Actions toolbar */}
        <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto" style={{ background: "#141410", borderBottom: "1px solid #D4A84320" }}>
          {([
            { label: "Practice", icon: "M5 3l14 9-14 9V3z", target: "daily" as View },
            { label: "Studio", icon: "M2 3h20v14H2zM8 21h8M12 17v4", target: "studio" as View },
            { label: "Jam", icon: "M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z", target: "jam" as View },
            { label: "Library", icon: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z", target: "lib" as View },
            { label: "Coach", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", target: "coach" as View },
            { label: "Skills", icon: "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z", target: "skills" as View },
          ] as const).map(({ label, icon, target }) => (
            <button key={target} type="button" onClick={() => setView(target)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all hover:bg-[#D4A84315] flex-shrink-0"
              style={{ background: "transparent" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon}/>
              </svg>
              <span className="font-label text-[14px] font-medium text-[#aaa] hover:text-[#D4A843] transition-colors whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {/* --- Today's Practice --- */}
        {(() => {
          const dayPct = curExList.length > 0 ? Math.round((curDone / curExList.length) * 100) : 0;
          const todayDate = new Date();
          const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" });
          const dateStr = todayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const todayCats = curCats.length > 0 ? curCats.join(", ") : "Rest Day";
          return (
            <div className="p-5 sm:p-6" style={{ background: "linear-gradient(135deg, #1a1708, #121214)" }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-heading text-lg sm:text-xl font-bold text-[#eee]">Today&apos;s Practice</div>
                  <div className="font-readout text-[11px] text-[#666] mt-1">
                    {dayName}, {dateStr}
                  </div>
                  <div className="font-readout text-[11px] text-[#666] mt-0.5">
                    {curExList.length} Exercises &middot; {curMin} min
                  </div>
                  <div className="font-readout text-[10px] text-[#555] mt-0.5">
                    Today: {todayCats}
                  </div>
                </div>
                {streak.currentStreak > 0 && (
                  <div className="flex items-center gap-1.5 bg-[#D4A843]/10 px-3 py-1.5 rounded-full">
                    <span className="text-lg">&#x1F525;</span>
                    <span className="font-stat text-[14px] text-[#D4A843]">{streak.currentStreak} Day Streak</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button type="button" onClick={() => { setView("daily"); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-label text-[13px] font-semibold text-[#121214] transition-all hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #D4A843, #DFBD69)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Start Practice
                </button>
                <span className={`font-readout text-[13px] font-bold ${dayPct >= 100 && curExList.length > 0 ? "text-[#33CC33]" : "text-[#D4A843]"}`}>
                  {dayPct}% complete
                </span>
              </div>
              <div className="mt-3 h-[6px] rounded-full overflow-hidden" style={{ background: "#ffffff08" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: dayPct + "%", background: dayPct >= 100 && curExList.length > 0 ? "#33CC33" : "linear-gradient(90deg, #D4A843, #DFBD69)" }} />
              </div>
            </div>
          );
        })()}

        {/* --- Weekly Focus (inline, below Today's Practice) --- */}
        <div className="border-t border-[#D4A84330]" style={{ background: "#121214" }}>
          <button onClick={() => setSettingsOpen(p => !p)} className="flex items-center gap-3 w-full cursor-pointer bg-transparent border-0 text-left px-5 py-4 transition-colors hover:bg-[#1a1708]">
            <div className="led led-gold" />
            <span className="font-label text-[13px] font-semibold text-[#D4A843] flex-1">Weekly Focus</span>
            <span className="font-readout text-[12px] px-3 py-1.5 rounded-lg" style={{ background: settingsOpen ? "transparent" : "#D4A84315", color: "#D4A843", border: settingsOpen ? "none" : "1px solid #D4A84330" }}>
              {!settingsOpen && `W${week} \u00B7 ${mode} \u00B7 ${scale} \u00B7 ${style}`}
              {settingsOpen && ""}
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
        </div>

        {/* --- Songs for the Week (merged setlist) --- */}
        <div className="border-t border-[#D4A84320] px-5 py-4" style={{ background: "#121214" }}>
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

        {/* --- Week Schedule --- */}
        <div className="border-t border-[#D4A84320] px-5 py-4" style={{ background: "#121214" }}>
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

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {DAYS.map((day) => {
              const ac = dayCats[day] || [], hrs = dayHrs[day] || 0, exs = dayExMap[day] || [];
              const d2 = exs.filter((e) => doneMap[week + "-" + day + "-" + e.id]).length;
              const off = !ac.length, pct = exs.length ? Math.round((d2 / exs.length) * 100) : 0;
              return (
                <div key={day} onClick={() => { setSelDay(day); setView("daily"); }}
                  className={`p-2 cursor-pointer text-center transition-all ${off ? "bg-[#0e0e10] border border-[#1a1a1a]" : "panel hover:border-[#D4A843]/30"} ${selDay === day ? "!border-[#D4A843] ring-1 ring-[#D4A843]/30 !bg-[#1a1708]" : ""}`}
                  style={{ borderRadius: 8 }}>
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
      {/* Stats Row                                                        */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {[
          { value: String(streak.currentStreak), label: "Streak" },
          { value: wPct + "%", label: "Progress" },
          { value: String(wMin), label: "Minutes" },
          { value: DAYS.filter(d => (dayExMap[d] || []).some(e => doneMap[week + "-" + d + "-" + e.id])).length + "/7", label: "Days Active" },
        ].map(({ value, label }) => (
          <div key={label} className="p-3 text-center" style={{ background: "#1a1a1e", borderRadius: 8 }}>
            <div className="font-stat text-xl sm:text-2xl text-[#D4A843]">{value}</div>
            <div className="font-label text-[9px] text-[#555] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* SECTION 3: Week Analytics                                        */}
      {/* ================================================================ */}
      <div className="panel-secondary mb-4" style={{ borderRadius: 8 }}>
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
      {/* SECTION 4: Quick Jam                                             */}
      {/* ================================================================ */}
      <div className="panel-secondary mb-4" style={{ borderRadius: 8 }}>
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
            {/* Suno error/loading */}
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
            {/* Inline YouTube player */}
            {jamYtLoading && (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-[#0e0e10] mb-3 flex items-center justify-center">
                <div className="font-label text-[12px] text-[#555] animate-pulse">Searching YouTube...</div>
              </div>
            )}
            {jamVideoId && !jamYtLoading && (
              <div className="mb-3">
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                  <iframe src={`https://www.youtube.com/embed/${jamVideoId}?modestbranding=1&rel=0&autoplay=1`}
                    className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Jam Backing Track" />
                </div>
                {jamYtUrl && (
                  <a href={jamYtUrl} target="_blank" rel="noopener noreferrer"
                    className="font-label text-[11px] text-[#D4A843] hover:text-[#DFBD69] mt-2 inline-block no-underline">
                    Search more on YouTube →
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suno player (if generated) */}
      {sunoSuggestUrl && (
        <div className="panel-secondary p-3 mb-4" style={{ borderRadius: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="font-label text-[10px] text-[#D4A843]">AI Backing Track</div>
            <span className="font-readout text-[9px] text-[#555]">{scale} {mode} &middot; {style}</span>
          </div>
          <DarkAudioPlayer src={sunoSuggestUrl} title={`${scale} ${mode} \u00B7 ${style}`} loop />
        </div>
      )}

      {/* ================================================================ */}
      {/* Smart Suggestions                                                */}
      {/* ================================================================ */}
      {(() => {
        const suggestions = getSuggestions();
        if (suggestions.length === 0) return null;
        return (
          <div className="panel-secondary p-4 mb-4" style={{ borderRadius: 8 }}>
            <div className="font-label text-[10px] text-[#666] mb-2 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 015 11.9V17H7v-3.1A7 7 0 0112 2z"/>
              </svg>
              Suggestions
            </div>
            <div className="flex flex-col gap-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-[#888]">
                  <span className="flex-shrink-0">{s.icon}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
          <div className="panel-secondary p-4 mb-4" style={{ borderRadius: 8 }}>
            <div className="font-label text-[10px] text-[#666] mb-3 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Recent Activity
            </div>
            <div className="flex flex-col gap-1">
              {recent.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[#121214] rounded-lg">
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
