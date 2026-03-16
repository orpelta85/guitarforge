"use client";
import { useState, useRef, useEffect } from "react";
import FretboardChallenge from "./FretboardChallenge";

/* ── DATA ── */
const ALL_INTERVALS = [
  { name: "m2", label: "Minor 2nd", st: 1, color: "#ef4444", ref: "Jaws" },
  { name: "M2", label: "Major 2nd", st: 2, color: "#f97316", ref: "Happy Birthday" },
  { name: "m3", label: "Minor 3rd", st: 3, color: "#eab308", ref: "Smoke on the Water" },
  { name: "M3", label: "Major 3rd", st: 4, color: "#84cc16", ref: "When the Saints" },
  { name: "P4", label: "Perfect 4th", st: 5, color: "#22c55e", ref: "Here Comes the Bride" },
  { name: "TT", label: "Tritone", st: 6, color: "#14b8a6", ref: "Black Sabbath" },
  { name: "P5", label: "Perfect 5th", st: 7, color: "#06b6d4", ref: "Star Wars" },
  { name: "m6", label: "Minor 6th", st: 8, color: "#3b82f6", ref: "The Entertainer" },
  { name: "M6", label: "Major 6th", st: 9, color: "#6366f1", ref: "My Bonnie" },
  { name: "m7", label: "Minor 7th", st: 10, color: "#8b5cf6", ref: "Somewhere (WSS)" },
  { name: "M7", label: "Major 7th", st: 11, color: "#a855f7", ref: "Take On Me" },
  { name: "P8", label: "Octave", st: 12, color: "#ec4899", ref: "Over the Rainbow" },
];
const ALL_CHORDS = [
  { name: "Major", iv: [0,4,7], color: "#22c55e" }, { name: "Minor", iv: [0,3,7], color: "#3b82f6" },
  { name: "Dim", iv: [0,3,6], color: "#ef4444" }, { name: "Aug", iv: [0,4,8], color: "#f97316" },
  { name: "Dom7", iv: [0,4,7,10], color: "#eab308" }, { name: "Maj7", iv: [0,4,7,11], color: "#84cc16" },
  { name: "Min7", iv: [0,3,7,10], color: "#6366f1" }, { name: "Dim7", iv: [0,3,6,9], color: "#ec4899" },
  { name: "Sus2", iv: [0,2,7], color: "#14b8a6" }, { name: "Sus4", iv: [0,5,7], color: "#06b6d4" },
];
const ALL_SCALES = [
  { name: "Major", notes: [0,2,4,5,7,9,11], color: "#22c55e" },
  { name: "Nat. Minor", notes: [0,2,3,5,7,8,10], color: "#3b82f6" },
  { name: "Dorian", notes: [0,2,3,5,7,9,10], color: "#8b5cf6" },
  { name: "Phrygian", notes: [0,1,3,5,7,8,10], color: "#ef4444" },
  { name: "Lydian", notes: [0,2,4,6,7,9,11], color: "#eab308" },
  { name: "Mixolydian", notes: [0,2,4,5,7,9,10], color: "#f97316" },
  { name: "Harm. Minor", notes: [0,2,3,5,7,8,11], color: "#ec4899" },
  { name: "Pent. Minor", notes: [0,3,5,7,10], color: "#06b6d4" },
  { name: "Blues", notes: [0,3,5,6,7,10], color: "#14b8a6" },
];
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const TUNING = [40,45,50,55,59,64]; const STR = ["E","A","D","G","B","e"];

