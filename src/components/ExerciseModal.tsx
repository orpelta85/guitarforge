"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Exercise } from "@/lib/types";
import { COL, STYLES } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { ytSearch, ssSearch } from "@/lib/helpers";
import { buildCacheKey, getCachedTrack, downloadAndCache, type CachedTrack } from "@/lib/suno";
import TimerBox from "./TimerBox";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import DarkAudioPlayer from "./DarkAudioPlayer";
import dynamic from "next/dynamic";
const GpFileUploader = dynamic(() => import("./GpFileUploader"), {
  ssr: false,
  loading: () => <div className="panel p-4 text-center font-label text-sm text-[var(--text-muted)]">Loading viewer...</div>
});

interface Props {
  exercise: Exercise;
  mode: string; scale: string; style: string;
  week: number; day: string;
  savedYtUrl?: string;
  bpm: string; note: string;
  onBpmChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onDone?: () => void;
}

/* ── Modal type routing ── */
const THEORY_CATS = ["Ear Training", "Fretboard", "Modes", "Keys", "Chords"];

function getModalType(exercise: Exercise): "song" | "exercise" | "theory" {
  if (exercise.songId || exercise.songName || exercise.c === "Songs") return "song";
  if (THEORY_CATS.includes(exercise.c) && !exercise.tex && !exercise.bt) return "theory";
  return "exercise";
}

