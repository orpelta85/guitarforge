"use client";
import { useState, useEffect, useRef } from "react";

function RotaryKnob({ value, min, max, onChange, label, size = 48 }: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; label: string; size?: number;
}) {
  const range = max - min;
  const pct = (value - min) / range;
  const angle = -135 + pct * 270;
  const r = size / 2;

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size + 16 }}>
      <svg width={size} height={size} className="cursor-pointer"
        onMouseDown={e => {
          const startY = e.clientY;
          const startVal = value;
          const onMove = (ev: MouseEvent) => {
            const dy = startY - ev.clientY;
            const newVal = Math.max(min, Math.min(max, startVal + (dy / 100) * range));
            onChange(Math.round(newVal));
          };
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <circle cx={r} cy={r} r={r-2} fill="none" stroke="#2A2824" strokeWidth="2"/>
        <circle cx={r} cy={r} r={r-4} fill="url(#knobGradTimer)"/>
        <line x1={r} y1={r} x2={r + (r-8) * Math.sin(angle * Math.PI/180)}
              y2={r - (r-8) * Math.cos(angle * Math.PI/180)}
              stroke="#33CC33" strokeWidth="2" strokeLinecap="round"/>
        <defs>
          <radialGradient id="knobGradTimer">
            <stop offset="0%" stopColor="#2A2A2A"/>
            <stop offset="100%" stopColor="#1A1A1A"/>
          </radialGradient>
        </defs>
      </svg>
      <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-[11px] text-[#33CC33] font-mono">{value}</span>
    </div>
  );
}

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
          <RotaryKnob value={setMins} min={1} max={60} onChange={(v) => { setSetMins(v); setSec(v * 60); }} label="דקות" size={40} />
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
