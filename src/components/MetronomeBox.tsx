"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export default function MetronomeBox() {
  const audioRef = useRef<AudioContext | null>(null);
  const clickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bpmRef = useRef(80);
  const beatRef = useRef(0);

  const [on, setOn] = useState(false);
  const [startBpm, setStartBpm] = useState(60);
  const [targetBpm, setTargetBpm] = useState(120);
  const [incAmt, setIncAmt] = useState(5);
  const [incSec, setIncSec] = useState(30);
  const [prog, setProg] = useState(true);
  const [showBpm, setShowBpm] = useState(60);
  const [beat, setBeat] = useState(0);

  const beep = useCallback((accent = false) => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    const ctx = audioRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1200 : 900;
    gain.gain.setValueAtTime(accent ? 0.35 : 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }, []);

  function doStart() {
    bpmRef.current = startBpm;
    beatRef.current = 0;
    setShowBpm(startBpm);
    setBeat(0);
    setOn(true);
    beep(true);

    clickRef.current = setInterval(() => {
      beatRef.current = (beatRef.current + 1) % 4;
      setBeat(beatRef.current);
      beep(beatRef.current === 0);
    }, 60000 / startBpm);

    if (prog && targetBpm > startBpm) {
      incRef.current = setInterval(() => {
        const next = Math.min(bpmRef.current + incAmt, targetBpm);
        bpmRef.current = next;
        setShowBpm(next);
        if (clickRef.current) clearInterval(clickRef.current);
        clickRef.current = setInterval(() => {
          beatRef.current = (beatRef.current + 1) % 4;
          setBeat(beatRef.current);
          beep(beatRef.current === 0);
        }, 60000 / next);
        if (next >= targetBpm && incRef.current) clearInterval(incRef.current);
      }, incSec * 1000);
    }
  }

  function doStop() {
    if (clickRef.current) clearInterval(clickRef.current);
    if (incRef.current) clearInterval(incRef.current);
    setOn(false);
    setBeat(0);
  }

  useEffect(() => {
    return () => { if (clickRef.current) clearInterval(clickRef.current); if (incRef.current) clearInterval(incRef.current); };
  }, []);

  const pct = targetBpm > startBpm ? Math.round(((showBpm - startBpm) / (targetBpm - startBpm)) * 100) : 0;

  return (
    <div className="panel p-4 mb-3">
      <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
        <div className={`led ${on ? "led-gold" : "led-off"}`} />
        Metronome {prog ? "· Progressive" : ""}
      </div>

      <div className="flex items-center gap-4 mb-3">
        <span className={`font-readout text-3xl font-bold ${on ? "text-[#D4A843]" : "text-[#ccc]"}`}>
          {on ? showBpm : startBpm}
        </span>
        <span className="font-label text-[9px] text-[#444]">BPM</span>

        {/* Beat indicators */}
        {on && (
          <div className="flex gap-1.5 ml-2">
            {[0, 1, 2, 3].map((b) => (
              <div key={b} className={`led ${beat === b ? (b === 0 ? "led-gold" : "led-on") : "led-off"}`}
                style={{ width: b === 0 ? 10 : 8, height: b === 0 ? 10 : 8 }} />
            ))}
          </div>
        )}

        {on && prog && (
          <div className="flex-1">
            <div className="vu !h-[3px]">
              <div className="vu-fill" style={{ width: pct + "%" }} />
            </div>
          </div>
        )}
      </div>

      {!on && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2"
            onClick={() => setProg(!prog)}>
            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${
              prog ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444] bg-transparent"
            }`}>{prog ? "✓" : ""}</div>
            <span className="font-label text-[10px] text-[#666]">Progressive</span>
          </label>

          <div className="grid grid-cols-4 gap-2">
            <label className="font-label text-[9px] text-[#555]">
              Start
              <input type="number" value={startBpm} min={30} max={220}
                onChange={(e) => setStartBpm(Number(e.target.value))}
                className="input input-gold mt-0.5 text-center !py-1 text-xs" />
            </label>
            <label className={`font-label text-[9px] ${prog ? "text-[#555]" : "text-[#333]"}`}>
              Target
              <input type="number" value={targetBpm} min={30} max={300} disabled={!prog}
                onChange={(e) => setTargetBpm(Number(e.target.value))}
                className="input mt-0.5 text-center !py-1 text-xs disabled:opacity-30" />
            </label>
            <label className={`font-label text-[9px] ${prog ? "text-[#555]" : "text-[#333]"}`}>
              +BPM
              <input type="number" value={incAmt} min={1} max={20} disabled={!prog}
                onChange={(e) => setIncAmt(Number(e.target.value))}
                className="input mt-0.5 text-center !py-1 text-xs disabled:opacity-30" />
            </label>
            <label className={`font-label text-[9px] ${prog ? "text-[#555]" : "text-[#333]"}`}>
              Every (sec)
              <input type="number" value={incSec} min={5} max={120} step={5} disabled={!prog}
                onChange={(e) => setIncSec(Number(e.target.value))}
                className="input mt-0.5 text-center !py-1 text-xs disabled:opacity-30" />
            </label>
          </div>
        </div>
      )}

      {!on ? (
        <button onClick={doStart} className="btn-gold w-full !py-2.5 justify-center">
          {prog ? startBpm + " → " + targetBpm + " BPM" : startBpm + " BPM"}
        </button>
      ) : (
        <button onClick={doStop} className="btn-danger w-full !py-2.5 justify-center">
          Stop
        </button>
      )}
    </div>
  );
}
