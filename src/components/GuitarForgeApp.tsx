"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, SongProgressMap, ExEditMap } from "@/lib/types";
import { DAYS, CATS, COL, MODES, SCALES, STYLES, DEFAULT_DAY_CATS, DEFAULT_DAY_HRS, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { autoFill, makeSongItemSimple, ytSearch } from "@/lib/helpers";
import ExerciseModal from "./ExerciseModal";
import SongModal from "./SongModal";
import Navbar from "./Navbar";
import type { View } from "./Navbar";
import LearningCenterPage from "./LearningCenterPage";
import StudioPage from "./StudioPage";
import ProfilePage from "./ProfilePage";
import AiCoachPage from "./AiCoachPage";
import ErrorBoundary from "./ErrorBoundary";
import { useAuth } from "./AuthProvider";
import AuthPage from "./AuthPage";
import SkillTreePage from "./SkillTreePage";
import JamModePage from "./JamModePage";
import { SONG_LIBRARY } from "@/lib/songs-data";
import type { SongEntry } from "@/lib/types";
import { buildStyle, recordUsage, saveToLibrary, getAllLibraryTracks, deleteFromLibrary } from "@/lib/suno";
import type { LibraryTrack } from "@/lib/suno";
import { syncData, uploadSettings } from "@/lib/cloud-sync";

// ── Page Components ──
import HomePage from "./HomePage";
import PracticePage from "./PracticePage";
import LibraryPage from "./LibraryPage";
import ReportPage from "./ReportPage";
import SongsPage from "./SongsPage";

export default function GuitarForgeApp() {
  const [view, setViewRaw] = useState<View>("dash");
  const [week, setWeek] = useState(1);
  const [mode, setMode] = useState("Aeolian");
  const [scale, setScale] = useState("Am");
  const [style, setStyle] = useState("Metal");
  const [dayCats, setDayCats] = useState<DayCats>(DEFAULT_DAY_CATS);
  const [dayHrs, setDayHrs] = useState<DayHrs>(DEFAULT_DAY_HRS);
  const [selDay, setSelDay] = useState(() => DAYS[new Date().getDay()]);
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
  const [libTab, setLibTab] = useState<"exercises" | "styles" | "mysongs" | "recordings" | "backing" | "songlib">("exercises");
  const [songModal, setSongModal] = useState<SongEntry | null>(null);
  const [customSongs, setCustomSongs] = useState<SongEntry[]>([]);
  const [songLibSearch, setSongLibSearch] = useState("");
  const [songLibFilter, setSongLibFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced" | "Expert">("all");
  const [showAddSong, setShowAddSong] = useState(false);
  const [songLibProgress, setSongLibProgress] = useState<Record<number, number>>({});
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [exPickerOpen, setExPickerOpen] = useState(false);
  const [exPickerSearch, setExPickerSearch] = useState("");
  const [exPickerCat, setExPickerCat] = useState("All");
  const [libShowAll, setLibShowAll] = useState(false);
  const [libCollapsed, setLibCollapsed] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(CAT_GROUPS).map(g => [g, true])));
  const [songLibGenre, setSongLibGenre] = useState("all");
  const [songLibGenres, setSongLibGenres] = useState<string[]>([]);
  const [songLibSort, setSongLibSort] = useState<"popular" | "artist" | "title" | "recent">("popular");
  const [songLibHasGP, setSongLibHasGP] = useState(false);
  const [songLibLimit, setSongLibLimit] = useState(20);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sunoSuggestUrl, setSunoSuggestUrl] = useState<string | null>(null);
  const [sunoSuggestLoading, setSunoSuggestLoading] = useState(false);
  const [sunoSuggestDismissed, setSunoSuggestDismissed] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // ── Auth ──
  const { user, loading: authLoading } = useAuth();
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [authBannerDismissed, setAuthBannerDismissed] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncedUserRef = useRef<string | null>(null);

  // ── Library: My Songs, Recordings, Backing Tracks ──
  const [mySongs, setMySongs] = useState<number[]>([]);

  // ── Onboarding wizard ──
  const [showWelcome, setShowWelcome] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardLevel, setWizardLevel] = useState<string>("");
  const [wizardStyles, setWizardStyles] = useState<string[]>([]);
  const [wizardTime, setWizardTime] = useState<number>(0);

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

  // ── Session Timer ──
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionRunning, setSessionRunning] = useState(false);
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Quick Tools toggles ──
  const [showQuickMetronome, setShowQuickMetronome] = useState(false);
  const [showQuickRecorder, setShowQuickRecorder] = useState(false);

  // ── Daily Recorder control ──
  const dailyRecControlRef = useRef<import("./DailyRecorderBox").DailyRecorderControl | null>(null);

  // ── Song Picker (unified) ──
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songPickerSearch, setSongPickerSearch] = useState("");

  // Hash-based routing: #studio, #practice, etc.
  const VALID_VIEWS = new Set<View>(["dash", "daily", "lib", "songs", "learn", "studio", "jam", "log", "profile", "coach", "skills"]);
  const hashToView = (hash: string): View | null => {
    const map: Record<string, View> = { "#home": "dash", "#dashboard": "dash", "#dash": "dash", "#practice": "daily", "#daily": "daily", "#library": "lib", "#lib": "lib", "#songs": "songs", "#learn": "learn", "#learning": "learn", "#studio": "studio", "#jam": "jam", "#report": "log", "#log": "log", "#profile": "profile", "#coach": "coach", "#skills": "skills" };
    const v = map[hash.toLowerCase()] || hash.replace("#", "") as View;
    return VALID_VIEWS.has(v) ? v : null;
  };
  const [pendingTuner, setPendingTuner] = useState(false);
  const setView = (v: View) => { setViewRaw(v); setViewKey(k => k + 1); history.pushState(null, "", `#${v}`); };
  const openTuner = () => { setPendingTuner(true); setView("daily"); };

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case '1': setView('dash'); break;
        case '2': setView('daily'); break;
        case '3': setView('learn'); break;
        case '4': setView('studio'); break;
        case '5': setView('lib'); break;
        case 'Escape': setModal(null); setSongModal(null); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => { const v = hashToView(window.location.hash); if (v) setViewRaw(v); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    try {
      const hv = hashToView(window.location.hash);
      if (hv) setViewRaw(hv);
      const raw = localStorage.getItem("gf30");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.week) setWeek(d.week); if (d.mode) setMode(d.mode); if (d.scale) setScale(d.scale);
        if (d.style && STYLES.includes(d.style)) setStyle(d.style); else if (d.style) setStyle("Metal"); if (d.dayCats) setDayCats(d.dayCats); if (d.dayHrs) setDayHrs(d.dayHrs);
        if (d.dayExMap) setDayExMap(d.dayExMap); if (d.doneMap) setDoneMap(d.doneMap);
        if (d.bpmLog) setBpmLog(d.bpmLog); if (d.noteLog) setNoteLog(d.noteLog);
        if (d.songs) setSongs(d.songs); if (d.songProgress) setSongProgress(d.songProgress);
        if (d.exEdits) setExEdits(d.exEdits);
        if (d.customSongs) setCustomSongs(d.customSongs);
      }
    } catch { /* first time */ }
    try {
      const sr = localStorage.getItem("gf-streak");
      if (sr) setStreak(JSON.parse(sr));
      const cr = localStorage.getItem("gf-calendar");
      if (cr) setCalendarData(JSON.parse(cr));
      const slp = localStorage.getItem("gf-songlib-progress");
      if (slp) setSongLibProgress(JSON.parse(slp));
      const ms = localStorage.getItem("gf-my-songs");
      if (ms) setMySongs(JSON.parse(ms));
    } catch {}
    setReady(true);
    if (!localStorage.getItem("gf30") && !localStorage.getItem("gf-onboarded")) {
      setShowWelcome(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const data = { week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs };
      try { localStorage.setItem("gf30", JSON.stringify(data)); } catch { /* quota */ }
      try { localStorage.setItem("gf-songlib-progress", JSON.stringify(songLibProgress)); } catch {}
      try { localStorage.setItem("gf-my-songs", JSON.stringify(mySongs)); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs, songLibProgress, mySongs]);

  // ── Cloud Sync: download on login ──
  useEffect(() => {
    if (!user || !ready || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;
    setSyncing(true);
    setSyncError(null);
    const localData = { week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs, songLibProgress, mySongs, streak, calendarData };
    syncData(user.id, localData)
      .then((merged) => {
        const d = merged as Record<string, any>;
        if (d.week) setWeek(d.week);
        if (d.mode) setMode(d.mode);
        if (d.scale) setScale(d.scale);
        if (d.style && STYLES.includes(d.style)) setStyle(d.style);
        if (d.dayCats) setDayCats(d.dayCats);
        if (d.dayHrs) setDayHrs(d.dayHrs);
        if (d.dayExMap) setDayExMap(d.dayExMap);
        if (d.doneMap) setDoneMap(d.doneMap);
        if (d.bpmLog) setBpmLog(d.bpmLog);
        if (d.noteLog) setNoteLog(d.noteLog);
        if (d.songs) setSongs(d.songs);
        if (d.songProgress) setSongProgress(d.songProgress);
        if (d.exEdits) setExEdits(d.exEdits);
        if (d.customSongs) setCustomSongs(d.customSongs);
        if (d.songLibProgress) setSongLibProgress(d.songLibProgress);
        if (d.mySongs) setMySongs(d.mySongs);
        if (d.streak) { setStreak(d.streak); try { localStorage.setItem("gf-streak", JSON.stringify(d.streak)); } catch {} }
        if (d.calendarData) { setCalendarData(d.calendarData); try { localStorage.setItem("gf-calendar", JSON.stringify(d.calendarData)); } catch {} }
        setLastSynced(new Date());
      })
      .catch((err) => { setSyncError(String(err?.message || err)); })
      .finally(() => setSyncing(false));
  }, [user, ready]);

  // ── Cloud Sync: upload on save (debounced) ──
  useEffect(() => {
    if (!ready || !user) return;
    const timer = setTimeout(() => {
      const data = { week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs, songLibProgress, mySongs, streak, calendarData };
      uploadSettings(user.id, data)
        .then(() => setLastSynced(new Date()))
        .catch(() => { /* silent */ });
    }, 3000);
    return () => clearTimeout(timer);
  }, [ready, user, week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs, songLibProgress, mySongs, streak, calendarData]);

  // ── Auto-dismiss sync error toast after 5 seconds ──
  useEffect(() => {
    if (!syncError) return;
    const timer = setTimeout(() => setSyncError(null), 5000);
    return () => clearTimeout(timer);
  }, [syncError]);

  // ── Streak & Calendar update when exercise is marked done ──
  const updateStreakAndCalendar = useCallback((newDoneMap: BoolMap) => {
    if (!ready) return;
    const today = new Date().toISOString().slice(0, 10);
    let todayDone = 0;
    DAYS.forEach(d => {
      (dayExMap[d] || []).forEach(e => {
        if (newDoneMap[week + "-" + d + "-" + e.id]) todayDone++;
      });
    });
    const totalMin = DAYS.reduce((sum, d) => {
      return sum + (dayExMap[d] || []).filter(e => newDoneMap[week + "-" + d + "-" + e.id]).reduce((s, e) => s + e.m, 0);
    }, 0);
    setCalendarData(prev => {
      const next = { ...prev, [today]: { exercisesDone: todayDone, minutesPracticed: totalMin } };
      try { localStorage.setItem("gf-calendar", JSON.stringify(next)); } catch {}
      return next;
    });
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

  useEffect(() => {
    if (focusEx) { setFocusTimer(0); setFocusRunning(true); }
    else { setFocusRunning(false); setFocusTimer(0); }
  }, [focusEx]);

  // ── Session Timer effect ──
  useEffect(() => {
    if (sessionRunning) {
      sessionIntervalRef.current = setInterval(() => setSessionSeconds(t => t + 1), 1000);
    } else {
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
    }
    return () => { if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current); };
  }, [sessionRunning]);

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  };

  // ── Smart suggestions generator ──
  const getSuggestions = useCallback(() => {
    const suggestions: { icon: string; text: string }[] = [];
    const today = new Date().toISOString().slice(0, 10);
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
      suggestions.push({ icon: "\uD83D\uDCCB", text: `You haven't practiced ${leastCat} yet \u2014 consider adding it to your routine.` });
    } else if (leastCat) {
      const daysSince = catLastDate[leastCat] ? Math.floor((new Date(today).getTime() - new Date(catLastDate[leastCat]).getTime()) / 86400000) : 0;
      if (daysSince > 3) suggestions.push({ icon: "\uD83D\uDCCB", text: `You haven't practiced ${leastCat} in ${daysSince} days.` });
    }
    const bpmEntries = Object.entries(bpmLog).filter(([, v]) => v);
    if (bpmEntries.length > 3) {
      const lastBpm = bpmEntries[bpmEntries.length - 1];
      const prevBpms = bpmEntries.slice(-4, -1).map(([, v]) => parseInt(v));
      const lastVal = parseInt(lastBpm[1]);
      if (prevBpms.every(b => Math.abs(b - lastVal) <= 2)) {
        const exId = parseInt(lastBpm[0].split("-").pop() || "0");
        const ex = EXERCISES.find(e => e.id === exId);
        if (ex) suggestions.push({ icon: "\u26A1", text: `Your "${ex.n}" BPM has been stuck at ${lastVal} \u2014 try burst picking or slow-fast-slow to break through.` });
      }
    }
    if (streak.currentStreak > 0 && streak.longestStreak > streak.currentStreak) {
      const diff = streak.longestStreak - streak.currentStreak;
      suggestions.push({ icon: "\uD83D\uDD25", text: `Great streak! Keep it up for ${diff} more day${diff > 1 ? "s" : ""} to beat your record of ${streak.longestStreak}.` });
    } else if (streak.currentStreak === 0 && streak.longestStreak > 0) {
      suggestions.push({ icon: "\uD83D\uDCAA", text: `Your best streak was ${streak.longestStreak} days \u2014 start a new one today!` });
    }
    const usedIds = new Set<number>();
    DAYS.forEach(d => (dayExMap[d] || []).forEach(e => usedIds.add(e.id)));
    const unused = EXERCISES.filter(e => !usedIds.has(e.id) && e.c !== "Songs");
    if (unused.length > 0) {
      const pick = unused[Math.floor(Math.random() * unused.length)];
      suggestions.push({ icon: "\uD83C\uDFAF", text: `Try adding "${pick.n}" (${pick.c}) \u2014 it complements your current routine.` });
    }
    if (streak.currentStreak >= 6) {
      suggestions.push({ icon: "\uD83D\uDE34", text: `${streak.currentStreak} day streak \u2014 remember rest is part of progress too.` });
    }
    return suggestions.slice(0, 5);
  }, [calendarData, dayExMap, doneMap, week, bpmLog, streak]);

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
    return songs.map((song) => makeSongItemSimple(song));
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
        body: JSON.stringify({ scale: songScale, mode: songMode, style: songStyle, bpm: songBpm, title: `${song.title} - ${song.artist} Style Backing` }),
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

  // ── Computed values (memoized to prevent re-render cascades) ──
  const EMPTY_EX: Exercise[] = useMemo(() => [], []);
  const EMPTY_CATS: string[] = useMemo(() => [], []);
  const curExList = dayExMap[selDay] || EMPTY_EX;
  const curMin = curExList.reduce((s, e) => s + e.m, 0);
  const curDone = curExList.filter((e) => doneMap[week + "-" + selDay + "-" + e.id]).length;
  const curCats = dayCats[selDay] || EMPTY_CATS;

  let wTot = 0, wDn = 0, wMin = 0;
  DAYS.forEach((d) => (dayExMap[d] || []).forEach((e) => { wTot++; wMin += e.m; if (doneMap[week + "-" + d + "-" + e.id]) wDn++; }));
  const wPct = wTot > 0 ? Math.round((wDn / wTot) * 100) : 0;

  // ── Loading state ──
  if (!ready || authLoading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: "#121214" }}>
      <img src="/logo.png" alt="Guitar Practice" className="h-28 object-contain logo-blend" />
      <div className="font-label text-[10px] text-[#555]">Loading...</div>
    </div>
  );

  if (showAuthPage && !user) return (
    <AuthPage onSkip={() => setShowAuthPage(false)} />
  );

  // ── Onboarding Wizard completion ──
  const finishWizard = () => {
    if (wizardStyles.length > 0) setStyle(wizardStyles[0]);
    const hrs = wizardTime || 1;
    const newDayHrs: DayHrs = {};
    DAYS.forEach(d => { newDayHrs[d] = d === "Saturday" ? 0 : hrs; });
    setDayHrs(newDayHrs);
    const begCats: Record<string, string[]> = {
      Sunday: ["Warm-Up", "Chords", "Rhythm"], Monday: ["Warm-Up", "Fretboard", "Ear Training"],
      Tuesday: ["Warm-Up", "Picking", "Dynamics"], Wednesday: ["Warm-Up", "Modes", "Improv"],
      Thursday: ["Warm-Up", "Songs"], Friday: ["Warm-Up", "Rhythm", "Phrasing"], Saturday: [],
    };
    const intCats: Record<string, string[]> = {
      Sunday: ["Warm-Up", "Shred", "Riffs"], Monday: ["Warm-Up", "Ear Training", "Modes", "Improv"],
      Tuesday: ["Warm-Up", "Legato", "Bends", "Phrasing"], Wednesday: ["Warm-Up", "Fretboard", "Improv", "Modes"],
      Thursday: ["Warm-Up", "Shred", "Songs"], Friday: ["Warm-Up", "Rhythm", "Dynamics", "Composition"], Saturday: [],
    };
    const advCats: Record<string, string[]> = {
      Sunday: ["Warm-Up", "Shred", "Sweep", "Arpeggios"], Monday: ["Warm-Up", "Tapping", "Legato", "Harmonics"],
      Tuesday: ["Warm-Up", "Modes", "Improv", "Phrasing"], Wednesday: ["Warm-Up", "Fretboard", "Composition", "Riffs"],
      Thursday: ["Warm-Up", "Shred", "Songs", "Dynamics"], Friday: ["Warm-Up", "Rhythm", "Bends", "Picking"], Saturday: [],
    };
    const cats = wizardLevel === "Beginner" ? begCats : wizardLevel === "Advanced" ? advCats : intCats;
    setDayCats(cats);
    setTimeout(() => {
      const nd: DayExMap = {};
      const s = wizardStyles.length > 0 ? wizardStyles[0] : "Metal";
      DAYS.forEach(day => {
        const c = cats[day] || [], m = (newDayHrs[day] || 0) * 60;
        if (c.length > 0 && m > 0) nd[day] = autoFill(c, m, [], s);
      });
      setDayExMap(nd);
    }, 50);
    localStorage.setItem("gf-onboarded", "true");
    setShowWelcome(false);
  };

  const WIZARD_STYLES = ["Hard Rock", "Metal", "Classic Rock", "Alternative Rock", "Punk Rock", "Grunge", "Blues", "Jazz", "Heavy Metal", "Thrash Metal", "Progressive Metal", "Progressive Rock", "Death Metal", "Acoustic", "Funk", "Fusion", "Flamenco", "Country", "Blues Rock", "Nu Metal", "Stoner Rock", "Neo-Classical"];

  if (showWelcome) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "#121214" }}>
      <div className="w-full max-w-[500px]">
        {/* Logo */}
        <div className="text-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 opacity-60">
            <path d="M12 2L9 7H4l3 5-3 5h5l3 5 3-5h5l-3-5 3-5h-5L12 2z" fill="#D4A843" opacity="0.3"/>
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" stroke="#D4A843" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <img src="/logo.png" alt="Guitar Practice" className="h-28 mx-auto object-contain logo-blend" />
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              width: i === wizardStep ? 24 : 8, height: 8,
              background: i <= wizardStep ? "#D4A843" : "#333",
              opacity: i <= wizardStep ? 1 : 0.4,
            }} />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-lg p-6 sm:p-8" style={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }}>
          {/* Step 1: Level */}
          {wizardStep === 0 && (
            <div className="animate-fade-in">
              <h2 className="font-heading text-xl sm:text-2xl text-[#D4A843] mb-1 text-center">Welcome to Guitar Practice</h2>
              <p className="font-label text-[13px] text-[#888] mb-6 text-center">Let&apos;s set up your practice routine</p>
              <div className="space-y-3">
                {([
                  { level: "Beginner", desc: "0–2 years. Basic chords, strumming, steady beat.", icon: "M12 20V4M8 8l4-4 4 4" },
                  { level: "Intermediate", desc: "2–5 years. Barre chords, pentatonic, play by ear.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
                  { level: "Advanced", desc: "5+ years. Sweep picking, legato, complex rhythms.", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
                  { level: "Expert", desc: "Professional. Full fretboard mastery, improvise across genres.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                ] as const).map(({ level, desc, icon }) => (
                  <button key={level} type="button" onClick={() => setWizardLevel(level)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left"
                    style={{
                      background: wizardLevel === level ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.02)",
                      borderColor: wizardLevel === level ? "#D4A843" : "#2a2a2e",
                    }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={wizardLevel === level ? "#D4A843" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d={icon}/>
                    </svg>
                    <div>
                      <div className="font-heading text-[15px]" style={{ color: wizardLevel === level ? "#D4A843" : "#ccc" }}>{level}</div>
                      <div className="font-label text-[11px] text-[#666]">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Styles */}
          {wizardStep === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-heading text-xl sm:text-2xl text-[#D4A843] mb-1 text-center">What&apos;s your style?</h2>
              <p className="font-label text-[13px] text-[#888] mb-6 text-center">Select up to 5 styles you want to focus on</p>
              <div className="grid grid-cols-2 gap-2.5">
                {WIZARD_STYLES.map(s => {
                  const sel = wizardStyles.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => {
                      setWizardStyles(prev => sel ? prev.filter(x => x !== s) : prev.length < 5 ? [...prev, s] : prev);
                    }}
                      className="p-3.5 rounded-lg border transition-all text-center"
                      style={{
                        background: sel ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: sel ? "#D4A843" : "#2a2a2e",
                      }}>
                      <div className="font-heading text-[13px]" style={{ color: sel ? "#D4A843" : "#999" }}>{s}</div>
                    </button>
                  );
                })}
              </div>
              {wizardStyles.length > 0 && (
                <div className="mt-4 text-center">
                  <span className="font-label text-[11px] text-[#D4A843]">{wizardStyles.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Time */}
          {wizardStep === 2 && (
            <div className="animate-fade-in">
              <h2 className="font-heading text-xl sm:text-2xl text-[#D4A843] mb-1 text-center">How much time?</h2>
              <p className="font-label text-[13px] text-[#888] mb-6 text-center">Daily practice commitment</p>
              <div className="space-y-3">
                {([
                  { hrs: 0.5, label: "30 min", desc: "Quick focused session. Great for busy days.", icon: "M12 2v10l4.24 4.24" },
                  { hrs: 1, label: "1 hour", desc: "Solid practice. Best for steady progress.", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
                  { hrs: 2, label: "2 hours", desc: "Deep dive. Maximum skill building.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
                  { hrs: 3, label: "2+ hours", desc: "Full session. For serious shredders.", icon: "M17.657 18.657A8 8 0 016.343 7.343M12 2v4m0 12v4m10-10h-4M6 12H2" },
                ] as const).map(({ hrs, label, desc, icon }) => (
                  <button key={hrs} type="button" onClick={() => setWizardTime(hrs)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left"
                    style={{
                      background: wizardTime === hrs ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.02)",
                      borderColor: wizardTime === hrs ? "#D4A843" : "#2a2a2e",
                    }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={wizardTime === hrs ? "#D4A843" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d={icon}/>
                    </svg>
                    <div>
                      <div className="font-heading text-[15px]" style={{ color: wizardTime === hrs ? "#D4A843" : "#ccc" }}>{label}</div>
                      <div className="font-label text-[11px] text-[#666]">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            {wizardStep > 0 ? (
              <button type="button" onClick={() => setWizardStep(s => s - 1)} className="btn-ghost">Back</button>
            ) : <div />}
            {wizardStep < 2 ? (
              <button type="button" onClick={() => setWizardStep(s => s + 1)}
                disabled={(wizardStep === 0 && !wizardLevel) || (wizardStep === 1 && wizardStyles.length === 0)}
                className="btn-gold disabled:opacity-30 disabled:cursor-not-allowed">
                Next
              </button>
            ) : (
              <button type="button" onClick={finishWizard}
                disabled={!wizardTime}
                className="btn-gold disabled:opacity-30 disabled:cursor-not-allowed">
                Start Practicing
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        <div className="text-center mt-4">
          <button type="button" onClick={() => { localStorage.setItem("gf-onboarded", "true"); setShowWelcome(false); }}
            className="font-label text-[11px] text-[#555] hover:text-[#888] bg-transparent border-none cursor-pointer transition-colors">
            Skip setup
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // ── MAIN RENDER: Thin router delegating to page components
  // ══════════════════════════════════════════════════════════

  return (
    <ErrorBoundary>
    <div className="flex h-screen text-white" style={{ background: "#121214" }} dir="ltr">
      <Navbar view={view} onViewChange={setView} onShowAuth={() => setShowAuthPage(true)} onOpenTuner={openTuner} lastSynced={lastSynced} syncing={syncing} />
      <div id="main-content" className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
      {view === "studio" && <StudioPage channelScale={scale} channelMode={mode} channelStyle={style} />}
      {view === "jam" && <JamModePage />}
      <div key={viewKey} className="view-transition px-2 sm:px-5 py-3 sm:py-5 pb-16 md:pb-5 max-w-[960px] lg:max-w-[1100px] xl:max-w-[1280px] mx-auto w-full">

        {view === "learn" && <LearningCenterPage />}
        {view === "profile" && <ProfilePage />}
        {view === "coach" && <AiCoachPage onNavigate={(v) => setView(v as View)} />}
        {view === "skills" && <SkillTreePage />}

        {view === "songs" && (
          <SongsPage
            customSongs={customSongs}
            songLibSearch={songLibSearch}
            songLibFilter={songLibFilter}
            songLibGenre={songLibGenre}
            songLibGenres={songLibGenres}
            songLibSort={songLibSort}
            songLibHasGP={songLibHasGP}
            songLibLimit={songLibLimit}
            showAddSong={showAddSong}
            newSongTitle={newSongTitle}
            newSongArtist={newSongArtist}
            songBackingTracks={songBackingTracks}
            songBackingLoading={songBackingLoading}
            songBackingPlaying={songBackingPlaying}
            setCustomSongs={setCustomSongs}
            setSongLibSearch={setSongLibSearch}
            setSongLibFilter={setSongLibFilter}
            setSongLibGenre={setSongLibGenre}
            setSongLibGenres={setSongLibGenres}
            setSongLibSort={setSongLibSort}
            setSongLibHasGP={setSongLibHasGP}
            setSongLibLimit={setSongLibLimit}
            setShowAddSong={setShowAddSong}
            setNewSongTitle={setNewSongTitle}
            setNewSongArtist={setNewSongArtist}
            setSongModal={setSongModal}
            generateSongBacking={generateSongBacking}
            toggleSongBackingPlay={toggleSongBackingPlay}
          />
        )}

        {view === "dash" && (
          <HomePage
            week={week} mode={mode} scale={scale} style={style}
            dayCats={dayCats} dayHrs={dayHrs} dayExMap={dayExMap}
            doneMap={doneMap} bpmLog={bpmLog} selDay={selDay}
            songs={songs} newSongName={newSongName} newSongUrl={newSongUrl}
            showEditor={showEditor} collapsedGroups={collapsedGroups}
            settingsOpen={settingsOpen} showAnalytics={showAnalytics}
            calendarData={calendarData} streak={streak}
            sunoSuggestUrl={sunoSuggestUrl} sunoSuggestLoading={sunoSuggestLoading}
            sunoSuggestDismissed={sunoSuggestDismissed}
            user={user} authBannerDismissed={authBannerDismissed}
            setView={setView} setWeek={setWeek} setMode={setMode}
            setScale={setScale} setStyle={setStyle} setDayCats={setDayCats}
            setDayHrs={setDayHrs} setDayExMap={setDayExMap} setDoneMap={setDoneMap}
            setBpmLog={setBpmLog} setSelDay={setSelDay} setSongs={setSongs}
            setNewSongName={setNewSongName} setNewSongUrl={setNewSongUrl}
            setShowEditor={setShowEditor} setCollapsedGroups={setCollapsedGroups}
            setSettingsOpen={setSettingsOpen} setShowAnalytics={setShowAnalytics}
            setShowAuthPage={setShowAuthPage} setAuthBannerDismissed={setAuthBannerDismissed}
            setSunoSuggestUrl={setSunoSuggestUrl} setSunoSuggestLoading={setSunoSuggestLoading}
            setSunoSuggestDismissed={setSunoSuggestDismissed}
            setSongModal={setSongModal} setModal={setModal}
            curExList={curExList} curDone={curDone} curMin={curMin} curCats={curCats}
            wTot={wTot} wDn={wDn} wPct={wPct} wMin={wMin}
            buildAll={buildAll} getSuggestions={getSuggestions}
          />
        )}

        {view === "daily" && (
          <PracticePage
            week={week} selDay={selDay} style={style}
            dayCats={dayCats} dayHrs={dayHrs} dayExMap={dayExMap}
            doneMap={doneMap} bpmLog={bpmLog} songs={songs} exEdits={exEdits}
            streak={streak}
            sessionSeconds={sessionSeconds} sessionRunning={sessionRunning}
            showQuickMetronome={showQuickMetronome} showQuickRecorder={showQuickRecorder}
            exPickerOpen={exPickerOpen} exPickerSearch={exPickerSearch} exPickerCat={exPickerCat}
            songPickerOpen={songPickerOpen} songPickerSearch={songPickerSearch}
            curExList={curExList} curDone={curDone} curMin={curMin} curCats={curCats}
            setView={setView} setSelDay={setSelDay} setDayCats={setDayCats} setDayHrs={setDayHrs} setDayExMap={setDayExMap}
            setSessionRunning={setSessionRunning} setSessionSeconds={setSessionSeconds}
            setShowQuickMetronome={setShowQuickMetronome} setShowQuickRecorder={setShowQuickRecorder}
            setExPickerOpen={setExPickerOpen} setExPickerSearch={setExPickerSearch}
            setExPickerCat={setExPickerCat}
            setSongPickerOpen={setSongPickerOpen} setSongPickerSearch={setSongPickerSearch}
            setModal={setModal} setFocusEx={setFocusEx}
            dailyRecControlRef={dailyRecControlRef} exerciseModalOpen={!!modal}
            toggleDone={toggleDone} getEditedEx={getEditedEx} buildDay={buildDay}
            pendingTuner={pendingTuner} setPendingTuner={setPendingTuner}
          />
        )}

        {view === "lib" && (
          <LibraryPage
            week={week} doneMap={doneMap} exEdits={exEdits}
            customSongs={customSongs} mySongs={mySongs}
            songLibSearch={songLibSearch} songLibFilter={songLibFilter}
            songLibGenre={songLibGenre} songLibGenres={songLibGenres}
            songLibSort={songLibSort} songLibHasGP={songLibHasGP}
            songLibLimit={songLibLimit}
            showAddSong={showAddSong} newSongTitle={newSongTitle} newSongArtist={newSongArtist}
            libTab={libTab} libFilter={libFilter} libSearch={libSearch}
            libShowAll={libShowAll} libCollapsed={libCollapsed} editingId={editingId}
            setView={setView} setExEdits={setExEdits} setCustomSongs={setCustomSongs}
            setMySongs={setMySongs} setSongLibSearch={setSongLibSearch}
            setSongLibFilter={setSongLibFilter} setSongLibGenre={setSongLibGenre}
            setSongLibGenres={setSongLibGenres} setSongLibSort={setSongLibSort}
            setSongLibHasGP={setSongLibHasGP}
            setSongLibLimit={setSongLibLimit} setShowAddSong={setShowAddSong}
            setNewSongTitle={setNewSongTitle} setNewSongArtist={setNewSongArtist}
            setLibTab={setLibTab} setLibFilter={setLibFilter} setLibSearch={setLibSearch}
            setLibShowAll={setLibShowAll} setLibCollapsed={setLibCollapsed}
            setEditingId={setEditingId} setModal={setModal} setSongModal={setSongModal}
            getEditedEx={getEditedEx}
          />
        )}

        {view === "log" && (
          <ReportPage
            week={week} mode={mode} scale={scale} style={style}
            dayExMap={dayExMap} doneMap={doneMap} bpmLog={bpmLog}
            songs={songs} streak={streak}
            wTot={wTot} wDn={wDn} wPct={wPct}
          />
        )}
      </div>

      {modal && (() => {
        const isSong = !!(modal.songId || modal.songName || modal.c === "Songs");
        if (isSong) {
          const entry = (modal.songId ? SONG_LIBRARY.find(s => s.id === modal.songId) : null)
            || SONG_LIBRARY.find(s => `${s.artist} - ${s.title}` === (modal.songName || modal.n))
            || { id: modal.id, title: modal.songName || modal.n, artist: "" };
          return <SongModal song={entry} onClose={() => setModal(null)}
            targetMinutes={modal.m || undefined}
            mySongs={mySongs} onToggleMySong={(id) => setMySongs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />;
        }
        return <ExerciseModal exercise={modal} mode={mode} scale={scale} style={style} week={week} day={selDay}
          savedYtUrl={exEdits[modal.id]?.ytUrl || ""}
          bpm={bpmLog[week + "-" + selDay + "-" + modal.id] || ""} note={noteLog[week + "-" + selDay + "-" + modal.id] || ""}
          onBpmChange={(v) => setBpmLog((p) => ({ ...p, [week + "-" + selDay + "-" + modal.id]: v }))}
          onNoteChange={(v) => setNoteLog((p) => ({ ...p, [week + "-" + selDay + "-" + modal.id]: v }))}
          onClose={() => setModal(null)}
          onDone={() => { const k = week + "-" + selDay + "-" + modal.id; markDone(k, true); setModal(null); }} />;
      })()}
      {songModal && <SongModal song={songModal} onClose={() => setSongModal(null)}
        targetMinutes={songs.some(s => s.id === songModal.id) && songs.length > 0 && (dayHrs[selDay] || 0) > 0
          ? Math.max(5, Math.round((dayHrs[selDay] * 60) / songs.length / 5) * 5)
          : undefined}
        mySongs={mySongs} onToggleMySong={(id) => setMySongs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />}

      {/* Focus Mode Overlay */}
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
              <div className="font-label text-[10px] text-[#555] mb-2">{ex.c}</div>
              <div className="font-heading text-3xl sm:text-5xl font-bold text-[#D4A843] mb-8">{ex.n}</div>
              <div className="font-readout text-7xl sm:text-8xl font-bold text-white mb-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </div>
              <div className="flex gap-4 justify-center mb-8">
                <button type="button" onClick={() => setFocusRunning(!focusRunning)} className="btn-gold !px-8">
                  {focusRunning ? "Pause" : "Resume"}
                </button>
                <button type="button" onClick={() => { setFocusTimer(0); setFocusRunning(true); }} className="btn-ghost">
                  Reset
                </button>
              </div>
              {ex.b && (
                <div className="mb-6">
                  <div className="font-label text-[10px] text-[#555] mb-1">BPM Range</div>
                  <div className="font-readout text-2xl text-[#D4A843]">{ex.b}</div>
                </div>
              )}
              <div className="font-readout text-[12px] text-[#444]">
                Target: {ex.m} min
              </div>
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

    {/* Sync error toast */}
    {syncError && (
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[999] max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-lg flex items-center gap-3 shadow-lg animate-fade-in"
        style={{ background: "rgba(196,30,58,0.15)", border: "1px solid rgba(196,30,58,0.3)", backdropFilter: "blur(8px)" }}
        role="alert">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="2" className="flex-shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-[12px] text-[#eee] flex-1">Sync failed: {syncError}. Data saved locally.</span>
        <button type="button" onClick={() => setSyncError(null)} className="text-[#888] hover:text-[#ccc] transition-colors flex-shrink-0" aria-label="Dismiss sync error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    )}

    </div>
    </ErrorBoundary>
  );
}
