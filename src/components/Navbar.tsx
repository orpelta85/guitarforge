"use client";

import { useState, useRef, useEffect } from "react";

type View = "dash" | "daily" | "lib" | "learn" | "studio" | "log" | "profile" | "coach";

interface NavbarProps {
  view: View;
  onViewChange: (view: View) => void;
}

const MAIN_NAV: { id: View; label: string }[] = [
  { id: "dash", label: "Dashboard" },
  { id: "daily", label: "Practice" },
  { id: "lib", label: "Library" },
  { id: "studio", label: "Studio" },
];

const MORE_NAV: { id: View; label: string }[] = [
  { id: "learn", label: "Learning" },
  { id: "coach", label: "Coach" },
  { id: "log", label: "Report" },
  { id: "profile", label: "Profile" },
];

const MORE_IDS = new Set<View>(MORE_NAV.map((n) => n.id));

export default function Navbar({ view, onViewChange }: NavbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isMoreActive = MORE_IDS.has(view);
  const moreLabel = isMoreActive ? MORE_NAV.find((n) => n.id === view)?.label || "More..." : "More...";

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
        {MAIN_NAV.map(({ id, label }) => (
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

        {/* More dropdown */}
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`font-label text-[13px] px-4 py-1.5 rounded-sm cursor-pointer transition-all whitespace-nowrap flex items-center gap-1 ${
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
            <div className="absolute top-full left-0 z-50 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[160px]">
              {MORE_NAV.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => { onViewChange(id); setMoreOpen(false); }}
                  className={`w-full text-left font-label text-[12px] px-4 py-2 cursor-pointer transition-colors ${
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
  );
}

export type { View };
