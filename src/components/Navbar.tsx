"use client";

import Image from "next/image";
import { useState } from "react";

type View = "dash" | "daily" | "lib" | "songs" | "learn" | "studio" | "jam" | "log" | "profile" | "coach" | "skills";

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
  { id: "jam", label: "Jam" },
  { id: "learn", label: "Learning" },
  { id: "coach", label: "Coach" },
  { id: "skills", label: "Skills" },
  { id: "log", label: "Report" },
  { id: "profile", label: "Profile" },
];

// Bottom tab bar items for mobile (5 items)
const MOBILE_TABS: { id: View; label: string; icon: string }[] = [
  { id: "daily", label: "Practice", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "lib", label: "Library", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "songs", label: "Songs", icon: "M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 19V5l12-4v14m0 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "studio", label: "Studio", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-4h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
];

const MORE_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: "dash", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { id: "learn", label: "Learning", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0v6m-3-3l3 3 3-3" },
  { id: "coach", label: "Coach", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { id: "jam", label: "Jam Mode", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM15 10l-3 3m0-3l3 3" },
  { id: "skills", label: "Skill Tree", icon: "M12 3v2m0 14v2m-7-7H3m18 0h-2M7.05 7.05L5.636 5.636m12.728 12.728L16.95 16.95M7.05 16.95l-1.414 1.414M18.364 5.636L16.95 7.05M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { id: "log", label: "Report", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

export default function Navbar({ view, onViewChange }: NavbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isMobileTabActive = MOBILE_TABS.some(t => t.id === view);
  const isMoreActive = !isMobileTabActive;

  return (
    <>
      <header className="sticky top-0 z-40">
        {/* Top bar — amp control panel header */}
        <div className="navbar-top px-3 sm:px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Image src="/logo-dark.svg" alt="GuitarForge" width={120} height={44} className="h-[36px] sm:h-[44px] logo-glow" style={{ width: 'auto', height: 'auto' }} priority />
            <div className="flex items-center gap-1.5 ml-2">
              <div className="led led-on" />
            </div>
          </div>
        </div>

        {/* Desktop navigation — channel selector strip (hidden on mobile) */}
        <nav className="navbar-nav hidden sm:flex px-2 sm:px-5 py-1.5 items-center gap-0.5 overflow-x-auto scrollbar-hide" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center gap-0.5 max-w-[1200px] mx-auto w-full">
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
          </div>
        </nav>

        {/* Gold accent line */}
        <div className="navbar-accent-line" />
      </header>

      {/* Mobile bottom tab bar (visible only on < sm) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex sm:hidden mobile-tab-bar">
        {MOBILE_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => { onViewChange(id); setMoreOpen(false); }}
            className={`mobile-tab-item ${view === id ? "mobile-tab-item--active" : ""}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={icon} />
            </svg>
            <span>{label}</span>
          </button>
        ))}
        {/* More button */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`mobile-tab-item ${isMoreActive ? "mobile-tab-item--active" : ""}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
            <circle cx="5" cy="5" r="1.5" />
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="19" cy="5" r="1.5" />
            <circle cx="5" cy="19" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
            <circle cx="19" cy="19" r="1.5" />
          </svg>
          <span>More</span>
        </button>
      </nav>

      {/* More overlay (mobile only) */}
      {moreOpen && (
        <div className="fixed inset-0 z-[49] flex sm:hidden flex-col justify-end" onClick={() => setMoreOpen(false)}>
          <div className="bg-black/70 absolute inset-0" />
          <div className="relative mb-[56px] mx-2 rounded-md overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-panel)' }} onClick={e => e.stopPropagation()}>
            {MORE_ITEMS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => { onViewChange(id); setMoreOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${view === id ? "text-[#D4A843] bg-[rgba(212,168,67,0.08)]" : "text-[#9a9590] hover:text-[#e8e4dc] hover:bg-[rgba(255,255,255,0.03)]"}`}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
                <span className="font-label text-[12px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </>
  );
}

export type { View };
