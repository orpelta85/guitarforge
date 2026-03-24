"use client";
import { useState, useEffect, useRef } from "react";
import type { SongEntry, Exercise } from "@/lib/types";
import { EXERCISES } from "@/lib/exercises";
import { ytSearch } from "@/lib/helpers";
import { useFocusTrap } from "./ExerciseModal";
import StemSeparator from "./StemSeparator";
import dynamic from "next/dynamic";
const GpFileUploader = dynamic(() => import("./GpFileUploader"), {
  ssr: false,
  loading: () => <div className="panel p-4 text-center font-label text-sm text-[var(--text-muted)]">Loading viewer...</div>
});

interface Props {
  song: SongEntry;
  onClose: () => void;
  targetMinutes?: number;
  mySongs?: number[];
  onToggleMySong?: (id: number) => void;
}

type Tab = "practice" | "tutorial" | "log";

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "#22c55e",
  Intermediate: "#D4A843",
  Advanced: "#ef4444",
};

const PROGRESS_OPTIONS = [
  { value: "not-started", label: "Not Started" },
  { value: "learning", label: "Learning" },
  { value: "slow", label: "Can Play Slow" },
  { value: "full-speed", label: "Full Speed" },
  { value: "mastered", label: "Mastered" },
];

export default function SongModal({ song, onClose, targetMinutes, mySongs, onToggleMySong }: Props) {
  const [tab, setTab] = useState<Tab>("practice");

  // Practice timer
  const [timerSec, setTimerSec] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setTimeout(() => setTimerSec(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timerActive, timerSec]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const targetSec = (targetMinutes || 0) * 60;
  const timerMm = String(Math.floor(timerSec / 60)).padStart(2, "0");
  const timerSs = String(timerSec % 60).padStart(2, "0");
  const timerOver = targetSec > 0 && timerSec >= targetSec;

  // Backing track auto-search
  const [btVideoId, setBtVideoId] = useState("");
  const [btLoading, setBtLoading] = useState(false);
  const [btSearched, setBtSearched] = useState(false);
  const [btUrl, setBtUrl] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [origVideoId, setOrigVideoId] = useState("");
  const [origLoading, setOrigLoading] = useState(false);
  const [origSearched, setOrigSearched] = useState(false);
  const [origUrl, setOrigUrl] = useState("");

  // Tutorial state
  const [tutorialVideoId, setTutorialVideoId] = useState("");
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const [tutorialSearched, setTutorialSearched] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  // Notes state — loaded from localStorage
  const lsKey = `gf-song-notes-${song.id}`;
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [progress, setProgress] = useState("not-started");

  // Practice history
  type Session = { date: string; duration: number };
  const histKey = `gf-song-history-${song.id}`;
  const [sessions, setSessions] = useState<Session[]>([]);

  // Linked exercises
  const linkedKey = `gf-song-linked-${song.id}`;
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  const [exSearch, setExSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.notes) setNotes(d.notes);
        if (d.rating) setRating(d.rating);
        if (d.progress) setProgress(d.progress);
      }
    } catch {}
    try {
      const h = localStorage.getItem(histKey);
      if (h) setSessions(JSON.parse(h));
    } catch {}
    try {
      const l = localStorage.getItem(linkedKey);
      if (l) setLinkedIds(JSON.parse(l));
    } catch {}
  }, [lsKey, histKey, linkedKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(lsKey, JSON.stringify({ notes, rating, progress }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, rating, progress, lsKey]);

  // Auto-fetch original video on mount
  useEffect(() => {
    if (origSearched || origVideoId) return;
    setOrigLoading(true);
    setOrigSearched(true);
    const q = `${song.title} ${song.artist} official video`;
    fetch(`/api/youtube?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        const id = data.results?.[0] || data.items?.[0]?.videoId;
        if (id) setOrigVideoId(id);
      })
      .catch(() => {})
      .finally(() => setOrigLoading(false));
  }, [origSearched, origVideoId, song.title, song.artist]);

  // Fetch backing track lazily when user switches to it
  useEffect(() => {
    if (showOriginal || btSearched || btVideoId) return;
    setBtLoading(true);
    setBtSearched(true);
    const q = `${song.title} ${song.artist} backing track guitar`;
    fetch(`/api/youtube?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        const id = data.results?.[0] || data.items?.[0]?.videoId;
        if (id) setBtVideoId(id);
      })
      .catch(() => {})
      .finally(() => setBtLoading(false));
  }, [showOriginal, btSearched, btVideoId, song.title, song.artist]);

  // Auto-fetch tutorial
  useEffect(() => {
    if (tab !== "tutorial" || tutorialSearched || tutorialVideoId) return;
    setTutorialLoading(true);
    setTutorialSearched(true);
    const q = `how to play ${song.title} ${song.artist} guitar tutorial`;
    fetch(`/api/youtube?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        if (data.items?.[0]?.videoId) setTutorialVideoId(data.items[0].videoId);
      })
      .catch(() => {})
      .finally(() => setTutorialLoading(false));
  }, [tab, tutorialSearched, tutorialVideoId, song.title, song.artist]);

  function saveSession(sec: number) {
    if (sec < 5) return;
    try {
      const raw = localStorage.getItem(histKey);
      const existing: Session[] = raw ? JSON.parse(raw) : [];
      const updated = [{ date: new Date().toISOString(), duration: sec }, ...existing].slice(0, 20);
      localStorage.setItem(histKey, JSON.stringify(updated));
      setSessions(updated);
    } catch {}
  }

  function toggleLinkedEx(id: number) {
    const updated = linkedIds.includes(id) ? linkedIds.filter(x => x !== id) : [...linkedIds, id];
    setLinkedIds(updated);
    try { localStorage.setItem(linkedKey, JSON.stringify(updated)); } catch {}
  }

  function loadManualUrl() {
    const m = manualUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (m) setTutorialVideoId(m[1]);
  }

  function parseYtUrl(val: string): string | null {
    const m = val.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  const ytQuery = `how to play ${song.title} ${song.artist} guitar tutorial`;
  const dc = song.difficulty ? DIFFICULTY_COLORS[song.difficulty] || "#888" : "#888";
  const hasGp = song.gp || !!song.gpFileName || !!song.gpPath;
  const gpStorageUrl = song.gpPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gp-tabs/${song.gpPath}`
    : undefined;

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="exercise-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Song: ${song.title} by ${song.artist}`}>
      <div className="exercise-modal-content flex flex-col" ref={modalRef}>

        {/* DARK HEADER */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 modal-dark-header flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="font-heading text-2xl text-[var(--text-primary)] leading-tight">{song.title}</div>
              <div className="font-label text-[14px] text-[var(--text-secondary)] mt-0.5">{song.artist}</div>
              {song.album && <div className="font-readout text-[11px] text-[var(--text-muted)] mt-0.5">{song.album}{song.year ? ` · ${song.year}` : ""}</div>}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {song.genre && <span className="font-readout text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-secondary)] border border-white/[0.08]">{song.genre}</span>}
                {song.difficulty && <span className="font-readout text-[10px] px-2 py-0.5 rounded-full border" style={{ background: dc + "18", color: dc, borderColor: dc + "50" }}>{song.difficulty}</span>}
                {song.key && <span className="font-readout text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-secondary)] border border-white/[0.08]">♩ {song.key}</span>}
                {song.tempo && <span className="font-readout text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-secondary)] border border-white/[0.08]">{song.tempo} BPM</span>}
                {song.tuning && song.tuning !== "Standard" && (
                  <span className="font-readout text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40 font-semibold">⚠ {song.tuning}</span>
                )}
                {hasGp && <span className="font-readout text-[10px] px-1.5 py-0.5 rounded border border-[var(--gold)]/40 text-[var(--gold)]">GP</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onToggleMySong && (
                <button type="button" onClick={() => onToggleMySong(song.id)}
                  className={`w-9 h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center cursor-pointer transition-all border ${
                    mySongs?.includes(song.id)
                      ? "bg-red-500/20 border-red-500/40 text-red-400"
                      : "bg-[var(--bg-elevated)] border-[var(--border-accent)] text-zinc-500 hover:text-red-400 hover:border-red-500/40"
                  }`}
                  aria-label={mySongs?.includes(song.id) ? "Remove from My Songs" : "Add to My Songs"}
                  title={mySongs?.includes(song.id) ? "Remove from My Songs" : "Add to My Songs"}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={mySongs?.includes(song.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              )}
              <button type="button" onClick={onClose}
                className="w-9 h-9 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--text-secondary)] text-lg cursor-pointer hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Close">
                ×
              </button>
            </div>
          </div>

          {/* Progress bar + Timer row */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap flex-1">
              {PROGRESS_OPTIONS.map(opt => (
                <button type="button" key={opt.value} onClick={() => setProgress(opt.value)}
                  className={`font-label text-[10px] px-2.5 py-1 min-h-[44px] rounded cursor-pointer border transition-all ${
                    progress === opt.value
                      ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]"
                      : "border-[var(--border-panel)] text-[var(--text-muted)]"
                  }`}>{opt.label}</button>
              ))}
            </div>

            {/* Practice timer */}
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 flex-shrink-0">
              <button type="button" onClick={() => { if (timerActive) saveSession(timerSec); setTimerActive(a => !a); }}
                className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all ${timerActive ? "bg-green-500/20 text-green-400" : timerOver ? "bg-amber-500/20 text-amber-400" : "bg-white/[0.06] text-zinc-400 hover:text-zinc-200"}`}
                title={timerActive ? "Pause" : "Start practice timer"}>
                {timerActive
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>}
              </button>
              <span className={`font-readout text-[13px] tabular-nums ${timerActive ? "text-green-400" : timerOver ? "text-amber-400" : "text-zinc-400"}`}>
                {timerMm}:{timerSs}
              </span>
              {targetSec > 0 && (
                <span className="font-label text-[10px] text-zinc-600">
                  / {targetMinutes}m
                </span>
              )}
              {timerSec > 0 && !timerActive && (
                <button type="button" onClick={() => { setTimerSec(0); setTimerActive(false); }}
                  className="font-label text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-recess)] flex-shrink-0">
          {([
            { id: "practice" as Tab, label: "Practice" },
            { id: "tutorial" as Tab, label: "Tutorial" },
            { id: "log" as Tab, label: "Log" },
          ]).map(({ id, label }) => (
            <button type="button" key={id} onClick={() => setTab(id)}
              className={`flex-1 py-3 min-h-[44px] font-label text-[12px] cursor-pointer border-b-2 transition-all ${
                tab === id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--text-muted)]"
              }`}>{label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">

          {/* Practice Tab */}
          {tab === "practice" && (
            <div>
              {/* Tuning Alert */}
              {song.tuning && song.tuning !== "Standard" && (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3 mb-4">
                  <span className="text-amber-400 text-lg flex-shrink-0">⚠</span>
                  <div>
                    <span className="font-label text-[13px] text-amber-300 font-semibold">Non-Standard Tuning: {song.tuning}</span>
                    <span className="font-label text-[11px] text-amber-500/80 ml-2">— tune your guitar before playing</span>
                  </div>
                </div>
              )}

              {/* YouTube Backing Track — auto-searched */}
              <div className="mb-6">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> BACKING TRACK
                </div>

                {(showOriginal ? origLoading : btLoading) && (
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-6 text-center font-label text-[12px] text-[var(--text-muted)] mb-3">
                    {showOriginal ? "Searching for original video..." : "Searching for backing track..."}
                  </div>
                )}

                {/* Toggle: Backing vs Original */}
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setShowOriginal(false)}
                    className={`font-label text-[11px] px-3 py-1.5 rounded cursor-pointer border transition-all ${!showOriginal ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]" : "border-[var(--border-panel)] text-[var(--text-muted)]"}`}>
                    Backing Track
                  </button>
                  <button type="button" onClick={() => setShowOriginal(true)}
                    className={`font-label text-[11px] px-3 py-1.5 rounded cursor-pointer border transition-all ${showOriginal ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]" : "border-[var(--border-panel)] text-[var(--text-muted)]"}`}>
                    Original
                  </button>
                </div>

                {/* Video embed */}
                {!showOriginal && btVideoId && (
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-3">
                    <iframe src={`https://www.youtube.com/embed/${btVideoId}?modestbranding=1&rel=0`}
                      className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Backing Track" />
                  </div>
                )}
                {showOriginal && origVideoId && (
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-3">
                    <iframe src={`https://www.youtube.com/embed/${origVideoId}?modestbranding=1&rel=0`}
                      className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Original" />
                  </div>
                )}


                {/* Paste URL to embed */}
                <div className="flex gap-2 mt-3">
                  {!showOriginal ? (
                    <>
                      <input value={btUrl} onChange={e => setBtUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { const id = parseYtUrl(btUrl); if (id) setBtVideoId(id); } }}
                        placeholder="Paste YouTube URL..." className="input flex-1 !text-[12px]" />
                      <button type="button" onClick={() => { const id = parseYtUrl(btUrl); if (id) setBtVideoId(id); }} className="btn-gold !text-[11px]">Load</button>
                    </>
                  ) : (
                    <>
                      <input value={origUrl} onChange={e => setOrigUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { const id = parseYtUrl(origUrl); if (id) setOrigVideoId(id); } }}
                        placeholder="Paste YouTube URL..." className="input flex-1 !text-[12px]" />
                      <button type="button" onClick={() => { const id = parseYtUrl(origUrl); if (id) setOrigVideoId(id); }} className="btn-gold !text-[11px]">Load</button>
                    </>
                  )}
                </div>

                {/* Quick search */}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="font-label text-[10px] text-[var(--text-muted)]">Open in YouTube:</span>
                  <button type="button" onClick={() => window.open(ytSearch(`${song.title} ${song.artist} backing track guitar`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1">Backing Track</button>
                  <button type="button" onClick={() => window.open(ytSearch(`${song.title} ${song.artist} original`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1">Original</button>
                  <button type="button" onClick={() => window.open(ytSearch(`${song.title} ${song.artist} live`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1">Live</button>
                </div>

                {/* Stem Separation */}
                {btVideoId && (
                  <StemSeparator
                    audioUrl={`https://www.youtube.com/watch?v=${btVideoId}`}
                    cacheKey={`song-stems-${song.id}`}
                  />
                )}
              </div>

              {/* GP file uploader */}
              <div className="mb-6">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> GUITAR PRO TAB
                </div>
                <GpFileUploader exerciseId={`song-${song.id}`} songName={song.title} gpUrl={gpStorageUrl} />
                <div className="flex gap-1.5 flex-wrap mt-2">
                  <button type="button" onClick={async () => {
                    try {
                      const r = await fetch(`/api/gptabs?q=${encodeURIComponent(song.title)}`);
                      const data = await r.json();
                      if (data.length > 0) window.open(data[0].downloadUrl, "_blank");
                      else window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(song.title)}&in=songs&page=1`, "_blank");
                    } catch { window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(song.title)}&in=songs&page=1`, "_blank"); }
                  }} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Download tabs</button>
                  {song.songsterrUrl ? (
                    <a href={song.songsterrUrl} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost no-underline !text-[10px] !px-2.5 !py-1.5">Open in Songsterr</a>
                  ) : (
                    <a href={`https://www.songsterr.com/?pattern=${encodeURIComponent(song.title + " " + song.artist)}`} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost no-underline !text-[10px] !px-2.5 !py-1.5">Search Songsterr</a>
                  )}
                </div>
              </div>

              {/* Song details */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> SONG INFO
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  {song.artist && <div><span className="text-[var(--text-muted)]">Artist: </span><span className="text-[var(--text-secondary)]">{song.artist}</span></div>}
                  {song.album && <div><span className="text-[var(--text-muted)]">Album: </span><span className="text-[var(--text-secondary)]">{song.album}</span></div>}
                  {song.year && <div><span className="text-[var(--text-muted)]">Year: </span><span className="text-[var(--text-secondary)]">{song.year}</span></div>}
                  {song.genre && <div><span className="text-[var(--text-muted)]">Genre: </span><span className="text-[var(--text-secondary)]">{song.genre}</span></div>}
                  {song.tempo && <div><span className="text-[var(--text-muted)]">Tempo: </span><span className="text-[var(--text-secondary)]">{song.tempo} BPM</span></div>}
                  {song.key && <div><span className="text-[var(--text-muted)]">Key: </span><span className="text-[var(--text-secondary)]">{song.key}</span></div>}
                  {song.tuning && <div><span className="text-[var(--text-muted)]">Tuning: </span><span className="text-[var(--text-secondary)]">{song.tuning}</span></div>}
                  {song.difficulty && <div><span className="text-[var(--text-muted)]">Difficulty: </span><span style={{ color: dc }}>{song.difficulty}</span></div>}
                </div>
              </div>
            </div>
          )}

          {/* Tutorial Tab */}
          {tab === "tutorial" && (
            <div>
              <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                <div className="led led-gold" /> Tutorial — {song.title}
              </div>

              {tutorialLoading && (
                <div className="bg-[var(--bg-secondary)] rounded-lg p-6 text-center font-label text-[12px] text-[var(--text-muted)] mb-3">Searching YouTube for tutorial...</div>
              )}

              {tutorialVideoId && (
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-3">
                  <iframe src={`https://www.youtube.com/embed/${tutorialVideoId}?modestbranding=1&rel=0`}
                    className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Tutorial" />
                </div>
              )}

              {!tutorialVideoId && !tutorialLoading && (
                <div className="bg-[var(--bg-recess)] border border-dashed border-[var(--border-panel)] rounded-lg p-6 mb-3 text-center">
                  <div className="font-label text-[12px] text-[var(--text-muted)]">Paste a YouTube URL below</div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input value={manualUrl} onChange={e => setManualUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadManualUrl()}
                  placeholder="Paste YouTube URL..."
                  className="input flex-1 !text-[12px]" />
                <button type="button" onClick={loadManualUrl} className="btn-gold !text-[11px]">Load</button>
              </div>

              <button type="button" onClick={() => window.open(ytSearch(ytQuery), "_blank")}
                className="btn-ghost w-full justify-center !text-[11px]">
                Search more tutorials on YouTube
              </button>

              {/* Linked Exercises */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mt-4">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> LINKED EXERCISES
                </div>
                {linkedIds.length > 0 && (
                  <div className="flex flex-col gap-1 mb-3">
                    {linkedIds.map(id => {
                      const ex = EXERCISES.find((e: Exercise) => e.id === id);
                      if (!ex) return null;
                      return (
                        <div key={id} className="flex items-center justify-between bg-[var(--bg-recess)] rounded px-3 py-2">
                          <div>
                            <span className="font-label text-[11px] text-[var(--text-primary)]">{ex.n}</span>
                            <span className="font-readout text-[10px] text-[var(--text-muted)] ml-2">{ex.c} · {ex.m}m</span>
                          </div>
                          <button type="button" onClick={() => toggleLinkedEx(id)}
                            className="text-zinc-600 hover:text-red-400 transition-colors font-label text-[11px] cursor-pointer">×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={exSearch} onChange={e => setExSearch(e.target.value)}
                    placeholder="Search exercises to link..."
                    className="input flex-1 !text-[11px]" />
                </div>
                {exSearch.trim() && (
                  <div className="mt-2 max-h-40 overflow-y-auto flex flex-col gap-1">
                    {EXERCISES.filter((e: Exercise) =>
                      (e.n.toLowerCase().includes(exSearch.toLowerCase()) || e.c.toLowerCase().includes(exSearch.toLowerCase())) &&
                      !linkedIds.includes(e.id)
                    ).slice(0, 8).map((e: Exercise) => (
                      <button type="button" key={e.id} onClick={() => { toggleLinkedEx(e.id); setExSearch(""); }}
                        className="flex items-center justify-between bg-[var(--bg-recess)] hover:bg-white/[0.05] rounded px-3 py-2 text-left transition-colors cursor-pointer">
                        <span className="font-label text-[11px] text-[var(--text-primary)]">{e.n}</span>
                        <span className="font-readout text-[10px] text-[var(--text-muted)] ml-2 flex-shrink-0">{e.c}</span>
                      </button>
                    ))}
                    {EXERCISES.filter((e: Exercise) =>
                      (e.n.toLowerCase().includes(exSearch.toLowerCase()) || e.c.toLowerCase().includes(exSearch.toLowerCase())) &&
                      !linkedIds.includes(e.id)
                    ).length === 0 && (
                      <div className="font-label text-[11px] text-[var(--text-muted)] px-3 py-2">No exercises found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Log Tab */}
          {tab === "log" && (
            <div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-4">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> PRACTICE LOG
                </div>

                {/* Star rating */}
                <div className="mb-4">
                  <div className="font-label text-[11px] text-[var(--text-muted)] mb-1">Difficulty Rating</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button type="button" key={s} onClick={() => setRating(s === rating ? 0 : s)}
                        className={`text-xl cursor-pointer bg-transparent border-none transition-colors min-w-[44px] min-h-[44px] ${s <= rating ? "text-[var(--gold)]" : "text-[var(--border-panel)]"}`}
                        style={{ textShadow: s <= rating ? "0 0 6px rgba(212,168,67,0.4)" : "none" }}
                        aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress status */}
                <div className="mb-4">
                  <div className="font-label text-[11px] text-[var(--text-muted)] mb-1">Status</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {PROGRESS_OPTIONS.map(opt => (
                      <button type="button" key={opt.value} onClick={() => setProgress(opt.value)}
                        className={`font-label text-[10px] px-3 py-1.5 min-h-[44px] rounded cursor-pointer border transition-all ${
                          progress === opt.value
                            ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]"
                            : "border-[var(--border-panel)] text-[var(--text-muted)]"
                        }`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes textarea */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> PERSONAL NOTES
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Personal notes about this song..."
                  className="input w-full !h-32 resize-none" />
              </div>

              {/* Practice History */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mt-4">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="led led-gold" /> PRACTICE HISTORY
                  </div>
                  {sessions.length > 0 && (
                    <span className="font-readout text-[10px] text-[var(--text-muted)]">
                      Total: {Math.round(sessions.reduce((s, x) => s + x.duration, 0) / 60)}m across {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {sessions.length === 0 ? (
                  <div className="font-label text-[11px] text-[var(--text-muted)] text-center py-4">
                    No sessions recorded yet. Start the timer to track practice time.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {sessions.map((s, i) => {
                      const d = new Date(s.date);
                      const mm = String(Math.floor(s.duration / 60)).padStart(2, "0");
                      const ss = String(s.duration % 60).padStart(2, "0");
                      return (
                        <div key={i} className="flex items-center justify-between bg-[var(--bg-recess)] rounded px-3 py-2">
                          <span className="font-readout text-[11px] text-[var(--text-muted)]">
                            {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="font-readout text-[12px] text-[var(--text-primary)] tabular-nums">{mm}:{ss}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
