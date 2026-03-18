"use client";

interface RotaryKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  size?: number;
  accentColor?: string;
  gradientId?: string;
}

export default function RotaryKnob({ value, min, max, onChange, label, size = 48, accentColor = "#D4A843", gradientId = "knobGrad" }: RotaryKnobProps) {
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
        <circle cx={r} cy={r} r={r-4} fill={`url(#${gradientId})`}/>
        <line x1={r} y1={r} x2={r + (r-8) * Math.sin(angle * Math.PI/180)}
              y2={r - (r-8) * Math.cos(angle * Math.PI/180)}
              stroke={accentColor} strokeWidth="2" strokeLinecap="round"/>
        <defs>
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor="#2A2A2A"/>
            <stop offset="100%" stopColor="#1A1A1A"/>
          </radialGradient>
        </defs>
      </svg>
      <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-[11px] font-mono" style={{ color: accentColor }}>{value}</span>
    </div>
  );
}
