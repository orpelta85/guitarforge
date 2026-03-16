"use client";
import { useState, useRef, useEffect } from "react";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const TUNING = [40,45,50,55,59,64];
const STR = ["E","A","D","G","B","e"];

interface Stats { correct: number; total: number; avgTime: number; bestTime: number; }

export default function FretboardChallenge() {
  const [target, setTarget] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [duration, setDuration] = useState(60);
  const [stats, setStats] = useState<Stats>({ correct: 0, total: 0, avgTime: 0, bestTime: 99 });
  const [feedback, setFeedback] = useState<{ str: number; fret: number; ok: boolean } | null>(null);
  const [strings, setStrings] = useState<Set<number>>(new Set([0,1,2,3,4,5]));
  const [maxFret, setMaxFret] = useState(12);
  const [showSharps, setShowSharps] = useState(true);
  const [questionTime, setQuestionTime] = useState(0);
  const [history, setHistory] = useState<{ note: string; time: number; correct: boolean }[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  function tone(midi: number) {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const c = ctxRef.current, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "triangle";
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    o.start(c.currentTime); o.stop(c.currentTime + 0.5);
  }

  function nextNote() {
    const pool = showSharps ? NOTES : NOTES.filter(n => !n.includes("#"));
    const n = pool[Math.floor(Math.random() * pool.length)];
    setTarget(n); setFeedback(null); setQuestionTime(0);
    qTimerRef.current = setInterval(() => setQuestionTime(t => t + 0.1), 100);
  }

  function start() {
    setRunning(true); setTimeLeft(duration);
    setStats({ correct: 0, total: 0, avgTime: 0, bestTime: 99 });
    setHistory([]);
    nextNote();
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { stop(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function stop() {
    setRunning(false); setTarget(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (qTimerRef.current) clearInterval(qTimerRef.current);
  }

  function handleClick(str: number, fret: number) {
    if (!running || !target) return;
    if (!strings.has(str)) return;
    const note = NOTES[(TUNING[str] + fret) % 12];
    const correct = note === target;
    const time = Math.round(questionTime * 10) / 10;

    if (qTimerRef.current) clearInterval(qTimerRef.current);

    setFeedback({ str, fret, ok: correct });
    if (correct) tone(TUNING[str] + fret);

    setHistory(h => [...h, { note: target, time, correct }]);
    setStats(prev => {
      const newTotal = prev.total + 1;
      const newCorrect = prev.correct + (correct ? 1 : 0);
      const totalTime = prev.avgTime * prev.total + (correct ? time : 0);
      const correctCount = prev.correct + (correct ? 1 : 0);
      return {
        correct: newCorrect, total: newTotal,
        avgTime: correctCount > 0 ? Math.round((totalTime / correctCount) * 10) / 10 : 0,
        bestTime: correct && time < prev.bestTime ? time : prev.bestTime,
      };
    });

    setTimeout(nextNote, correct ? 300 : 800);
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); if (qTimerRef.current) clearInterval(qTimerRef.current); };
  }, []);

  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div>
      {/* Settings */}
      {!running && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-3">Challenge Settings</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <label className="font-label text-[9px] text-[#555]">Duration (sec)
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="input mt-0.5 !text-xs">
                {[30, 60, 90, 120].map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
            </label>
            <label className="font-label text-[9px] text-[#555]">Max Fret
              <select value={maxFret} onChange={e => setMaxFret(Number(e.target.value))} className="input mt-0.5 !text-xs">
                {[5, 7, 9, 12, 15].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="font-label text-[9px] text-[#555]">Include Sharps
              <div className="mt-1">
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setShowSharps(!showSharps)}>
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${showSharps ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{showSharps ? "✓" : ""}</div>
                  <span className="font-label text-[10px] text-[#666]">{showSharps ? "Yes" : "No"}</span>
                </label>
              </div>
            </label>
          </div>
          <div className="font-label text-[9px] text-[#555] mb-1.5">Strings</div>
          <div className="flex gap-1 mb-3">
            {STR.map((s, i) => (
              <button key={i} onClick={() => { const n = new Set(strings); if (n.has(i)) { if (n.size > 1) n.delete(i); } else n.add(i); setStrings(n); }}
                className={`font-readout text-[11px] px-3 py-1 rounded-sm cursor-pointer border ${strings.has(i) ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#444]"}`}>{s}</button>
            ))}
          </div>
          <button onClick={start} className="btn-gold w-full justify-center !py-3">Start Challenge</button>
        </div>
      )}

      {/* Active challenge */}
      {running && (
        <>
          {/* Timer + target */}
          <div className="panel p-4 mb-3">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="font-label text-[9px] text-[#555]">Find:</span>
                <span className="font-heading text-3xl text-[#D4A843] ml-3">{target}</span>
              </div>
              <div className="text-right">
                <div className="font-readout text-2xl text-[#ccc]">{timeLeft}s</div>
                <div className="font-readout text-[10px] text-[#555]">{questionTime.toFixed(1)}s</div>
              </div>
            </div>
            <div className="vu"><div className="vu-fill" style={{ width: (timeLeft / duration * 100) + "%" }} /></div>
            <div className="flex justify-between mt-2">
              <span className="font-readout text-[10px] text-[#33CC33]">{stats.correct} correct</span>
              <span className="font-readout text-[10px] text-[#C41E3A]">{stats.total - stats.correct} wrong</span>
              <button onClick={stop} className="font-label text-[9px] text-[#C41E3A] cursor-pointer">Stop</button>
            </div>
          </div>

          {/* Fretboard */}
          <div className="panel p-4 overflow-x-auto" dir="ltr">
            <div className="min-w-[500px]">
              <div className="flex mb-1"><div className="w-6" />{Array.from({ length: maxFret + 1 }, (_, f) => <div key={f} className="flex-1 text-center font-readout text-[8px] text-[#333]">{f}</div>)}</div>
              {[...Array(6)].map((_, si) => {
                const s = 5 - si;
                const active = strings.has(s);
                return (
                  <div key={s} className="flex items-center h-7" style={{ opacity: active ? 1 : 0.2 }}>
                    <div className="w-6 font-readout text-[9px] text-[#444] text-center">{STR[s]}</div>
                    {Array.from({ length: maxFret + 1 }, (_, f) => {
                      const hit = feedback && feedback.str === s && feedback.fret === f;
                      return (
                        <div key={f} onClick={() => handleClick(s, f)}
                          className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-all h-full"
                          style={{ borderRight: "1px solid #1a1a1a", borderBottom: si < 5 ? "1px solid #2a2a2a" : "1px solid #333" }}>
                          {hit && <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                            style={{ background: feedback.ok ? "#22c55e" : "#C41E3A", color: "#fff" }}>
                            {NOTES[(TUNING[s] + f) % 12]}
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className="flex mt-1"><div className="w-6" />{Array.from({ length: maxFret + 1 }, (_, f) => <div key={f} className="flex-1 text-center">{[3,5,7,9,12].includes(f) && <div className={`w-1.5 h-1.5 rounded-full mx-auto ${f === 12 ? "bg-[#D4A843]/40" : "bg-[#333]"}`} />}</div>)}</div>
            </div>
          </div>
        </>
      )}

      {/* Results */}
      {!running && stats.total > 0 && (
        <div className="panel p-5 mt-3">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Results</div>
          <div className="grid grid-cols-4 gap-3 text-center mb-4">
            <div><div className="font-readout text-xl font-bold text-[#D4A843]">{stats.correct}/{stats.total}</div><div className="font-label text-[9px] text-[#555]">Score</div></div>
            <div><div className="font-readout text-xl font-bold" style={{ color: pct >= 80 ? "#33CC33" : pct >= 50 ? "#D4A843" : "#C41E3A" }}>{pct}%</div><div className="font-label text-[9px] text-[#555]">Accuracy</div></div>
            <div><div className="font-readout text-xl font-bold text-[#D4A843]">{stats.avgTime}s</div><div className="font-label text-[9px] text-[#555]">Avg Time</div></div>
            <div><div className="font-readout text-xl font-bold text-[#33CC33]">{stats.bestTime < 99 ? stats.bestTime + "s" : "—"}</div><div className="font-label text-[9px] text-[#555]">Best Time</div></div>
          </div>

          {/* Weak notes */}
          {(() => {
            const noteStats: Record<string, { c: number; t: number }> = {};
            history.forEach(h => { if (!noteStats[h.note]) noteStats[h.note] = { c: 0, t: 0 }; noteStats[h.note].t++; if (h.correct) noteStats[h.note].c++; });
            const weak = Object.entries(noteStats).filter(([, v]) => v.t >= 2 && (v.c / v.t) < 0.7);
            if (!weak.length) return null;
            return (
              <div>
                <div className="font-label text-[9px] text-[#555] mb-1.5">Needs Practice</div>
                <div className="flex gap-1.5">
                  {weak.map(([note, v]) => (
                    <span key={note} className="font-readout text-[11px] px-2 py-1 border border-[#C41E3A]/30 text-[#C41E3A] rounded-sm">
                      {note} ({Math.round((v.c / v.t) * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          <button onClick={start} className="btn-gold mt-4 w-full justify-center">Play Again</button>
        </div>
      )}
    </div>
  );
}