const ACHIEVEMENTS = [
  { id: "first10", name: "First Steps", desc: "10 answers", need: 10, key: "total" },
  { id: "first50", name: "Warming Up", desc: "50 answers", need: 50, key: "total" },
  { id: "streak5", name: "On Fire", desc: "5x streak", need: 5, key: "streak" },
  { id: "streak10", name: "Unstoppable", desc: "10x streak", need: 10, key: "streak" },
  { id: "streak25", name: "Iron Ears", desc: "25x streak", need: 25, key: "streak" },
  { id: "acc90", name: "Sharp Ear", desc: "90%+ (20+ questions)", need: 90, key: "accuracy" },
  { id: "lv5", name: "Apprentice", desc: "Level 5", need: 5, key: "level" },
  { id: "lv10", name: "Journeyman", desc: "Level 10", need: 10, key: "level" },
  { id: "lv25", name: "Master", desc: "Level 25", need: 25, key: "level" },
  { id: "lv50", name: "Grand Master", desc: "Level 50", need: 50, key: "level" },
];

type ExMode = "intervals" | "chords" | "scales" | "fretboard" | "progressions";
type Direction = "ascending" | "descending" | "harmonic";
type SubTab = "exercise" | "achievements" | "reference";

function freq(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }

interface EarState { xp: number; level: number; bestStreak: number; unlocked: string[]; history: Record<string, { c: number; t: number }>; }

