"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

type View = "dash" | "daily" | "lib" | "learn" | "studio" | "log" | "profile" | "coach";

interface NavbarProps {
  view: View;
  onViewChange: (view: View) => void;
}

const MAIN_NAV: { id: View; label: string; icon: string }[] = [
  { id: "dash", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0v-6a1 1 0 011-1h2a1 1 0 011 1v6m-6 0h6" },
  { id: "daily", label: "Practice", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "lib", label: "Library", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "studio", label: "Studio", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-4h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
];

const MORE_NAV: { id: View; label: string; icon: string }[] = [
  { id: "learn", label: "Learning", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" },
  { id: "coach", label: "Coach", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { id: "log", label: "Report", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

const MORE_IDS = new Set<View>(MORE_NAV.map((n) => n.id));

// Bottom tab bar items (mobile): 5 tabs — Dashboard, Practice, Library, Studio, More
const BOTTOM_TABS: { id: View | "more"; label: string; icon: string }[] = [
  { id: "dash", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0v-6a1 1 0 011-1h2a1 1 0 011 1v6m-6 0h6" },
  { id: "daily", label: "Practice", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "lib", label: "Library", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "studio", label: "Studio", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-4h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  { id: "more", label: "More", icon: "M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" },
];

export default function Navbar({ view, onViewChange }: NavbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) closeMore();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [closeMore]);

  const isMoreActive = MORE_IDS.has(view);
  const moreLabel = isMoreActive ? MORE_NAV.find((n) => n.id === view)?.label || "More..." : "More...";

  const handleNav = (id: View) => {
    onViewChange(id);
    setMoreOpen(false);
    setMobileMoreOpen(false);
  };

  // Check if current view is one of the 4 main bottom tabs
  const isBottomMainTab = (v: View) => ["dash", "daily", "lib", "studio"].includes(v);

  return (
    <>
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

        {/* Navigation — desktop strip (hidden on mobile) */}
        <nav className="hidden sm:flex px-5 py-1.5 items-center gap-0.5 bg-[#111] border-b border-[#222]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {MAIN_NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`font-label text-[13px] px-4 py-1.5 rounded-sm cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
                view === id
                  ? "bg-[#D4A843] text-[#0A0A0A]"
                  : "text-[#777] hover:text-[#ccc]"
              }`}
              style={view === id ? { boxShadow: '0 0 10px rgba(212,168,67,0.3)' } : undefined}
            >
              {label}
            </button>
          ))}

          {/* More dropdown — desktop */}
          <div ref={moreRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); }}
              className={`font-label text-[13px] px-4 py-1.5 rounded-sm cursor-pointer transition-all whitespace-nowrap flex items-center gap-1 flex-shrink-0 ${
                isMoreActive
                  ? "bg-[#D4A843] text-[#0A0A0A]"
                  : "text-[#777] hover:text-[#ccc]"
              }`}
              style={isMoreActive ? { boxShadow: '0 0 10px rgba(212,168,67,0.3)' } : undefined}
            >
              {moreLabel}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {moreOpen && (
              <div className="absolute top-full right-0 z-50 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[160px]">
                {MORE_NAV.map(({ id, label }) => (
                  <button
                    key={id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleNav(id)}
                    className={`w-full text-right font-label text-[12px] px-4 py-2.5 cursor-pointer transition-colors ${
                      view === id
                        ? "text-[#f59e0b] bg-[#f59e0b11]"
                        : "text-[#999] hover:text-[#ccc] hover:bg-[#222]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* ══ MOBILE BOTTOM TAB BAR ══ (Task 1) */}
      <nav className="sm:hidden bottom-tab-bar" aria-label="Mobile navigation">
        {BOTTOM_TABS.map(({ id, label, icon }) => {
          const isActive = id === "more"
            ? isMoreActive
            : view === id;
          return (
            <button
              key={id}
              onClick={() => {
                if (id === "more") {
                  setMobileMoreOpen(!mobileMoreOpen);
                } else {
                  handleNav(id as View);
                  setMobileMoreOpen(false);
                }
              }}
              className={`bottom-tab-item ${isActive ? "active" : ""}`}
              aria-label={label}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon}/>
              </svg>
              <span className="tab-label">{label}</span>
              {/* Active indicator dot */}
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-[#D4A843]" style={{ boxShadow: '0 0 4px rgba(212,168,67,0.6)' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile "More" sheet overlay */}
      {mobileMoreOpen && (
        <>
          <div className="sm:hidden more-sheet-overlay" onClick={() => setMobileMoreOpen(false)} />
          <div className="sm:hidden more-sheet animate-fade-in">
            <div className="grid grid-cols-2 gap-2">
              {MORE_NAV.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-lg cursor-pointer transition-all ${
                    view === id
                      ? "bg-[#D4A843]/12 text-[#D4A843] border border-[#D4A843]/25"
                      : "text-[#888] hover:text-[#ccc] hover:bg-[#222] border border-transparent"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d={icon}/>
                  </svg>
                  <span className="font-label text-[12px]">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export type { View };
