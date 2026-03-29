"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, ExEditMap } from "@/lib/types";
import { DAYS, CATS, COL, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { autoFill, makeSongItemSimple } from "@/lib/helpers";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import DailyRecorderBox from "./DailyRecorderBox";
import type { DailyRecorderControl } from "./DailyRecorderBox";
import type { View } from "./Navbar";

// ── Note detection constants ──
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const GUITAR_STRINGS = [
  { note: "E4", freq: 329.63, label: "1st (E4)" },
  { note: "B3", freq: 246.94, label: "2nd (B3)" },
  { note: "G3", freq: 196.00, label: "3rd (G3)" },
  { note: "D3", freq: 146.83, label: "4th (D3)" },
  { note: "A2", freq: 110.00, label: "5th (A2)" },
  { note: "E2", freq: 82.41, label: "6th (E2)" },
];

function freqToNote(freq: number): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log2(freq / 440));
  const roundedNote = Math.round(noteNum);
  const cents = Math.round((noteNum - roundedNote) * 100);
  const noteIdx = ((roundedNote % 12) + 12) % 12;
  const octave = Math.floor((roundedNote + 9) / 12) + 4;
  return { note: NOTE_NAMES[noteIdx], octave, cents };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoCorrelate(inputBuf: any, sampleRate: number): number {
  let SIZE = inputBuf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += inputBuf[i] * inputBuf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(inputBuf[i]) < thres) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(inputBuf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }

  const trimmed = Array.prototype.slice.call(inputBuf, r1, r2) as number[];
  const buf = new Float32Array(trimmed);
  SIZE = buf.length;

  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let val = 0;
    for (let j = 0; j < SIZE - i; j++) val += buf[j] * buf[j + i];
    c[i] = val;
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

interface PracticePageProps {
  week: number;
  selDay: string;
  style: string;
  dayCats: DayCats;
  dayHrs: DayHrs;
  dayExMap: DayExMap;
  doneMap: BoolMap;
  bpmLog: StringMap;
  songs: Song[];
  exEdits: ExEditMap;
  streak: { currentStreak: number; longestStreak: number; lastPracticeDate: string; totalDays: number };
  customExercises?: Exercise[];
  sessionSeconds: number;
  sessionRunning: boolean;
  showQuickMetronome: boolean;
  showQuickRecorder: boolean;
  exPickerOpen: boolean;
  exPickerSearch: string;
  exPickerCat: string;
  songPickerOpen: boolean;
  songPickerSearch: string;
  // Computed
  curExList: Exercise[];
  curDone: number;
  curMin: number;
  curCats: string[];
  // Setters
  setView: (v: View) => void;
  setSelDay: (s: string) => void;
  setDayCats: React.Dispatch<React.SetStateAction<DayCats>>;
  setDayHrs: React.Dispatch<React.SetStateAction<DayHrs>>;
  setDayExMap: React.Dispatch<React.SetStateAction<DayExMap>>;
  setSessionRunning: (b: boolean) => void;
  setSessionSeconds: (n: number) => void;
  setShowQuickMetronome: (b: boolean) => void;
  setShowQuickRecorder: (b: boolean) => void;
  setExPickerOpen: (b: boolean) => void;
  setExPickerSearch: (s: string) => void;
  setExPickerCat: (s: string) => void;
  setSongPickerOpen: (b: boolean) => void;
  setSongPickerSearch: (s: string) => void;
  setModal: (ex: Exercise | null) => void;
  setFocusEx: (v: { ex: Exercise; idx: number } | null) => void;
  // Daily recorder
  dailyRecControlRef: React.MutableRefObject<DailyRecorderControl | null>;
  // Tuner navigation
  pendingTuner?: boolean;
  setPendingTuner?: (b: boolean) => void;
  // Functions
  toggleDone: (key: string) => void;
  getEditedEx: (ex: Exercise) => Exercise;
  buildDay: (day: string) => void;
}

