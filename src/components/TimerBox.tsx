"use client";
import { useState, useEffect, useRef } from "react";
import RotaryKnob from "./RotaryKnob";

interface TimerBoxProps { minutes: number; }

export default function TimerBox({ minutes = 5 }: TimerBoxProps) {
  const [setMins, setSetMins] = useState(minutes);
  const totalSec = setMins * 60;
  const [sec, setSec] = useState(totalSec);
  const [active, setActive] = useState(false);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active && sec > 0) {
      ref.current = setTimeout(() => setSec((s) => s - 1), 1000);
    } else if (sec <= 0 && active) {
      setActive(false);
    }
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [active, sec]);

  const disp = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  const pct = totalSec > 0 ? Math.round((1 - sec / totalSec) * 100) : 0;

  return (
    <div className="panel p-4 mb-3">
      <div className="font-label text-[10px] text-[#33CC33] mb-3 flex items-center gap-2">
        <div className={`led ${active ? "led-on" : "led-off"}`} />
        Timer
      </div>
      <div className="flex items-center gap-4">
        {!active && (
          <RotaryKnob value={setMins} min={1} max={60} onChange={(v) => { setSetMins(v); setSec(v * 60); }} label="Minutes" size={40} accentColor="#33CC33" gradientId="knobGradTimer" />
        )}
        <span className={`font-readout text-3xl font-bold ${active ? "text-[#33CC33]" : "text-[#ccc]"}`}>{disp}</span>
        <div className="flex-1">
          <div className="vu vu-green">
            <div className="vu-fill" style={{ width: pct + "%" }} />
          </div>
        </div>
        {!active ? (
          <button onClick={() => { setSec(setMins * 60); setActive(true); }}
            className="btn-gold">{setMins}m</button>
        ) : (
          <button onClick={() => setActive(false)} className="btn-danger">Stop</button>
        )}
      </div>
    </div>
  );
}
