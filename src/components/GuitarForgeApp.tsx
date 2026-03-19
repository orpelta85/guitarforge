"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, SongProgressMap, ExEditMap } from "@/lib/types";
import { DAYS, CATS, COL, MODES, SCALES, STYLES, STAGES, DEFAULT_DAY_CATS, DEFAULT_DAY_HRS, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { autoFill, makeSongItem, ytSearch } from "@/lib/helpers";
import ExerciseModal from "./ExerciseModal";
import SongModal from "./SongModal";
import Navbar from "./Navbar";
import type { View } from "./Navbar";
import LearningCenterPage from "./LearningCenterPage";
import StudioPage from "./StudioPage";
import WeeklyCharts from "./WeeklyCharts";
import SongsterrSearch from "./SongsterrSearch";
import ProfilePage from "./ProfilePage";
import AiCoachPage from "./AiCoachPage";
import LibraryEditor from "./LibraryEditor";
import ErrorBoundary from "./ErrorBoundary";
import SkillTreePage from "./SkillTreePage";
import JamModePage from "./JamModePage";
import { SONG_LIBRARY } from "@/lib/songs-data";
import type { SongEntry } from "@/lib/types";
import { buildStyle, recordUsage, saveToLibrary } from "@/lib/suno";
import type { LibraryTrack } from "@/lib/suno";

export default function GuitarForgeApp() {
  const [view, setViewRaw] = useState<View>("dash");
  const [week, setWeek] = useState(1);
  const [mode, setMode] = useState("Aeolian");
  const [scale, setScale] = useState("Am");
  const [style, setStyle] = useState("Metal");
  const [dayCats, setDayCats] = useState<DayCats>(DEFAULT_DAY_CATS);
  const [dayHrs, setDayHrs] = useState<DayHrs>(DEFAULT_DAY_HRS);
  const [selDay, setSelDay] = useState("Sunday");
  const [dayExMap, setDayExMap] = useState<DayExMap>({});
  const [doneMap, setDoneMap] = useState<BoolMap>({});
  const [bpmLog, setBpmLog] = useState<StringMap>({});
  const [noteLog, setNoteLog] = useState<StringMap>({});
  const [ready, setReady] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [libFilter, setLibFilter] = useState("All");
  const [modal, setModal] = useState<Exercise | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [newSongName, setNewSongName] = useState("");
  const [newSongUrl, setNewSongUrl] = useState("");
  const [songProgress, setSongProgress] = useState<SongProgressMap>({});
  const [exEdits, setExEdits] = useState<ExEditMap>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [libSearch, setLibSearch] = useState("");
  const [libTab, setLibTab] = useState<"exercises" | "styles" | "songs" | "songlib">("exercises");
  const [songModal, setSongModal] = useState<SongEntry | null>(null);
  const [customSongs, setCustomSongs] = useState<SongEntry[]>([]);
  const [songLibSearch, setSongLibSearch] = useState("");
  const [songLibFilter, setSongLibFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced">("all");
  const [showAddSong, setShowAddSong] = useState(false);
  const [songLibProgress, setSongLibProgress] = useState<Record<number, number>>({}); // songId → stagesCompleted (0-6)
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [exPickerOpen, setExPickerOpen] = useState(false);
  const [exPickerSearch, setExPickerSearch] = useState("");
  const [exPickerCat, setExPickerCat] = useState("All");
  const [libShowAll, setLibShowAll] = useState(false);
  const [songLibShowAll, setSongLibShowAll] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sunoSuggestUrl, setSunoSuggestUrl] = useState<string | null>(null);
  const [sunoSuggestLoading, setSunoSuggestLoading] = useState(false);
  const [sunoSuggestDismissed, setSunoSuggestDismissed] = useState(false);

  // ── Song backing track generation ──
  const [songBackingTracks, setSongBackingTracks] = useState<Record<number, string>>({});
  const [songBackingLoading, setSongBackingLoading] = useState<Record<number, boolean>>({});
  const [songBackingPlaying, setSongBackingPlaying] = useState<number | null>(null);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Phase 1 Engagement features ──
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number; lastPracticeDate: string; totalDays: number }>({ currentStreak: 0, longestStreak: 0, lastPracticeDate: "", totalDays: 0 });
  const [calendarData, setCalendarData] = useState<Record<string, { exercisesDone: number; minutesPracticed: number }>>({});
  const [focusEx, setFocusEx] = useState<{ ex: Exercise; idx: number } | null>(null);
  const [focusTimer, setFocusTimer] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [viewKey, setViewKey] = useState(0);

  // Hash-based routing: #studio, #practice, etc.
  const VALID_VIEWS = new Set<View>(["dash", "daily", "lib", "songs", "learn", "studio", "log", "profile", "coach"]);
  const hashToView = (hash: string): View | null => {
    const map: Record<string, View> = { "#dashboard": "dash", "#dash": "dash", "#practice": "daily", "#daily": "daily", "#library": "lib", "#lib": "lib", "#songs": "songs", "#learn": "learn", "#learning": "learn", "#studio": "studio", "#report": "log", "#log": "log", "#profile": "profile", "#coach": "coach" };
    const v = map[hash.toLowerCase()] || hash.replace("#", "") as View;
    return VALID_VIEWS.has(v) ? v : null;
  };
  const setView = (v: View) => { setViewRaw(v); setViewKey(k => k + 1); history.pushState(null, "", `#${v}`); };

  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => { const v = hashToView(window.location.hash); if (v) setViewRaw(v); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    try {
      // Restore view from URL hash
      const hv = hashToView(window.location.hash);
      if (hv) setViewRaw(hv);
      const raw = localStorage.getItem("gf30");
      if (raw) {
        const d = JSON.parse(raw);
        // Do NOT restore d.view — it now lives in sessionStorage
        if (d.week) setWeek(d.week); if (d.mode) setMode(d.mode); if (d.scale) setScale(d.scale);
        if (d.style && STYLES.includes(d.style)) setStyle(d.style); else if (d.style) setStyle("Metal"); if (d.dayCats) setDayCats(d.dayCats); if (d.dayHrs) setDayHrs(d.dayHrs);
        if (d.dayExMap) setDayExMap(d.dayExMap); if (d.doneMap) setDoneMap(d.doneMap);
        if (d.bpmLog) setBpmLog(d.bpmLog); if (d.noteLog) setNoteLog(d.noteLog);
        if (d.songs) setSongs(d.songs); if (d.songProgress) setSongProgress(d.songProgress);
        if (d.exEdits) setExEdits(d.exEdits);
        if (d.customSongs) setCustomSongs(d.customSongs);
      }
    } catch { /* first time */ }
    // Load streak + calendar
    try {
      const sr = localStorage.getItem("gf-streak");
      if (sr) setStreak(JSON.parse(sr));
      const cr = localStorage.getItem("gf-calendar");
      if (cr) setCalendarData(JSON.parse(cr));
      const slp = localStorage.getItem("gf-songlib-progress");
      if (slp) setSongLibProgress(JSON.parse(slp));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const data = { week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs };
      try { localStorage.setItem("gf30", JSON.stringify(data)); } catch { /* quota */ }
      try { localStorage.setItem("gf-songlib-progress", JSON.stringify(songLibProgress)); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs, songLibProgress]);

  // ── Streak & Calendar update when exercise is marked done ──
  const updateStreakAndCalendar = useCallback((newDoneMap: BoolMap) => {
    if (!ready) return;
    const today = new Date().toISOString().slice(0, 10);

    // Count how many exercises done today (across all days in current week view)
    let todayDone = 0;
    DAYS.forEach(d => {
      (dayExMap[d] || []).forEach(e => {
        if (newDoneMap[week + "-" + d + "-" + e.id]) todayDone++;
      });
    });

    // Update calendar
    const totalMin = DAYS.reduce((sum, d) => {
      return sum + (dayExMap[d] || []).filter(e => newDoneMap[week + "-" + d + "-" + e.id]).reduce((s, e) => s + e.m, 0);
    }, 0);
    setCalendarData(prev => {
      const next = { ...prev, [today]: { exercisesDone: todayDone, minutesPracticed: totalMin } };
      try { localStorage.setItem("gf-calendar", JSON.stringify(next)); } catch {}
      return next;
    });

    // Update streak
    if (todayDone > 0) {
      setStreak(prev => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        let newCurrent = prev.currentStreak;
        let newTotal = prev.totalDays;
        if (prev.lastPracticeDate !== today) {
          newTotal = prev.totalDays + 1;
          if (prev.lastPracticeDate === yesterday) {
            newCurrent = prev.currentStreak + 1;
          } else if (prev.lastPracticeDate !== today) {
            newCurrent = 1;
          }
        }
        const newLongest = Math.max(prev.longestStreak, newCurrent);
        const next = { currentStreak: newCurrent, longestStreak: newLongest, lastPracticeDate: today, totalDays: newTotal };
        try { localStorage.setItem("gf-streak", JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, [ready, week, dayExMap]);

  // ── Focus mode timer ──
  useEffect(() => {
    if (focusRunning) {
      focusIntervalRef.current = setInterval(() => setFocusTimer(t => t + 1), 1000);
    } else {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    }
    return () => { if (focusIntervalRef.current) clearInterval(focusIntervalRef.current); };
  }, [focusRunning]);

  // Auto-start timer when focus opens
  useEffect(() => {
    if (focusEx) { setFocusTimer(0); setFocusRunning(true); }
    else { setFocusRunning(false); setFocusTimer(0); }
  }, [focusEx]);

  // ── Smart suggestions generator ──
  const getSuggestions = useCallback(() => {
    const suggestions: { icon: string; text: string }[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // 1. Find least-practiced category
    const catCount: Record<string, number> = {};
    const catLastDate: Record<string, string> = {};
    CATS.forEach(c => { catCount[c] = 0; catLastDate[c] = ""; });
    Object.entries(calendarData).forEach(([date]) => {
      DAYS.forEach(d => {
        (dayExMap[d] || []).forEach(e => {
          if (doneMap[week + "-" + d + "-" + e.id]) {
            catCount[e.c] = (catCount[e.c] || 0) + 1;
            if (!catLastDate[e.c] || date > catLastDate[e.c]) catLastDate[e.c] = date;
          }
        });
      });
    });
    const activeCats = Object.keys(catCount).filter(c => c !== "Songs" && CATS.includes(c));
    const leastCat = activeCats.sort((a, b) => catCount[a] - catCount[b])[0];
    if (leastCat && catCount[leastCat] === 0) {
      suggestions.push({ icon: "📋", text: `You haven't practiced ${leastCat} yet — consider adding it to your routine.` });
    } else if (leastCat) {
      const daysSince = catLastDate[leastCat] ? Math.floor((new Date(today).getTime() - new Date(catLastDate[leastCat]).getTime()) / 86400000) : 0;
      if (daysSince > 3) suggestions.push({ icon: "📋", text: `You haven't practiced ${leastCat} in ${daysSince} days.` });
    }

    // 2. BPM plateau detection
    const bpmEntries = Object.entries(bpmLog).filter(([, v]) => v);
    if (bpmEntries.length > 3) {
      const lastBpm = bpmEntries[bpmEntries.length - 1];
      const prevBpms = bpmEntries.slice(-4, -1).map(([, v]) => parseInt(v));
      const lastVal = parseInt(lastBpm[1]);
      if (prevBpms.every(b => Math.abs(b - lastVal) <= 2)) {
        const exId = parseInt(lastBpm[0].split("-").pop() || "0");
        const ex = EXERCISES.find(e => e.id === exId);
        if (ex) suggestions.push({ icon: "⚡", text: `Your "${ex.n}" BPM has been stuck at ${lastVal} — try burst picking or slow-fast-slow to break through.` });
      }
    }

    // 3. Streak encouragement
    if (streak.currentStreak > 0 && streak.longestStreak > streak.currentStreak) {
      const diff = streak.longestStreak - streak.currentStreak;
      suggestions.push({ icon: "🔥", text: `Great streak! Keep it up for ${diff} more day${diff > 1 ? "s" : ""} to beat your record of ${streak.longestStreak}.` });
    } else if (streak.currentStreak === 0 && streak.longestStreak > 0) {
      suggestions.push({ icon: "💪", text: `Your best streak was ${streak.longestStreak} days — start a new one today!` });
    }

    // 4. New exercise suggestion
    const usedIds = new Set<number>();
    DAYS.forEach(d => (dayExMap[d] || []).forEach(e => usedIds.add(e.id)));
    const unused = EXERCISES.filter(e => !usedIds.has(e.id) && e.c !== "Songs");
    if (unused.length > 0) {
      const pick = unused[Math.floor(Math.random() * unused.length)];
      suggestions.push({ icon: "🎯", text: `Try adding "${pick.n}" (${pick.c}) — it complements your current routine.` });
    }

    // 5. Rest day reminder
    if (streak.currentStreak >= 6) {
      suggestions.push({ icon: "😴", text: `${streak.currentStreak} day streak — remember rest is part of progress too.` });
    }

    return suggestions.slice(0, 5);
  }, [calendarData, dayExMap, doneMap, week, bpmLog, streak]);

  // Wrapper for marking exercises done — updates streak + calendar
  function markDone(key: string, val: boolean) {
    setDoneMap(p => {
      const next = { ...p, [key]: val };
      setTimeout(() => updateStreakAndCalendar(next), 0);
      return next;
    });
  }
  function toggleDone(key: string) {
    setDoneMap(p => {
      const next = { ...p, [key]: !p[key] };
      setTimeout(() => updateStreakAndCalendar(next), 0);
      return next;
    });
  }

  function getEditedEx(ex: Exercise): Exercise { return exEdits[ex.id] ? { ...ex, ...exEdits[ex.id] } : ex; }

  function getSongItems(): Exercise[] {
    return songs.map((song) => {
      let ns = 0;
      for (let i = 0; i < STAGES.length; i++) { if (songProgress[week + "-" + song.id + "-" + i]?.done) ns = i + 1; else break; }
      return makeSongItem(song, Math.min(ns, STAGES.length - 1));
    });
  }

  function buildDay(day: string) {
    const cats = dayCats[day] || [], mins = (dayHrs[day] || 0) * 60;
    if (!cats.length || mins <= 0) return;
    setDayExMap((p) => ({ ...p, [day]: autoFill(cats, mins, cats.includes("Songs") ? getSongItems() : [], style) }));
  }

  async function generateSongBacking(song: SongEntry) {
    if (songBackingLoading[song.id]) return;
    setSongBackingLoading(prev => ({ ...prev, [song.id]: true }));

    const songKey = song.key || "Am";
    const isMinor = songKey.endsWith("m");
    const songScale = songKey;
    const songMode = isMinor ? "Aeolian" : "Ionian";
    const songStyle = song.genre || "Metal";
    const songBpm = song.tempo || 120;

    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scale: songScale,
          mode: songMode,
          style: songStyle,
          bpm: songBpm,
          title: `${song.title} - ${song.artist} Style Backing`,
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
        setSongBackingTracks(prev => ({ ...prev, [song.id]: audioUrl }));
        recordUsage(10);

        // Save to library
        try {
          const libTrack: LibraryTrack = {
            id: track.id || `song-${song.id}-${Date.now()}`,
            audioBlob: new Blob(),
            audioUrl,
            title: `${song.title} - ${song.artist} Backing`,
            style: songStyle,
            params: { scale: songScale, mode: songMode, style: songStyle, bpm: songBpm },
            duration: track.duration || 0,
            createdAt: Date.now(),
            source: "generate",
            favorite: false,
          };
          await saveToLibrary(libTrack);
        } catch {}
      }
    } catch (err) {
      console.error("Song backing generation failed:", err);
    } finally {
      setSongBackingLoading(prev => ({ ...prev, [song.id]: false }));
    }
  }

  function toggleSongBackingPlay(songId: number) {
    const url = songBackingTracks[songId];
    if (!url) return;

    if (songBackingPlaying === songId && songAudioRef.current) {
      songAudioRef.current.pause();
      setSongBackingPlaying(null);
      return;
    }

    if (songAudioRef.current) {
      songAudioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.onended = () => setSongBackingPlaying(null);
    audio.play();
    songAudioRef.current = audio;
    setSongBackingPlaying(songId);
  }

  function buildAll() {
    const nd: DayExMap = {};
    DAYS.forEach((day) => {
      const cats = dayCats[day] || [], mins = (dayHrs[day] || 0) * 60;
      if (cats.length > 0 && mins > 0) nd[day] = autoFill(cats, mins, cats.includes("Songs") ? getSongItems() : [], style);
    });
    setDayExMap(nd);
  }

  const curExList = dayExMap[selDay] || [];
  const curMin = curExList.reduce((s, e) => s + e.m, 0);
  const curDone = curExList.filter((e) => doneMap[week + "-" + selDay + "-" + e.id]).length;
  const curCats = dayCats[selDay] || [];

  let wTot = 0, wDn = 0, wMin = 0;
  DAYS.forEach((d) => (dayExMap[d] || []).forEach((e) => { wTot++; wMin += e.m; if (doneMap[week + "-" + d + "-" + e.id]) wDn++; }));
  const wPct = wTot > 0 ? Math.round((wDn / wTot) * 100) : 0;

  if (!ready) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: "#0A0A0A" }}>
      <div className="font-heading text-3xl font-black text-[#D4A843]">GuitarForge</div>
      <div className="font-label text-[10px] text-[#555]">Loading...</div>
    </div>
  );

  return (
    <ErrorBoundary>
    <div className="min-h-screen text-white" style={{ background: "#0A0A0A" }} dir="ltr">
      <Navbar view={view} onViewChange={setView} />
      {view === "studio" && <StudioPage channelScale={scale} channelMode={mode} channelStyle={style} />}
      {view === "jam" && <JamModePage />}
      <div key={viewKey} className="view-transition px-2 sm:px-5 py-3 sm:py-5 pb-16 sm:pb-5 max-w-[960px] lg:max-w-[1100px] xl:max-w-[1280px] mx-auto overflow-x-hidden">

        {view === "learn" && <LearningCenterPage />}
        {view === "profile" && <ProfilePage />}
        {view === "coach" && <AiCoachPage />}
        {view === "skills" && <SkillTreePage />}
        {view === "songs" && (() => {
          const allSongs = [...SONG_LIBRARY, ...customSongs];
          const filtered = allSongs.filter(s => {
            if (songLibFilter !== "all" && s.difficulty !== songLibFilter) return false;
            if (songLibSearch.trim()) {
              const q = songLibSearch.trim().toLowerCase();
              return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.genre || "").toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q);
            }
            return true;
          });
          const diffCounts = { all: allSongs.length, Beginner: allSongs.filter(s => s.difficulty === "Beginner").length, Intermediate: allSongs.filter(s => s.difficulty === "Intermediate").length, Advanced: allSongs.filter(s => s.difficulty === "Advanced").length };
          return (
            <div className="animate-fade-in">
              <div className="font-heading text-xl font-bold text-[#D4A843] mb-4">Song Library</div>
              <input type="text" placeholder="Search song, artist, genre..." className="input w-full mb-3"
                value={songLibSearch} onChange={e => setSongLibSearch(e.target.value)} />
              <div className="flex gap-1 flex-wrap mb-4">
                {([["all", "All", "#D4A843"], ["Beginner", "Beginner", "#22c55e"], ["Intermediate", "Intermediate", "#f59e0b"], ["Advanced", "Advanced", "#ef4444"]] as const).map(([key, label, color]) => (
                  <button key={key} onClick={() => setSongLibFilter(key as typeof songLibFilter)}
                    className="font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border transition-all"
                    style={songLibFilter === key ? { background: color, borderColor: color, color: "#0A0A0A" } : { borderColor: color + "40", color: color + "99" }}>
                    {label} ({diffCounts[key as keyof typeof diffCounts]})
                  </button>
                ))}
              </div>
              <div className="mb-4">
                <button onClick={() => setShowAddSong(!showAddSong)} className="btn-ghost !text-[10px] mb-2">
                  {showAddSong ? "Close" : "+ Add Song"}
                </button>
                {showAddSong && (
                  <div className="panel p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                      <input placeholder="Song title..." value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} className="input min-w-0" />
                      <input placeholder="Artist..." value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} className="input min-w-0" />
                      <button onClick={() => {
                        if (!newSongTitle.trim() || !newSongArtist.trim()) return;
                        setCustomSongs(p => [...p, { id: Date.now(), title: newSongTitle.trim(), artist: newSongArtist.trim() }]);
                        setNewSongTitle(""); setNewSongArtist("");
                      }} className="btn-gold">Add</button>
                    </div>
                  </div>
                )}
              </div>
              {filtered.length === 0 && (
                <div className="panel p-8 text-center">
                  <div className="font-label text-sm text-[#444]">No songs found</div>
                </div>
              )}
              {(() => {
                const limited = songLibShowAll ? filtered : filtered.slice(0, 50);
                return (<>
                  {limited.map(song => {
                    const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#f59e0b", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                    const isCustom = song.id >= 1000000000;
                    return (
                      <div key={song.id} onClick={() => setSongModal(song)}
                        className="panel p-4 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</span>
                              {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                            </div>
                            <div className="font-readout text-[11px] text-[#666] mt-1">{song.artist}</div>
                            <div className="flex gap-2 mt-1 flex-wrap items-center">
                              {song.genre && <span className="font-readout text-[9px] text-[#555]">{song.genre}</span>}
                              {song.key && <span className="font-readout text-[9px] text-[#555]">Key: {song.key}</span>}
                              {song.tempo && <span className="font-readout text-[9px] text-[#555]">{song.tempo} BPM</span>}
                              {song.tuning && song.tuning !== "Standard" && <span className="font-readout text-[9px] text-[#555]">{song.tuning}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {isCustom && (
                              <button onClick={(e) => { e.stopPropagation(); setCustomSongs(p => p.filter(s => s.id !== song.id)); }}
                                className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333]">Remove</button>
                            )}
                            {/* Generate / Play backing track */}
                            {songBackingTracks[song.id] ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); toggleSongBackingPlay(song.id); }}
                                className="btn-ghost !px-2 !py-1 !text-[9px] flex items-center gap-1"
                                style={{ borderColor: songBackingPlaying === song.id ? "#D4A843" : undefined }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill={songBackingPlaying === song.id ? "#D4A843" : "none"} stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  {songBackingPlaying === song.id
                                    ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
                                    : <polygon points="5 3 19 12 5 21 5 3"/>}
                                </svg>
                                {songBackingPlaying === song.id ? "Pause" : "Play"}
                              </button>
                            ) : (
                              <button type="button" onClick={(e) => { e.stopPropagation(); generateSongBacking(song); }}
                                disabled={songBackingLoading[song.id]}
                                className="btn-ghost !px-2 !py-1 !text-[9px] flex items-center gap-1 disabled:opacity-50">
                                {songBackingLoading[song.id] ? (
                                  <>
                                    <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/></svg>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>
                                    Backing
                                  </>
                                )}
                              </button>
                            )}
                            {/* 6-stage progress bar */}
                            {(() => {
                              const stages = songLibProgress[song.id] || 0;
                              return (
                                <div className="flex items-center gap-1">
                                  <div className="flex gap-[2px]">
                                    {[0,1,2,3,4,5].map(i => (
                                      <div key={i} className="rounded-[1px]" style={{ width: 8, height: 4, background: i < stages ? "#D4A843" : "#1a1a1a" }}
                                        onClick={(e) => { e.stopPropagation(); setSongLibProgress(p => ({ ...p, [song.id]: i < stages ? i : i + 1 })); }} />
                                    ))}
                                  </div>
                                  <span className="font-readout text-[8px] text-[#444]">{stages}/6</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!songLibShowAll && filtered.length > 50 && (
                    <button type="button" onClick={() => setSongLibShowAll(true)} className="btn-ghost w-full mt-2 !text-[11px]">
                      Show all {filtered.length} songs
                    </button>
                  )}
                </>);
              })()}
            </div>
          );
        })()}

        {/* ══ DASHBOARD ══ */}
        {view === "dash" && (<div className="animate-fade-in">
          {/* 1. Week Progress (most important) */}
          <div className="panel-primary p-4 sm:p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-label text-[11px] text-[#D4A843] flex items-center gap-2">
                <div className={`led ${wPct >= 100 ? "led-on" : "led-gold"}`} /> Week {week} Progress
              </span>
              <span className={`font-readout text-3xl sm:text-4xl font-bold ${wPct >= 100 ? "text-[#33CC33] progress-glow-green" : "text-[#D4A843] progress-glow"}`}>{wPct}%</span>
            </div>
            <div className="vu"><div className="vu-fill" style={{ width: wPct + "%" }} /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 text-center">
              <div>
                <div className="font-stat text-xl sm:text-2xl text-[#D4A843]">{wDn}</div>
                <div className="font-label text-[9px] text-[#555]">Done</div>
              </div>
              <div>
                <div className="font-stat text-xl sm:text-2xl text-[#888]">{wTot}</div>
                <div className="font-label text-[9px] text-[#555]">Total</div>
              </div>
              <div>
                <div className="font-stat text-xl sm:text-2xl text-[#D4A843]">{wMin}</div>
                <div className="font-label text-[9px] text-[#555]">Minutes</div>
              </div>
              <div>
                <div className="font-stat text-xl sm:text-2xl text-[#D4A843]">
                  {DAYS.filter(d => (dayExMap[d] || []).some(e => doneMap[week + "-" + d + "-" + e.id])).length}
                </div>
                <div className="font-label text-[9px] text-[#555]">Days Active</div>
              </div>
            </div>
          </div>

          {/* ── Streak + Calendar Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 mb-4">
            {/* Streak counter */}
            <div className="panel p-4 flex items-center gap-3 sm:min-w-[200px]">
              <span className="text-3xl">🔥</span>
              <div>
                <div className="font-stat text-2xl text-[#D4A843]">{streak.currentStreak}</div>
                <div className="font-label text-[9px] text-[#555]">Day Streak</div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-readout text-[11px] text-[#666]">Best: {streak.longestStreak}</div>
                <div className="font-readout text-[10px] text-[#444]">{streak.totalDays} total days</div>
              </div>
            </div>

            {/* Practice Calendar Heatmap — last 12 weeks */}
            <div className="panel p-4 overflow-hidden">
              <div className="font-label text-[10px] text-[#555] mb-2 flex items-center gap-2">
                <div className="led led-on" style={{ width: 6, height: 6 }} /> Practice Activity
              </div>
              <div className="flex gap-1" style={{ direction: "ltr" }}>
                {/* Day labels */}
                <div className="flex flex-col gap-[2px] text-[8px] text-[#444] font-readout pt-0" style={{ width: "20px" }}>
                  <div style={{ height: "12px" }}></div>
                  <div style={{ height: "12px", lineHeight: "12px" }}>Mon</div>
                  <div style={{ height: "12px" }}></div>
                  <div style={{ height: "12px", lineHeight: "12px" }}>Wed</div>
                  <div style={{ height: "12px" }}></div>
                  <div style={{ height: "12px", lineHeight: "12px" }}>Fri</div>
                  <div style={{ height: "12px" }}></div>
                </div>
                {/* Grid */}
                <div className="flex gap-[2px] flex-1 overflow-hidden justify-end">
                  {(() => {
                    const weeks: { date: string; count: number }[][] = [];
                    const today = new Date();
                    // Go back 83 days (12 weeks)
                    const start = new Date(today);
                    start.setDate(start.getDate() - 83);
                    // Align to Sunday
                    start.setDate(start.getDate() - start.getDay());
                    let cur = new Date(start);
                    let curWeek: { date: string; count: number }[] = [];
                    while (cur <= today) {
                      const ds = cur.toISOString().slice(0, 10);
                      const cd = calendarData[ds];
                      curWeek.push({ date: ds, count: cd?.exercisesDone || 0 });
                      if (curWeek.length === 7) { weeks.push(curWeek); curWeek = []; }
                      cur.setDate(cur.getDate() + 1);
                    }
                    if (curWeek.length > 0) weeks.push(curWeek);
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
          </div>

          {/* ── Smart Suggestions ── */}
          {(() => {
            const suggestions = getSuggestions();
            if (suggestions.length === 0) return null;
            return (
              <div className="panel-secondary p-4 mb-4">
                <div className="font-label text-[10px] text-[#666] mb-2 flex items-center gap-2">
                  💡 Suggestions
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

          {/* Schedule — Task 7: primary panel */}
          <div className="panel-primary p-4 sm:p-5 mb-4">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <span className="font-label text-[11px] text-[#D4A843] flex items-center gap-2"><div className="led led-gold" /> Schedule</span>
              <div className="flex gap-2">
                <button onClick={() => setShowEditor(!showEditor)} className="btn-ghost">{showEditor ? "Close" : "Edit"}</button>
                <button onClick={buildAll} className="btn-gold">Build Routine</button>
              </div>
            </div>

            {showEditor && (
              <div className="mb-4 p-4 bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm">
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
                                <span className="text-[8px]">{isCollapsed ? "▶" : "▼"}</span> {group}
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
              </div>
            )}

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {DAYS.map((day) => {
                const ac = dayCats[day] || [], hrs = dayHrs[day] || 0, exs = dayExMap[day] || [];
                const d2 = exs.filter((e) => doneMap[week + "-" + day + "-" + e.id]).length;
                const off = !ac.length, pct = exs.length ? Math.round((d2 / exs.length) * 100) : 0;
                return (
                  <div key={day} onClick={() => { setSelDay(day); setView("daily"); }}
                    className={`rounded-sm p-2 cursor-pointer text-center transition-all ${off ? "bg-[#0A0A0A] border border-[#1a1a1a]" : "panel hover:border-[#D4A843]/30"} ${selDay === day ? "!border-[#D4A843] ring-1 ring-[#D4A843]/30 !bg-[#1a1708]" : ""}`}>
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

          <div className="flex gap-2 mb-4">
            <button onClick={() => {
              // Archive current week data before moving on
              try {
                const archive = JSON.parse(localStorage.getItem("gf-archive") || "[]");
                archive.push({ week, mode, scale, style, doneMap, bpmLog, dayExMap, date: new Date().toLocaleDateString("he-IL") });
                localStorage.setItem("gf-archive", JSON.stringify(archive.slice(-52)));
              } catch {}
              setWeek(week + 1); setDoneMap({}); setBpmLog({});
            }} className="btn-gold !text-[10px]">Finish Week &amp; Archive</button>
            <button onClick={() => { setWeek(week + 1); setDoneMap({}); setBpmLog({}); setDayExMap({}); }}
              className="btn-ghost !text-[10px] !text-[#C41E3A] !border-[#C41E3A]/30">Reset All</button>
          </div>

          {/* 3. Setlist */}
          <div className="panel p-3 sm:p-5 mb-4" style={{ borderColor: "#1a3a2a" }}>
            <div className="font-label text-[11px] text-[#33CC33] mb-3 flex items-center gap-2">
              <div className="led led-on" /> Setlist
            </div>
            {songs.map((song) => {
              const dn = STAGES.filter((_, si) => songProgress[week + "-" + song.id + "-" + si]?.done).length;
              return (
                <div key={song.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm mb-1.5">
                  <div className="flex-1">
                    <div className="font-heading text-sm !font-medium !normal-case !tracking-normal">{song.name}</div>
                    <div className="font-readout text-[10px] text-[#555]">{dn}/6</div>
                  </div>
                  {song.url && <a href={song.url} target="_blank" rel="noopener noreferrer" className="font-label text-[9px] text-[#D4A843] no-underline hover:text-[#DFBD69]">Tab</a>}
                  <button onClick={() => setSongs((p) => p.filter((s) => s.id !== song.id))} className="btn-ghost !px-2 !py-1 !text-[10px] !text-[#C41E3A] !border-[#333]">Remove</button>
                </div>
              );
            })}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-3">
              <input placeholder="Song name..." value={newSongName} onChange={(e) => setNewSongName(e.target.value)} className="input min-w-0" />
              <input placeholder="Tab URL..." value={newSongUrl} onChange={(e) => setNewSongUrl(e.target.value)} className="input min-w-0" />
              <button onClick={() => { if (!newSongName.trim()) return; setSongs((p) => [...p, { name: newSongName.trim(), url: newSongUrl.trim(), id: Date.now() }]); setNewSongName(""); setNewSongUrl(""); }} className="btn-gold">Add</button>
            </div>
            <SongsterrSearch onSelect={(name, url) => {
              setSongs((p) => [...p, { name, url, id: Date.now() }]);
            }} />
          </div>

          {/* Suno backing track suggestion */}
          {!sunoSuggestDismissed && !sunoSuggestUrl && (
            <div className="panel-secondary p-3 mb-4 flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" className="flex-shrink-0">
                <path d="M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 19V5l12-4v14m0 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              <div className="flex-1">
                <div className="font-label text-[10px] text-[#D4A843]">AI Backing Track</div>
                <div className="font-readout text-[9px] text-[#555]">{scale} {mode} · {style} · Generate a practice track with Suno AI</div>
              </div>
              <button type="button" onClick={async () => {
                setSunoSuggestLoading(true);
                try {
                  const res = await fetch("/api/suno", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scale, mode, style, bpm: 120, title: `${scale} ${mode} ${style} Practice` }) });
                  const data = await res.json();
                  if (data.tracks?.[0]?.audioUrl) setSunoSuggestUrl(data.tracks[0].audioUrl);
                } catch {} finally { setSunoSuggestLoading(false); }
              }} className="btn-gold !text-[9px] !px-3 flex-shrink-0" disabled={sunoSuggestLoading}>
                {sunoSuggestLoading ? "Generating..." : "Generate"}
              </button>
              <button type="button" aria-label="Dismiss" title="Dismiss" onClick={() => setSunoSuggestDismissed(true)} className="text-[#333] hover:text-[#666] flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          {sunoSuggestUrl && (
            <div className="panel-secondary p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="font-label text-[10px] text-[#D4A843]">AI Backing Track</div>
                <span className="font-readout text-[9px] text-[#555]">{scale} {mode} · {style}</span>
              </div>
              <audio src={sunoSuggestUrl} controls loop className="w-full" style={{ height: 32 }} />
            </div>
          )}

          {/* 4. Channel Settings (collapsible) */}
          <div className="panel-secondary mb-4">
            <button onClick={() => setSettingsOpen(p => !p)} className="panel-header flex items-center gap-2 w-full cursor-pointer bg-transparent border-0 text-left">
              <div className="led led-gold" />
              <span className="flex-1">CHANNEL SETTINGS</span>
              <span className="font-readout text-[10px] text-[#555]">
                {!settingsOpen && `W${week} · ${mode} · ${scale} · ${style}`}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { l: "Week", v: <div className="segment-display text-center mt-1"><input type="number" value={week} min={1} onChange={(e) => setWeek(Number(e.target.value))} className="bg-transparent border-none outline-none text-center w-full font-mono font-bold text-[#D4A843]" style={{ boxShadow: 'none' }} /></div> },
                  { l: "Mode", v: <select value={mode} onChange={(e) => setMode(e.target.value)} className="input w-full text-[12px] sm:text-[14px]">{MODES.map((m) => <option key={m}>{m}</option>)}</select> },
                  { l: "Key", v: <select value={scale} onChange={(e) => setScale(e.target.value)} className="input w-full">{SCALES.map((s) => <option key={s}>{s}</option>)}</select> },
                  { l: "Style", v: <select value={style} onChange={(e) => setStyle(e.target.value)} className="input w-full text-[12px] sm:text-[14px]">{STYLES.map((s) => <option key={s}>{s}</option>)}</select> },
                ].map(({ l, v }) => <label key={l} className="font-label text-[11px] text-[#666]">{l}<div className="mt-1">{v}</div></label>)}
              </div>
            )}
          </div>
        </div>)}

        {/* ══ PRACTICE ══ */}
        {view === "daily" && (<div className="animate-fade-in">
          {/* Streak in practice header */}
          {streak.currentStreak > 0 && (
            <div className="flex items-center gap-2 mb-3 text-[12px] text-[#888]">
              <span>🔥</span>
              <span className="font-stat text-[#D4A843]">{streak.currentStreak} Day Streak!</span>
            </div>
          )}
          {/* Task 4: Practice progress bar */}
          {curExList.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-label text-[10px] text-[#666]">{curDone}/{curExList.length} exercises</span>
                <span className={`font-readout text-[11px] font-bold ${curDone === curExList.length && curExList.length > 0 ? "text-[#33CC33]" : "text-[#D4A843]"}`}>
                  {curExList.length > 0 ? Math.round((curDone / curExList.length) * 100) : 0}%
                </span>
              </div>
              <div className="practice-progress-bar">
                <div className="practice-progress-fill" style={{ width: (curExList.length > 0 ? Math.round((curDone / curExList.length) * 100) : 0) + "%" }} />
              </div>
            </div>
          )}

          <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide pb-1">
            {DAYS.map((day) => (
              <button key={day} onClick={() => setSelDay(day)}
                className={`font-label text-[11px] px-3 py-1.5 rounded-sm cursor-pointer transition-all flex-shrink-0 ${
                  selDay === day ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] hover:text-[#aaa]"
                }`}><span className="sm:hidden">{day.slice(0, 3)}</span><span className="hidden sm:inline">{day}</span></button>
            ))}
          </div>

          <div className="panel p-3 sm:p-5 mb-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <div className="font-heading text-lg sm:text-xl font-bold text-[#D4A843]">{selDay}</div>
                <div className="font-readout text-[10px] sm:text-[11px] text-[#555] mt-0.5">
                  <span>{curExList.length} exercises</span>
                  <span className="mx-1">·</span>
                  <span>{curMin} min</span>
                  <span className="mx-1">·</span>
                  <span>{curDone} done</span>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {curCats.map((cat) => <span key={cat} className="tag" style={{ border: `1px solid ${COL[cat]}30`, color: COL[cat] }}>{cat}</span>)}
                  {!curCats.length && <span className="font-label text-[10px] text-[#333]">Rest Day</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => buildDay(selDay)} className="btn-ghost">Auto Fill</button>
                <button type="button" onClick={() => { setExPickerOpen(true); setExPickerSearch(""); setExPickerCat("All"); }} className="btn-ghost">+ Exercise</button>
                {songs.length > 0 && (
                  <select title="Add song stage" onChange={(e) => { if (!e.target.value) return; const [sid, sidx] = e.target.value.split("x").map(Number); const song = songs.find((s) => s.id === sid); if (song) setDayExMap((p) => ({ ...p, [selDay]: [...(p[selDay] || []), makeSongItem(song, sidx)] })); e.target.value = ""; }} className="input w-full sm:!w-auto !py-1.5 text-[11px]" style={{ borderColor: "#1a3a2a" }} defaultValue="">
                    <option value="" disabled>+ Song</option>
                    {songs.map((song) => <optgroup key={song.id} label={song.name}>{STAGES.map((st, si) => <option key={si} value={song.id + "x" + si}>{songProgress[week + "-" + song.id + "-" + si]?.done ? "✓ " : ""}{song.name} - {st.name} ({st.m}m)</option>)}</optgroup>)}
                  </select>
                )}
              </div>
              {/* Fix #3: Searchable exercise picker */}
              {exPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={() => setExPickerOpen(false)}>
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative w-full max-w-[520px] mx-2 rounded-sm overflow-hidden" style={{ background: "#111", border: "1px solid #333", maxHeight: "70vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                    <div className="p-3 border-b border-[#222]">
                      <input type="text" placeholder="Search exercises..." className="input w-full mb-2" autoFocus
                        value={exPickerSearch} onChange={e => setExPickerSearch(e.target.value)} />
                      <div className="flex gap-1 flex-wrap">
                        <button type="button" onClick={() => setExPickerCat("All")}
                          className={`font-label text-[9px] px-2 py-0.5 rounded-sm border transition-all ${exPickerCat === "All" ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All</button>
                        {CATS.filter(c => c !== "Songs").map(cat => (
                          <button type="button" key={cat} onClick={() => setExPickerCat(cat)}
                            className="font-label text-[9px] px-2 py-0.5 rounded-sm border transition-all"
                            style={exPickerCat === cat ? { background: COL[cat], borderColor: COL[cat], color: "#0A0A0A" } : { borderColor: (COL[cat] || "#888") + "40", color: (COL[cat] || "#888") + "99" }}>{cat}</button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: "50vh" }}>
                      {EXERCISES.filter(e => {
                        if (exPickerCat !== "All" && e.c !== exPickerCat) return false;
                        if (exPickerSearch.trim()) {
                          const q = exPickerSearch.trim().toLowerCase();
                          return e.n.toLowerCase().includes(q) || e.d.toLowerCase().includes(q) || e.c.toLowerCase().includes(q);
                        }
                        return true;
                      }).map(ex => (
                        <button type="button" key={ex.id} onClick={() => {
                          setDayExMap(p => ({ ...p, [selDay]: [...(p[selDay] || []), ex] }));
                          setExPickerOpen(false);
                        }} className="w-full text-left px-3 py-2 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                          <span className="tag flex-shrink-0 !text-[8px]" style={{ border: `1px solid ${COL[ex.c] || "#888"}40`, color: COL[ex.c] || "#888" }}>{ex.c}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-[#ccc] truncate">{ex.n}</div>
                            <div className="font-readout text-[9px] text-[#555]">{ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-t border-[#222] text-center">
                      <button type="button" onClick={() => setExPickerOpen(false)} className="btn-ghost !text-[10px]">Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fix #2: Improved empty state */}
          {!curExList.length && <div className="panel p-8 sm:p-12 text-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-5 opacity-40">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
            </svg>
            <div className="font-heading text-xl text-[#D4A843] mb-2">Ready to Practice?</div>
            <div className="font-readout text-[12px] text-[#555] mb-5 max-w-[320px] mx-auto">
              {curCats.length > 0
                ? "Hit Auto Fill to generate today's routine based on your selected categories."
                : "Go to Dashboard > Schedule to set categories for this day, then come back and Auto Fill."}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => buildDay(selDay)} className="btn-gold">Auto Fill</button>
              <button type="button" onClick={() => { setExPickerOpen(true); setExPickerSearch(""); setExPickerCat("All"); }} className="btn-ghost">+ Add Exercise</button>
            </div>
          </div>}

          {curExList.map((rawEx, idx) => {
            const ex = typeof rawEx.id === "number" && rawEx.id < 1000 ? getEditedEx(rawEx) : rawEx;
            const done = doneMap[week + "-" + selDay + "-" + ex.id], cc = COL[ex.c] || "#888", isSong = ex.c === "Songs";
            return (
              <div key={String(ex.id) + "-" + idx} className={`flex items-start gap-2 sm:gap-3 px-2 sm:px-4 py-2.5 sm:py-3 mb-2 rounded-sm transition-all ${isSong ? "bg-[#0a110a] border border-[#1a3a2a]" : "panel"}`} style={{ opacity: done ? 0.4 : 1 }}>
                <button type="button" aria-label={done ? "Mark undone" : "Mark done"} onClick={() => {
                  const k = week + "-" + selDay + "-" + ex.id; toggleDone(k);
                  if (isSong && ex.songId !== undefined && ex.stageIdx !== undefined) setSongProgress((p) => ({ ...p, [week + "-" + ex.songId + "-" + ex.stageIdx]: { ...p[week + "-" + ex.songId + "-" + ex.stageIdx], done: !done } }));
                }} className="cursor-pointer mt-1.5 flex-shrink-0 bg-transparent border-none p-0">
                  <div className={`led ${done ? "led-on" : "led-off"}`} style={{ width: 10, height: 10 }} />
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setModal(ex)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tag flex-shrink-0" style={{ border: `1px solid ${cc}40`, color: cc }}>{ex.c}</span>
                    <span className="font-heading text-[13px] sm:text-sm !font-medium !normal-case !tracking-normal leading-snug">{ex.n}</span>
                  </div>
                  <div className="font-readout text-[10px] text-[#444] mt-1 line-clamp-1">{ex.m}min {ex.b ? "· " + ex.b + " BPM" : ""} · {ex.f}</div>
                </div>
                <div className="hidden sm:flex flex-col gap-1 flex-shrink-0">
                  <div className="flex gap-0.5">
                    <button onClick={() => { if (!idx) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx-1]] = [l[idx-1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px]" style={{ opacity: idx === 0 ? 0.2 : 1 }}>UP</button>
                    <button onClick={() => { if (idx >= curExList.length - 1) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx+1]] = [l[idx+1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px]" style={{ opacity: idx >= curExList.length - 1 ? 0.2 : 1 }}>DN</button>
                  </div>
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => setFocusEx({ ex, idx })} className="btn-ghost !px-1.5 !py-0.5 !text-[9px]">Focus</button>
                    {!isSong && <button onClick={() => { const pool = EXERCISES.filter((e) => e.c === ex.c && e.id !== ex.id); if (!pool.length) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); l[idx] = pool[Math.floor(Math.random() * pool.length)]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px]">Swap</button>}
                    <button type="button" onClick={() => setDayExMap((p) => { const l = (p[selDay] || []).slice(); l.splice(idx, 1); return { ...p, [selDay]: l }; })}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px] !text-[#C41E3A]">Del</button>
                  </div>
                </div>
                {/* Task 6: Mobile compact action row */}
                <div className="mobile-action-row flex-shrink-0 mt-1">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFocusEx({ ex, idx }); }}
                    className="btn-ghost !px-2 !py-1 !text-[9px]" aria-label="Focus">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  {!isSong && <button type="button" onClick={(e) => { e.stopPropagation(); const pool = EXERCISES.filter((x) => x.c === ex.c && x.id !== ex.id); if (!pool.length) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); l[idx] = pool[Math.floor(Math.random() * pool.length)]; return { ...p, [selDay]: l }; }); }}
                    className="btn-ghost !px-2 !py-1 !text-[9px]" aria-label="Swap">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  </button>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDayExMap((p) => { const l = (p[selDay] || []).slice(); l.splice(idx, 1); return { ...p, [selDay]: l }; }); }}
                    className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#C41E3A]/20" aria-label="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Fix #2: Quick Stats + Suggested Exercises when few exercises */}
          {curExList.length > 0 && curExList.length <= 4 && (() => {
            const todayBpms = curExList.map(e => bpmLog[week + "-" + selDay + "-" + e.id]).filter(Boolean);
            const curIds = new Set(curExList.map(e => e.id));
            const suggested = EXERCISES.filter(e => curCats.includes(e.c) && !curIds.has(e.id)).slice(0, 5);
            return (<>
              <div className="panel p-4 mb-3 mt-3">
                <div className="font-label text-[10px] text-[#D4A843] mb-2">Quick Stats</div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="font-stat text-lg text-[#D4A843]">{curDone}/{curExList.length}</div>
                    <div className="font-label text-[9px] text-[#555]">Done Today</div>
                  </div>
                  <div>
                    <div className="font-stat text-lg text-[#D4A843]">{curMin}m</div>
                    <div className="font-label text-[9px] text-[#555]">Total Time</div>
                  </div>
                  <div>
                    <div className="font-stat text-lg text-[#D4A843]">{todayBpms.length > 0 ? todayBpms[todayBpms.length - 1] : "--"}</div>
                    <div className="font-label text-[9px] text-[#555]">Last BPM</div>
                  </div>
                </div>
              </div>
              {suggested.length > 0 && (
                <div className="panel p-4 mb-3">
                  <div className="font-label text-[10px] text-[#666] mb-2">Suggested Exercises</div>
                  {suggested.map(ex => (
                    <button type="button" key={ex.id} onClick={() => setDayExMap(p => ({ ...p, [selDay]: [...(p[selDay] || []), ex] }))}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-[#1a1a1a] transition-colors">
                      <span className="tag !text-[8px]" style={{ border: `1px solid ${COL[ex.c] || "#888"}40`, color: COL[ex.c] || "#888" }}>{ex.c}</span>
                      <span className="text-[11px] text-[#888] flex-1 truncate">{ex.n}</span>
                      <span className="font-readout text-[9px] text-[#444]">{ex.m}m</span>
                      <span className="text-[10px] text-[#D4A843]">+</span>
                    </button>
                  ))}
                </div>
              )}
            </>);
          })()}
        </div>)}

        {/* ══ LIBRARY ══ */}
        {view === "lib" && (<div className="animate-fade-in">
          {/* Sub-tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
            {([["exercises", "Exercises"], ["styles", "Styles"], ["songs", "Songs"], ["songlib", "Song Library +"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setLibTab(key)}
                className={`font-label text-[11px] px-4 py-1.5 rounded-sm cursor-pointer border transition-all flex-shrink-0 ${libTab === key ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>{label}</button>
            ))}
          </div>

          {/* Exercises tab */}
          {libTab === "exercises" && (<>
            <input type="text" placeholder="Search exercise..." className="input w-full mb-3"
              value={libSearch} onChange={e => setLibSearch(e.target.value)} />

            <div className="flex gap-1 flex-wrap mb-4">
              <button onClick={() => setLibFilter("All")} className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${libFilter === "All" ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All ({EXERCISES.length})</button>
              {CATS.filter((c) => c !== "Songs").map((cat) => {
                const cnt = EXERCISES.filter((e) => e.c === cat).length, c = COL[cat];
                if (!cnt) return null;
                return <button key={cat} onClick={() => setLibFilter(cat)} className="font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border transition-all"
                  style={libFilter === cat ? { background: c, borderColor: c, color: "#0A0A0A" } : { borderColor: c + "40", color: c + "99" }}>{cat} ({cnt})</button>;
              })}
            </div>

            {(() => {
              const filtered = EXERCISES.filter((e) => {
                if (libFilter !== "All" && e.c !== libFilter) return false;
                if (libSearch.trim()) {
                  const q = libSearch.trim().toLowerCase();
                  return e.n.toLowerCase().includes(q) || e.d.toLowerCase().includes(q) || e.f.toLowerCase().includes(q);
                }
                return true;
              });
              const limited = libShowAll ? filtered : filtered.slice(0, 50);
              return (<>
                {limited.map((rawEx) => {
                  const ex = getEditedEx(rawEx), c = COL[ex.c], isEd = editingId === ex.id;
                  return (
                    <div key={ex.id} className={`panel mb-1.5 overflow-hidden ${isEd ? "!border-[#D4A843]/30" : ""}`}>
                      <div onClick={() => setEditingId(isEd ? null : ex.id)} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                        <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                        <div className="flex-1">
                          <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{ex.n}</div>
                          <div className="font-readout text-[10px] text-[#444]">{ex.f} · {ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                        </div>
                        <span className="text-[10px] text-[#333]">{isEd ? "−" : "+"}</span>
                      </div>
                      {isEd && <LibraryEditor ex={ex} exEdits={exEdits} setExEdits={setExEdits} />}
                    </div>
                  );
                })}
                {!libShowAll && filtered.length > 50 && (
                  <button type="button" onClick={() => setLibShowAll(true)} className="btn-ghost w-full mt-2 !text-[11px]">
                    Show all {filtered.length} items
                  </button>
                )}
              </>);
            })()}
          </>)}

          {/* Styles tab */}
          {libTab === "styles" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STYLES.map((s) => {
                const cnt = EXERCISES.filter((e) => e.styles?.includes(s)).length;
                return (
                  <div key={s} className="panel p-4 text-center">
                    <div className="font-heading text-sm font-bold text-[#D4A843]">{s}</div>
                    <div className="font-readout text-[11px] text-[#555] mt-1">{cnt} exercises</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Songs tab */}
          {libTab === "songs" && (
            <div>
              {songs.length === 0 && <div className="panel p-8 sm:p-12 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#33CC33" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                  <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
                </svg>
                <div className="font-heading text-lg text-[#33CC33] mb-2">No Songs</div>
                <div className="font-readout text-[11px] text-[#444] mb-4">Add songs from the Dashboard</div>
                <button type="button" onClick={() => setView("dash")} className="btn-ghost">Dashboard</button>
              </div>}
              {songs.map((song) => {
                const dn = STAGES.filter((_, si) => songProgress[week + "-" + song.id + "-" + si]?.done).length;
                return (
                  <div key={song.id} className="panel p-4 mb-1.5">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-heading text-sm !font-medium !normal-case !tracking-normal">{song.name}</div>
                        <div className="font-readout text-[10px] text-[#555] mt-1">Stage {dn + 1} of {STAGES.length}</div>
                      </div>
                      <div className="font-readout text-lg font-bold text-[#D4A843]">{dn}/{STAGES.length}</div>
                    </div>
                    <div className="vu mt-2 !h-[3px]"><div className="vu-fill" style={{ width: Math.round((dn / STAGES.length) * 100) + "%" }} /></div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {STAGES.map((st, si) => {
                        const done = songProgress[week + "-" + song.id + "-" + si]?.done;
                        return <span key={si} className="font-label text-[9px] px-2 py-0.5 rounded-sm border" style={{ borderColor: done ? "#33CC33" + "40" : "#222", color: done ? "#33CC33" : "#444" }}>{st.name}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Song Library tab */}
          {libTab === "songlib" && (() => {
            const allSongs = [...SONG_LIBRARY, ...customSongs];
            const genres = [...new Set(allSongs.map(s => s.genre).filter(Boolean))];
            const artists = [...new Set(allSongs.map(s => s.artist).filter(Boolean))];
            const filtered = allSongs.filter(s => {
              if (songLibFilter !== "all" && s.difficulty !== songLibFilter) return false;
              if (songLibSearch.trim()) {
                const q = songLibSearch.trim().toLowerCase();
                return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.genre || "").toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q);
              }
              return true;
            });
            const diffCounts = { all: allSongs.length, Beginner: allSongs.filter(s => s.difficulty === "Beginner").length, Intermediate: allSongs.filter(s => s.difficulty === "Intermediate").length, Advanced: allSongs.filter(s => s.difficulty === "Advanced").length };
            return (
              <div>
                {/* Search */}
                <input type="text" placeholder="Search song, artist, genre..." className="input w-full mb-3"
                  value={songLibSearch} onChange={e => setSongLibSearch(e.target.value)} />

                {/* Difficulty filter */}
                <div className="flex gap-1 flex-wrap mb-4">
                  {([["all", "All", "#D4A843"], ["Beginner", "Beginner", "#22c55e"], ["Intermediate", "Intermediate", "#f59e0b"], ["Advanced", "Advanced", "#ef4444"]] as const).map(([key, label, color]) => (
                    <button key={key} onClick={() => setSongLibFilter(key as typeof songLibFilter)}
                      className="font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border transition-all"
                      style={songLibFilter === key ? { background: color, borderColor: color, color: "#0A0A0A" } : { borderColor: color + "40", color: color + "99" }}>
                      {label} ({diffCounts[key as keyof typeof diffCounts]})
                    </button>
                  ))}
                </div>

                {/* Add custom song */}
                <div className="mb-4">
                  <button onClick={() => setShowAddSong(!showAddSong)} className="btn-ghost !text-[10px] mb-2">
                    {showAddSong ? "Close" : "+ Add Song"}
                  </button>
                  {showAddSong && (
                    <div className="panel p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                        <input placeholder="Song title..." value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} className="input min-w-0" />
                        <input placeholder="Artist..." value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} className="input min-w-0" />
                        <button onClick={() => {
                          if (!newSongTitle.trim() || !newSongArtist.trim()) return;
                          setCustomSongs(p => [...p, { id: Date.now(), title: newSongTitle.trim(), artist: newSongArtist.trim() }]);
                          setNewSongTitle(""); setNewSongArtist("");
                        }} className="btn-gold">Add</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Song cards */}
                {filtered.length === 0 && (
                  <div className="panel p-8 text-center">
                    <div className="font-label text-sm text-[#444]">No songs found</div>
                  </div>
                )}
                {(() => {
                  const limited = songLibShowAll ? filtered : filtered.slice(0, 50);
                  return (<>
                    {limited.map(song => {
                      const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#f59e0b", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                      const isCustom = song.id >= 1000000000;
                      return (
                        <div key={song.id} onClick={() => setSongModal(song)}
                          className="panel p-4 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</span>
                                {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                              </div>
                              <div className="font-readout text-[11px] text-[#666] mt-1">{song.artist}</div>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {song.genre && <span className="font-readout text-[9px] text-[#555]">{song.genre}</span>}
                                {song.key && <span className="font-readout text-[9px] text-[#555]">Key: {song.key}</span>}
                                {song.tempo && <span className="font-readout text-[9px] text-[#555]">{song.tempo} BPM</span>}
                                {song.tuning && song.tuning !== "Standard" && <span className="font-readout text-[9px] text-[#555]">{song.tuning}</span>}
                              </div>
                            </div>
                            {isCustom && (
                              <button onClick={(e) => { e.stopPropagation(); setCustomSongs(p => p.filter(s => s.id !== song.id)); }}
                                className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0 mr-2">Remove</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!songLibShowAll && filtered.length > 50 && (
                      <button type="button" onClick={() => setSongLibShowAll(true)} className="btn-ghost w-full mt-2 !text-[11px]">
                        Show all {filtered.length} songs
                      </button>
                    )}
                  </>);
                })()}
              </div>
            );
          })()}
        </div>)}

        {/* ══ REPORT ══ */}
        {view === "log" && (<div className="animate-fade-in">
          <div className="panel p-3 sm:p-5 mb-4">
            <div className="font-heading text-xl font-bold text-[#D4A843]">Week {week}</div>
            <div className="font-label text-[10px] text-[#555] mt-1">{mode} · {scale} · {style}</div>
            <div className="vu mt-3"><div className="vu-fill" style={{ width: wPct + "%" }} /></div>
            <div className="font-readout text-[11px] text-[#555] mt-2">{wDn}/{wTot} ({wPct}%)</div>
          </div>

          {/* Streak stats in report */}
          <div className="panel p-4 mb-4">
            <div className="font-label text-[10px] text-[#555] mb-2 flex items-center gap-2">🔥 Practice Streak</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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
                <div className="font-readout text-sm text-[#666] mt-1">{streak.lastPracticeDate || "—"}</div>
                <div className="font-label text-[9px] text-[#555]">Last Practice</div>
              </div>
            </div>
          </div>

          <WeeklyCharts week={week} dayExMap={dayExMap} doneMap={doneMap} bpmLog={bpmLog} />

          {songs.length > 0 && (
            <div className="panel p-5 mb-4">
              <div className="font-label text-[11px] text-[#33CC33] mb-3 flex items-center gap-2"><div className="led led-on" /> Songs</div>
              {songs.map((song) => {
                const sd = STAGES.map((st, si) => ({ name: st.name, idx: si, ...(songProgress[week + "-" + song.id + "-" + si] || {}) }));
                const dn = sd.filter((s) => s.done).length;
                return (
                  <div key={song.id} className="p-3 bg-[#0A0A0A] rounded-sm mb-2 border border-[#1a1a1a]">
                    <div className="flex justify-between mb-2"><span className="font-medium text-sm">{song.name}</span><span className="font-readout text-[11px] text-[#555]">{dn}/6</span></div>
                    <div className="vu vu-green !h-[3px] mb-2"><div className="vu-fill" style={{ width: Math.round((dn / 6) * 100) + "%" }} /></div>
                    {sd.map((s) => <div key={s.idx} className="flex gap-2 text-[11px] py-0.5"><div className={`led ${s.done ? "led-on" : "led-off"}`} style={{ width: 6, height: 6, marginTop: 5 }} /><span style={{ color: s.done ? "#ccc" : "#444" }}>{s.name}</span></div>)}
                  </div>
                );
              })}
            </div>
          )}

          {DAYS.map((day) => {
            const exs = dayExMap[day] || [];
            if (!exs.length) return null;
            return (
              <div key={day} className="panel p-5 mb-4">
                <div className="font-label text-[12px] text-[#aaa] mb-3">{day}</div>
                {exs.map((ex, idx) => {
                  const k = week + "-" + day + "-" + ex.id, done = doneMap[k];
                  return (
                    <div key={String(ex.id) + "-" + idx} className="flex gap-2 py-1.5 text-[12px] border-b border-[#111] last:border-0">
                      <div className={`led ${done ? "led-on" : "led-off"}`} style={{ width: 6, height: 6, marginTop: 6 }} />
                      <span className="flex-1" style={{ color: done ? "#ccc" : "#444" }}>{ex.n}</span>
                      {bpmLog[k] && <span className="font-readout text-[#D4A843]">{bpmLog[k]} BPM</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>)}
      </div>

      {modal && <ExerciseModal exercise={modal} mode={mode} scale={scale} style={style} week={week} day={selDay}
        savedYtUrl={exEdits[modal.id]?.ytUrl || ""}
        bpm={bpmLog[week + "-" + selDay + "-" + modal.id] || ""} note={noteLog[week + "-" + selDay + "-" + modal.id] || ""}
        onBpmChange={(v) => setBpmLog((p) => ({ ...p, [week + "-" + selDay + "-" + modal.id]: v }))}
        onNoteChange={(v) => setNoteLog((p) => ({ ...p, [week + "-" + selDay + "-" + modal.id]: v }))}
        onClose={() => setModal(null)}
        onDone={() => { const k = week + "-" + selDay + "-" + modal.id; markDone(k, true); setModal(null); }} />}
      {songModal && <SongModal song={songModal} onClose={() => setSongModal(null)} />}

      {/* ══ FOCUS MODE OVERLAY ══ */}
      {focusEx && (() => {
        const ex = focusEx.ex;
        const mins = Math.floor(focusTimer / 60);
        const secs = focusTimer % 60;
        return (
          <div className="focus-overlay">
            <button type="button" className="focus-close" onClick={() => setFocusEx(null)} aria-label="Close focus mode" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            <div className="text-center px-6 max-w-[600px] w-full">
              {/* Exercise name */}
              <div className="font-label text-[10px] text-[#555] mb-2">{ex.c}</div>
              <div className="font-heading text-3xl sm:text-5xl font-bold text-[#D4A843] mb-8">{ex.n}</div>

              {/* Timer */}
              <div className="font-readout text-7xl sm:text-8xl font-bold text-white mb-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </div>

              {/* Timer controls */}
              <div className="flex gap-4 justify-center mb-8">
                <button type="button" onClick={() => setFocusRunning(!focusRunning)} className="btn-gold !px-8">
                  {focusRunning ? "Pause" : "Resume"}
                </button>
                <button type="button" onClick={() => { setFocusTimer(0); setFocusRunning(true); }} className="btn-ghost">
                  Reset
                </button>
              </div>

              {/* BPM if available */}
              {ex.b && (
                <div className="mb-6">
                  <div className="font-label text-[10px] text-[#555] mb-1">BPM Range</div>
                  <div className="font-readout text-2xl text-[#D4A843]">{ex.b}</div>
                </div>
              )}

              {/* Target time */}
              <div className="font-readout text-[12px] text-[#444]">
                Target: {ex.m} min
              </div>

              {/* Mark done button */}
              <div className="mt-8">
                <button type="button" onClick={() => {
                  const k = week + "-" + selDay + "-" + ex.id;
                  markDone(k, true);
                  setFocusEx(null);
                }} className="btn-gold !px-10">
                  Mark Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </ErrorBoundary>
  );
}