export default function PracticePage(props: PracticePageProps) {
  const {
    week, selDay, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, songs, exEdits,
    streak, customExercises = [], sessionSeconds, sessionRunning, showQuickMetronome, showQuickRecorder,
    exPickerOpen, exPickerSearch, exPickerCat, songPickerOpen, songPickerSearch,
    curExList, curDone, curMin, curCats,
    setView, setSelDay, setDayCats, setDayHrs, setDayExMap,
    setSessionRunning, setSessionSeconds, setShowQuickMetronome, setShowQuickRecorder,
    setExPickerOpen, setExPickerSearch, setExPickerCat,
    setSongPickerOpen, setSongPickerSearch,
    setModal, setFocusEx,
    dailyRecControlRef,
    pendingTuner, setPendingTuner,
    toggleDone, getEditedEx, buildDay,
  } = props;

  // ── Local state ──
  const [showDayEditor, setShowDayEditor] = useState(false);
  const [showTuner, setShowTuner] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [editingTimeIdx, setEditingTimeIdx] = useState<number | null>(null);
  const [editingTimeVal, setEditingTimeVal] = useState("");

  // Copy/Paste clipboard for day routine
  const [copiedDayRoutine, setCopiedDayRoutine] = useState<{ cats: string[]; hrs: number; exs: Exercise[] } | null>(null);

  // ── Practice Log (journal) ──
  const logKey = `gf-practice-log-${selDay}`;
  const [showLog, setShowLog] = useState(false);
  const [logText, setLogText] = useState("");
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load log from localStorage when day changes
  useEffect(() => {
    const saved = localStorage.getItem(logKey);
    setLogText(saved || "");
  }, [logKey]);

  // Debounced save on text change
  const handleLogChange = useCallback((val: string) => {
    setLogText(val);
    if (logTimerRef.current) clearTimeout(logTimerRef.current);
    logTimerRef.current = setTimeout(() => {
      if (val.trim()) localStorage.setItem(logKey, val);
      else localStorage.removeItem(logKey);
    }, 500);
  }, [logKey]);

  // ── Tuner state ──
  const [tunerNote, setTunerNote] = useState("");
  const [tunerOctave, setTunerOctave] = useState(0);
  const [tunerCents, setTunerCents] = useState(0);
  const [tunerFreq, setTunerFreq] = useState(0);
  const [tunerActive, setTunerActive] = useState(false);
  const tunerCtxRef = useRef<AudioContext | null>(null);
  const tunerStreamRef = useRef<MediaStream | null>(null);
  const tunerAnimRef = useRef<number>(0);
  const tunerAnalyserRef = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tunerBufRef = useRef<any>(null);

  const startTuner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      tunerCtxRef.current = ctx;
      tunerStreamRef.current = stream;
      tunerAnalyserRef.current = analyser;
      tunerBufRef.current = buf;
      setTunerActive(true);

      const detect = () => {
        if (!tunerAnalyserRef.current || !tunerBufRef.current) return;
        tunerAnalyserRef.current.getFloatTimeDomainData(tunerBufRef.current);
        const freq = autoCorrelate(tunerBufRef.current, ctx.sampleRate);
        if (freq > 0 && freq < 2000) {
          const { note, octave, cents } = freqToNote(freq);
          setTunerNote(note);
          setTunerOctave(octave);
          setTunerCents(cents);
          setTunerFreq(Math.round(freq * 10) / 10);
        }
        tunerAnimRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch {
      // Microphone access denied
    }
  }, []);

  const stopTuner = useCallback(() => {
    if (tunerAnimRef.current) cancelAnimationFrame(tunerAnimRef.current);
    if (tunerStreamRef.current) tunerStreamRef.current.getTracks().forEach(t => t.stop());
    if (tunerCtxRef.current) tunerCtxRef.current.close();
    tunerCtxRef.current = null;
    tunerStreamRef.current = null;
    tunerAnalyserRef.current = null;
    tunerBufRef.current = null;
    setTunerActive(false);
    setTunerNote("");
    setTunerCents(0);
    setTunerFreq(0);
  }, []);

  useEffect(() => {
    return () => { stopTuner(); };
  }, [stopTuner]);

  useEffect(() => {
    if (showTuner && !tunerActive) startTuner();
    if (!showTuner && tunerActive) stopTuner();
  }, [showTuner, tunerActive, startTuner, stopTuner]);

  // Open tuner when navigated from mobile More menu
  useEffect(() => {
    if (pendingTuner) {
      setShowTuner(true);
      setPendingTuner?.(false);
    }
  }, [pendingTuner, setPendingTuner]);

  const fmtTimer = (s: number) => {
    const total = Math.floor(s);
    const m = Math.floor(total / 60), sec = total % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  };

  // ── Drag & Drop handlers ──
  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragLeave = () => { setDragOverIdx(null); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setDayExMap(p => {
      const l = (p[selDay] || []).slice();
      const [item] = l.splice(dragIdx, 1);
      l.splice(idx, 0, item);
      return { ...p, [selDay]: l };
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // Closest guitar string for tuner
  const closestString = tunerFreq > 0 ? GUITAR_STRINGS.reduce((prev, curr) =>
    Math.abs(curr.freq - tunerFreq) < Math.abs(prev.freq - tunerFreq) ? curr : prev
  ) : null;

  return (
    <div className="animate-fade-in">
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
            <div className="flex items-center gap-2">
              <div className="font-heading text-lg sm:text-xl font-bold text-[#D4A843]">{selDay}</div>
              <button type="button" onClick={() => setShowDayEditor(!showDayEditor)}
                className={`font-label text-[9px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${showDayEditor ? "bg-[#D4A843]/15 text-[#D4A843] border-[#D4A843]/40" : "border-[#333] text-[#555] hover:border-[#D4A843]/40 hover:text-[#D4A843]"}`}
                title="Edit day schedule">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
            </div>
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
            <button type="button" title="Copy this day's routine" onClick={() => setCopiedDayRoutine({
              cats: [...(dayCats[selDay] || [])],
              hrs: dayHrs[selDay] || 0,
              exs: [...(dayExMap[selDay] || [])],
            })} className="btn-ghost !px-2" style={{ borderColor: "#333" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              <span className="ml-1">Copy</span>
            </button>
            <button type="button" title="Paste routine to this day" onClick={() => {
              if (!copiedDayRoutine) return;
              setDayCats(p => ({ ...p, [selDay]: [...copiedDayRoutine.cats] }));
              setDayHrs(p => ({ ...p, [selDay]: copiedDayRoutine.hrs }));
              setDayExMap(p => ({ ...p, [selDay]: [...copiedDayRoutine.exs] }));
            }} className="btn-ghost !px-2" style={{ borderColor: copiedDayRoutine ? "#D4A843" + "40" : "#222", color: copiedDayRoutine ? "#D4A843" : "#333" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
              <span className="ml-1">Paste</span>
            </button>
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
                  {[...EXERCISES, ...customExercises].filter(e => {
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

        {/* Inline Day Schedule Editor (Issue #2) */}
        {showDayEditor && (() => {
          const ac = dayCats[selDay] || [];
          const hrs = dayHrs[selDay] || 0;
          return (
            <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-label text-[10px] text-[#888]">Practice Time</span>
                <input type="number" value={hrs} min={0} max={8} step={0.5} title="Practice hours"
                  onChange={(e) => setDayHrs((p) => ({ ...p, [selDay]: Number(e.target.value) }))}
                  className="input input-gold w-16 text-center !py-1" />
                <span className="font-label text-[9px] text-[#444]">hours</span>
              </div>
              <div className="font-label text-[10px] text-[#888] mb-2">Categories</div>
              {Object.entries(CAT_GROUPS).map(([group, cats]) => (
                <div key={group} className="mb-2">
                  <div className="font-label text-[9px] text-[#555] mb-1">{group}</div>
                  <div className="flex flex-wrap gap-1">
                    {cats.map((cat) => {
                      const on = ac.includes(cat), c = COL[cat] || "#888";
                      return (
                        <span key={cat} onClick={() => setDayCats((p) => {
                          const a = (p[selDay] || []).slice(), i = a.indexOf(cat);
                          i >= 0 ? a.splice(i, 1) : a.push(cat); return { ...p, [selDay]: a };
                        })} className="tag cursor-pointer transition-all" style={{
                          border: `1px solid ${on ? c : "#2a2a2a"}`, color: on ? c : "#444",
                          background: on ? c + "10" : "transparent",
                        }}>{cat}</span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-3 pt-3 border-t border-[#1a1a1a]">
                <button onClick={() => { buildDay(selDay); setShowDayEditor(false); }} className="btn-gold !text-[10px]">Apply & Fill</button>
                <button onClick={() => setShowDayEditor(false)} className="btn-ghost !text-[10px]">Close</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Session Timer + Tools (moved UNDER day header - Issue #3) */}
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
            <button type="button" onClick={() => setShowLog(!showLog)}
              className={`relative btn-ghost !px-2 !py-1.5 !text-[10px] flex items-center gap-1 ${showLog ? "!border-[#D4A843]/60 !text-[#D4A843]" : ""}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Log
              {logText.trim() && !showLog && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D4A843]" />}
            </button>
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

        {/* Tool Buttons Row */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-[#ffffff08]">
          <button type="button" onClick={() => { setShowQuickMetronome(!showQuickMetronome); setShowQuickRecorder(false); setShowTuner(false); }}
            className={`flex items-center gap-1.5 font-label text-[11px] px-3 py-2 rounded-lg border transition-all ${showQuickMetronome ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#888] hover:border-[#555]"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="10" strokeDasharray="4 2"/></svg>
            Metronome
          </button>
          <button type="button" onClick={() => { setShowTuner(!showTuner); setShowQuickMetronome(false); setShowQuickRecorder(false); }}
            className={`flex items-center gap-1.5 font-label text-[11px] px-3 py-2 rounded-lg border transition-all ${showTuner ? "bg-[#818cf8] text-[#121214] border-[#818cf8]" : "border-[#333] text-[#888] hover:border-[#555]"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10V5a2 2 0 012-2h3.5"/><path d="M22 10V5a2 2 0 00-2-2h-3.5"/><path d="M2 14v5a2 2 0 002 2h3.5"/><path d="M22 14v5a2 2 0 01-2 2h-3.5"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Tuner
          </button>
          <button type="button" onClick={() => { setShowQuickRecorder(!showQuickRecorder); setShowQuickMetronome(false); setShowTuner(false); }}
            className={`flex items-center gap-1.5 font-label text-[11px] px-3 py-2 rounded-lg border transition-all ${showQuickRecorder ? "bg-[#C41E3A] text-white border-[#C41E3A]" : "border-[#333] text-[#888] hover:border-[#555]"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
            Record
          </button>
        </div>

        {/* Practice Log (expandable) */}
        {showLog && (
          <div className="mt-3 pt-3 border-t border-[#ffffff08]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label text-[10px] text-[#666]">Practice Log - {selDay}</span>
              {logText.trim() && (
                <span className="font-label text-[9px] text-[#444]">Auto-saved</span>
              )}
            </div>
            <textarea
              value={logText}
              onChange={e => handleLogChange(e.target.value)}
              placeholder="Write notes about today's session..."
              rows={4}
              className="w-full bg-[#111] text-[#ccc] text-[12px] font-body rounded-lg border border-[#333] focus:border-[#D4A843] focus:outline-none p-3 resize-y placeholder-[#444]"
            />
          </div>
        )}
      </div>

      {/* Inline Metronome */}
      {showQuickMetronome && (
        <div className="panel p-4 mb-4" style={{ borderColor: "#D4A843" + "30" }}>
          <MetronomeBox standalone />
        </div>
      )}

      {/* Inline Tuner (Issue #5) */}
      {showTuner && (
        <div className="panel p-4 mb-4" style={{ borderColor: "#818cf8" + "30" }}>
          <div className="font-label text-[10px] text-[#818cf8] mb-3 flex items-center gap-2">
            <div className={`led ${tunerActive ? "led-green" : "led-off"}`} />
            Guitar Tuner
          </div>

          <div className="text-center py-4">
            {tunerNote ? (
              <>
                <div className="font-heading text-5xl font-bold text-white mb-1">{tunerNote}{tunerOctave}</div>
                <div className="font-readout text-[12px] text-[#666] mb-4">{tunerFreq} Hz</div>

                {/* Cents indicator bar */}
                <div className="relative mx-auto max-w-[300px] mb-4">
                  <div className="h-2 bg-[#1a1a1a] rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 w-px h-full bg-[#33CC33]" />
                    <div className="absolute top-0 h-full w-2 rounded-full transition-all duration-100"
                      style={{
                        left: `${50 + tunerCents / 2}%`,
                        transform: "translateX(-50%)",
                        background: Math.abs(tunerCents) < 5 ? "#33CC33" : Math.abs(tunerCents) < 15 ? "#D4A843" : "#C41E3A",
                      }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-readout text-[9px] text-[#444]">-50</span>
                    <span className={`font-readout text-[11px] font-bold ${Math.abs(tunerCents) < 5 ? "text-[#33CC33]" : Math.abs(tunerCents) < 15 ? "text-[#D4A843]" : "text-[#C41E3A]"}`}>
                      {tunerCents > 0 ? "+" : ""}{tunerCents} cents
                    </span>
                    <span className="font-readout text-[9px] text-[#444]">+50</span>
                  </div>
                </div>

                {/* In tune indicator */}
                {Math.abs(tunerCents) < 5 && (
                  <div className="font-label text-[11px] text-[#33CC33] mb-3">In Tune</div>
                )}
              </>
            ) : (
              <div className="py-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
                <div className="font-readout text-[12px] text-[#555]">Play a note to detect pitch...</div>
              </div>
            )}
          </div>

          {/* Guitar strings reference */}
          <div className="grid grid-cols-6 gap-1 mt-2">
            {GUITAR_STRINGS.map((gs) => {
              const isClosest = closestString?.note === gs.note && tunerNote !== "";
              return (
                <div key={gs.note} className={`text-center p-2 rounded-lg border transition-all ${isClosest ? "border-[#818cf8]/60 bg-[#818cf8]/10" : "border-[#1a1a1a]"}`}>
                  <div className={`font-heading text-[13px] font-bold ${isClosest ? "text-[#818cf8]" : "text-[#666]"}`}>{gs.note}</div>
                  <div className="font-readout text-[8px] text-[#444]">{Math.round(gs.freq)} Hz</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline Daily Session Recorder */}
      {showQuickRecorder && (
        <div className="panel p-4 mb-4" style={{ borderColor: "#C41E3A" + "30" }}>
          <DailyRecorderBox
            storageKey={week + "-" + selDay + "-session"}
            controlRef={dailyRecControlRef}
          />
        </div>
      )}

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
            : "Set your categories using the edit button above, then Auto Fill to build your session."}
        </div>
        <div className="flex gap-3 justify-center">
          {curCats.length > 0 && <button type="button" onClick={() => buildDay(selDay)} className="btn-gold">Auto Fill</button>}
          <button type="button" onClick={() => { setExPickerOpen(true); setExPickerSearch(""); setExPickerCat("All"); }} className="btn-ghost">+ Add Exercise</button>
          {curCats.length === 0 && <button type="button" onClick={() => setShowDayEditor(true)} className="btn-gold">Set Up Day</button>}
        </div>
      </div>}

      {/* Exercise list -- unified cards with drag & drop (Issue #6) */}
      {curExList.map((rawEx, idx) => {
        const ex = typeof rawEx.id === "number" && rawEx.id < 1000 ? getEditedEx(rawEx) : rawEx;
        const done = doneMap[week + "-" + selDay + "-" + ex.id], cc = COL[ex.c] || "#888", isSong = ex.c === "Songs";
        const isDragging = dragIdx === idx;
        const isDragOver = dragOverIdx === idx;
        return (
          <div key={String(ex.id) + "-" + idx}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={`panel mb-2 rounded-lg transition-all ${isDragOver ? "!border-[#D4A843]/60" : ""}`}
            style={{
              opacity: isDragging ? 0.4 : done ? 0.45 : 1,
              borderTop: isDragOver ? "2px solid #D4A843" : undefined,
            }}>
            <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing flex-shrink-0 text-[#333] hover:text-[#666] transition-colors hidden sm:block" title="Drag to reorder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
              </div>
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
                <div className="font-readout text-[10px] text-[#555] mt-0.5 flex items-center gap-0.5">
                  <span>{isSong ? "Song" : ex.c} &middot; </span>
                  {editingTimeIdx === idx ? (
                    <input type="number" autoFocus min={1} max={120} value={editingTimeVal}
                      className="input !w-10 !py-0 !px-1 !text-[10px] text-center !h-4 !min-h-0"
                      onClick={e => e.stopPropagation()}
                      onChange={e => setEditingTimeVal(e.target.value)}
                      onBlur={() => { const n = parseInt(editingTimeVal); if (n > 0 && n <= 120) { setDayExMap(p => { const l = (p[selDay] || []).slice(); l[idx] = { ...l[idx], m: n }; return { ...p, [selDay]: l }; }); } setEditingTimeIdx(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { const n = parseInt(editingTimeVal); if (n > 0 && n <= 120) { setDayExMap(p => { const l = (p[selDay] || []).slice(); l[idx] = { ...l[idx], m: n }; return { ...p, [selDay]: l }; }); } setEditingTimeIdx(null); } if (e.key === "Escape") setEditingTimeIdx(null); }} />
                  ) : (
                    <button type="button" onClick={e => { e.stopPropagation(); setEditingTimeIdx(idx); setEditingTimeVal(String(ex.m)); }}
                      className="cursor-pointer hover:text-[#D4A843] transition-colors" title="Click to edit time">
                      {ex.m}min
                    </button>
                  )}
                  {ex.b ? <span>&middot; {ex.b} BPM</span> : null}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { if (!idx) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx-1]] = [l[idx-1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                  className="btn-ghost !px-1.5 !py-1 !text-[9px]" style={{ opacity: idx === 0 ? 0.2 : 1 }} title="Move up">UP</button>
                <button onClick={() => { if (idx >= curExList.length - 1) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx+1]] = [l[idx+1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                  className="btn-ghost !px-1.5 !py-1 !text-[9px]" style={{ opacity: idx >= curExList.length - 1 ? 0.2 : 1 }} title="Move down">DN</button>
                {!isSong && <button onClick={() => { const pool = EXERCISES.filter((e) => e.c === ex.c && e.id !== ex.id); if (!pool.length) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); l[idx] = pool[Math.floor(Math.random() * pool.length)]; return { ...p, [selDay]: l }; }); }}
                  className="btn-ghost !px-1.5 !py-1 !text-[9px]">Swap</button>}
                <button type="button" onClick={() => setDayExMap((p) => { const l = (p[selDay] || []).slice(); l.splice(idx, 1); return { ...p, [selDay]: l }; })}
                  className="btn-ghost !px-1.5 !py-1 !text-[9px] !text-[#C41E3A]">Del</button>
              </div>
              <div className="mobile-action-row flex-shrink-0">
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
    </div>
  );
}
