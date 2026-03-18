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
      {/* Top bar — amp control panel header */}
      <div className="navbar-top px-3 sm:px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Image src="/logo-dark.svg" alt="GuitarForge" width={120} height={44} className="h-[36px] sm:h-[44px] logo-glow" style={{ width: 'auto' }} priority />
          <div className="flex items-center gap-1.5 ml-2">
            <div className="led led-on" />
          </div>
        </div>
      </div>

      {/* Navigation — channel selector strip */}
      <nav className="navbar-nav flex px-2 sm:px-5 py-1.5 items-center gap-0.5 overflow-x-auto scrollbar-hide" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
        {ALL_NAV.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`nav-btn text-[11px] sm:text-[13px] ${
              view === id
                ? "nav-btn--active"
                : "nav-btn--inactive"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Gold accent line */}
      <div className="navbar-accent-line" />
    </header>
  );
}

export type { View };
