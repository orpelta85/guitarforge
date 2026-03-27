"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "./AuthProvider";

type View = "dash" | "daily" | "lib" | "songs" | "learn" | "studio" | "jam" | "log" | "profile" | "coach" | "skills";

interface NavbarProps {
  view: View;
  onViewChange: (view: View) => void;
  onShowAuth?: () => void;
  lastSynced?: Date | null;
  syncing?: boolean;
}

// ── SVG Icon components (inline, Lucide/Feather style) ──

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
    </svg>
  );
}

function IconPractice() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-3v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="15" r="3" />
    </svg>
  );
}

function IconLearn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

function IconStudio() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="13" y2="11" />
    </svg>
  );
}

function IconCoach() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconSuno() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h2l2-5 3 10 3-7 2 4h2" />
      <path d="M18 12h2" />
      <circle cx="22" cy="12" r="1" />
    </svg>
  );
}

function IconSkills() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconJam() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h2l2-5 3 10 3-7 2 4h2" />
      <path d="M18 12h2" />
      <circle cx="22" cy="12" r="1" />
    </svg>
  );
}

function IconTuner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}

// ── Navigation data ──

interface NavItem {
  id: View | "suno";
  label: string;
  icon: () => React.JSX.Element;
}

const MAIN_NAV: NavItem[] = [
  { id: "dash", label: "Home", icon: IconHome },
  { id: "daily", label: "Practice", icon: IconPractice },
  { id: "learn", label: "Learn", icon: IconLearn },
  { id: "studio", label: "Studio", icon: IconStudio },
  { id: "jam", label: "Jam Mode", icon: IconJam },
  { id: "lib", label: "Library", icon: IconLibrary },
];

const TOOLS_NAV: NavItem[] = [
  { id: "coach", label: "AI Coach", icon: IconCoach },
  { id: "suno", label: "Suno AI", icon: IconSuno },
  { id: "skills", label: "Skills", icon: IconSkills },
];

const MOBILE_TABS: NavItem[] = [
  { id: "dash", label: "Home", icon: IconHome },
  { id: "daily", label: "Practice", icon: IconPractice },
  { id: "learn", label: "Learn", icon: IconLearn },
  { id: "studio", label: "Studio", icon: IconStudio },
  { id: "lib", label: "Library", icon: IconLibrary },
];

const MORE_DRAWER_ITEMS: NavItem[] = [
  { id: "coach", label: "AI Coach", icon: IconCoach },
  { id: "skills", label: "Skill Tree", icon: IconSkills },
  { id: "jam", label: "Jam Mode", icon: IconJam },
  { id: "daily", label: "Tuner", icon: IconTuner },
  { id: "suno", label: "Suno AI", icon: IconSuno },
];

export default function Navbar({ view, onViewChange, onShowAuth, lastSynced, syncing }: NavbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleNav = (id: View | "suno") => {
    if (id === "suno") {
      // Navigate to studio and trigger suno panel
      onViewChange("studio");
    } else {
      onViewChange(id);
    }
  };

  const isActive = (id: View | "suno") => {
    if (id === "suno") return false;
    return view === id;
  };

  return (
    <>
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="sidebar hidden md:flex flex-col h-screen w-[220px] flex-shrink-0 sticky top-0">
        {/* Logo + Profile (Suno-style top section) */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex justify-center">
            <Image src="/logo.png" alt="Guitar Practice" width={110} height={70} className="object-contain logo-blend" priority />
          </div>
        </div>

        <div className="mx-4 border-t" style={{ borderColor: "var(--border-panel)" }} />

        {/* Main section */}
        <nav className="flex-1 px-3 pt-3 flex flex-col gap-0.5">
          <div className="sidebar-section-label">Main</div>
          {MAIN_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`sidebar-item ${isActive(id) ? "sidebar-item--active" : ""}`}
              aria-label={label}
              aria-current={isActive(id) ? "page" : undefined}
            >
              <span className="sidebar-item-icon"><Icon /></span>
              <span>{label}</span>
            </button>
          ))}

          <div className="sidebar-section-label mt-5">Tools</div>
          {TOOLS_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`sidebar-item ${isActive(id) ? "sidebar-item--active" : ""}`}
              aria-label={label}
              aria-current={isActive(id) ? "page" : undefined}
            >
              <span className="sidebar-item-icon"><Icon /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Profile */}
        <div className="px-3 pb-1">
          <div className="mx-1 border-t mb-2" style={{ borderColor: "var(--border-panel)" }} />
          <button
            type="button"
            onClick={() => onViewChange("profile")}
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg transition-colors hover:bg-white/5"
          >
            {user ? (
              <>
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #D4A843, #a07c2e)" }}>
                    <span className="text-[11px] font-bold text-black">{(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}</span>
                  </div>
                )}
                <div className="flex flex-col items-start overflow-hidden min-w-0 flex-1">
                  <span className="text-[13px] font-medium truncate w-full" style={{ color: "#e0e0e0" }}>
                    {user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
                  </span>
                  {syncing ? (
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Syncing...</span>
                  ) : lastSynced ? (
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />Synced</span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{user.email}</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <IconProfile />
                </div>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-[13px] font-medium" style={{ color: "#e0e0e0" }}>Guest</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Sign in to sync</span>
                </div>
              </>
            )}
          </button>
        </div>

        {/* Bottom actions */}
        <div className="px-4 py-3">
          {user ? (
            <button
              onClick={() => logout()}
              className="text-[11px] px-2 py-1.5 rounded-md transition-colors text-left w-full"
              style={{ color: "#666" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={e => (e.currentTarget.style.color = "#666")}
              aria-label="Sign out"
            >
              Sign Out
            </button>
          ) : onShowAuth ? (
            <button
              onClick={onShowAuth}
              className="text-[11px] px-2 py-1.5 rounded-md transition-colors text-left w-full"
              style={{ color: "#D4A843" }}
            >
              Sign in to sync
            </button>
          ) : null}
        </div>
      </aside>

      {/* ═══ Mobile Bottom Tab Bar ═══ */}
      <nav className="mobile-tab-bar fixed bottom-0 left-0 right-0 z-50 flex md:hidden">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => { handleNav(id); setMoreOpen(false); }}
            className={`mobile-tab-item ${isActive(id) ? "mobile-tab-item--active" : ""}`}
            aria-label={label}
            aria-current={isActive(id) ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`mobile-tab-item ${moreOpen || ["coach", "skills", "jam"].includes(view) ? "mobile-tab-item--active" : ""}`}
          aria-label="More navigation options"
          aria-expanded={moreOpen}
        >
          <IconMore />
          <span>More</span>
        </button>
      </nav>

      {/* ═══ Mobile "More" Drawer ═══ */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-[56px] left-0 right-0 rounded-t-xl overflow-hidden"
            style={{ background: "var(--bg-panel)", borderTop: "1px solid var(--border-panel)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 flex flex-col gap-1">
              {MORE_DRAWER_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => { handleNav(id); setMoreOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left min-h-[44px]"
                  style={{
                    background: isActive(id) ? "rgba(212,168,67,0.1)" : "transparent",
                    color: isActive(id) ? "var(--gold)" : "var(--text-secondary)",
                  }}
                  aria-label={label}
                  aria-current={isActive(id) ? "page" : undefined}
                >
                  <Icon />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export type { View };
