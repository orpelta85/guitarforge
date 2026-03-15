"use client";
import { useState, useCallback, useRef, useEffect } from "react";

/* ── DATA ── */
const ALL_INTERVALS = [
  { name: "m2", label: "Minor 2nd", st: 1, color: "#ef4444", ref: "Jaws theme" },
  { name: "M2", label: "Major 2nd", st: 2, color: "#f97316", ref: "Happy Birthday" },
  { name: "m3", label: "Minor 3rd", st: 3, color: "#eab308", ref: "Smoke on the Water" },
  { name: "M3", label: "Major 3rd", st: 4, color: "#84cc16", ref: "When the Saints" },
  { name: "P4", label: "Perfect 4th", st: 5, color: "#22c55e", ref: "Here Comes the Bride" },
  { name: "TT", label: "Tritone", st: 6, color: "#14b8a6", ref: "Black Sabbath (intro)" },
  { name: "P5", label: "Perfect 5th", st: 7, color: "#06b6d4", ref: "Star Wars" },
  { name: "m6", label: "Minor 6th", st: 8, color: "#3b82f6", ref: "The Entertainer" },
  { name: "M6", label: "Major 6th", st: 9, color: "#6366f1", ref: "My Bonnie" },
  { name: "m7", label: "Minor 7th", st: 10, color: "#8b5cf6", ref: "Somewhere (West Side)" },
  { name: "M7", label: "Major 7th", st: 11, color: "#a855f7", ref: "Take On Me" },
  { name: "P8", label: "Octave", st: 12, color: "#ec4899", ref: "Somewhere Over Rainbow" },
];
const ALL_CHORDS = [
  { name: "Major", iv: [0,4,7], color: "#22c55e" }, { name: "Minor", iv: [0,3,7], color: "#3b82f6" },
  { name: "Dim", iv: [0,3,6], color: "#ef4444" }, { name: "Aug", iv: [0,4,8], color: "#f97316" },
  { name: "Dom7", iv: [0,4,7,10], color: "#eab308" }, { name: "Maj7", iv: [0,4,7,11], color: "#84cc16" },
  { name: "Min7", iv: [0,3,7,10], color: "#6366f1" }, { name: "Dim7", iv: [0,3,6,9], color: "#ec4899" },
  { name: "Sus2", iv: [0,2,7], color: "#14b8a6" }, { name: "Sus4", iv: [0,5,7], color: "#06b6d4" },
];
const ALL_SCALES = [
  { name: "Major", notes: [0,2,4,5,7,9,11], color: "#22c55e" }, { name: "Minor", notes: [0,2,3,5,7,8,10], color: "#3b82f6" },
  { name: "Dorian", notes: [0,2,3,5,7,9,10], color: "#8b5cf6" }, { name: "Phrygian", notes: [0,1,3,5,7,8,10], color: "#ef4444" },
  { name: "Lydian", notes: [0,2,4,6,7,9,11], color: "#eab308" }, { name: "Mixolydian", notes: [0,2,4,5,7,9,10], color: "#f97316" },
  { name: "Harmonic Min", notes: [0,2,3,5,7,8,11], color: "#ec4899" }, { name: "Pentatonic Min", notes: [0,3,5,7,10], color: "#06b6d4" },
  { name: "Blues", notes: [0,3,5,6,7,10], color: "#14b8a6" },
];
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const TUNING = [40,45,50,55,59,64];
const STR_NAMES = ["E","A","D","G","B","e"];
const ACHIEVEMENTS = [
  { id: "first10", name: "First Steps", desc: "Answer 10 questions", need: 10, key: "total" },
  { id: "streak5", name: "On Fire", desc: "5 correct in a row", need: 5, key: "streak" },
  { id: "streak10", name: "Unstoppable", desc: "10 correct in a row", need: 10, key: "streak" },
  { id: "streak25", name: "Iron Ears", desc: "25 correct in a row", need: 25, key: "streak" },
  { id: "acc90", name: "Sharp Ear", desc: "90%+ accuracy (20+ questions)", need: 90, key: "accuracy" },
  { id: "lv5", name: "Apprentice", desc: "Reach level 5", need: 5, key: "level" },
  { id: "lv10", name: "Journeyman", desc: "Reach level 10", need: 10, key: "level" },
  { id: "lv25", name: "Master", desc: "Reach level 25", need: 25, key: "level" },
];

