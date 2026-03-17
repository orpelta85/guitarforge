"use client";
import { useState, useEffect } from "react";
import type { Exercise, Song, DayCats, DayHrs, DayExMap, BoolMap, StringMap, SongProgressMap, ExEditMap } from "@/lib/types";
import { DAYS, CATS, COL, MODES, SCALES, STYLES, STAGES, DEFAULT_DAY_CATS, DEFAULT_DAY_HRS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { autoFill, makeSongItem, ytSearch } from "@/lib/helpers";
import ExerciseModal from "./ExerciseModal";
import Navbar from "./Navbar";
import type { View } from "./Navbar";
import EarTrainingPage from "./EarTrainingPage";
import KnowledgePage from "./KnowledgePage";
import StudioPage from "./StudioPage";
import WeeklyCharts from "./WeeklyCharts";
import SongsterrSearch from "./SongsterrSearch";
import ProfilePage from "./ProfilePage";
import AiCoachPage from "./AiCoachPage";
import LibraryEditor from "./LibraryEditor";

export default function GuitarForgeApp() {
  const [view, setView] = useState<View>("dash");
  const [week, setWeek] = useState(1);
  const [mode, setMode] = useState("Aeolian");
  const [scale, setScale] = useState("Am");
  const [style, setStyle] = useState("Doom Metal");
  const [dayCats, setDayCats] = useState<DayCats>(DEFAULT_DAY_CATS);
  const [dayHrs, setDayHrs] = useState<DayHrs>(DEFAULT_DAY_HRS);
  const [selDay, setSelDay] = useState("ראשון");
  const [dayExMap, setDayExMap] = useState<DayExMap>({});
  const [doneMap, setDoneMap] = useState<BoolMap>({});
  const [bpmLog, setBpmLog] = useState<StringMap>({});
  const [noteLog, setNoteLog] = useState<StringMap>({});
  const [ready, setReady] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [libFilter, setLibFilter] = useState("הכל");
  const [modal, setModal] = useState<Exercise | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [newSongName, setNewSongName] = useState("");
  const [newSongUrl, setNewSongUrl] = useState("");
  const [songProgress, setSongProgress] = useState<SongProgressMap>({});
  const [exEdits, setExEdits] = useState<ExEditMap>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gf30");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.week) setWeek(d.week); if (d.mode) setMode(d.mode); if (d.scale) setScale(d.scale);
        if (d.style && STYLES.includes(d.style)) setStyle(d.style); else if (d.style) setStyle("Metal"); if (d.dayCats) setDayCats(d.dayCats); if (d.dayHrs) setDayHrs(d.dayHrs);
        if (d.dayExMap) setDayExMap(d.dayExMap); if (d.doneMap) setDoneMap(d.doneMap);
        if (d.bpmLog) setBpmLog(d.bpmLog); if (d.noteLog) setNoteLog(d.noteLog);
        if (d.songs) setSongs(d.songs); if (d.songProgress) setSongProgress(d.songProgress);
        if (d.exEdits) setExEdits(d.exEdits);
      }
    } catch { /* first time */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const data = { week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits };
    try { localStorage.setItem("gf30", JSON.stringify(data)); } catch { /* quota */ }
  }, [ready, week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits]);

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
    setDayExMap((p) => ({ ...p, [day]: autoFill(cats, mins, cats.includes("שירים") ? getSongItems() : []) }));
  }

  function buildAll() {
    const nd: DayExMap = {};
    DAYS.forEach((day) => {
      const cats = dayCats[day] || [], mins = (dayHrs[day] || 0) * 60;
      if (cats.length > 0 && mins > 0) nd[day] = autoFill(cats, mins, cats.includes("שירים") ? getSongItems() : []);
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
    <div className="min-h-screen text-white" style={{ background: "#0A0A0A" }} dir="rtl">
      <Navbar view={view} onViewChange={setView} />
      <div className="px-5 py-5 max-w-[960px] mx-auto">

        {view === "ear" && <EarTrainingPage />}
        {view === "studio" && <StudioPage />}
        {view === "knowledge" && <KnowledgePage />}
        {view === "profile" && <ProfilePage />}
        {view === "coach" && <AiCoachPage />}

        {/* ══ DASHBOARD ══ */}
        {view === "dash" && (<div>
          {/* Settings */}
          <div className="panel p-5 mb-4">
            <div className="font-label text-[11px] text-[#D4A843] mb-4 flex items-center gap-2">
              <div className="led led-gold" /> Channel Settings
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Week", v: <input type="number" value={week} min={1} onChange={(e) => setWeek(Number(e.target.value))} className="input input-gold text-center" /> },
                { l: "Mode", v: <select value={mode} onChange={(e) => setMode(e.target.value)} className="input">{MODES.map((m) => <option key={m}>{m}</option>)}</select> },
                { l: "Key", v: <select value={scale} onChange={(e) => setScale(e.target.value)} className="input">{SCALES.map((s) => <option key={s}>{s}</option>)}</select> },
                { l: "Style", v: <select value={style} onChange={(e) => setStyle(e.target.value)} className="input">{STYLES.map((s) => <option key={s}>{s}</option>)}</select> },
              ].map(({ l, v }) => <label key={l} className="font-label text-[10px] text-[#666]">{l}<div className="mt-1">{v}</div></label>)}
            </div>
          </div>

          {/* Songs */}
          <div className="panel p-5 mb-4" style={{ borderColor: "#1a3a2a" }}>
            <div className="font-label text-[11px] text-[#33CC33] mb-3 flex items-center gap-2">
              <div className="led led-on" /> Setlist
            </div>
            {songs.map((song) => {
              const dn = STAGES.filter((_, si) => songProgress[week + "-" + song.id + "-" + si]?.done).length;
              return (
                <div key={song.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm mb-1.5">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{song.name}</div>
                    <div className="font-readout text-[10px] text-[#555]">{dn}/6</div>
                  </div>
                  {song.url && <a href={song.url} target="_blank" rel="noopener noreferrer" className="font-label text-[9px] text-[#D4A843] no-underline hover:text-[#DFBD69]">Tab</a>}
                  <button onClick={() => setSongs((p) => p.filter((s) => s.id !== song.id))} className="btn-ghost !px-2 !py-1 !text-[10px] !text-[#C41E3A] !border-[#333]">Remove</button>
                </div>
              );
            })}
            <div className="flex gap-2 mt-3 flex-wrap">
              <input placeholder="Song name..." value={newSongName} onChange={(e) => setNewSongName(e.target.value)} className="input flex-1 min-w-[120px]" />
              <input placeholder="Tab URL..." value={newSongUrl} onChange={(e) => setNewSongUrl(e.target.value)} className="input flex-1 min-w-[120px]" />
              <button onClick={() => { if (!newSongName.trim()) return; setSongs((p) => [...p, { name: newSongName.trim(), url: newSongUrl.trim(), id: Date.now() }]); setNewSongName(""); setNewSongUrl(""); }} className="btn-gold">Add</button>
            </div>
            <SongsterrSearch onSelect={(name, url) => {
              setSongs((p) => [...p, { name, url, id: Date.now() }]);
            }} />
          </div>

          {/* Progress + Streak */}
          <div className="panel p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-label text-[11px] text-[#D4A843] flex items-center gap-2">
                <div className={`led ${wPct >= 100 ? "led-on" : "led-gold"}`} /> Week {week} Progress
              </span>
              <span className={`font-readout text-2xl font-bold ${wPct >= 100 ? "text-[#33CC33]" : "text-[#D4A843]"}`}>{wPct}%</span>
            </div>
            <div className="vu"><div className="vu-fill" style={{ width: wPct + "%" }} /></div>
            <div className="grid grid-cols-4 gap-3 mt-3 text-center">
              <div>
                <div className="font-readout text-lg font-bold text-[#D4A843]">{wDn}</div>
                <div className="font-label text-[8px] text-[#555]">Done</div>
              </div>
              <div>
                <div className="font-readout text-lg font-bold text-[#888]">{wTot}</div>
                <div className="font-label text-[8px] text-[#555]">Total</div>
              </div>
              <div>
                <div className="font-readout text-lg font-bold text-[#D4A843]">{wMin}</div>
                <div className="font-label text-[8px] text-[#555]">Minutes</div>
              </div>
              <div>
                <div className="font-readout text-lg font-bold text-[#D4A843]">
                  {DAYS.filter(d => (dayExMap[d] || []).some(e => doneMap[week + "-" + d + "-" + e.id])).length}
                </div>
                <div className="font-label text-[8px] text-[#555]">Days Active</div>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="panel p-5 mb-4">
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
                      <div className="pr-[62px] flex flex-wrap gap-1">
                        {CATS.map((cat) => {
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
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((day) => {
                const ac = dayCats[day] || [], hrs = dayHrs[day] || 0, exs = dayExMap[day] || [];
                const d2 = exs.filter((e) => doneMap[week + "-" + day + "-" + e.id]).length;
                const off = !ac.length, pct = exs.length ? Math.round((d2 / exs.length) * 100) : 0;
                return (
                  <div key={day} onClick={() => { setSelDay(day); setView("daily"); }}
                    className={`rounded-sm p-2 cursor-pointer text-center transition-all ${off ? "bg-[#0A0A0A] border border-[#151515]" : "panel hover:border-[#D4A843]/30"}`}>
                    <div className={`font-label text-[10px] ${off ? "text-[#333]" : "text-[#aaa]"}`}>{day}</div>
                    <div className="font-readout text-[9px] text-[#444]">{hrs}h</div>
                    {exs.length > 0 && <>
                      <div className="vu mt-1 !h-[3px]"><div className="vu-fill" style={{ width: pct + "%" }} /></div>
                      <div className="font-readout text-[8px] text-[#444] mt-0.5">{d2}/{exs.length}</div>
                    </>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
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
        </div>)}

        {/* ══ PRACTICE ══ */}
        {view === "daily" && (<div>
          <div className="flex gap-1 mb-4 flex-wrap">
            {DAYS.map((day) => (
              <button key={day} onClick={() => setSelDay(day)}
                className={`font-label text-[11px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${
                  selDay === day ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] hover:text-[#aaa]"
                }`}>{day}</button>
            ))}
          </div>

          <div className="panel p-5 mb-4 flex justify-between items-center flex-wrap gap-3">
            <div>
              <div className="font-heading text-xl font-bold text-[#D4A843]">{selDay}</div>
              <div className="font-readout text-[11px] text-[#555] mt-0.5">{curExList.length} exercises · {curMin} min · {curDone} done</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {curCats.map((cat) => <span key={cat} className="tag" style={{ border: `1px solid ${COL[cat]}30`, color: COL[cat] }}>{cat}</span>)}
                {!curCats.length && <span className="font-label text-[10px] text-[#333]">Rest Day</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => buildDay(selDay)} className="btn-ghost">Auto Fill</button>
              <select onChange={(e) => { if (!e.target.value) return; const ex = EXERCISES.find((x) => x.id === Number(e.target.value)); if (ex) setDayExMap((p) => ({ ...p, [selDay]: [...(p[selDay] || []), ex] })); e.target.value = ""; }} className="input !w-auto !py-1.5 text-[11px]" defaultValue="">
                <option value="" disabled>+ Exercise</option>
                {CATS.filter((c) => c !== "שירים").map((cat) => <optgroup key={cat} label={cat}>{EXERCISES.filter((e) => e.c === cat).map((e) => <option key={e.id} value={e.id}>{e.n} ({e.m}m)</option>)}</optgroup>)}
              </select>
              {songs.length > 0 && (
                <select onChange={(e) => { if (!e.target.value) return; const [sid, sidx] = e.target.value.split("x").map(Number); const song = songs.find((s) => s.id === sid); if (song) setDayExMap((p) => ({ ...p, [selDay]: [...(p[selDay] || []), makeSongItem(song, sidx)] })); e.target.value = ""; }} className="input !w-auto !py-1.5 text-[11px]" style={{ borderColor: "#1a3a2a" }} defaultValue="">
                  <option value="" disabled>+ Song</option>
                  {songs.map((song) => <optgroup key={song.id} label={song.name}>{STAGES.map((st, si) => <option key={si} value={song.id + "x" + si}>{songProgress[week + "-" + song.id + "-" + si]?.done ? "✓ " : ""}{st.name} ({st.m}m)</option>)}</optgroup>)}
                </select>
              )}
            </div>
          </div>

          {!curExList.length && <div className="panel p-12 text-center"><div className="font-label text-[#333] text-sm">No exercises. Press Auto Fill or add manually.</div></div>}

          {curExList.map((rawEx, idx) => {
            const ex = typeof rawEx.id === "number" && rawEx.id < 1000 ? getEditedEx(rawEx) : rawEx;
            const done = doneMap[week + "-" + selDay + "-" + ex.id], cc = COL[ex.c] || "#888", isSong = ex.c === "שירים";
            return (
              <div key={String(ex.id) + "-" + idx} className={`flex items-start gap-3 px-4 py-3 mb-1.5 rounded-sm transition-all ${isSong ? "bg-[#0a110a] border border-[#1a3a2a]" : "panel"}`} style={{ opacity: done ? 0.4 : 1 }}>
                <div onClick={() => {
                  const k = week + "-" + selDay + "-" + ex.id; setDoneMap((p) => ({ ...p, [k]: !p[k] }));
                  if (isSong && ex.songId !== undefined && ex.stageIdx !== undefined) setSongProgress((p) => ({ ...p, [week + "-" + ex.songId + "-" + ex.stageIdx]: { ...p[week + "-" + ex.songId + "-" + ex.stageIdx], done: !done } }));
                }} className="cursor-pointer mt-1 flex-shrink-0">
                  <div className={`led ${done ? "led-on" : "led-off"}`} style={{ width: 10, height: 10 }} />
                </div>
                <div className="flex-1 cursor-pointer" onClick={() => setModal(ex)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tag" style={{ border: `1px solid ${cc}40`, color: cc }}>{ex.c}</span>
                    <span className="text-sm font-medium">{ex.n}</span>
                  </div>
                  <div className="font-readout text-[10px] text-[#444] mt-1">{ex.m}min {ex.b ? "· " + ex.b + " BPM" : ""} · {ex.f}</div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <div className="flex gap-0.5">
                    <button onClick={() => { if (!idx) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx-1]] = [l[idx-1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px]" style={{ opacity: idx === 0 ? 0.2 : 1 }}>UP</button>
                    <button onClick={() => { if (idx >= curExList.length - 1) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); [l[idx], l[idx+1]] = [l[idx+1], l[idx]]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px]" style={{ opacity: idx >= curExList.length - 1 ? 0.2 : 1 }}>DN</button>
                  </div>
                  <div className="flex gap-0.5">
                    {!isSong && <button onClick={() => { const pool = EXERCISES.filter((e) => e.c === ex.c && e.id !== ex.id); if (!pool.length) return; setDayExMap((p) => { const l = (p[selDay] || []).slice(); l[idx] = pool[Math.floor(Math.random() * pool.length)]; return { ...p, [selDay]: l }; }); }}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px]">Swap</button>}
                    <button onClick={() => setDayExMap((p) => { const l = (p[selDay] || []).slice(); l.splice(idx, 1); return { ...p, [selDay]: l }; })}
                      className="btn-ghost !px-1.5 !py-0.5 !text-[9px] !text-[#C41E3A]">Del</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>)}

        {/* ══ LIBRARY ══ */}
        {view === "lib" && (<div>
          <div className="flex gap-1 flex-wrap mb-4">
            <button onClick={() => setLibFilter("הכל")} className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${libFilter === "הכל" ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All ({EXERCISES.length})</button>
            {CATS.filter((c) => c !== "שירים").map((cat) => {
              const cnt = EXERCISES.filter((e) => e.c === cat).length, c = COL[cat];
              if (!cnt) return null;
              return <button key={cat} onClick={() => setLibFilter(cat)} className="font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border transition-all"
                style={libFilter === cat ? { background: c, borderColor: c, color: "#0A0A0A" } : { borderColor: c + "40", color: c + "99" }}>{cat} ({cnt})</button>;
            })}
          </div>

          {EXERCISES.filter((e) => libFilter === "הכל" || e.c === libFilter).map((rawEx) => {
            const ex = getEditedEx(rawEx), c = COL[ex.c], isEd = editingId === ex.id;
            return (
              <div key={ex.id} className={`panel mb-1.5 overflow-hidden ${isEd ? "!border-[#D4A843]/30" : ""}`}>
                <div onClick={() => setEditingId(isEd ? null : ex.id)} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{ex.n}</div>
                    <div className="font-readout text-[10px] text-[#444]">{ex.f} · {ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                  </div>
                  <span className="text-[10px] text-[#333]">{isEd ? "−" : "+"}</span>
                </div>
                {isEd && <LibraryEditor ex={ex} exEdits={exEdits} setExEdits={setExEdits} />}
              </div>
            );
          })}
        </div>)}

        {/* ══ REPORT ══ */}
        {view === "log" && (<div>
          <div className="panel p-5 mb-4">
            <div className="font-heading text-xl font-bold text-[#D4A843]">Week {week}</div>
            <div className="font-label text-[10px] text-[#555] mt-1">{mode} · {scale} · {style}</div>
            <div className="vu mt-3"><div className="vu-fill" style={{ width: wPct + "%" }} /></div>
            <div className="font-readout text-[11px] text-[#555] mt-2">{wDn}/{wTot} ({wPct}%)</div>
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
                {exs.map((ex) => {
                  const k = week + "-" + day + "-" + ex.id, done = doneMap[k];
                  return (
                    <div key={ex.id} className="flex gap-2 py-1.5 text-[12px] border-b border-[#111] last:border-0">
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
        onDone={() => { const k = week + "-" + selDay + "-" + modal.id; setDoneMap(p => ({ ...p, [k]: true })); setModal(null); }} />}
    </div>
  );
}