const PROG_QUESTIONS = [
  { name: "I - IV - V - I", chords: [[0,4,7],[5,9,12],[7,11,14],[0,4,7]] },
  { name: "i - bVI - bVII - i", chords: [[0,3,7],[8,12,15],[10,14,17],[0,3,7]] },
  { name: "I - V - vi - IV", chords: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]] },
  { name: "ii - V - I", chords: [[2,5,9],[7,11,14],[0,4,7]] },
  { name: "I - vi - IV - V", chords: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]] },
  { name: "i - iv - v - i", chords: [[0,3,7],[5,8,12],[7,10,14],[0,3,7]] },
];

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
  const [enabledScales, setEnabledScales] = useState<Set<string>>(new Set(["Major","Nat. Minor","Pent. Minor"]));
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [earState, setEarState] = useState<EarState>({ xp: 0, level: 1, bestStreak: 0, unlocked: [], history: {} });
  const [fbTarget, setFbTarget] = useState<string | null>(null);
  const [fbFeedback, setFbFeedback] = useState<{ fret: number; str: number; ok: boolean } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { try { const s = localStorage.getItem("gf-ear3"); if (s) { const d = JSON.parse(s); setEarState(d); setScore(p => ({ ...p, bestStreak: d.bestStreak || 0 })); } } catch {} }, []);
  function persist(st: EarState) { setEarState(st); try { localStorage.setItem("gf-ear3", JSON.stringify(st)); } catch {} }

  function ctx() { if (!ctxRef.current) ctxRef.current = new AudioContext(); return ctxRef.current; }
  function tone(f: number, dur = 0.6, delay = 0, type: OscillatorType = "triangle") {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.22, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.1);
  }
  function playIv(st: number, dir: Direction) {
    const r = 55 + Math.floor(Math.random() * 12);
    if (dir === "harmonic") { tone(freq(r)); tone(freq(r + st)); }
    else if (dir === "descending") { tone(freq(r + st), 0.6, 0); tone(freq(r), 0.6, 0.7); }
    else { tone(freq(r), 0.6, 0); tone(freq(r + st), 0.6, 0.7); }
  }
  function playChord(iv: number[]) { const r = 55 + Math.floor(Math.random() * 12); iv.forEach(s => tone(freq(r + s), 1.2)); }
  function playScaleNotes(ns: number[]) { const r = 55 + Math.floor(Math.random() * 12); ns.forEach((n, i) => tone(freq(r + n), 0.35, i * 0.2)); }
  function playProg(chords: number[][]) { chords.forEach((ch, i) => { const r = 48; ch.forEach(n => tone(freq(r + n), 0.8, i * 1.0)); }); }

  const activeIv = ALL_INTERVALS.filter(i => enabledIntervals.has(i.st));
  const activeCh = ALL_CHORDS.filter(c => enabledChords.has(c.name));
  const activeSc = ALL_SCALES.filter(s => enabledScales.has(s.name));

  function newQ() {
    setPicked(null); setRevealed(false); setFbFeedback(null);
    if (mode === "intervals") { const it = activeIv[Math.floor(Math.random() * activeIv.length)]; if (it) { setAnswer(it.name); playIv(it.st, direction); } }
    else if (mode === "chords") { const it = activeCh[Math.floor(Math.random() * activeCh.length)]; if (it) { setAnswer(it.name); playChord(it.iv); } }
    else if (mode === "scales") { const it = activeSc[Math.floor(Math.random() * activeSc.length)]; if (it) { setAnswer(it.name); playScaleNotes(it.notes); } }
    else if (mode === "fretboard") { const n = NOTES[Math.floor(Math.random() * 12)]; setFbTarget(n); setAnswer(n); tone(freq(60 + NOTES.indexOf(n))); }
    else if (mode === "progressions") { const p = PROG_QUESTIONS[Math.floor(Math.random() * PROG_QUESTIONS.length)]; setAnswer(p.name); playProg(p.chords); }
  }

  function replay() {
    if (!answer) return;
    if (mode === "intervals") { const it = ALL_INTERVALS.find(i => i.name === answer); if (it) playIv(it.st, direction); }
    else if (mode === "chords") { const it = ALL_CHORDS.find(c => c.name === answer); if (it) playChord(it.iv); }
    else if (mode === "scales") { const it = ALL_SCALES.find(s => s.name === answer); if (it) playScaleNotes(it.notes); }
    else if (mode === "fretboard") { const i = NOTES.indexOf(answer); if (i >= 0) tone(freq(60 + i)); }
    else if (mode === "progressions") { const p = PROG_QUESTIONS.find(q => q.name === answer); if (p) playProg(p.chords); }
  }

  function handleAnswer(name: string) {
    if (revealed || !answer) return;
    setPicked(name); setRevealed(true);
    const correct = name === answer;
    const ns = correct ? score.streak + 1 : 0;
    const best = Math.max(score.bestStreak, ns, earState.bestStreak);
    const earned = correct ? (10 + Math.min(ns, 20) * 2) : 0;
    const nx = earState.xp + earned;
    const nl = Math.floor(nx / 100) + 1;
    const hKey = mode + "-" + answer;
    const prev = earState.history[hKey] || { c: 0, t: 0 };
    const newH = { ...earState.history, [hKey]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } };
    const unlocked = [...earState.unlocked];
    const pct = (score.correct + (correct ? 1 : 0)) / (score.total + 1) * 100;
    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.key === "total" && score.total + 1 >= a.need) unlocked.push(a.id);
      if (a.key === "streak" && ns >= a.need) unlocked.push(a.id);
      if (a.key === "accuracy" && score.total + 1 >= 20 && pct >= a.need) unlocked.push(a.id);
      if (a.key === "level" && nl >= a.need) unlocked.push(a.id);
    });
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1, streak: ns, bestStreak: best });
    persist({ xp: nx, level: nl, bestStreak: best, unlocked, history: newH });
    if (autoAdvance && correct) timeoutRef.current = setTimeout(newQ, 900);
  }

  function handleFbClick(s: number, f: number) {
    if (!fbTarget || revealed) return;
    const note = NOTES[(TUNING[s] + f) % 12]; const ok = note === fbTarget;
    setFbFeedback({ str: s, fret: f, ok });
    handleAnswer(ok ? fbTarget : "__wrong");
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  function toggleSet<T>(s: Set<T>, i: T): Set<T> { const n = new Set(s); if (n.has(i)) { if (n.size > 2) n.delete(i); } else n.add(i); return n; }

  const pool = mode === "intervals" ? activeIv : mode === "chords" ? activeCh : mode === "scales" ? activeSc : mode === "progressions" ? PROG_QUESTIONS.map(p => ({ name: p.name, color: "#D4A843" })) : [];
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="panel p-5 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-heading text-xl font-bold text-[#D4A843]">Ear Training</div>
            <div className="font-label text-[10px] text-[#555] mt-0.5">26 exercise types inspired by musictheory.net</div>
          </div>
          <div className="text-right">
            <div className="font-readout text-2xl font-bold text-[#D4A843]">LV.{earState.level}</div>
            <div className="font-readout text-[10px] text-[#555]">{earState.xp} XP</div>
          </div>
        </div>
        <div className="vu !h-[4px] mt-2"><div className="vu-fill" style={{ width: (earState.xp % 100) + "%" }} /></div>
        <div className="flex justify-between mt-1">
          <span className="font-readout text-[9px] text-[#444]">{100 - earState.xp % 100} XP to next</span>
          <span className="font-readout text-[9px] text-[#444]">Best streak: {earState.bestStreak}</span>
        </div>
      </div>

      {/* Mode */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {(["intervals","chords","scales","progressions","fretboard"] as ExMode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setRevealed(false); setAnswer(null); setFbTarget(null); }}
            className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all flex-1 ${mode === m ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{m}</button>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 mb-3">
        {(["exercise","achievements","reference"] as SubTab[]).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border flex-1 transition-all ${subTab === t ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{t}</button>
        ))}
      </div>

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
              {score.streak > 0 && <span className="font-readout text-sm" style={{ color: score.streak >= 10 ? "#33CC33" : score.streak >= 5 ? "#D4A843" : "#888" }}>{score.streak}x</span>}
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
            <div className="font-label text-[10px] text-[#D4A843] mb-3">Exercise Settings</div>
            {mode === "intervals" && (<>
              <div className="mb-3"><div className="font-label text-[9px] text-[#555] mb-1">Direction</div>
                <div className="flex gap-1">{(["ascending","descending","harmonic"] as const).map(d => (
                  <button key={d} onClick={() => setDirection(d)} className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${direction === d ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#444]"}`}>{d}</button>
                ))}</div></div>
              <div className="font-label text-[9px] text-[#555] mb-1">Active Intervals</div>
              <div className="flex flex-wrap gap-1">{ALL_INTERVALS.map(i => (
                <button key={i.name} onClick={() => setEnabledIntervals(toggleSet(enabledIntervals, i.st))}
                  className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                  style={enabledIntervals.has(i.st) ? { borderColor: i.color, color: i.color, background: i.color + "12" } : { borderColor: "#222", color: "#444" }}>{i.name}</button>
              ))}</div>
            </>)}
            {mode === "chords" && (<><div className="font-label text-[9px] text-[#555] mb-1">Active Chords</div>
              <div className="flex flex-wrap gap-1">{ALL_CHORDS.map(c => (
                <button key={c.name} onClick={() => setEnabledChords(toggleSet(enabledChords, c.name))}
                  className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                  style={enabledChords.has(c.name) ? { borderColor: c.color, color: c.color, background: c.color + "12" } : { borderColor: "#222", color: "#444" }}>{c.name}</button>
              ))}</div></>)}
            {mode === "scales" && (<><div className="font-label text-[9px] text-[#555] mb-1">Active Scales</div>
              <div className="flex flex-wrap gap-1">{ALL_SCALES.map(s => (
                <button key={s.name} onClick={() => setEnabledScales(toggleSet(enabledScales, s.name))}
                  className="font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border"
                  style={enabledScales.has(s.name) ? { borderColor: s.color, color: s.color, background: s.color + "12" } : { borderColor: "#222", color: "#444" }}>{s.name}</button>
              ))}</div></>)}
            <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
              <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAutoAdvance(!autoAdvance)}>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${autoAdvance ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{autoAdvance ? "✓" : ""}</div>
                <span className="font-label text-[10px] text-[#666]">Auto-advance on correct</span>
              </label>
            </div>
          </div>
        )}

        {/* Play area — not fretboard */}
        {mode !== "fretboard" ? (
          <div className="panel p-6 mb-3">
            <div className="flex justify-center gap-3 mb-6">
              <button onClick={newQ} className="w-16 h-16 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
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
                  const n = item.name, ok = revealed && n === answer, wrong = revealed && n === picked && n !== answer;
                  const hk = mode + "-" + n, hist = earState.history[hk];
                  const weak = hist && hist.t >= 3 && (hist.c / hist.t) < 0.6;
                  return (
                    <button key={n} onClick={() => handleAnswer(n)} disabled={revealed}
                      className="py-3 rounded-sm text-center transition-all cursor-pointer border relative overflow-hidden"
                      style={ok ? { background: "#22c55e", borderColor: "#22c55e", color: "#0A0A0A" }
                        : wrong ? { background: "#C41E3A", borderColor: "#C41E3A", color: "#fff" }
                        : { background: "#141414", borderColor: "#222", color: "#aaa" }}>
                      {!revealed && "color" in item && <div className="absolute bottom-0 left-0 h-[2px] w-full" style={{ background: (item as { color: string }).color }} />}
                      {weak && !revealed && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#C41E3A]" />}
                      <div className="font-label text-sm">{n}</div>
                      {"label" in item && <div className="text-[8px] opacity-50 mt-0.5">{(item as typeof ALL_INTERVALS[0]).label}</div>}
                    </button>
                  );
                })}
              </div>
            )}
            {revealed && (
              <div className="mt-4 text-center">
                {picked === answer
                  ? <><div className="font-heading text-lg text-[#22c55e]">Correct!</div><div className="font-readout text-[11px] text-[#D4A843] mt-1">+{10 + Math.min(score.streak, 20) * 2} XP</div></>
                  : <div className="font-heading text-lg text-[#C41E3A]">Answer: {answer}</div>
                }
                {!autoAdvance && <button onClick={newQ} className="btn-gold mt-3">Next</button>}
              </div>
            )}
          </div>
        ) : (
          /* Fretboard mode */
          <div className="panel p-4 mb-3">
            <div className="flex justify-between items-center mb-4">
              <div>
                {fbTarget
                  ? <><span className="font-label text-[10px] text-[#555]">Find:</span><span className="font-heading text-3xl text-[#D4A843] ml-3">{fbTarget}</span></>
                  : <span className="font-label text-sm text-[#333]">Press New Note</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={newQ} className="btn-gold !text-[10px]">New Note</button>
                {fbTarget && <button onClick={replay} className="btn-ghost !text-[10px]">Replay</button>}
              </div>
            </div>
            <div className="overflow-x-auto" dir="ltr">
              <div className="min-w-[550px]">
                <div className="flex mb-1"><div className="w-6" />{Array.from({length: 13}, (_,f) => <div key={f} className="flex-1 text-center font-readout text-[8px] text-[#333]">{f}</div>)}</div>
                {[...Array(6)].map((_, si) => {
                  const s = 5 - si;
                  return (
                    <div key={s} className="flex items-center h-7">
                      <div className="w-6 font-readout text-[9px] text-[#444] text-center">{STR[s]}</div>
                      {Array.from({length: 13}, (_,f) => {
                        const hit = fbFeedback && fbFeedback.str === s && fbFeedback.fret === f;
                        return (
                          <div key={f} onClick={() => handleFbClick(s, f)}
                            className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-all h-full"
                            style={{ borderRight: "1px solid #1a1a1a", borderBottom: si < 5 ? "1px solid #2a2a2a" : "1px solid #333" }}>
                            {hit && <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                              style={{ background: fbFeedback.ok ? "#22c55e" : "#C41E3A", color: "#fff" }}>{NOTES[(TUNING[s] + f) % 12]}</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            {revealed && <div className="mt-3 text-center">{fbFeedback?.ok ? <div className="font-heading text-lg text-[#22c55e]">Correct!</div> : <div className="font-heading text-lg text-[#C41E3A]">The note was {fbTarget}</div>}</div>}
          </div>
        )}

        {/* Timed Fretboard Challenge */}
        {mode === "fretboard" && (
          <div className="mt-3"><div className="divider-gold mb-3" /><div className="font-label text-[10px] text-[#D4A843] mb-2">Timed Challenge</div><FretboardChallenge /></div>
        )}
      </>)}

      {/* Achievements */}
      {subTab === "achievements" && (
        <div className="panel p-5">
          <div className="font-label text-[11px] text-[#D4A843] mb-4">Achievements ({earState.unlocked.length}/{ACHIEVEMENTS.length})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACHIEVEMENTS.map(a => {
              const done = earState.unlocked.includes(a.id);
              return (
                <div key={a.id} className={`p-3 rounded-sm border ${done ? "border-[#D4A843]/40 bg-[#D4A843]/5" : "border-[#1a1a1a]"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`led ${done ? "led-gold" : "led-off"}`} />
                    <div><div className={`font-label text-[11px] ${done ? "text-[#D4A843]" : "text-[#555]"}`}>{a.name}</div><div className="text-[10px] text-[#444]">{a.desc}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reference */}
      {subTab === "reference" && (
        <div className="panel p-4">
          {mode === "intervals" && (
            <div>
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Interval Reference — Click to hear</div>
              {ALL_INTERVALS.map(i => (
                <div key={i.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] transition-all px-1 -mx-1 rounded-sm"
                  onClick={() => { tone(freq(60), 0.5, 0); tone(freq(60 + i.st), 0.5, 0.6); }}>
                  <div className="w-2 h-5 rounded-sm" style={{ background: i.color }} />
                  <div className="w-8 font-readout text-sm" style={{ color: i.color }}>{i.name}</div>
                  <div className="flex-1"><div className="text-[11px] text-[#aaa]">{i.label}</div><div className="text-[9px] text-[#555] italic">{i.ref}</div></div>
                  <div className="font-readout text-[10px] text-[#444]">{i.st}st</div>
                  {earState.history["intervals-" + i.name] && (() => {
                    const h = earState.history["intervals-" + i.name]; const p = Math.round((h.c / h.t) * 100);
                    return <span className="font-readout text-[9px]" style={{ color: p >= 80 ? "#33CC33" : p >= 50 ? "#D4A843" : "#C41E3A" }}>{p}%</span>;
                  })()}
                </div>
              ))}
            </div>
          )}
          {mode === "chords" && (
            <div>
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Chord Reference — Click to hear</div>
              {ALL_CHORDS.map(c => (
                <div key={c.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] px-1 -mx-1 rounded-sm"
                  onClick={() => playChord(c.iv)}>
                  <div className="w-2 h-5 rounded-sm" style={{ background: c.color }} />
                  <span className="font-label text-sm flex-1" style={{ color: c.color }}>{c.name}</span>
                  <span className="font-readout text-[10px] text-[#444]">{c.iv.join("-")}</span>
                </div>
              ))}
            </div>
          )}
          {mode === "scales" && (
            <div>
              <div className="font-label text-[10px] text-[#D4A843] mb-3">Scale Reference — Click to hear</div>
              {ALL_SCALES.map(s => (
                <div key={s.name} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] px-1 -mx-1 rounded-sm"
                  onClick={() => playScaleNotes(s.notes)}>
                  <div className="w-2 h-5 rounded-sm" style={{ background: s.color }} />
                  <span className="font-label text-sm flex-1" style={{ color: s.color }}>{s.name}</span>
                  <span className="font-readout text-[10px] text-[#444]">{s.notes.join("-")}</span>
                </div>
              ))}
            </div>
          )}
          {(mode === "fretboard" || mode === "progressions") && (
            <div className="py-4 text-center font-label text-sm text-[#444]">
              {mode === "fretboard" ? "Use the fretboard exercise and timed challenge above" : "Listen for root movement and chord qualities in progressions"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
