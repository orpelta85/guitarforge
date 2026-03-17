"use client";

type View = "dash" | "daily" | "lib" | "learn" | "studio" | "log" | "profile" | "coach";

interface NavbarProps {
  view: View;
  onViewChange: (view: View) => void;
}

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "dash", label: "Dashboard" },
  { id: "daily", label: "Practice" },
  { id: "lib", label: "Library" },
  { id: "learn", label: "Learning" },
  { id: "studio", label: "Studio" },
  { id: "coach", label: "Coach" },
  { id: "log", label: "Report" },
  { id: "profile", label: "Profile" },
];

export default function Navbar({ view, onViewChange }: NavbarProps) {
  return (
    <header>
      {/* Top bar — gold faceplate */}
      <div className="faceplate px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-heading text-2xl font-black tracking-wide text-[#1A1714]">
            GuitarForge
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="led led-on" />
          </div>
        </div>
        <div className="font-label text-[10px] text-[#1A1714]/40 tracking-[0.2em]">
          Practice System
        </div>
      </div>

      {/* Navigation — dark strip */}
      <nav className="px-5 py-1.5 flex items-center gap-0.5 overflow-x-auto bg-[#111] border-b border-[#222]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`font-label text-[13px] px-4 py-1.5 rounded-sm cursor-pointer transition-all whitespace-nowrap ${
              view === id
                ? "bg-[#D4A843] text-[#0A0A0A]"
                : "text-[#777] hover:text-[#ccc]"
            }`}
            style={view === id ? { boxShadow: '0 0 10px rgba(212,168,67,0.3)' } : undefined}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export type { View };
