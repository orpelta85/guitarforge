"use client";
import { useCallback } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, ExEditMap, SongEntry } from "@/lib/types";
import { DAYS, CATS, COL, MODES, SCALES, STYLES, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import SongsterrSearch from "./SongsterrSearch";
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
    curExList, curDone, curMin, curCats, wTot, wDn, wPct, wMin,
    buildAll, getSuggestions,
  } = props;

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
            {!settingsOpen && `W${week} \u00B7 ${mode} \u00B7 ${scale} \u00B7 ${style}`}
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
          <span className="text-[14px]">&#x1F4CA;</span>
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
          <DarkAudioPlayer src={sunoSuggestUrl} title={`${scale} ${mode} \u00B7 ${style}`} loop />
        </div>
      )}
    </div>
  );
}