/* ── Shared: YouTube embed + paste ── */
function YouTubeEmbed({ videoId, setVideoId, label }: {
  videoId: string;
  setVideoId: (v: string) => void;
  label: string;
}) {
  const [url, setUrl] = useState("");
  function load() {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (m) setVideoId(m[1]);
  }
  return (
    <div>
      {videoId && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-3">
          <iframe src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`}
            className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title={label} />
        </div>
      )}
      {!videoId && (
        <div className="bg-[var(--bg-recess)] border border-dashed border-[var(--border-panel)] rounded-lg p-6 mb-3 text-center">
          <div className="font-label text-[12px] text-[var(--text-muted)]">Paste a YouTube URL below</div>
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()}
          placeholder="Paste YouTube URL..."
          className="input flex-1 !text-[12px]" />
        <button onClick={load} className="btn-gold !text-[11px]">Load</button>
      </div>
    </div>
  );
}

/* ── Shared: Section header with LED ── */
function SectionLabel({ color, children }: { color: "gold" | "green" | "red" | "amber" | "purple"; children: React.ReactNode }) {
  const ledClass = color === "purple" ? "" : `led-${color}`;
  return (
    <div className="font-label text-[11px] tracking-wider mb-3 flex items-center gap-2" style={{ color: color === "purple" ? "#8b5cf6" : color === "gold" ? "var(--gold)" : color === "green" ? "var(--led-green)" : color === "red" ? "var(--led-red)" : "var(--led-amber)" }}>
      {color === "purple" ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ) : (
        <div className={`led ${ledClass}`} />
      )}
      {children}
    </div>
  );
}

/* ── Shared: Tab bar ── */
function TabBar<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-recess)]">
      {tabs.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`flex-1 py-3 font-label text-[12px] cursor-pointer border-b-2 transition-all ${
            active === id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--text-muted)]"
          }`}>{label}</button>
      ))}
    </div>
  );
}

/* ── Shared: Dark header (replaces cream faceplate) ── */
function DarkHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5" style={{ background: "linear-gradient(180deg, #1e1c18 0%, #18181c 100%)", borderBottom: "1px solid var(--border-panel)" }}>
      {children}
    </div>
  );
}

/* ── Shared: Close button ── */
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--text-secondary)] text-lg cursor-pointer hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
      aria-label="Close">
      ×
    </button>
  );
}

/* ── Suno backing track hook ── */
function useSunoTrack(ex: Exercise, scale: string, mode: string, style: string, needsBacking: boolean) {
  const [sunoTrack, setSunoTrack] = useState<CachedTrack | null>(null);
  const [sunoLoading, setSunoLoading] = useState(false);
  const [sunoError, setSunoError] = useState("");
  const [sunoCredits, setSunoCredits] = useState<number | null>(null);
  const [sunoConfirm, setSunoConfirm] = useState(false);
  const [sunoStyle, setSunoStyle] = useState(ex.styles?.[0] || style);
  const sunoAudioRef = useRef<HTMLAudioElement | null>(null);

  const parseBpmMid = (bpmStr: string): number => {
    const m = bpmStr.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) return Math.round((parseInt(m[1]) + parseInt(m[2])) / 2);
    const single = parseInt(bpmStr);
    return isNaN(single) ? 120 : single;
  };
  const sunoBpm = parseBpmMid(ex.b);

  useEffect(() => {
    if (!needsBacking) return;
    const key = buildCacheKey(ex.id, sunoStyle, scale, mode, sunoBpm);
    getCachedTrack(key).then((cached) => { if (cached) setSunoTrack(cached); });
  }, [ex.id, sunoStyle, scale, mode, sunoBpm, needsBacking]);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/suno");
      const data = await res.json();
      if (typeof data.credits_left === "number") setSunoCredits(data.credits_left);
    } catch { /* non-critical */ }
  }, []);

  const generateSunoTrack = useCallback(async () => {
    setSunoLoading(true);
    setSunoError("");
    setSunoConfirm(false);
    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale, mode, style: sunoStyle, bpm: sunoBpm }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.tracks?.length) throw new Error("No tracks returned — try again");
      const track = data.tracks[0];
      const cacheKey = buildCacheKey(ex.id, sunoStyle, scale, mode, sunoBpm);
      const cached = await downloadAndCache(
        cacheKey, track.id, track.audioUrl,
        { scale, mode, style: sunoStyle, bpm: sunoBpm },
        track.duration, track.title
      );
      setSunoTrack(cached);
      fetchCredits();
    } catch (err) {
      setSunoError(err instanceof Error ? err.message : "Failed to generate");
    }
    setSunoLoading(false);
  }, [ex.id, scale, mode, sunoStyle, sunoBpm, fetchCredits]);

  return { sunoTrack, setSunoTrack, sunoLoading, sunoError, setSunoError, sunoCredits, sunoConfirm, setSunoConfirm, sunoStyle, setSunoStyle, sunoAudioRef, sunoBpm, fetchCredits, generateSunoTrack };
}

/* ── Suno section UI ── */
function SunoSection({ ex, scale, mode, suno }: {
  ex: Exercise; scale: string; mode: string;
  suno: ReturnType<typeof useSunoTrack>;
}) {
  return (
    <div className="mb-6">
      <SectionLabel color="purple">AI BACKING TRACK</SectionLabel>
      {suno.sunoTrack && (
        <div className="bg-[var(--bg-secondary)] border border-[#8b5cf620] rounded-lg p-3 mb-2">
          <div className="text-[11px] text-[var(--text-secondary)] mb-2">{suno.sunoTrack.title}</div>
          <DarkAudioPlayer src={suno.sunoTrack.audioUrl} loop />
          <div className="text-[9px] text-[var(--text-muted)] mt-1">Cached — no credits used</div>
        </div>
      )}
      {!suno.sunoTrack && !suno.sunoLoading && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-3 space-y-2">
          <div className="flex gap-2 items-end">
            <label className="flex-1">
              <span className="text-[9px] text-[var(--text-muted)] block mb-0.5">Style</span>
              <select value={suno.sunoStyle} onChange={(e) => suno.setSunoStyle(e.target.value)}
                className="w-full bg-[var(--bg-recess)] border border-[var(--border-panel)] rounded px-2 py-1.5 text-[11px] text-[var(--text-secondary)] outline-none focus:border-[#8b5cf6] cursor-pointer">
                {(ex.styles && ex.styles.length > 0 ? ex.styles : STYLES).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="text-[10px] text-[var(--text-muted)] pb-1">{scale} {mode} / {suno.sunoBpm} BPM</div>
          </div>
          {!suno.sunoConfirm ? (
            <button type="button" onClick={() => { suno.fetchCredits(); suno.setSunoConfirm(true); }}
              className="w-full text-[11px] py-2 rounded-lg bg-[#8b5cf6] text-white hover:brightness-110 cursor-pointer transition-all font-medium">
              Generate AI Backing Track
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] text-[var(--text-secondary)]">
                ~10 credits per track.{suno.sunoCredits !== null && ` You have ${suno.sunoCredits} remaining.`}
                {suno.sunoCredits !== null && suno.sunoCredits <= 10 && (
                  <span className="text-[var(--crimson)] ml-1">Credits low!</span>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={suno.generateSunoTrack}
                  className="flex-1 text-[11px] py-1.5 rounded-lg bg-[#8b5cf6] text-white hover:brightness-110 cursor-pointer font-medium">
                  Confirm Generate
                </button>
                <button type="button" onClick={() => suno.setSunoConfirm(false)}
                  className="flex-1 text-[11px] py-1.5 rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {suno.sunoError && <div className="text-[11px] text-[var(--crimson)]">{suno.sunoError}</div>}
        </div>
      )}
      {suno.sunoLoading && (
        <div className="bg-[var(--bg-secondary)] border border-[#8b5cf620] rounded-lg p-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-[12px] text-[#8b5cf6]">Generating backing track...</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">This takes 30-90 seconds</div>
        </div>
      )}
      {suno.sunoTrack && !suno.sunoLoading && (
        <button type="button" onClick={() => { suno.setSunoTrack(null); suno.setSunoConfirm(false); suno.setSunoError(""); }}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors mt-1">
          Generate new track
        </button>
      )}
    </div>
  );
}

/* ── YouTube backing section ── */
function YouTubeBackingSection({ scale, mode, style, ex, ytVideoId, setYtVideoId, ytSearchInput, setYtSearchInput }: {
  scale: string; mode: string; style: string; ex: Exercise;
  ytVideoId: string; setYtVideoId: (v: string) => void;
  ytSearchInput: string; setYtSearchInput: (v: string) => void;
}) {
  function parseAndLoad(val: string) {
    const m = val.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (m) setYtVideoId(m[1]);
  }
  return (
    <div className="mb-6">
      <SectionLabel color="gold">BACKING TRACK</SectionLabel>
      {ytVideoId && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-3">
          <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
            className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Backing" />
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input value={ytSearchInput} onChange={e => setYtSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") parseAndLoad(ytSearchInput); }}
          placeholder="Paste YouTube URL here..."
          className="input flex-1 !text-[12px]" />
        <button onClick={() => parseAndLoad(ytSearchInput)} className="btn-gold !text-[11px]">Load</button>
      </div>
      <div className="font-label text-[10px] text-[var(--text-muted)] mb-2">Find a backing track on YouTube:</div>
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => window.open(ytSearch(`${scale} ${mode} backing track guitar`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">{scale} {mode}</button>
        <button onClick={() => window.open(ytSearch(`${scale} ${style} jam track`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">{style} Jam</button>
        <button onClick={() => window.open(ytSearch(`${scale} slow blues backing track`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Slow Blues</button>
        {ex.songName && <button onClick={() => window.open(ytSearch(`${ex.songName} backing track`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">{ex.songName}</button>}
      </div>
    </div>
  );
}

/* ── GP Tab section ── */
function GpTabSection({ ex }: { ex: Exercise }) {
  return (
    <div className="mb-6">
      <SectionLabel color="gold">GUITAR PRO TAB</SectionLabel>
      <GpFileUploader exerciseId={String(ex.id)} tex={ex.tex || EXERCISES.find(e => e.id === ex.id)?.tex} songName={ex.n} />
      <div className="flex gap-1.5 flex-wrap mt-2">
        <button type="button" onClick={async () => {
          try {
            const r = await fetch(`/api/gptabs?q=${encodeURIComponent(ex.n)}`);
            const data = await r.json();
            if (data.length > 0) window.open(data[0].downloadUrl, "_blank");
            else window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.n)}&in=songs&page=1`, "_blank");
          } catch { window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.n)}&in=songs&page=1`, "_blank"); }
        }} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Download tabs</button>
        {(ex.ss || ex.songUrl) && <a href={ex.songUrl || ssSearch(ex.n)} target="_blank" rel="noopener noreferrer"
          className="btn-ghost no-underline !text-[10px] !px-2.5 !py-1.5">Songsterr</a>}
      </div>
    </div>
  );
}

/* ── Tutorial tab (shared across all types) ── */
function TutorialTabContent({ exerciseName, ytQuery }: { exerciseName: string; ytQuery: string }) {
  const [videoId, setVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (searched || videoId) return;
    setLoading(true);
    setSearched(true);
    fetch(`/api/youtube?q=${encodeURIComponent(ytQuery + " guitar tutorial")}`)
      .then(r => r.json())
      .then(data => {
        if (data.items?.[0]?.videoId) setVideoId(data.items[0].videoId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ytQuery, searched, videoId]);

  return (
    <div>
      <SectionLabel color="gold">Tutorial — {exerciseName}</SectionLabel>
      {loading && (
        <div className="bg-[var(--bg-secondary)] rounded-lg p-6 text-center font-label text-[12px] text-[var(--text-muted)] mb-3">Searching YouTube for tutorial...</div>
      )}
      <YouTubeEmbed videoId={videoId} setVideoId={setVideoId} label="Tutorial" />
      <button onClick={() => window.open(ytSearch(ytQuery + " guitar tutorial"), "_blank")}
        className="btn-ghost w-full justify-center !text-[11px]">
        Search more tutorials on YouTube
      </button>
    </div>
  );
}

/* ── Log tab (shared across all types) ── */
function LogTabContent({ bpm, note, onBpmChange, onNoteChange, week, day, exId }: {
  bpm: string; note: string;
  onBpmChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  week: number; day: string; exId: number;
}) {
  return (
    <div>
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-4">
        <SectionLabel color="gold">SESSION LOG</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="font-label text-[11px] text-[var(--text-muted)]">BPM Achieved
            <input value={bpm} onChange={(e) => onBpmChange(e.target.value)} placeholder="e.g. 120" className="input input-gold mt-1" />
          </label>
          <label className="font-label text-[11px] text-[var(--text-muted)]">Date
            <input value={new Date().toLocaleDateString("en-US")} disabled className="input mt-1 !text-[var(--text-muted)]" />
          </label>
        </div>
        <label className="font-label text-[11px] text-[var(--text-muted)]">Notes
          <textarea value={note} onChange={(e) => onNoteChange(e.target.value)}
            placeholder="What went well? What needs work?..."
            className="input mt-1 !h-24 resize-none" />
        </label>
      </div>
      <SectionLabel color="red">RECORDINGS</SectionLabel>
      <RecorderBox storageKey={week + "-" + day + "-" + exId} />
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   SONG WINDOW
   ════════════════════════════════════════════════════════════════ */
function SongWindow({ exercise: ex, mode, scale, style, week, day, savedYtUrl, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  const cc = COL[ex.c] || "#888";
  type SongTab = "practice" | "tutorial" | "log";
  const [tab, setTab] = useState<SongTab>("practice");

  // Backing track video
  const savedVid = savedYtUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const [btVideoId, setBtVideoId] = useState("");
  const [btLoading, setBtLoading] = useState(false);
  const [btSearched, setBtSearched] = useState(false);

  // Auto-search backing track on mount
  useEffect(() => {
    if (btSearched || btVideoId || savedVid?.[1]) return;
    setBtLoading(true);
    setBtSearched(true);
    const q = `${ex.songName || ex.n} backing track guitar`;
    fetch(`/api/youtube?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        if (data.items?.[0]?.videoId) setBtVideoId(data.items[0].videoId);
      })
      .catch(() => {})
      .finally(() => setBtLoading(false));
  }, [btSearched, btVideoId, savedVid, ex.songName, ex.n]);

  // Use saved URL if available
  useEffect(() => {
    if (savedVid?.[1] && !btVideoId) setBtVideoId(savedVid[1]);
  }, [savedVid, btVideoId]);

  // Original track video
  const [origVideoId, setOrigVideoId] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);

  const songName = ex.songName || ex.n;

  return (
    <>
      {/* DARK HEADER */}
      <DarkHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="tag" style={{ border: `1px solid ${cc}60`, color: cc, background: cc + "15" }}>{ex.c}</span>
              {ex.b && <span className="font-readout text-[12px] text-[var(--text-secondary)]">{ex.b} BPM</span>}
              <span className="font-readout text-[12px] text-[var(--text-secondary)]">{ex.m} min</span>
              {ex.tex && <span className="font-readout text-[10px] px-1.5 py-0.5 rounded border border-[var(--gold)]/40 text-[var(--gold)]">GP</span>}
            </div>
            <div className="font-heading text-2xl text-[var(--text-primary)]">{songName}</div>
            {ex.f && <div className="font-label text-[11px] text-[var(--text-muted)] mt-1">{ex.f}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {onDone && <button type="button" onClick={onDone} className="btn-gold !text-[11px] !px-4 !py-2">Done</button>}
            <CloseButton onClick={onClose} />
          </div>
        </div>
      </DarkHeader>

      <TabBar tabs={[
        { id: "practice" as SongTab, label: "Practice" },
        { id: "tutorial" as SongTab, label: "Tutorial" },
        { id: "log" as SongTab, label: "Log" },
      ]} active={tab} onChange={setTab} />

      <div className="p-4 sm:p-6">
        {tab === "practice" && (
          <div>
            {/* YouTube Backing Track — auto-searched */}
            <div className="mb-6">
              <SectionLabel color="gold">BACKING TRACK</SectionLabel>
              {btLoading && (
                <div className="bg-[var(--bg-secondary)] rounded-lg p-6 text-center font-label text-[12px] text-[var(--text-muted)] mb-3">Searching for backing track...</div>
              )}

              {/* Toggle: Backing vs Original */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => setShowOriginal(false)}
                  className={`font-label text-[11px] px-3 py-1.5 rounded cursor-pointer border transition-all ${!showOriginal ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]" : "border-[var(--border-panel)] text-[var(--text-muted)]"}`}>
                  Backing Track
                </button>
                <button onClick={() => setShowOriginal(true)}
                  className={`font-label text-[11px] px-3 py-1.5 rounded cursor-pointer border transition-all ${showOriginal ? "bg-[var(--gold)] text-[#121214] border-[var(--gold)]" : "border-[var(--border-panel)] text-[var(--text-muted)]"}`}>
                  Original
                </button>
              </div>

              {!showOriginal ? (
                <YouTubeEmbed videoId={btVideoId} setVideoId={setBtVideoId} label="Backing Track" />
              ) : (
                <YouTubeEmbed videoId={origVideoId} setVideoId={setOrigVideoId} label="Original" />
              )}

              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => window.open(ytSearch(`${songName} backing track guitar`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Backing Track</button>
                <button onClick={() => window.open(ytSearch(`${songName} original`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Original Song</button>
                <button onClick={() => window.open(ytSearch(`${songName} live`), "_blank")} className="btn-ghost !text-[10px] !px-2.5 !py-1.5">Live Version</button>
              </div>
            </div>

            {/* GP Tab */}
            <GpTabSection ex={ex} />

            {/* Practice Tools */}
            <div className="space-y-4">
              <div>
                <SectionLabel color="amber">METRONOME</SectionLabel>
                <MetronomeBox />
              </div>
              <div>
                <SectionLabel color="green">TIMER</SectionLabel>
                <TimerBox minutes={ex.m} />
              </div>
              <div>
                <SectionLabel color="red">RECORDER</SectionLabel>
                <RecorderBox storageKey={week + "-" + day + "-" + ex.id} />
              </div>
            </div>
          </div>
        )}

        {tab === "tutorial" && (
          <TutorialTabContent exerciseName={songName} ytQuery={`how to play ${songName} guitar`} />
        )}

        {tab === "log" && (
          <LogTabContent bpm={bpm} note={note} onBpmChange={onBpmChange} onNoteChange={onNoteChange} week={week} day={day} exId={ex.id} />
        )}
      </div>
    </>
  );
}


/* ════════════════════════════════════════════════════════════════
   EXERCISE WINDOW
   ════════════════════════════════════════════════════════════════ */
const BACKING_CATS = ["Improv", "Riffs", "Composition", "Songs", "Modes"];

function ExerciseWindow({ exercise: ex, mode, scale, style, week, day, savedYtUrl, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  const cc = COL[ex.c] || "#888";
  type ExTab = "practice" | "tutorial" | "log";
  const [tab, setTab] = useState<ExTab>("practice");
  const needsBacking = ex.bt || BACKING_CATS.includes(ex.c);

  // YouTube state
  const savedVid = savedYtUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const [ytVideoId, setYtVideoId] = useState(savedVid ? savedVid[1] : "");
  const [ytSearchInput, setYtSearchInput] = useState(savedYtUrl || "");

  // Suno
  const suno = useSunoTrack(ex, scale, mode, style, needsBacking);

  // Scroll refs for sticky toolbar
  const timerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* STICKY TOOLBAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2" style={{ background: "linear-gradient(180deg, #1e1c18 0%, #1a1a1e 100%)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => timerRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors" title="Jump to Timer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--led-green)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/></svg>
          </button>
          <button type="button" onClick={() => recorderRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors" title="Jump to Recorder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--led-red)" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {onDone && <button type="button" onClick={onDone} className="btn-gold !text-[11px] !px-4 !py-1.5">Done</button>}
          <CloseButton onClick={onClose} />
        </div>
      </div>

      {/* DARK HEADER */}
      <DarkHeader>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="tag" style={{ border: `1px solid ${cc}60`, color: cc, background: cc + "15" }}>{ex.c}</span>
          {ex.b && <span className="font-readout text-[12px] text-[var(--text-secondary)]">{ex.b} BPM</span>}
          <span className="font-readout text-[12px] text-[var(--text-secondary)]">{ex.m} min</span>
        </div>
        <div className="font-heading text-xl text-[var(--text-primary)]">{ex.n}</div>
        {ex.f && <div className="font-label text-[11px] text-[var(--text-muted)] mt-1">Focus: {ex.f}</div>}
      </DarkHeader>

      <TabBar tabs={[
        { id: "practice" as ExTab, label: "Practice" },
        { id: "tutorial" as ExTab, label: "Tutorial" },
        { id: "log" as ExTab, label: "Log" },
      ]} active={tab} onChange={setTab} />

      <div className="p-4 sm:p-6">
        {tab === "practice" && (
          <div>
            {/* Description + tips */}
            <div className="text-[14px] text-[var(--text-secondary)] leading-7 mb-4">{ex.d}</div>
            {ex.t && (
              <div className="flex gap-3 items-start bg-[var(--gold)]/5 border border-[var(--gold)]/15 px-4 py-3 rounded-lg mb-6">
                <div className="led led-gold mt-1 flex-shrink-0" />
                <span className="text-[12px] text-[var(--gold)]/80 leading-5">{ex.t}</span>
              </div>
            )}

            {/* GP Tab — prominent */}
            <GpTabSection ex={ex} />

            {/* Metronome — above backing track for exercises */}
            <div className="mb-6">
              <SectionLabel color="amber">METRONOME</SectionLabel>
              <MetronomeBox />
            </div>

            {/* Suno AI Backing Track */}
            {needsBacking && <SunoSection ex={ex} scale={scale} mode={mode} suno={suno} />}

            {/* YouTube Backing */}
            <YouTubeBackingSection scale={scale} mode={mode} style={style} ex={ex}
              ytVideoId={ytVideoId} setYtVideoId={setYtVideoId}
              ytSearchInput={ytSearchInput} setYtSearchInput={setYtSearchInput} />

            {/* Timer + Recorder */}
            <div ref={timerRef} className="mb-4">
              <SectionLabel color="green">TIMER</SectionLabel>
              <TimerBox minutes={ex.m} />
            </div>
            <div ref={recorderRef}>
              <SectionLabel color="red">RECORDER</SectionLabel>
              <RecorderBox storageKey={week + "-" + day + "-" + ex.id} />
            </div>
          </div>
        )}

        {tab === "tutorial" && (
          <TutorialTabContent exerciseName={ex.n} ytQuery={ex.yt} />
        )}

        {tab === "log" && (
          <LogTabContent bpm={bpm} note={note} onBpmChange={onBpmChange} onNoteChange={onNoteChange} week={week} day={day} exId={ex.id} />
        )}
      </div>
    </>
  );
}


/* ════════════════════════════════════════════════════════════════
   THEORY WINDOW
   ════════════════════════════════════════════════════════════════ */
const TOOL_MAP: Record<string, { label: string; hint: string }> = {
  "Ear Training": { label: "Interval Trainer", hint: "Open Ear Training tools in the Learning Center" },
  "Fretboard": { label: "Fretboard Visualizer", hint: "Open Fretboard tool in the Learning Center" },
  "Modes": { label: "Scale Explorer", hint: "Open Scales tool in the Learning Center" },
  "Keys": { label: "Circle of Fifths", hint: "Open Circle of Fifths in the Learning Center" },
  "Chords": { label: "Chord Diagram", hint: "Open Chord tools in the Learning Center" },
};

function TheoryWindow({ exercise: ex, week, day, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  const cc = COL[ex.c] || "#888";
  type TheoryTab = "lesson" | "tool" | "tutorial" | "log";
  const [tab, setTab] = useState<TheoryTab>("lesson");
  const tool = TOOL_MAP[ex.c] || { label: "Learning Center", hint: "Open the Learning Center for interactive tools" };

  // Parse steps from description if numbered
  const steps = ex.d.match(/\d+\.\s+[^.]+\./g) || [];
  const hasSteps = steps.length >= 2;
  const descWithoutSteps = hasSteps ? ex.d.replace(/\d+\.\s+[^.]+\./g, "").trim() : ex.d;

  return (
    <>
      {/* DARK HEADER */}
      <DarkHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="tag" style={{ border: `1px solid ${cc}60`, color: cc, background: cc + "15" }}>{ex.c}</span>
              <span className="font-readout text-[12px] text-[var(--text-secondary)]">{ex.m} min</span>
            </div>
            <div className="font-heading text-xl text-[var(--text-primary)]">{ex.n}</div>
            {ex.f && <div className="font-label text-[11px] text-[var(--text-muted)] mt-1">Focus: {ex.f}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {onDone && <button type="button" onClick={onDone} className="btn-gold !text-[11px] !px-4 !py-2">Done</button>}
            <CloseButton onClick={onClose} />
          </div>
        </div>
      </DarkHeader>

      <TabBar tabs={[
        { id: "lesson" as TheoryTab, label: "Lesson" },
        { id: "tool" as TheoryTab, label: "Tool" },
        { id: "tutorial" as TheoryTab, label: "Tutorial" },
        { id: "log" as TheoryTab, label: "Log" },
      ]} active={tab} onChange={setTab} />

      <div className="p-4 sm:p-6">
        {/* LESSON TAB */}
        {tab === "lesson" && (
          <div>
            <SectionLabel color="gold">INSTRUCTIONS</SectionLabel>
            <div className="text-[14px] text-[var(--text-secondary)] leading-7 mb-4">
              {hasSteps ? descWithoutSteps : ex.d}
            </div>

            {ex.t && (
              <div className="flex gap-3 items-start bg-[var(--gold)]/5 border border-[var(--gold)]/15 px-4 py-3 rounded-lg mb-6">
                <div className="led led-gold mt-1 flex-shrink-0" />
                <span className="text-[12px] text-[var(--gold)]/80 leading-5">{ex.t}</span>
              </div>
            )}

            {hasSteps && (
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
                <div className="font-label text-[11px] text-[var(--gold)] mb-3">STEPS</div>
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-[13px] text-[var(--text-secondary)] leading-6">{step.replace(/^\d+\.\s+/, "")}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <SectionLabel color="green">TIMER</SectionLabel>
            <TimerBox minutes={ex.m} />
          </div>
        )}

        {/* TOOL TAB */}
        {tab === "tool" && (
          <div>
            <SectionLabel color="gold">INTERACTIVE TOOL</SectionLabel>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 text-center mb-4">
              <div className="font-heading text-lg text-[var(--text-primary)] mb-2">{tool.label}</div>
              <div className="text-[13px] text-[var(--text-muted)] mb-4">{tool.hint}</div>
              <div className="text-[12px] text-[var(--text-muted)] mb-4">
                The {tool.label} is available in the Learning Center with full interactive features.
              </div>
            </div>
            <button type="button" onClick={() => {
              window.dispatchEvent(new CustomEvent("gf-navigate", { detail: { view: "lib", subTab: "tools" } }));
              onClose();
            }} className="btn-ghost w-full justify-center !text-[12px] py-3">
              Open Full Tool in Learning Center
            </button>
          </div>
        )}

        {/* TUTORIAL TAB */}
        {tab === "tutorial" && (
          <TutorialTabContent exerciseName={ex.n} ytQuery={ex.yt} />
        )}

        {/* LOG TAB */}
        {tab === "log" && (
          <LogTabContent bpm={bpm} note={note} onBpmChange={onBpmChange} onNoteChange={onNoteChange} week={week} day={day} exId={ex.id} />
        )}
      </div>
    </>
  );
}


/* ════════════════════════════════════════════════════════════════
   MAIN EXPORT — routes to the correct window type
   ════════════════════════════════════════════════════════════════ */
export default function ExerciseModal(props: Props) {
  const modalType = getModalType(props.exercise);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      className="exercise-modal-overlay">
      <div className="exercise-modal-content">
        {modalType === "song" && <SongWindow {...props} />}
        {modalType === "exercise" && <ExerciseWindow {...props} />}
        {modalType === "theory" && <TheoryWindow {...props} />}
      </div>
    </div>
  );
}
