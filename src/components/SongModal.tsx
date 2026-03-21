"use client";
import { useState, useEffect, useRef } from "react";
import type { SongEntry } from "@/lib/types";
import { ytSearch } from "@/lib/helpers";
import { useFocusTrap } from "./ExerciseModal";
import dynamic from "next/dynamic";
const GpFileUploader = dynamic(() => import("./GpFileUploader"), {
  ssr: false,
  loading: () => <div className="panel p-4 text-center font-label text-sm text-[var(--text-muted)]">Loading viewer...</div>
});

interface Props {
  song: SongEntry;
  onClose: () => void;
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

export default function SongModal({ song, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("practice");

  // Backing track auto-search
  const [btVideoId, setBtVideoId] = useState("");
  const [btLoading, setBtLoading] = useState(false);
  const [btSearched, setBtSearched] = useState(false);
  const [btUrl, setBtUrl] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [origVideoId, setOrigVideoId] = useState("");
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
  }, [lsKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(lsKey, JSON.stringify({ notes, rating, progress }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, rating, progress, lsKey]);

  // Auto-fetch backing track on mount
  useEffect(() => {
    if (btSearched || btVideoId) return;
    setBtLoading(true);
    setBtSearched(true);
    const q = `${song.title} ${song.artist} backing track guitar`;
    fetch(`/api/youtube?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        if (data.items?.[0]?.videoId) setBtVideoId(data.items[0].videoId);
      })
      .catch(() => {})
      .finally(() => setBtLoading(false));
  }, [btSearched, btVideoId, song.title, song.artist]);

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
      <div className="exercise-modal-content" ref={modalRef}>

        {/* DARK HEADER */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 modal-dark-header">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {song.genre && <span className="tag" style={{ border: "1px solid #D4A84360", color: "#D4A843", background: "#D4A84315" }}>{song.genre}</span>}
                {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                {song.tempo && <span className="font-readout text-[12px] text-[var(--text-secondary)]">{song.tempo} BPM</span>}
                {song.key && <span className="font-readout text-[12px] text-[var(--text-secondary)]">Key: {song.key}</span>}
                {hasGp && <span className="font-readout text-[10px] px-1.5 py-0.5 rounded border border-[var(--gold)]/40 text-[var(--gold)]">GP</span>}
              </div>
              <div className="font-heading text-2xl text-[var(--text-primary)]">{song.title}</div>
              <div className="font-label text-[14px] text-[var(--text-secondary)] mt-1">{song.artist}</div>
              {song.album && <div className="font-readout text-[12px] text-[var(--text-muted)] mt-0.5">{song.album}{song.year ? ` (${song.year})` : ""}{song.tuning && song.tuning !== "Standard" ? ` / ${song.tuning}` : ""}</div>}
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--text-secondary)] text-lg cursor-pointer hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
              aria-label="Close">
              ×
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex gap-1 flex-wrap">
              {PROGRESS_OPTIONS.map(opt => (
                <button type="button" key={opt.value} onClick={() => setProgress(opt.value)}
                  className={`font-label text-[10px] px-2.5 py-1 min-h-[44px] rounded cursor-pointer border transition-all ${
                    progress === opt.value
                      ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]"
                      : "border-[var(--border-panel)] text-[var(--text-muted)]"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-recess)]">
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

        <div className="p-4 sm:p-6">

          {/* Practice Tab */}
          {tab === "practice" && (
            <div>
              {/* YouTube Backing Track — auto-searched */}
              <div className="mb-6">
                <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> BACKING TRACK
                </div>

                {btLoading && (
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-6 text-center font-label text-[12px] text-[var(--text-muted)] mb-3">Searching for backing track...</div>
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

                {/* Paste URL */}
                <div className="flex gap-2 mb-3">
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

                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => window.open(ytSearch(`${song.title} ${song.artist} backing track guitar`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Backing Track</button>
                  <button type="button" onClick={() => window.open(ytSearch(`${song.title} ${song.artist} original`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Original Song</button>
                  <button type="button" onClick={() => window.open(ytSearch(`${song.title} ${song.artist} live`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Live Version</button>
                </div>
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

              {/* Song tips */}
              {(song.tuning || song.key || song.tempo) && (
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mt-4">
                  <div className="font-label text-[11px] tracking-wider text-[var(--gold)] mb-2">SONG DETAILS</div>
                  <div className="space-y-1 text-[12px] text-[var(--text-secondary)]">
                    {song.tuning && song.tuning !== "Standard" && <div>Tuning: <span className="text-[var(--gold)]">{song.tuning}</span> (not standard)</div>}
                    {song.key && <div>Key: {song.key}</div>}
                    {song.tempo && <div>Tempo: {song.tempo} BPM</div>}
                  </div>
                </div>
              )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
