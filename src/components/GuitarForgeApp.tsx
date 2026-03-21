"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, SongProgressMap, ExEditMap } from "@/lib/types";
import { DAYS, CATS, COL, MODES, SCALES, STYLES, DEFAULT_DAY_CATS, DEFAULT_DAY_HRS, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { autoFill, makeSongItemSimple, ytSearch } from "@/lib/helpers";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
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
import DarkAudioPlayer from "./DarkAudioPlayer";
import LibraryEditor from "./LibraryEditor";
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
  const [libTab, setLibTab] = useState<"exercises" | "styles" | "mysongs" | "recordings" | "backing" | "songlib">("exercises");
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
  const [libCollapsed, setLibCollapsed] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(CAT_GROUPS).map(g => [g, true])));
  const [songLibGenre, setSongLibGenre] = useState("all");
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
  const [mySongs, setMySongs] = useState<number[]>([]); // array of song IDs
  const [libRecordings, setLibRecordings] = useState<{ id: string; name: string; date: string; duration: number; format: string }[]>([]);
  const [libRecordingsLoaded, setLibRecordingsLoaded] = useState(false);
  const [libBackingTracks, setLibBackingTracks] = useState<LibraryTrack[]>([]);
  const [libBackingLoaded, setLibBackingLoaded] = useState(false);
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const [playingBackingId, setPlayingBackingId] = useState<string | null>(null);
  const libAudioRef = useRef<HTMLAudioElement | null>(null);

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
  const setView = (v: View) => { setViewRaw(v); setViewKey(k => k + 1); history.pushState(null, "", `#${v}`); };

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
      const ms = localStorage.getItem("gf-my-songs");
      if (ms) setMySongs(JSON.parse(ms));
    } catch {}
    setReady(true);
    // Show onboarding wizard for first-time users
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
        // Apply merged data to state
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
        .catch(() => { /* silent — local save already succeeded */ });
    }, 3000); // 3s debounce for cloud uploads
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

  if (!ready || authLoading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: "#121214" }}>
      <div className="font-heading text-3xl font-black text-[#D4A843]">GuitarForge</div>
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

  const WIZARD_STYLES = ["Metal", "Hard Rock", "Blues", "Classic Rock", "Jazz", "Punk Rock", "Acoustic", "Progressive Metal"];

  if (showWelcome) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "#121214" }}>
      <div className="w-full max-w-[500px]">
        {/* Logo */}
        <div className="text-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 opacity-60">
            <path d="M12 2L9 7H4l3 5-3 5h5l3 5 3-5h5l-3-5 3-5h-5L12 2z" fill="#D4A843" opacity="0.3"/>
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" stroke="#D4A843" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="font-heading text-2xl font-black text-[#D4A843]">GuitarForge</div>
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
              <h2 className="font-heading text-xl sm:text-2xl text-[#D4A843] mb-1 text-center">Welcome to GuitarForge</h2>
              <p className="font-label text-[13px] text-[#888] mb-6 text-center">Let&apos;s set up your practice routine</p>
              <div className="space-y-3">
                {([
                  { level: "Beginner", desc: "Just starting out. Focus on fundamentals.", icon: "M12 20V4M8 8l4-4 4 4" },
                  { level: "Intermediate", desc: "1-3 years. Ready for speed and technique.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
                  { level: "Advanced", desc: "3+ years. Shred, sweep, and master the fretboard.", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
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
              <p className="font-label text-[13px] text-[#888] mb-6 text-center">Select 1-3 styles you want to focus on</p>
              <div className="grid grid-cols-2 gap-2.5">
                {WIZARD_STYLES.map(s => {
                  const sel = wizardStyles.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => {
                      setWizardStyles(prev => sel ? prev.filter(x => x !== s) : prev.length < 3 ? [...prev, s] : prev);
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

  // ── Memoized song library computations ──
  const allSongsMemo = useMemo(() => [...SONG_LIBRARY, ...customSongs], [customSongs]);
  const songGenres = useMemo(() => [...new Set(allSongsMemo.map(s => s.genre).filter((g): g is string => !!g))].sort(), [allSongsMemo]);
  const songLibFiltered = useMemo(() => {
    const genreFiltered = songLibGenre === "all" ? allSongsMemo : allSongsMemo.filter(s => s.genre === songLibGenre);
    return genreFiltered.filter(s => {
      if (songLibFilter !== "all" && s.difficulty !== songLibFilter) return false;
      if (songLibSearch.trim()) {
        const q = songLibSearch.trim().toLowerCase();
        return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.genre || "").toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [allSongsMemo, songLibGenre, songLibFilter, songLibSearch]);
  const songLibDiffCounts = useMemo(() => {
    const genreFiltered = songLibGenre === "all" ? allSongsMemo : allSongsMemo.filter(s => s.genre === songLibGenre);
    return { all: genreFiltered.length, Beginner: genreFiltered.filter(s => s.difficulty === "Beginner").length, Intermediate: genreFiltered.filter(s => s.difficulty === "Intermediate").length, Advanced: genreFiltered.filter(s => s.difficulty === "Advanced").length };
  }, [allSongsMemo, songLibGenre]);

  return (
    <ErrorBoundary>
    <div className="flex h-screen text-white" style={{ background: "#121214" }} dir="ltr">
      <Navbar view={view} onViewChange={setView} onShowAuth={() => setShowAuthPage(true)} lastSynced={lastSynced} syncing={syncing} />
      <div id="main-content" className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
      {view === "studio" && <StudioPage channelScale={scale} channelMode={mode} channelStyle={style} />}
      {view === "jam" && <JamModePage />}
      <div key={viewKey} className="view-transition px-2 sm:px-5 py-3 sm:py-5 pb-16 md:pb-5 max-w-[960px] lg:max-w-[1100px] xl:max-w-[1280px] mx-auto w-full">

        {view === "learn" && <LearningCenterPage />}
        {view === "profile" && <ProfilePage />}
        {view === "coach" && <AiCoachPage onNavigate={(v) => setView(v as View)} />}
        {view === "skills" && <SkillTreePage />}
        {view === "songs" && (() => {
          const filtered = songLibFiltered;
          const diffCounts = songLibDiffCounts;
          return (
            <div className="animate-fade-in">
              <div className="font-heading text-xl font-bold text-[#D4A843] mb-4">Song Library</div>

              {/* Genre tabs */}
              <div className="flex gap-1 flex-wrap mb-3 overflow-x-auto scrollbar-hide">
                <button onClick={() => { setSongLibGenre("all"); setSongLibLimit(20); }}
                  className={`font-label text-[10px] px-3 py-1 min-h-[44px] rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === "all" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
                  All ({allSongsMemo.length})
                </button>
                {songGenres.map(g => {
                  const cnt = allSongsMemo.filter(s => s.genre === g).length;
                  return (
                    <button key={g} onClick={() => { setSongLibGenre(g); setSongLibLimit(20); }}
                      className={`font-label text-[10px] px-3 py-1 min-h-[44px] rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === g ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
                      {g} ({cnt})
                    </button>
                  );
                })}
              </div>

              <input type="text" placeholder="Search song, artist, genre..." className="input w-full mb-3"
                value={songLibSearch} onChange={e => { setSongLibSearch(e.target.value); setSongLibLimit(20); }} />

              {/* Difficulty filter */}
              <div className="flex gap-1 flex-wrap mb-4">
                {([["all", "All", "#D4A843"], ["Beginner", "Beginner", "#22c55e"], ["Intermediate", "Intermediate", "#D4A843"], ["Advanced", "Advanced", "#ef4444"]] as const).map(([key, label, color]) => (
                  <button key={key} onClick={() => { setSongLibFilter(key as typeof songLibFilter); setSongLibLimit(20); }}
                    className="font-label text-[10px] px-3 py-1 min-h-[44px] rounded-lg cursor-pointer border transition-all"
                    style={songLibFilter === key ? { background: color, borderColor: color, color: "#121214" } : { borderColor: color + "40", color: color + "99" }}>
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

              {/* Showing count */}
              <div className="font-readout text-[10px] text-[#555] mb-2">
                Showing {Math.min(songLibLimit, filtered.length)} of {filtered.length} songs
              </div>

              {filtered.length === 0 && (
                <div className="panel p-8 sm:p-10 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <div className="font-heading text-base text-[#D4A843] mb-1.5">No songs match your search</div>
                  <div className="font-label text-[11px] text-[#555]">Try a different term or clear your filters.</div>
                </div>
              )}
              {(() => {
                const limited = filtered.slice(0, songLibLimit);
                return (<>
                  {limited.map(song => {
                    const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                    const isCustom = song.id >= 1000000000;
                    return (
                      <div key={song.id} onClick={() => setSongModal(song)}
                        tabIndex={0} role="button" aria-label={`${song.title} by ${song.artist}`}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSongModal(song); } }}
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
                            {/* Stage pills removed -- simplified */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {songLibLimit < filtered.length && (
                    <button type="button" onClick={() => setSongLibLimit(p => p + 20)} className="btn-ghost w-full mt-2 !text-[11px]">
                      Load more ({filtered.length - songLibLimit} remaining)
                    </button>
                  )}
                </>);
              })()}
            </div>
          );
        })()}

        {/* ══ DASHBOARD ══ */}
        {view === "dash" && (<div className="animate-fade-in">
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
          {/* -- 1. Hero Card -- */}
          {(() => {
            const dayPct = curExList.length > 0 ? Math.round((curDone / curExList.length) * 100) : 0;
            const todayDate = new Date();
            const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" });
            const dateStr = todayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const todayCats = curCats.length > 0 ? curCats.join(", ") : "Rest Day";
            return (
              <div className="p-5 sm:p-6 mb-4" style={{ background: "linear-gradient(135deg, #1a1708, #121214)", border: "1px solid #D4A84330", borderRadius: 12 }}>
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

          {/* -- 2. Quick Start -- */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {([
              { label: "Start Practice", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="#D4A843" stroke="none"><path d="M8 5v14l11-7z"/></svg>, target: "daily" as View },
              { label: "Open Studio", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m11-11h-2M3 12H1m17.36 6.36l-1.41-1.41M7.05 7.05L5.64 5.64m12.73 0l-1.42 1.41M7.05 16.95l-1.41 1.41"/></svg>, target: "studio" as View },
              { label: "Jam Mode", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><path d="M9 19c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2zM9 19V5l12-4v14m0 0c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2z"/></svg>, target: "jam" as View },
              { label: "Browse Library", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>, target: "lib" as View },
              { label: "AI Coach", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><path d="M12 2a3 3 0 00-3 3v4a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v1a7 7 0 01-14 0v-1"/><path d="M12 18v4m-4 0h8"/></svg>, target: "coach" as View },
              { label: "Skill Tree", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7l3-7z"/></svg>, target: "skills" as View },
            ] as const).map(({ label, icon, target }) => (
              <button key={target} type="button" onClick={() => setView(target)}
                className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-lg transition-all hover:border-[#D4A843]/40 hover:bg-[#1a1708]"
                style={{ background: "#141416", border: "1px solid #1a1a1e" }}>
                {icon}
                <span className="font-label text-[9px] sm:text-[10px] text-[#888]">{label}</span>
              </button>
            ))}
          </div>

          {/* -- 3. Stats Row -- */}
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

          {/* -- 4. Weekly Schedule -- */}
          <div className="panel-primary p-4 sm:p-5 mb-4" style={{ borderRadius: 8 }}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-label text-[11px] text-[#D4A843] flex items-center gap-2"><div className="led led-gold" /> Week {week} Schedule</span>
              <button onClick={() => setShowEditor(!showEditor)} className="font-readout text-[10px] text-[#555] hover:text-[#888] transition-colors flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/><circle cx="12" cy="12" r="3"/></svg>
                {showEditor ? "Close editor" : "Edit schedule"}
              </button>
            </div>

            {showEditor && (
              <div className="mb-4 p-4 bg-[#121214] border border-[#1a1a1a] rounded-lg">
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
                {/* Finish Week / Reset moved inside editor */}
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
                    className={`p-2 cursor-pointer text-center transition-all ${off ? "bg-[#121214] border border-[#1a1a1a]" : "panel hover:border-[#D4A843]/30"} ${selDay === day ? "!border-[#D4A843] ring-1 ring-[#D4A843]/30 !bg-[#1a1708]" : ""}`}
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

          {/* -- 5. Smart Suggestions -- */}
          {(() => {
            const suggestions = getSuggestions();
            if (suggestions.length === 0) return null;
            return (
              <div className="panel-secondary p-4 mb-4" style={{ borderRadius: 8 }}>
                <div className="font-label text-[10px] text-[#666] mb-2 flex items-center gap-2">
                  &#x1F4A1; Suggestions
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

          {/* -- 6. Setlist (simplified) -- */}
          <div className="panel p-3 sm:p-5 mb-4" style={{ borderColor: "#1a3a2a", borderRadius: 8 }}>
            <div className="font-label text-[11px] text-[#33CC33] mb-3 flex items-center gap-2">
              <div className="led led-on" /> Setlist
            </div>
            {songs.length === 0 && (
              <div className="text-center py-4 text-[12px] text-[#444]">No songs in your setlist yet. Add one below.</div>
            )}
            {songs.map((song) => (
              <div key={song.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#121214] border border-[#1a1a1a] rounded-lg mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="font-heading text-sm !font-medium !normal-case !tracking-normal truncate">{song.name}</div>
                </div>
                {song.url && <a href={song.url} target="_blank" rel="noopener noreferrer" className="font-label text-[9px] text-[#D4A843] no-underline hover:text-[#DFBD69] flex-shrink-0">Tab</a>}
                <button onClick={() => setSongs((p) => p.filter((s) => s.id !== song.id))} className="btn-ghost !px-2 !py-1 !text-[10px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Remove</button>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-3">
              <input placeholder="Song name..." value={newSongName} onChange={(e) => setNewSongName(e.target.value)} className="input min-w-0" />
              <input placeholder="Tab URL..." value={newSongUrl} onChange={(e) => setNewSongUrl(e.target.value)} className="input min-w-0" />
              <button onClick={() => { if (!newSongName.trim()) return; setSongs((p) => [...p, { name: newSongName.trim(), url: newSongUrl.trim(), id: Date.now() }]); setNewSongName(""); setNewSongUrl(""); }} className="btn-gold">Add Song</button>
            </div>
            <SongsterrSearch onSelect={(name, url) => {
              setSongs((p) => [...p, { name, url, id: Date.now() }]);
            }} />
          </div>

          {/* -- 7. Weekly Focus (was Channel Settings) -- */}
          <div className="panel-secondary mb-4" style={{ borderRadius: 8 }}>
            <button onClick={() => setSettingsOpen(p => !p)} className="panel-header flex items-center gap-2 w-full cursor-pointer bg-transparent border-0 text-left">
              <div className="led led-gold" />
              <span className="flex-1">Weekly Focus</span>
              <span className="font-readout text-[10px] text-[#555]">
                {!settingsOpen && `W${week} · ${mode} · ${scale} · ${style}`}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="p-3 sm:p-5">
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

          {/* -- 8. Recent Activity -- */}
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

          {/* -- 9. Week Analytics (collapsible) -- */}
          <div className="panel-secondary mb-4" style={{ borderRadius: 8 }}>
            <button onClick={() => setShowAnalytics(p => !p)} className="panel-header flex items-center gap-2 w-full cursor-pointer bg-transparent border-0 text-left">
              <span className="text-[14px]">📊</span>
              <span className="flex-1">Week Analytics</span>
              <span className="font-readout text-[10px] text-[#555]">
                {!showAnalytics && `${wDn}/${wTot} done · ${wPct}%`}
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

          {/* -- 10. Suno Backing Track -- */}
          {!sunoSuggestDismissed && !sunoSuggestUrl && (
            <div className="panel-secondary p-3 mb-4 flex items-center gap-3" style={{ borderRadius: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" className="flex-shrink-0">
                <path d="M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 19V5l12-4v14m0 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              <div className="flex-1">
                <div className="font-label text-[10px] text-[#D4A843]">AI Backing Track</div>
                <div className="font-readout text-[9px] text-[#555]">{scale} {mode} &middot; {style} &middot; Generate a practice track with Suno AI</div>
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
            <div className="panel-secondary p-3 mb-4" style={{ borderRadius: 8 }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="font-label text-[10px] text-[#D4A843]">AI Backing Track</div>
                <span className="font-readout text-[9px] text-[#555]">{scale} {mode} &middot; {style}</span>
              </div>
              <DarkAudioPlayer src={sunoSuggestUrl} title={`${scale} ${mode} · ${style}`} loop />
            </div>
          )}
        </div>)}

        {/* ══ PRACTICE ══ */}
        {view === "daily" && (<div className="animate-fade-in">
          {/* Session Timer Bar */}
          <div className="panel p-3 mb-4" style={{ borderColor: "#D4A843" + "30", background: "linear-gradient(135deg, rgba(212,168,67,0.06) 0%, transparent 60%)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="font-stat text-2xl text-[#D4A843] tabular-nums" style={{ minWidth: 72 }}>{fmtTimer(sessionSeconds)}</div>
                <div className="font-label text-[10px] text-[#666]">Session</div>
                {streak.currentStreak > 0 && (
                  <span className="font-label text-[10px] text-[#D4A843]">Day {streak.currentStreak}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setSessionRunning(!sessionRunning)}
                  className={`font-label text-[10px] px-3 py-1.5 rounded-lg border transition-all ${sessionRunning ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#D4A843]/40 text-[#D4A843]"}`}>
                  {sessionRunning ? "Pause" : "Start"}
                </button>
                <button type="button" onClick={() => { setSessionSeconds(0); setSessionRunning(false); }}
                  className="btn-ghost !px-2 !py-1.5 !text-[10px]">Reset</button>
              </div>
            </div>
            {curExList.length > 0 && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
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
          </div>

          {/* Quick Tools Row */}
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => { setShowQuickMetronome(!showQuickMetronome); setShowQuickRecorder(false); }}
              className={`flex items-center gap-1.5 font-label text-[11px] px-3 py-2 rounded-lg border transition-all ${showQuickMetronome ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#888] hover:border-[#555]"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="10" strokeDasharray="4 2"/></svg>
              Metronome
            </button>
            <button type="button" onClick={() => setView("learn")}
              className="flex items-center gap-1.5 font-label text-[11px] px-3 py-2 rounded-lg border border-[#333] text-[#888] hover:border-[#555] transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
              Tuner
            </button>
            <button type="button" onClick={() => { setShowQuickRecorder(!showQuickRecorder); setShowQuickMetronome(false); }}
              className={`flex items-center gap-1.5 font-label text-[11px] px-3 py-2 rounded-lg border transition-all ${showQuickRecorder ? "bg-[#C41E3A] text-white border-[#C41E3A]" : "border-[#333] text-[#888] hover:border-[#555]"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
              Record
            </button>
          </div>

          {/* Inline Metronome */}
          {showQuickMetronome && (
            <div className="panel p-4 mb-4" style={{ borderColor: "#D4A843" + "30" }}>
              <MetronomeBox standalone />
            </div>
          )}

          {/* Inline Recorder */}
          {showQuickRecorder && (
            <div className="panel p-4 mb-4" style={{ borderColor: "#C41E3A" + "30" }}>
              <RecorderBox storageKey={week + "-" + selDay + "-session"} />
            </div>
          )}

          {/* Day Selector */}
          <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide pb-1">
            {DAYS.map((day) => (
              <button key={day} onClick={() => setSelDay(day)}
                className={`font-label text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-all flex-shrink-0 ${
                  selDay === day ? "bg-[#D4A843] text-[#121214]" : "text-[#555] hover:text-[#aaa]"
                }`}><span className="sm:hidden">{day.slice(0, 3)}</span><span className="hidden sm:inline">{day}</span></button>
            ))}
          </div>

          {/* Day Header */}
          <div className="panel p-3 sm:p-5 mb-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <div className="font-heading text-lg sm:text-xl font-bold text-[#D4A843]">{selDay}</div>
                <div className="font-readout text-[10px] sm:text-[11px] text-[#555] mt-0.5">
                  <span>{curExList.length} exercises</span>
                  <span className="mx-1">&middot;</span>
                  <span>{curMin} min</span>
                  <span className="mx-1">&middot;</span>
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
                  <button type="button" onClick={() => { setSongPickerOpen(true); setSongPickerSearch(""); }} className="btn-ghost" style={{ borderColor: "#1a3a2a", color: "#33CC33" }}>+ Song</button>
                )}
              </div>

              {/* Unified Exercise Picker */}
              {exPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={() => setExPickerOpen(false)}>
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative w-full max-w-[520px] mx-2 rounded-lg overflow-hidden" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-panel)", maxHeight: "70vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                    <div className="p-3 border-b border-[#222]">
                      <div className="font-label text-[11px] text-[#D4A843] mb-2">Add Exercise</div>
                      <input type="text" placeholder="Search exercises..." className="input w-full mb-2" autoFocus
                        value={exPickerSearch} onChange={e => setExPickerSearch(e.target.value)} />
                      <div className="flex gap-1 flex-wrap">
                        <button type="button" onClick={() => setExPickerCat("All")}
                          className={`font-label text-[9px] px-2 py-0.5 rounded-sm border transition-all ${exPickerCat === "All" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All</button>
                        {CATS.filter(c => c !== "Songs").map(cat => (
                          <button type="button" key={cat} onClick={() => setExPickerCat(cat)}
                            className="font-label text-[9px] px-2 py-0.5 rounded-sm border transition-all"
                            style={exPickerCat === cat ? { background: COL[cat], borderColor: COL[cat], color: "#121214" } : { borderColor: (COL[cat] || "#888") + "40", color: (COL[cat] || "#888") + "99" }}>{cat}</button>
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
                        }} className="w-full text-left px-3 py-2.5 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COL[ex.c] || "#888" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-[#ccc] truncate">{ex.n}</div>
                            <div className="font-readout text-[9px] text-[#555]">{ex.c} &middot; {ex.m}min {ex.b ? "&middot; " + ex.b : ""}</div>
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

              {/* Unified Song Picker */}
              {songPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={() => setSongPickerOpen(false)}>
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative w-full max-w-[520px] mx-2 rounded-lg overflow-hidden" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-panel)", maxHeight: "70vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                    <div className="p-3 border-b border-[#222]">
                      <div className="font-label text-[11px] text-[#33CC33] mb-2">Add Song</div>
                      <input type="text" placeholder="Search songs..." className="input w-full" autoFocus
                        value={songPickerSearch} onChange={e => setSongPickerSearch(e.target.value)} />
                    </div>
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: "50vh" }}>
                      {songs.filter(s => !songPickerSearch.trim() || s.name.toLowerCase().includes(songPickerSearch.trim().toLowerCase())).map(song => (
                        <button type="button" key={song.id} onClick={() => {
                          setDayExMap(p => ({ ...p, [selDay]: [...(p[selDay] || []), makeSongItemSimple(song)] }));
                          setSongPickerOpen(false);
                        }} className="w-full text-left px-3 py-2.5 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COL["Songs"] || "#33CC33" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-[#ccc] truncate">{song.name}</div>
                            <div className="font-readout text-[9px] text-[#555]">Song &middot; 20min</div>
                          </div>
                        </button>
                      ))}
                      {songs.length === 0 && <div className="p-6 text-center text-[12px] text-[#555]">No songs in setlist. Add from Dashboard.</div>}
                    </div>
                    <div className="p-2 border-t border-[#222] text-center">
                      <button type="button" onClick={() => setSongPickerOpen(false)} className="btn-ghost !text-[10px]">Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {!curExList.length && <div className="panel p-8 sm:p-12 text-center" style={{ background: "linear-gradient(180deg, rgba(212,168,67,0.04) 0%, transparent 60%)" }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" className="mx-auto mb-5">
              <path d="M9 19V6l12-3v13" stroke="#D4A843" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
              <path d="M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" fill="#D4A843" opacity="0.15" stroke="#D4A843" strokeWidth="0.8"/>
              <path d="M21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" fill="#D4A843" opacity="0.15" stroke="#D4A843" strokeWidth="0.8"/>
              <path d="M9 10l12-3" stroke="#D4A843" strokeWidth="0.5" opacity="0.3" strokeDasharray="2 2"/>
            </svg>
            <div className="font-heading text-xl text-[#D4A843] mb-2">Ready to Practice?</div>
            <div className="font-readout text-[12px] text-[#666] mb-6 max-w-[340px] mx-auto leading-relaxed">
              {curCats.length > 0
                ? "Your categories are set. Hit Auto Fill to generate a personalized routine for today."
                : "Set your categories in Dashboard > Schedule first, then come back to build your practice session."}
            </div>
            <div className="flex gap-3 justify-center">
              {curCats.length > 0 && <button type="button" onClick={() => buildDay(selDay)} className="btn-gold">Auto Fill</button>}
              <button type="button" onClick={() => { setExPickerOpen(true); setExPickerSearch(""); setExPickerCat("All"); }} className="btn-ghost">+ Add Exercise</button>
              {curCats.length === 0 && <button type="button" onClick={() => setView("dash")} className="btn-gold">Go to Dashboard</button>}
            </div>
          </div>}

          {/* Exercise list -- unified cards */}
          {curExList.map((rawEx, idx) => {
            const ex = typeof rawEx.id === "number" && rawEx.id < 1000 ? getEditedEx(rawEx) : rawEx;
            const done = doneMap[week + "-" + selDay + "-" + ex.id], cc = COL[ex.c] || "#888", isSong = ex.c === "Songs";
            return (
              <div key={String(ex.id) + "-" + idx} className="panel mb-2 rounded-lg transition-all" style={{ opacity: done ? 0.45 : 1 }}>
                <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
                  <button type="button" aria-label={done ? "Mark undone" : "Mark done"} onClick={() => {
                    toggleDone(week + "-" + selDay + "-" + ex.id);
                  }} className="cursor-pointer flex-shrink-0 bg-transparent border-none p-0">
                    <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                      style={{ borderColor: done ? "#33CC33" : cc + "60", background: done ? "#33CC33" : "transparent" }}>
                      {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#121214" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                    </div>
                  </button>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cc }} />
                  <div className="flex-1 min-w-0 cursor-pointer" tabIndex={0} role="button" onClick={() => setModal(ex)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModal(ex); } }}>
                    <div className="font-heading text-[13px] sm:text-sm !font-medium !normal-case !tracking-normal leading-snug">{ex.n}</div>
                    <div className="font-readout text-[10px] text-[#555] mt-0.5">{isSong ? "Song" : ex.c} &middot; {ex.m}min {ex.b ? "&middot; " + ex.b + " BPM" : ""}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { if (!idx) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx-1]] = [l[idx-1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-1 !text-[9px]" style={{ opacity: idx === 0 ? 0.2 : 1 }}>UP</button>
                    <button onClick={() => { if (idx >= curExList.length - 1) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx+1]] = [l[idx+1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-1 !text-[9px]" style={{ opacity: idx >= curExList.length - 1 ? 0.2 : 1 }}>DN</button>
                    <button type="button" onClick={() => setFocusEx({ ex, idx })} className="btn-ghost !px-1.5 !py-1 !text-[9px]">Focus</button>
                    {!isSong && <button onClick={() => { const pool = EXERCISES.filter((e) => e.c === ex.c && e.id !== ex.id); if (!pool.length) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); l[idx] = pool[Math.floor(Math.random() * pool.length)]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-1 !text-[9px]">Swap</button>}
                    <button type="button" onClick={() => setDayExMap((p) => { const l = (p[selDay] || []).slice(); l.splice(idx, 1); return { ...p, [selDay]: l }; })}
                      className="btn-ghost !px-1.5 !py-1 !text-[9px] !text-[#C41E3A]">Del</button>
                  </div>
                  <div className="mobile-action-row flex-shrink-0">
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
              </div>
            );
          })}

          {/* Suggested Exercises */}
          {curExList.length > 0 && curExList.length <= 4 && (() => {
            const curIds = new Set(curExList.map(e => e.id));
            const suggested = EXERCISES.filter(e => curCats.includes(e.c) && !curIds.has(e.id)).slice(0, 5);
            return suggested.length > 0 ? (
              <div className="panel p-4 mb-3 mt-2">
                <div className="font-label text-[10px] text-[#666] mb-2">Suggested Exercises</div>
                {suggested.map(ex => (
                  <button type="button" key={ex.id} onClick={() => setDayExMap(p => ({ ...p, [selDay]: [...(p[selDay] || []), ex] }))}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COL[ex.c] || "#888" }} />
                    <span className="text-[11px] text-[#888] flex-1 truncate">{ex.n}</span>
                    <span className="font-readout text-[9px] text-[#444]">{ex.m}m</span>
                    <span className="text-[10px] text-[#D4A843]">+</span>
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </div>)}


        {/* ══ LIBRARY ══ */}
        {view === "lib" && (<div className="animate-fade-in">
          {/* Sub-tabs — 6 tabs, horizontal scroll on mobile */}
          <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide pb-1">
            {([
              ["exercises", "Exercises", "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"],
              ["styles", "Styles", "M9 19V6l12-3v13"],
              ["mysongs", "My Songs", "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"],
              ["recordings", "Recordings", "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-1h8M12 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"],
              ["backing", "Backing Tracks", "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"],
              ["songlib", "Song Library", "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"],
            ] as const).map(([key, label, iconPath]) => (
              <button type="button" key={key} onClick={() => setLibTab(key as typeof libTab)}
                className={`font-label text-[11px] px-3 py-2 rounded-lg cursor-pointer border transition-all flex-shrink-0 flex items-center gap-1.5 ${libTab === key ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666] hover:border-[#555] hover:text-[#888]"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={iconPath} /></svg>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab 1: Exercises ── */}
          {libTab === "exercises" && (<>
            <input type="text" placeholder="Search exercise..." className="input w-full mb-3"
              value={libSearch} onChange={e => setLibSearch(e.target.value)} />

            <div className="flex gap-1 flex-wrap mb-4">
              <button onClick={() => setLibFilter("All")} className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border ${libFilter === "All" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All ({EXERCISES.length})</button>
              {CATS.filter((c) => c !== "Songs").map((cat) => {
                const cnt = EXERCISES.filter((e) => e.c === cat).length, c = COL[cat];
                if (!cnt) return null;
                return <button key={cat} onClick={() => setLibFilter(cat)} className="font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all"
                  style={libFilter === cat ? { background: c, borderColor: c, color: "#121214" } : { borderColor: c + "40", color: c + "99" }}>{cat} ({cnt})</button>;
              })}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setLibShowAll(!libShowAll)} className="btn-ghost !text-[10px]">
                {libShowAll ? "Group by Category" : "Show Flat List"}
              </button>
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
              const isSearching = libSearch.trim().length > 0;

              const renderExCard = (rawEx: Exercise) => {
                const ex = getEditedEx(rawEx), c = COL[ex.c], isEd = editingId === ex.id;
                const practiceCount = Object.keys(doneMap).filter(k => k.includes("-" + ex.id) && doneMap[k]).length;
                return (
                  <div key={ex.id} className={`panel mb-1.5 overflow-hidden ${isEd ? "!border-[#D4A843]/30" : ""}`}>
                    <div onClick={() => setEditingId(isEd ? null : ex.id)} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                      <div className="flex-1">
                        <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{ex.n}</div>
                        <div className="font-readout text-[10px] text-[#444]">{ex.f} · {ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                      </div>
                      {practiceCount > 0 && (
                        <span className="font-readout text-[9px] px-1.5 py-0.5 rounded-sm bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">{practiceCount}x</span>
                      )}
                      <span className="text-[10px] text-[#333]">{isEd ? "−" : "+"}</span>
                    </div>
                    {isEd && <LibraryEditor ex={ex} exEdits={exEdits} setExEdits={setExEdits} />}
                  </div>
                );
              };

              if (libShowAll) {
                return (<>
                  {filtered.map(renderExCard)}
                  <div className="font-readout text-[10px] text-[#444] text-center mt-2">{filtered.length} exercises</div>
                </>);
              }

              return (<>
                {Object.entries(CAT_GROUPS).map(([groupName, groupCats]) => {
                  const groupExercises = filtered.filter(e => groupCats.includes(e.c));
                  if (groupExercises.length === 0) return null;
                  const isCollapsed = isSearching ? false : (libCollapsed[groupName] ?? true);
                  return (
                    <div key={groupName} className="mb-2">
                      <div
                        onClick={() => { if (!isSearching) setLibCollapsed(p => ({ ...p, [groupName]: !isCollapsed })); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer border border-[#1a1a1a] bg-[#141416] hover:border-[#D4A843]/20 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span className="font-heading text-sm font-semibold text-[#ccc] flex-1">{groupName}</span>
                        <span className="font-readout text-[10px] px-2 py-0.5 rounded-sm bg-[#1a1a1a] text-[#D4A843] border border-[#D4A843]/20">{groupExercises.length}</span>
                      </div>
                      {!isCollapsed && (
                        <div className="mt-1">{groupExercises.map(renderExCard)}</div>
                      )}
                    </div>
                  );
                })}
              </>);
            })()}
          </>)}

          {/* ── Tab 2: Styles ── */}
          {libTab === "styles" && (() => {
            const STYLE_DATA: Record<string, { color: string; icon: string; techniques: string[]; scales: string[] }> = {
              "Metal": { color: "#ef4444", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Palm Muting", "Tremolo Picking", "Sweep Picking", "Gallop Rhythm"], scales: ["Aeolian", "Phrygian", "Harmonic Minor"] },
              "Hard Rock": { color: "#f97316", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Power Chords", "Bends", "Vibrato", "Hammer-ons"], scales: ["Pentatonic Minor", "Aeolian", "Mixolydian"] },
              "Classic Rock": { color: "#eab308", icon: "M9 19V6l12-3v13", techniques: ["Bends", "Double Stops", "Rhythm Guitar", "Riffs"], scales: ["Pentatonic Minor", "Pentatonic Major", "Dorian"] },
              "Blues": { color: "#3b82f6", icon: "M9 19V6l12-3v13", techniques: ["Bends", "Vibrato", "Slides", "Call & Response"], scales: ["Blues Scale", "Pentatonic Minor", "Mixolydian"] },
              "Jazz": { color: "#8b5cf6", icon: "M9 19V6l12-3v13", techniques: ["Chord Melody", "Arpeggios", "Walking Bass", "Comping"], scales: ["Dorian", "Mixolydian", "Lydian", "Altered"] },
              "Grunge": { color: "#6b7280", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Power Chords", "Drop D", "Dynamics", "Feedback"], scales: ["Pentatonic Minor", "Aeolian", "Phrygian"] },
              "Stoner Rock": { color: "#a3e635", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Heavy Riffs", "Down Tuning", "Fuzz Tone", "Slow Bends"], scales: ["Pentatonic Minor", "Blues Scale", "Dorian"] },
              "Punk Rock": { color: "#ec4899", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Power Chords", "Fast Strumming", "Palm Muting"], scales: ["Aeolian", "Pentatonic Minor"] },
              "Neo-Classical": { color: "#c084fc", icon: "M9 19V6l12-3v13", techniques: ["Sweep Picking", "Alternate Picking", "Arpeggios", "Sequences"], scales: ["Harmonic Minor", "Phrygian Dominant", "Diminished"] },
              "Funk": { color: "#14b8a6", icon: "M9 19V6l12-3v13", techniques: ["Muted Strumming", "Wah Pedal", "Octaves", "Slap"], scales: ["Mixolydian", "Dorian", "Pentatonic Minor"] },
              "Country": { color: "#fbbf24", icon: "M9 19V6l12-3v13", techniques: ["Chicken Picking", "Bends", "Pedal Steel Licks", "Hybrid Picking"], scales: ["Pentatonic Major", "Mixolydian", "Major"] },
              "Flamenco": { color: "#f43f5e", icon: "M9 19V6l12-3v13", techniques: ["Rasgueado", "Picado", "Tremolo", "Golpe"], scales: ["Phrygian", "Phrygian Dominant", "Harmonic Minor"] },
              "Acoustic": { color: "#22c55e", icon: "M9 19V6l12-3v13", techniques: ["Fingerpicking", "Strumming", "Harmonics", "Percussive"], scales: ["Major", "Pentatonic Major", "Aeolian"] },
              "Progressive Metal": { color: "#6366f1", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Odd Time Signatures", "Polyrhythms", "Tapping", "Sweep Picking"], scales: ["Lydian", "Phrygian", "Whole Tone", "Diminished"] },
              "Djent": { color: "#0ea5e9", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Palm Muting", "Polyrhythms", "Extended Range", "Staccato"], scales: ["Aeolian", "Phrygian", "Lydian"] },
              "Death Metal": { color: "#991b1b", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Tremolo Picking", "Blast Beats", "Dissonance", "Sweep Picking"], scales: ["Phrygian", "Locrian", "Chromatic", "Whole Tone"] },
              "Fusion": { color: "#d946ef", icon: "M9 19V6l12-3v13", techniques: ["Legato", "Tapping", "Hybrid Picking", "Chord Extensions"], scales: ["Lydian", "Dorian", "Altered", "Melodic Minor"] },
            };
            const [activeStyle, setActiveStyle] = useState<string | null>(null);
            const styleExercises = activeStyle ? EXERCISES.filter(e => e.styles?.includes(activeStyle)) : [];
            const allSongsForStyle = activeStyle ? [...SONG_LIBRARY, ...customSongs].filter(s => s.genre?.toLowerCase().includes(activeStyle.toLowerCase())) : [];

            return (
              <div>
                {!activeStyle ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {STYLES.map((s) => {
                      const cnt = EXERCISES.filter((e) => e.styles?.includes(s)).length;
                      const sd = STYLE_DATA[s];
                      const songCnt = [...SONG_LIBRARY, ...customSongs].filter(se => se.genre?.toLowerCase().includes(s.toLowerCase())).length;
                      return (
                        <div key={s} onClick={() => setActiveStyle(s)}
                          className="panel p-4 text-center cursor-pointer hover:border-[#D4A843]/30 transition-all group">
                          <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: (sd?.color || "#D4A843") + "20", border: `1px solid ${sd?.color || "#D4A843"}40` }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sd?.color || "#D4A843"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={sd?.icon || "M9 19V6l12-3v13"} /></svg>
                          </div>
                          <div className="font-heading text-sm font-bold" style={{ color: sd?.color || "#D4A843" }}>{s}</div>
                          <div className="font-readout text-[10px] text-[#555] mt-1">{cnt} exercises</div>
                          {songCnt > 0 && <div className="font-readout text-[10px] text-[#444] mt-0.5">{songCnt} songs</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <button type="button" onClick={() => setActiveStyle(null)} className="btn-ghost !text-[10px] mb-4 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                      All Styles
                    </button>
                    <div className="panel p-4 mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: (STYLE_DATA[activeStyle]?.color || "#D4A843") + "20", border: `1px solid ${STYLE_DATA[activeStyle]?.color || "#D4A843"}40` }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={STYLE_DATA[activeStyle]?.color || "#D4A843"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STYLE_DATA[activeStyle]?.icon || "M9 19V6l12-3v13"} /></svg>
                        </div>
                        <div>
                          <div className="font-heading text-lg font-bold" style={{ color: STYLE_DATA[activeStyle]?.color || "#D4A843" }}>{activeStyle}</div>
                          <div className="font-readout text-[10px] text-[#555]">{styleExercises.length} exercises · {allSongsForStyle.length} songs</div>
                        </div>
                      </div>
                      {STYLE_DATA[activeStyle]?.techniques.length > 0 && (
                        <div className="mb-3">
                          <div className="font-label text-[10px] text-[#666] mb-1.5">Key Techniques</div>
                          <div className="flex gap-1.5 flex-wrap">
                            {STYLE_DATA[activeStyle].techniques.map(t => (
                              <span key={t} className="font-readout text-[10px] px-2 py-1 rounded-sm border border-[#333] text-[#888]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {STYLE_DATA[activeStyle]?.scales.length > 0 && (
                        <div>
                          <div className="font-label text-[10px] text-[#666] mb-1.5">Recommended Scales</div>
                          <div className="flex gap-1.5 flex-wrap">
                            {STYLE_DATA[activeStyle].scales.map(s => (
                              <span key={s} className="font-readout text-[10px] px-2 py-1 rounded-sm border border-[#D4A843]/20 text-[#D4A843]">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {styleExercises.length > 0 && (
                      <div className="mb-4">
                        <div className="font-label text-[11px] text-[#666] mb-2">Exercises for {activeStyle}</div>
                        {styleExercises.map(ex => {
                          const c = COL[ex.c];
                          return (
                            <div key={ex.id} onClick={() => setModal(ex)} tabIndex={0} role="button" onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModal(ex); } }} className="panel p-3 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                              <div className="flex items-center gap-3">
                                <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                                <div className="flex-1">
                                  <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{ex.n}</div>
                                  <div className="font-readout text-[10px] text-[#444]">{ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {allSongsForStyle.length > 0 && (
                      <div>
                        <div className="font-label text-[11px] text-[#666] mb-2">Songs ({allSongsForStyle.length})</div>
                        {allSongsForStyle.slice(0, 10).map(song => (
                          <div key={song.id} onClick={() => setSongModal(song)} className="panel p-3 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                            <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</div>
                            <div className="font-readout text-[10px] text-[#555]">{song.artist}</div>
                          </div>
                        ))}
                        {allSongsForStyle.length > 10 && (
                          <button type="button" onClick={() => { setLibTab("songlib"); setSongLibGenre(allSongsForStyle[0]?.genre || "all"); }} className="btn-ghost w-full mt-1 !text-[10px]">
                            View all {allSongsForStyle.length} songs
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Tab 3: My Songs ── */}
          {libTab === "mysongs" && (() => {
            const allSongsLookup = [...SONG_LIBRARY, ...customSongs];
            const savedSongs = mySongs.map(id => allSongsLookup.find(s => s.id === id)).filter((s): s is SongEntry => !!s);
            return (
              <div>
                {savedSongs.length === 0 ? (
                  <div className="panel p-8 sm:p-12 text-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    <div className="font-heading text-lg text-[#D4A843] mb-2">No Songs Saved</div>
                    <div className="font-readout text-[11px] text-[#444] mb-4">Browse the Song Library and tap the heart to save songs here.</div>
                    <button type="button" onClick={() => setLibTab("songlib")} className="btn-ghost">Browse Song Library</button>
                  </div>
                ) : (
                  <>
                    <div className="font-readout text-[10px] text-[#555] mb-3">{savedSongs.length} saved songs</div>
                    {savedSongs.map(song => {
                      const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                      return (
                        <div key={song.id} className="panel p-4 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0" onClick={() => setSongModal(song)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</span>
                                {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                              </div>
                              <div className="font-readout text-[11px] text-[#666] mt-1">{song.artist}</div>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {song.genre && <span className="font-readout text-[9px] text-[#555]">{song.genre}</span>}
                                {song.key && <span className="font-readout text-[9px] text-[#555]">Key: {song.key}</span>}
                                {song.tempo && <span className="font-readout text-[9px] text-[#555]">{song.tempo} BPM</span>}
                              </div>
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setMySongs(p => p.filter(id => id !== song.id)); }}
                              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors" title="Remove from My Songs">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Tab 4: My Recordings ── */}
          {libTab === "recordings" && (() => {
            if (!libRecordingsLoaded) {
              try {
                const raw = localStorage.getItem("gf-recordings");
                if (raw) setLibRecordings(JSON.parse(raw));
              } catch {}
              setLibRecordingsLoaded(true);
            }
            const playRecording = async (id: string) => {
              if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); return; }
              try {
                const dbReq = indexedDB.open("gf-studio", 2);
                dbReq.onsuccess = () => {
                  const db = dbReq.result;
                  const tx = db.transaction("recordings", "readonly");
                  const req = tx.objectStore("recordings").get(id);
                  req.onsuccess = () => {
                    const rec = req.result;
                    if (rec?.blob) {
                      if (libAudioRef.current) { libAudioRef.current.pause(); URL.revokeObjectURL(libAudioRef.current.src); }
                      const url = URL.createObjectURL(rec.blob);
                      const audio = new Audio(url);
                      audio.onended = () => setPlayingRecId(null);
                      audio.play();
                      libAudioRef.current = audio;
                      setPlayingRecId(id);
                    }
                  };
                };
              } catch {}
            };
            const deleteRecording = async (id: string) => {
              try {
                const dbReq = indexedDB.open("gf-studio", 2);
                dbReq.onsuccess = () => {
                  const db = dbReq.result;
                  const tx = db.transaction("recordings", "readwrite");
                  tx.objectStore("recordings").delete(id);
                  tx.oncomplete = () => {
                    const updated = libRecordings.filter(r => r.id !== id);
                    setLibRecordings(updated);
                    try { localStorage.setItem("gf-recordings", JSON.stringify(updated)); } catch {}
                  };
                };
              } catch {}
              if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); }
            };
            return (
              <div>
                {libRecordings.length === 0 ? (
                  <div className="panel p-8 sm:p-12 text-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                      <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-1h8M12 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"/>
                    </svg>
                    <div className="font-heading text-lg text-[#D4A843] mb-2">No Recordings</div>
                    <div className="font-readout text-[11px] text-[#444] mb-4">Record yourself in any exercise or the Studio to see recordings here.</div>
                    <button type="button" onClick={() => setView("studio")} className="btn-ghost">Open Studio</button>
                  </div>
                ) : (
                  <>
                    <div className="font-readout text-[10px] text-[#555] mb-3">{libRecordings.length} recordings</div>
                    {libRecordings.map(rec => (
                      <div key={rec.id} className="panel p-4 mb-1.5">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => playRecording(rec.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-all"
                            style={{ borderColor: playingRecId === rec.id ? "#D4A843" : "#333", background: playingRecId === rec.id ? "#D4A843" + "20" : "transparent" }}>
                            {playingRecId === rec.id ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{rec.name}</div>
                            <div className="font-readout text-[10px] text-[#444]">
                              {new Date(rec.date).toLocaleDateString()} · {Math.round(rec.duration)}s · {rec.format?.toUpperCase() || "WAV"}
                            </div>
                          </div>
                          <button type="button" onClick={() => deleteRecording(rec.id)}
                            className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Delete</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Tab 5: My Backing Tracks ── */}
          {libTab === "backing" && (() => {
            if (!libBackingLoaded) {
              setLibBackingLoaded(true);
              getAllLibraryTracks().then(tracks => setLibBackingTracks(tracks)).catch(() => {});
            }
            const playBacking = (track: LibraryTrack) => {
              if (playingBackingId === track.id) { libAudioRef.current?.pause(); setPlayingBackingId(null); return; }
              if (libAudioRef.current) { libAudioRef.current.pause(); URL.revokeObjectURL(libAudioRef.current.src); }
              const audio = new Audio(track.audioUrl);
              audio.onended = () => setPlayingBackingId(null);
              audio.play();
              libAudioRef.current = audio;
              setPlayingBackingId(track.id);
            };
            const deleteBacking = async (id: string) => {
              try { await deleteFromLibrary(id); setLibBackingTracks(p => p.filter(t => t.id !== id)); } catch {}
              if (playingBackingId === id) { libAudioRef.current?.pause(); setPlayingBackingId(null); }
            };
            return (
              <div>
                {libBackingTracks.length === 0 ? (
                  <div className="panel p-8 sm:p-12 text-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                      <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
                    </svg>
                    <div className="font-heading text-lg text-[#D4A843] mb-2">No Backing Tracks</div>
                    <div className="font-readout text-[11px] text-[#444] mb-4">Generate a backing track in any exercise or the Studio.</div>
                    <button type="button" onClick={() => setView("studio")} className="btn-ghost">Open Studio</button>
                  </div>
                ) : (
                  <>
                    <div className="font-readout text-[10px] text-[#555] mb-3">{libBackingTracks.length} backing tracks</div>
                    {libBackingTracks.map(track => (
                      <div key={track.id} className="panel p-4 mb-1.5">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => playBacking(track)}
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-all"
                            style={{ borderColor: playingBackingId === track.id ? "#D4A843" : "#333", background: playingBackingId === track.id ? "#D4A843" + "20" : "transparent" }}>
                            {playingBackingId === track.id ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{track.title}</div>
                            <div className="font-readout text-[10px] text-[#444]">
                              {track.params.style} · {track.params.scale} {track.params.mode} · {track.params.bpm} BPM
                            </div>
                            <div className="font-readout text-[9px] text-[#333] mt-0.5">
                              {new Date(track.createdAt).toLocaleDateString()} · {Math.round(track.duration)}s
                            </div>
                          </div>
                          {track.favorite && <span className="text-[#D4A843] text-xs flex-shrink-0">★</span>}
                          <button type="button" onClick={() => deleteBacking(track.id)}
                            className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Delete</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Tab 6: Song Library ── */}
          {libTab === "songlib" && (() => {
            const allSongs = [...SONG_LIBRARY, ...customSongs];
            const genres = [...new Set(allSongs.map(s => s.genre).filter((g): g is string => !!g))].sort();
            const genreFiltered = songLibGenre === "all" ? allSongs : allSongs.filter(s => s.genre === songLibGenre);
            const filtered = genreFiltered.filter(s => {
              if (songLibFilter !== "all" && s.difficulty !== songLibFilter) return false;
              if (songLibSearch.trim()) {
                const q = songLibSearch.trim().toLowerCase();
                return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.genre || "").toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q);
              }
              return true;
            });
            const diffCounts = { all: genreFiltered.length, Beginner: genreFiltered.filter(s => s.difficulty === "Beginner").length, Intermediate: genreFiltered.filter(s => s.difficulty === "Intermediate").length, Advanced: genreFiltered.filter(s => s.difficulty === "Advanced").length };
            return (
              <div>
                <div className="flex gap-1 flex-wrap mb-3 overflow-x-auto scrollbar-hide">
                  <button onClick={() => { setSongLibGenre("all"); setSongLibLimit(20); }}
                    className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === "all" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
                    All ({allSongs.length})
                  </button>
                  {genres.map(g => {
                    const cnt = allSongs.filter(s => s.genre === g).length;
                    return (
                      <button key={g} onClick={() => { setSongLibGenre(g); setSongLibLimit(20); }}
                        className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === g ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
                        {g} ({cnt})
                      </button>
                    );
                  })}
                </div>
                <input type="text" placeholder="Search song, artist, genre..." className="input w-full mb-3"
                  value={songLibSearch} onChange={e => { setSongLibSearch(e.target.value); setSongLibLimit(20); }} />
                <div className="flex gap-1 flex-wrap mb-4">
                  {([["all", "All", "#D4A843"], ["Beginner", "Beginner", "#22c55e"], ["Intermediate", "Intermediate", "#D4A843"], ["Advanced", "Advanced", "#ef4444"]] as const).map(([key, label, color]) => (
                    <button key={key} onClick={() => { setSongLibFilter(key as typeof songLibFilter); setSongLibLimit(20); }}
                      className="font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all"
                      style={songLibFilter === key ? { background: color, borderColor: color, color: "#121214" } : { borderColor: color + "40", color: color + "99" }}>
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
                <div className="font-readout text-[10px] text-[#555] mb-2">
                  Showing {Math.min(songLibLimit, filtered.length)} of {filtered.length} songs
                </div>
                {filtered.length === 0 && (
                  <div className="panel p-8 text-center"><div className="font-label text-sm text-[#444]">No songs found</div></div>
                )}
                {(() => {
                  const limited = filtered.slice(0, songLibLimit);
                  return (<>
                    {limited.map(song => {
                      const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                      const isCustom = song.id >= 1000000000;
                      const isSaved = mySongs.includes(song.id);
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
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button type="button" onClick={(e) => {
                                e.stopPropagation();
                                if (isSaved) setMySongs(p => p.filter(id => id !== song.id));
                                else setMySongs(p => [...p, song.id]);
                              }} className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors" title={isSaved ? "Remove from My Songs" : "Add to My Songs"}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? "#ef4444" : "none"} stroke={isSaved ? "#ef4444" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                                </svg>
                              </button>
                              {isCustom && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setCustomSongs(p => p.filter(s => s.id !== song.id)); }}
                                  className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333]">Remove</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {songLibLimit < filtered.length && (
                      <button type="button" onClick={() => setSongLibLimit(p => p + 20)} className="btn-ghost w-full mt-2 !text-[11px]">
                        Load more ({filtered.length - songLibLimit} remaining)
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
              {songs.map((song) => (
                  <div key={song.id} className="p-3 bg-[#121214] rounded-lg mb-2 border border-[#1a1a1a]">
                    <span className="font-medium text-sm">{song.name}</span>
                    {song.url && <a href={song.url} target="_blank" rel="noopener noreferrer" className="font-label text-[9px] text-[#D4A843] ml-2 no-underline">Tab</a>}
                  </div>
              ))}
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