type ExMode = "intervals" | "chords" | "scales" | "fretboard";
type Direction = "ascending" | "descending" | "harmonic";
type SubTab = "exercise" | "achievements" | "reference";

function freq(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

interface EarState { xp: number; level: number; bestStreak: number; unlocked: string[]; history: Record<string, { correct: number; total: number }>; }

export default function EarTrainingPage() {
  const [mode, setMode] = useState<ExMode>("intervals");
  const [subTab, setSubTab] = useState<SubTab>("exercise");
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
  const [answer, setAnswer] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [direction, setDirection] = useState<Direction>("ascending");
  const [enabledIntervals, setEnabledIntervals] = useState<Set<number>>(new Set([3,4,5,7,12]));
  const [enabledChords, setEnabledChords] = useState<Set<string>>(new Set(["Major","Minor","Dim"]));
  const [enabledScales, setEnabledScales] = useState<Set<string>>(new Set(["Major","Minor","Pentatonic Min"]));
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [earState, setEarState] = useState<EarState>({ xp: 0, level: 1, bestStreak: 0, unlocked: [], history: {} });
  // Fretboard mode
  const [fbTarget, setFbTarget] = useState<string | null>(null);
  const [fbFeedback, setFbFeedback] = useState<{ fret: number; str: number; correct: boolean } | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("gf-ear2"); if (s) { const d = JSON.parse(s); setEarState(d); setScore(p => ({ ...p, bestStreak: d.bestStreak || 0 })); } } catch {}
  }, []);

  function persist(st: EarState) { setEarState(st); try { localStorage.setItem("gf-ear2", JSON.stringify(st)); } catch {} }

  function ctx() { if (!ctxRef.current) ctxRef.current = new AudioContext(); return ctxRef.current; }

  function tone(f: number, dur = 0.6, delay = 0) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.22, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.1);
  }

  function playInterval(st: number, dir: Direction) {
    const root = 55 + Math.floor(Math.random() * 12);
    if (dir === "harmonic") { tone(freq(root)); tone(freq(root + st)); }
    else if (dir === "descending") { tone(freq(root + st), 0.6, 0); tone(freq(root), 0.6, 0.7); }
    else { tone(freq(root), 0.6, 0); tone(freq(root + st), 0.6, 0.7); }
  }
  function playChord(iv: number[]) { const r = 55 + Math.floor(Math.random() * 12); iv.forEach(s => tone(freq(r + s), 1.2)); }
  function playScale(ns: number[]) { const r = 55 + Math.floor(Math.random() * 12); ns.forEach((n, i) => tone(freq(r + n), 0.35, i * 0.22)); }

  const activeIntervals = ALL_INTERVALS.filter(i => enabledIntervals.has(i.st));
  const activeChords = ALL_CHORDS.filter(c => enabledChords.has(c.name));
  const activeScales = ALL_SCALES.filter(s => enabledScales.has(s.name));

  function newQuestion() {
    setPicked(null); setRevealed(false); setFbFeedback(null);
    if (mode === "intervals") { const it = activeIntervals[Math.floor(Math.random() * activeIntervals.length)]; if (it) { setAnswer(it.name); playInterval(it.st, direction); } }
    else if (mode === "chords") { const it = activeChords[Math.floor(Math.random() * activeChords.length)]; if (it) { setAnswer(it.name); playChord(it.iv); } }
    else if (mode === "scales") { const it = activeScales[Math.floor(Math.random() * activeScales.length)]; if (it) { setAnswer(it.name); playScale(it.notes); } }
    else if (mode === "fretboard") { const n = NOTES[Math.floor(Math.random() * 12)]; setFbTarget(n); setAnswer(n); tone(freq(60 + NOTES.indexOf(n))); }
  }

  function replay() {
    if (!answer) return;
    if (mode === "intervals") { const it = ALL_INTERVALS.find(i => i.name === answer); if (it) playInterval(it.st, direction); }
    else if (mode === "chords") { const it = ALL_CHORDS.find(c => c.name === answer); if (it) playChord(it.iv); }
    else if (mode === "scales") { const it = ALL_SCALES.find(s => s.name === answer); if (it) playScale(it.notes); }
    else { const idx = NOTES.indexOf(answer); if (idx >= 0) tone(freq(60 + idx)); }
  }

  function handleAnswer(name: string) {
    if (revealed || !answer) return;
    setPicked(name); setRevealed(true);
    const correct = name === answer;
    const newStreak = correct ? score.streak + 1 : 0;
    const best = Math.max(score.bestStreak, newStreak, earState.bestStreak);
    const earned = correct ? (10 + Math.min(newStreak, 20) * 2) : 0;
    const newXp = earState.xp + earned;
    const newLevel = Math.floor(newXp / 100) + 1;

    // Update history for adaptive
    const hKey = mode + "-" + answer;
    const prev = earState.history[hKey] || { correct: 0, total: 0 };
    const newHist = { ...earState.history, [hKey]: { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 } };

    // Check achievements
    const unlocked = [...earState.unlocked];
    const pct = (score.correct + (correct ? 1 : 0)) / (score.total + 1) * 100;
    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.key === "total" && score.total + 1 >= a.need) unlocked.push(a.id);
      if (a.key === "streak" && newStreak >= a.need) unlocked.push(a.id);
      if (a.key === "accuracy" && score.total + 1 >= 20 && pct >= a.need) unlocked.push(a.id);
      if (a.key === "level" && newLevel >= a.need) unlocked.push(a.id);
    });

    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1, streak: newStreak, bestStreak: best });
    persist({ xp: newXp, level: newLevel, bestStreak: best, unlocked, history: newHist });

    if (autoAdvance && correct) timeoutRef.current = setTimeout(newQuestion, 1000);
  }

  function handleFretboardClick(stringIdx: number, fret: number) {
    if (!fbTarget || revealed) return;
    const note = NOTES[(TUNING[stringIdx] + fret) % 12];
    const correct = note === fbTarget;
    setFbFeedback({ fret, str: stringIdx, correct });
    handleAnswer(correct ? fbTarget : "__wrong__" + note);
  }

  useEffect(() => { return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }; }, []);

  function toggleSet<T>(set: Set<T>, item: T): Set<T> { const n = new Set(set); if (n.has(item)) { if (n.size > 2) n.delete(item); } else n.add(item); return n; }

  const pool = mode === "intervals" ? activeIntervals : mode === "chords" ? activeChords : mode === "scales" ? activeScales : [];
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const xpInLevel = earState.xp % 100;

  return (
    <div>
      {/* Header */}
      <div className="panel p-5 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-heading text-xl font-bold text-[#D4A843]">Ear Training</div>
            <div className="font-label text-[10px] text-[#555] mt-0.5">Train · Level Up · Master</div>
          </div>
          <div className="text-right">
            <div className="font-readout text-2xl font-bold text-[#D4A843]">LV.{earState.level}</div>
            <div className="font-readout text-[10px] text-[#555]">{earState.xp} XP</div>
          </div>
        </div>
        <div className="vu !h-[4px] mt-2"><div className="vu-fill" style={{ width: xpInLevel + "%" }} /></div>
        <div className="flex justify-between mt-1">
          <span className="font-readout text-[9px] text-[#444]">{100 - xpInLevel} XP to next</span>
          <span className="font-readout text-[9px] text-[#444]">Best streak: {earState.bestStreak}</span>
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {(["intervals","chords","scales","fretboard"] as ExMode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setRevealed(false); setAnswer(null); setFbTarget(null); }}
            className={`font-label text-[11px] py-2 rounded-sm cursor-pointer transition-all ${mode === m ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{m}</button>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 mb-3">
        {(["exercise","achievements","reference"] as SubTab[]).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border transition-all flex-1 ${subTab === t ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{t}</button>
        ))}
      </div>

      {/* ── EXERCISE TAB ── */}
      {subTab === "exercise" && (<>
        {/* Stats */}
        <div className="panel p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className={`led ${pct >= 80 ? "led-on" : pct >= 50 ? "led-gold" : score.total > 0 ? "led-red" : "led-off"}`} />
                <span className="font-readout text-sm text-[#D4A843]">{score.correct}/{score.total}</span>
                {score.total > 0 && <span className="font-readout text-[10px] text-[#555]">({pct}%)</span>}
              </div>
              {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#22c55e" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setShowSettings(!showSettings)} className={`btn-ghost !text-[10px] !px-2 ${showSettings ? "active" : ""}`}>Settings</button>
              <button onClick={() => { setScore({ correct: 0, total: 0, streak: 0, bestStreak: earState.bestStreak }); setRevealed(false); setAnswer(null); }} className="btn-ghost !text-[10px] !px-2">Reset</button>
            </div>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="panel p-4 mb-3">
            <div className="font-label text-[10px] text-[#D4A843] mb-3">Settings</div>
            {mode === "intervals" && (<>
              <div className="mb-3">
                <div className="font-label text-[9px] text-[#555] mb-1">Direction</div>
                <div className="flex gap-1">{(["ascending","descending","harmonic"] as const).map(d => (
                  <button key={d} onClick={() => setDirection(d)} className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${direction === d ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{d}</button>
                ))}</div>
              </div>
              <div className="font-label text-[9px] text-[#555] mb-1">Intervals (min 2)</div>
              <div className="flex flex-wrap gap-1">{ALL_INTERVALS.map(i => (
                <button key={i.name} onClick={() => setEnabledIntervals(toggleSet(enabledIntervals, i.st))}
                  className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                  style={enabledIntervals.has(i.st) ? { borderColor: i.color, color: i.color, background: i.color + "12" } : { borderColor: "#222", color: "#444" }}>{i.name}</button>
              ))}</div>
            </>)}
            {mode === "chords" && (<>
              <div className="font-label text-[9px] text-[#555] mb-1">Chords (min 2)</div>
              <div className="flex flex-wrap gap-1">{ALL_CHORDS.map(c => (
                <button key={c.name} onClick={() => setEnabledChords(toggleSet(enabledChords, c.name))}
                  className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                  style={enabledChords.has(c.name) ? { borderColor: c.color, color: c.color, background: c.color + "12" } : { borderColor: "#222", color: "#444" }}>{c.name}</button>
              ))}</div>
            </>)}
            {mode === "scales" && (<>
              <div className="font-label text-[9px] text-[#555] mb-1">Scales (min 2)</div>
              <div className="flex flex-wrap gap-1">{ALL_SCALES.map(s => (
                <button key={s.name} onClick={() => setEnabledScales(toggleSet(enabledScales, s.name))}
                  className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                  style={enabledScales.has(s.name) ? { borderColor: s.color, color: s.color, background: s.color + "12" } : { borderColor: "#222", color: "#444" }}>{s.name}</button>
              ))}</div>
            </>)}
            <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
              <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAutoAdvance(!autoAdvance)}>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${autoAdvance ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{autoAdvance ? "✓" : ""}</div>
                <span className="font-label text-[10px] text-[#666]">Auto-advance on correct</span>
              </label>
            </div>
          </div>
        )}

        {/* Play area */}
        {mode !== "fretboard" ? (
          <div className="panel p-6 mb-3">
            <div className="flex justify-center gap-4 mb-6">
              <button onClick={newQuestion} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #D4A843, #B8922E)", border: "2px solid #DFBD69", boxShadow: "0 4px 16px rgba(212,168,67,0.25)" }}>
                <span className="text-[#0A0A0A] text-xl font-bold ml-0.5">&#9654;</span>
              </button>
              {answer && <button onClick={replay} className="w-10 h-10 rounded-full cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center mt-3"
                style={{ background: "#1a1a1a", border: "1px solid #333" }}><span className="text-[#888] text-sm">&#8635;</span></button>}
            </div>
            {!answer && <div className="text-center font-label text-sm text-[#333] py-4">Press play to begin</div>}
            {answer && (
              <div className={`grid gap-1.5 ${pool.length <= 6 ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
                {pool.map(item => {
                  const ok = revealed && item.name === answer, wrong = revealed && item.name === picked && item.name !== answer;
                  // Adaptive: show weakness indicator
                  const hk = mode + "-" + item.name;
                  const hist = earState.history[hk];
                  const weak = hist && hist.total >= 3 && (hist.correct / hist.total) < 0.6;
                  return (
                    <button key={item.name} onClick={() => handleAnswer(item.name)} disabled={revealed}
                      className="py-3 rounded-sm text-center transition-all cursor-pointer border relative overflow-hidden"
                      style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
                        : wrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                      {!revealed && <div className="absolute bottom-0 left-0 h-[2px]" style={{ background: item.color, width: "100%" }} />}
                      {weak && !revealed && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#C41E3A]" title="Needs practice" />}
                      <div className="font-label text-sm">{item.name}</div>
                      {"label" in item && <div className="text-[8px] opacity-50 mt-0.5">{(item as typeof ALL_INTERVALS[0]).label}</div>}
                    </button>
                  );
                })}
              </div>
            )}
            {revealed && (
              <div className="mt-4 text-center">
                {picked === answer ? (
                  <><div className="font-heading text-lg text-[#22c55e]">Correct!</div><div className="font-readout text-[11px] text-[#D4A843] mt-1">+{10 + Math.min(score.streak, 20) * 2} XP</div></>
                ) : (
                  <><div className="font-heading text-lg text-[#C41E3A]">Answer: {answer}</div></>
                )}
                {!autoAdvance && <button onClick={newQuestion} className="btn-gold mt-3">Next</button>}
              </div>
            )}
          </div>
        ) : (
          /* ── FRETBOARD MODE ── */
          <div className="panel p-4 mb-3">
            <div className="flex justify-between items-center mb-4">
              <div>
                {fbTarget ? (
                  <div><span className="font-label text-[10px] text-[#555]">Find this note:</span><span className="font-heading text-2xl text-[#D4A843] ml-3">{fbTarget}</span></div>
                ) : (
                  <div className="font-label text-sm text-[#333]">Press play to get a note</div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={newQuestion} className="btn-gold !text-[10px]">New Note</button>
                {fbTarget && <button onClick={replay} className="btn-ghost !text-[10px]">Replay</button>}
              </div>
            </div>
            {/* Fretboard */}
            <div className="overflow-x-auto" dir="ltr">
              <div className="min-w-[600px]">
                <div className="flex mb-1"><div className="w-7" />{Array.from({length: 13}, (_,f) => <div key={f} className="flex-1 text-center font-readout text-[8px] text-[#333]">{f}</div>)}</div>
                {[...Array(6)].map((_, si) => {
                  const s = 5 - si;
                  return (
                    <div key={s} className="flex items-center h-7">
                      <div className="w-7 font-readout text-[9px] text-[#444] text-center">{STR_NAMES[s]}</div>
                      {Array.from({length: 13}, (_,f) => {
                        const isHit = fbFeedback && fbFeedback.str === s && fbFeedback.fret === f;
                        return (
                          <div key={f} onClick={() => handleFretboardClick(s, f)}
                            className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-all"
                            style={{ borderRight: "1px solid #1a1a1a", borderBottom: si < 5 ? "1px solid #2a2a2a" : "1px solid #333" }}>
                            {isHit && (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                                style={{ background: fbFeedback.correct ? "#22c55e" : "#C41E3A", color: "#fff" }}>
                                {NOTES[(TUNING[s] + f) % 12]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="flex mt-1"><div className="w-7" />{Array.from({length: 13}, (_,f) => <div key={f} className="flex-1 text-center">{[3,5,7,9,12].includes(f) && <div className={`w-1.5 h-1.5 rounded-full mx-auto ${f===12 ? "bg-[#D4A843]/40" : "bg-[#333]"}`} />}</div>)}</div>
              </div>
            </div>
            {revealed && (
              <div className="mt-3 text-center">
                {fbFeedback?.correct
                  ? <div className="font-heading text-lg text-[#22c55e]">Correct!</div>
                  : <div className="font-heading text-lg text-[#C41E3A]">Wrong — the note was {fbTarget}</div>
                }
              </div>
            )}
          </div>
        )}
      </>)}

      {/* ── ACHIEVEMENTS TAB ── */}
      {subTab === "achievements" && (
        <div className="panel p-5">
          <div className="font-label text-[11px] text-[#D4A843] mb-4">Achievements ({earState.unlocked.length}/{ACHIEVEMENTS.length})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACHIEVEMENTS.map(a => {
              const done = earState.unlocked.includes(a.id);
              return (
                <div key={a.id} className={`p-3 rounded-sm border ${done ? "border-[#D4A843]/40 bg-[#D4A843]/5" : "border-[#1a1a1a] bg-[#0A0A0A]"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`led ${done ? "led-gold" : "led-off"}`} />
                    <div>
                      <div className={`font-label text-[11px] ${done ? "text-[#D4A843]" : "text-[#555]"}`}>{a.name}</div>
                      <div className="text-[10px] text-[#444]">{a.desc}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── REFERENCE TAB ── */}
      {subTab === "reference" && (
        <div>
          {mode === "intervals" && (
            <div className="panel p-4">
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Interval Reference + Songs</div>
              {ALL_INTERVALS.map(i => (
                <div key={i.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#141414] transition-all"
                  onClick={() => { tone(freq(60), 0.5, 0); tone(freq(60 + i.st), 0.5, 0.6); }}>
                  <div className="w-2 h-6 rounded-sm" style={{ background: i.color }} />
                  <div className="w-10 font-readout text-sm" style={{ color: i.color }}>{i.name}</div>
                  <div className="flex-1">
                    <div className="text-[11px] text-[#aaa]">{i.label}</div>
                    <div className="text-[10px] text-[#555] italic">{i.ref}</div>
                  </div>
                  <div className="font-readout text-[10px] text-[#444]">{i.st} semitones</div>
                  {/* Accuracy from history */}
                  {earState.history["intervals-" + i.name] && (
                    <div className="font-readout text-[9px]" style={{
                      color: (earState.history["intervals-" + i.name].correct / earState.history["intervals-" + i.name].total) >= 0.8 ? "#22c55e" : "#C41E3A"
                    }}>
                      {Math.round((earState.history["intervals-" + i.name].correct / earState.history["intervals-" + i.name].total) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {mode === "chords" && (
            <div className="panel p-4">
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Chord Reference</div>
              {ALL_CHORDS.map(c => (
                <div key={c.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#141414]"
                  onClick={() => playChord(c.iv)}>
                  <div className="w-2 h-6 rounded-sm" style={{ background: c.color }} />
                  <div className="font-label text-sm flex-1" style={{ color: c.color }}>{c.name}</div>
                  <div className="font-readout text-[10px] text-[#444]">{c.iv.join("-")}</div>
                </div>
              ))}
            </div>
          )}
          {mode === "scales" && (
            <div className="panel p-4">
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Scale Reference</div>
              {ALL_SCALES.map(s => (
                <div key={s.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#141414]"
                  onClick={() => playScale(s.notes)}>
                  <div className="w-2 h-6 rounded-sm" style={{ background: s.color }} />
                  <div className="font-label text-sm flex-1" style={{ color: s.color }}>{s.name}</div>
                  <div className="font-readout text-[10px] text-[#444]">{s.notes.join("-")}</div>
                </div>
              ))}
            </div>
          )}
          {mode === "fretboard" && (
            <div className="panel p-4">
              <div className="font-label text-[10px] text-[#D4A843] mb-2">Fretboard Tips</div>
              <div className="space-y-2 text-[12px] text-[#888]">
                <p>Use octave patterns: same note appears 2 frets up and 2 strings up (except G-B).</p>
                <p>Learn natural notes first (no sharps/flats), then fill in the gaps.</p>
                <p>Strings 6 and 1 are the same notes (both E). Master one, you know both.</p>
                <p>Fret 12 = same as open string (one octave higher).</p>
                <p>Reference points: fret 5 = next string open (except G string: fret 4).</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
