"use client";
import { useState } from "react";
import type { Exercise, Song, DayExMap, BoolMap, StringMap, ExEditMap } from "@/lib/types";
import { DAYS, CATS, COL } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { autoFill, makeSongItemSimple } from "@/lib/helpers";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import type { View } from "./Navbar";

interface PracticePageProps {
  week: number;
  selDay: string;
  style: string;
  dayCats: import("@/lib/types").DayCats;
  dayHrs: import("@/lib/types").DayHrs;
  dayExMap: DayExMap;
  doneMap: BoolMap;
  bpmLog: StringMap;
  songs: Song[];
  exEdits: ExEditMap;
  streak: { currentStreak: number; longestStreak: number; lastPracticeDate: string; totalDays: number };
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
  // Functions
  toggleDone: (key: string) => void;
  getEditedEx: (ex: Exercise) => Exercise;
  buildDay: (day: string) => void;
}

export default function PracticePage(props: PracticePageProps) {
  const {
    week, selDay, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, songs, exEdits,
    streak, sessionSeconds, sessionRunning, showQuickMetronome, showQuickRecorder,
    exPickerOpen, exPickerSearch, exPickerCat, songPickerOpen, songPickerSearch,
    curExList, curDone, curMin, curCats,
    setView, setSelDay, setDayExMap,
    setSessionRunning, setSessionSeconds, setShowQuickMetronome, setShowQuickRecorder,
    setExPickerOpen, setExPickerSearch, setExPickerCat,
    setSongPickerOpen, setSongPickerSearch,
    setModal, setFocusEx,
    toggleDone, getEditedEx, buildDay,
  } = props;

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  };

  return (
    <div className="animate-fade-in">
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
    </div>
  );
}
