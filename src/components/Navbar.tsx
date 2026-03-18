"use client";

import Image from "next/image";

type View = "dash" | "daily" | "lib" | "songs" | "learn" | "studio" | "log" | "profile" | "coach";

interface NavbarProps {
  view: View;
  onViewChange: (view: View) => void;
}

const ALL_NAV: { id: View; label: string }[] = [
  { id: "dash", label: "Dashboard" },
  { id: "daily", label: "Practice" },
  { id: "lib", label: "Library" },
  { id: "songs", label: "Songs" },
  { id: "studio", label: "Studio" },
  { id: "learn", label: "Learning" },
  { id: "coach", label: "Coach" },
  { id: "log", label: "Report" },
  { id: "profile", label: "Profile" },
];

export default function Navbar({ view, onViewChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40">
      {/* Top bar — dark sleek header with logo */}
      <div className="px-3 sm:px-5 py-2 flex items-center justify-between bg-[#0d0d0d] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2 sm:gap-3">
          <Image src="/logo-dark.svg" alt="GuitarForge" width={120} height={44} className="h-[36px] sm:h-[44px]" style={{ width: 'auto' }} priority />
          <div className="flex items-center gap-1.5 mr-2">
            <div className="led led-on" />
          </div>
        </div>
      </div>

      {/* Navigation — flat scrollable strip for all screen sizes */}
      <nav className="flex px-2 sm:px-5 py-1.5 items-center gap-0.5 bg-[#111] border-b border-[#222] overflow-x-auto scrollbar-hide" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        {ALL_NAV.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`font-label text-[11px] sm:text-[13px] px-3 sm:px-4 py-1.5 rounded-sm cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
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
