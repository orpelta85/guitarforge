"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Exercise } from "@/lib/types";
import { COL, STYLES, SCALES, MODES } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { ytSearch, ssSearch } from "@/lib/helpers";
import { buildCacheKey, getCachedTrack, downloadAndCache, type CachedTrack } from "@/lib/suno";
import { idbLoadRecordings, idbDeleteRecording } from "@/lib/recorderIdb";
import { saveToLibrary } from "@/lib/recordingsLibrary";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import DarkAudioPlayer from "./DarkAudioPlayer";
import StemSeparator from "./StemSeparator";
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
        <div className="bg-white/[0.03] border border-dashed border-white/[0.06] rounded-lg p-6 mb-3 text-center">
          <div className="font-label text-[12px] text-zinc-500">Paste a YouTube URL below</div>
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()}
          placeholder="Paste YouTube URL..."
          className="input flex-1 !text-[12px] min-w-0" />
        <button onClick={load} className="btn-gold !text-[11px]">Load</button>
      </div>
    </div>
  );
}

/* ── Shared: Section header with LED ── */
function SectionLabel({ color, children }: { color: "gold" | "green" | "red" | "amber" | "purple"; children: React.ReactNode }) {
  const ledClass = color === "purple" ? "" : `led-${color}`;
  return (
    <div className="text-[10px] font-medium uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: color === "purple" ? "#8b5cf6" : color === "gold" ? "var(--gold)" : color === "green" ? "var(--led-green)" : color === "red" ? "var(--led-red)" : "var(--led-amber)" }}>
      {color === "purple" ? (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ) : (
        <div className={`led ${ledClass}`} style={{ width: 6, height: 6 }} />
      )}
      {children}
    </div>
  );
}

/* ── Pill Tab Bar (new zone-based design) ── */
function PillTabBar<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="bg-zinc-900/50 rounded-xl p-1 flex gap-1" role="tablist">
      {tabs.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)}
          role="tab"
          aria-selected={active === id}
          className={`flex-1 py-2 px-3 min-h-[36px] text-[12px] font-medium cursor-pointer rounded-lg transition-all duration-200 ${
            active === id
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "text-zinc-500 hover:text-zinc-300 border border-transparent"
          }`}>{label}</button>
      ))}
    </div>
  );
}

/* ── Close button ── */
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-8 h-8 min-w-[36px] min-h-[36px] rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-500 text-base cursor-pointer hover:bg-white/[0.07] hover:text-zinc-300 transition-colors duration-200 flex-shrink-0"
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
      if (!data.tracks?.length) throw new Error("No tracks returned - try again");
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
    <div className="mb-4">
      <SectionLabel color="purple">AI BACKING TRACK</SectionLabel>
      {suno.sunoTrack && (
        <div className="bg-white/[0.03] border border-[#8b5cf620] rounded-lg p-3 mb-2">
          <div className="text-[11px] text-zinc-400 mb-2">{suno.sunoTrack.title}</div>
          <DarkAudioPlayer src={suno.sunoTrack.audioUrl} loop />
          <div className="text-[9px] text-zinc-600 mt-1">Cached - no credits used</div>
        </div>
      )}
      {!suno.sunoTrack && !suno.sunoLoading && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
          <div className="flex gap-2 items-end">
            <label className="flex-1">
              <span className="text-[9px] text-zinc-600 block mb-0.5">Style</span>
              <select value={suno.sunoStyle} onChange={(e) => suno.setSunoStyle(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-white/[0.08] rounded px-2 py-1.5 text-[11px] text-zinc-400 outline-none focus:border-[#8b5cf6] cursor-pointer">
                {(ex.styles && ex.styles.length > 0 ? ex.styles : STYLES).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="text-[10px] text-zinc-600 pb-1">{scale} {mode} / {suno.sunoBpm} BPM</div>
          </div>
          {!suno.sunoConfirm ? (
            <button type="button" onClick={() => { suno.fetchCredits(); suno.setSunoConfirm(true); }}
              className="w-full text-[11px] py-2 rounded-lg bg-[#8b5cf6] text-white hover:brightness-110 cursor-pointer transition-all font-medium">
              Generate AI Backing Track
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] text-zinc-400">
                ~10 credits per track.{suno.sunoCredits !== null && ` You have ${suno.sunoCredits} remaining.`}
                {suno.sunoCredits !== null && suno.sunoCredits <= 10 && suno.sunoCredits >= 5 && (
                  <span className="text-red-400 ml-1">Credits low!</span>
                )}
              </div>
              {suno.sunoCredits !== null && suno.sunoCredits < 5 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <div className="text-[12px] text-red-400 font-medium mb-1">Not enough credits</div>
                  <div className="text-[10px] text-red-400/70">You have {suno.sunoCredits} credits. Generation requires ~10.</div>
                  <a href="https://sunoapi.org" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#8b5cf6] hover:underline mt-1 block">Top up at sunoapi.org &rarr;</a>
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={suno.generateSunoTrack}
                  disabled={suno.sunoCredits !== null && suno.sunoCredits < 5}
                  className="flex-1 text-[11px] py-1.5 rounded-lg bg-[#8b5cf6] text-white hover:brightness-110 cursor-pointer font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  Confirm Generate
                </button>
                <button type="button" onClick={() => suno.setSunoConfirm(false)}
                  className="flex-1 text-[11px] py-1.5 rounded-lg bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {suno.sunoError && <div className="text-[11px] text-red-400">{suno.sunoError}</div>}
        </div>
      )}
      {suno.sunoLoading && (
        <div className="bg-white/[0.03] border border-[#8b5cf620] rounded-lg p-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-[12px] text-[#8b5cf6]">Generating backing track...</div>
          <div className="text-[10px] text-zinc-600 mt-1">This takes 30-90 seconds</div>
        </div>
      )}
      {suno.sunoTrack && !suno.sunoLoading && (
        <div className="flex items-center gap-3 mt-1">
          <button type="button" onClick={() => { suno.setSunoTrack(null); suno.setSunoConfirm(false); suno.setSunoError(""); }}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
            Generate new track
          </button>
        </div>
      )}
      {suno.sunoTrack && !suno.sunoLoading && (
        <StemSeparator
          audioUrl={suno.sunoTrack.audioUrl}
          cacheKey={`ex-stems-${ex.id}-${suno.sunoTrack.clipId}`}
        />
      )}
    </div>
  );
}

/* ── YouTube backing section ── */
function YouTubeBackingSection({ scale, mode, style, ex, ytVideoId, setYtVideoId, ytSearchInput, setYtSearchInput, ytSearchResults, setYtSearchResults, ytResultIndex, setYtResultIndex }: {
  scale: string; mode: string; style: string; ex: Exercise;
  ytVideoId: string; setYtVideoId: (v: string) => void;
  ytSearchInput: string; setYtSearchInput: (v: string) => void;
  ytSearchResults?: string[];
  setYtSearchResults?: (ids: string[]) => void;
  ytResultIndex?: number;
  setYtResultIndex?: (i: number) => void;
}) {
  const defaultStyle = (ex.styles && ex.styles.length > 0 ? ex.styles[0] : null) || style || STYLES[0];
  const defaultScale = scale || SCALES[0];
  const defaultMode = mode || MODES[0];

  const [filterScale, setFilterScale] = useState(defaultScale);
  const [filterMode, setFilterMode] = useState(defaultMode);
  const [filterStyle, setFilterStyle] = useState(defaultStyle);

  // Auto-load on first render using exercise context
  const didAutoLoad = useRef(false);
  useEffect(() => {
    if (didAutoLoad.current || ytVideoId) return;
    didAutoLoad.current = true;
    runSearch(`${defaultStyle} ${defaultScale} ${defaultMode} backing track guitar`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(query: string) {
    const urlMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) { setYtVideoId(urlMatch[1]); return; }
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const ids: string[] = data.results || data.items?.map((i: { videoId: string }) => i.videoId).filter(Boolean) || [];
      if (ids.length > 0) {
        setYtVideoId(ids[0]);
        if (setYtSearchResults) setYtSearchResults(ids);
        if (setYtResultIndex) setYtResultIndex(0);
      }
    } catch { /* ignore */ }
  }

  function handleNextVideo() {
    if (!ytSearchResults || ytSearchResults.length <= 1) return;
    const nextIdx = ((ytResultIndex ?? 0) + 1) % ytSearchResults.length;
    if (setYtResultIndex) setYtResultIndex(nextIdx);
    setYtVideoId(ytSearchResults[nextIdx]);
  }

  const selectCls = "bg-[#111] border border-[#2a2a2a] rounded px-2 py-1 text-[11px] text-zinc-300 outline-none cursor-pointer hover:border-amber-500/30 focus:border-amber-500/40";

  return (
    <div>
      <SectionLabel color="gold">BACKING TRACK</SectionLabel>

      {/* Row 1 — Filter search */}
      <div className="flex gap-2 items-center mb-2 flex-wrap">
        <select title="Style" value={filterStyle} onChange={e => setFilterStyle(e.target.value)} className={selectCls}>
          {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select title="Scale" value={filterScale} onChange={e => setFilterScale(e.target.value)} className={selectCls}>
          {SCALES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select title="Mode" value={filterMode} onChange={e => setFilterMode(e.target.value)} className={selectCls}>
          {MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => runSearch(`${filterStyle} ${filterScale} ${filterMode} backing track guitar`)}
          className="btn-gold !text-[11px] flex-shrink-0">Search</button>
        {(ytSearchResults?.length ?? 0) > 1 && (
          <button onClick={handleNextVideo}
            className="btn-ghost !text-[11px] flex-shrink-0 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>
            Next Video
          </button>
        )}
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-[#222]" />
        <span className="font-label text-[10px] text-[#444]">OR</span>
        <div className="flex-1 h-px bg-[#222]" />
      </div>

      {/* Row 2 — Free text search */}
      <div className="flex gap-2 mb-3">
        <input value={ytSearchInput} onChange={e => setYtSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") runSearch(ytSearchInput.trim() || `${ex.n} backing track guitar`); }}
          placeholder="Free search..."
          className="input flex-1 !text-[12px] min-w-0" />
        <button onClick={() => runSearch(ytSearchInput.trim() || `${ex.n} backing track guitar`)}
          className="btn-ghost !text-[11px] flex-shrink-0">Search</button>
      </div>
      {/* Video display */}
      {ytVideoId && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
            className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Backing Track" />
        </div>
      )}
    </div>
  );
}

/* ── GP Tab section ── */
function GpTabSection({ ex }: { ex: Exercise }) {
  const gpStorageUrl = ex.gpPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gp-tabs/${ex.gpPath}`
    : undefined;
  return (
    <div>
      <GpFileUploader exerciseId={String(ex.id)} tex={ex.tex || EXERCISES.find(e => e.id === ex.id)?.tex} songName={ex.n} gpUrl={gpStorageUrl} />
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
  const [results, setResults] = useState<string[]>([]);
  const [resultIdx, setResultIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (searched || videoId) return;
    setLoading(true);
    setSearched(true);
    fetch(`/api/youtube?q=${encodeURIComponent(ytQuery + " guitar tutorial")}`)
      .then(r => r.json())
      .then(data => {
        const ids: string[] = data.results || data.items?.map((i: { videoId: string }) => i.videoId).filter(Boolean) || [];
        if (ids.length > 0) { setVideoId(ids[0]); setResults(ids); setResultIdx(0); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ytQuery, searched, videoId]);

  function handleNext() {
    if (results.length <= 1) return;
    const next = (resultIdx + 1) % results.length;
    setResultIdx(next);
    setVideoId(results[next]);
  }

  return (
    <div>
      <SectionLabel color="gold">Tutorial - {exerciseName}</SectionLabel>
      {loading && (
        <div className="bg-white/[0.03] rounded-lg p-6 text-center text-[12px] text-zinc-600 mb-3">Searching YouTube for tutorial...</div>
      )}
      <div className="flex gap-2 mb-2">
        {results.length > 1 && (
          <button onClick={handleNext}
            className="btn-ghost !text-[11px] flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>
            Next Video
          </button>
        )}
        <button onClick={() => window.open(ytSearch(ytQuery + " guitar tutorial"), "_blank")}
          className="btn-ghost flex-1 justify-center !text-[11px]">
          Search more tutorials on YouTube
        </button>
      </div>
      <YouTubeEmbed videoId={videoId} setVideoId={setVideoId} label="Tutorial" />
    </div>
  );
}


/* ── Inline timer for toolbar ── */
function InlineTimer({ durationSec }: { durationSec: number }) {
  const [remaining, setRemaining] = useState(durationSec);
  const [active, setActive] = useState(false);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRemaining(durationSec);
    setActive(false);
  }, [durationSec]);

  useEffect(() => {
    if (active && remaining > 0) {
      ref.current = setTimeout(() => setRemaining(s => s - 1), 1000);
    } else if (remaining === 0) {
      setActive(false);
    }
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [active, remaining]);

  const done = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5">
      <button type="button" onClick={() => { if (!done) setActive(!active); }}
        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${active ? "bg-green-500/20 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.2)]" : done ? "bg-amber-500/20 text-amber-400" : "bg-white/[0.06] text-zinc-400 hover:text-zinc-200"}`}
        title={active ? "Pause timer" : "Start timer"}>
        {active ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : done ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        )}
      </button>
      <span className={`font-readout text-[14px] tabular-nums tracking-wide ${done ? "text-amber-400" : active ? "text-green-400" : "text-zinc-400"}`}>{mm}:{ss}</span>
      {remaining !== durationSec && !active && (
        <button type="button" onClick={() => { setRemaining(durationSec); setActive(false); }}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors ml-0.5">
          Reset
        </button>
      )}
    </div>
  );
}


/* ── Records Panel (shows exercise recordings from IDB) ── */
function RecordsPanel({ exerciseId, exerciseName, storageKey }: {
  exerciseId: string; exerciseName: string; storageKey: string;
}) {
  const [recordings, setRecordings] = useState<{ dt: string; d: string }[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const blobCacheRef = useRef<Map<number, Blob>>(new Map());

  useEffect(() => {
    idbLoadRecordings(storageKey).then(({ list, blobs }) => {
      setRecordings(list);
      blobCacheRef.current = blobs;
    });
  }, [storageKey]);

  async function handleSaveToLibrary(idx: number) {
    const blob = blobCacheRef.current.get(idx);
    if (!blob) return;
    await saveToLibrary(exerciseId, exerciseName, blob);
    setSavedIds(prev => new Set(prev).add(idx));
  }

  async function handleDelete(i: number, blobIdx: number) {
    await idbDeleteRecording(storageKey, blobIdx);
    blobCacheRef.current.delete(blobIdx);
    setRecordings(prev => prev.filter((_, j) => j !== i));
  }

  if (recordings.length === 0) {
    return (
      <div className="text-[11px] text-zinc-600 py-2">
        No recordings yet. Press Rec to record your practice.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {recordings.map((rec, i) => {
        const blobKeys = Array.from(blobCacheRef.current.keys()).sort((a, b) => b - a);
        const blobIdx = blobKeys[i] ?? i;
        return (
          <div key={i} className="flex items-center gap-2 bg-white/[0.03] rounded-lg p-2 border border-white/[0.05]">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-zinc-600 mb-1">{rec.dt}</div>
              <DarkAudioPlayer src={rec.d} compact />
            </div>
            <button onClick={() => handleSaveToLibrary(blobIdx)}
              disabled={savedIds.has(blobIdx)}
              className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-all ${
                savedIds.has(blobIdx)
                  ? "border-green-500/30 text-green-400 bg-green-500/10 cursor-default"
                  : "border-white/[0.08] text-zinc-500 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5"
              }`}>
              {savedIds.has(blobIdx) ? "Saved" : "Save"}
            </button>
            <button type="button" onClick={() => handleDelete(i, blobIdx)}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md border border-white/[0.06] text-zinc-600 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5 cursor-pointer transition-all"
              title="Delete recording">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ZONE 1: TOOLBAR (shared across all window types)
   Bigger, contains: exercise info + Record + Records + Timer + Done + Close
   ════════════════════════════════════════════════════════════════ */
function Toolbar({ ex, week, day, onClose, onDone, bpm, note, onBpmChange, onNoteChange }: { ex: Exercise; week: number; day: string; onClose: () => void; onDone?: () => void; bpm?: string; note?: string; onBpmChange?: (v: string) => void; onNoteChange?: (v: string) => void }) {
  const cc = COL[ex.c] || "#888";
  const songName = ex.songName || ex.n;
  const recKey = week + "-" + day + "-" + ex.id;
  const [notesOpen, setNotesOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsKey, setRecordsKey] = useState(0);
  return (
    <div className="sticky top-0 z-20 px-4 sm:px-5 py-3"
      style={{ background: "linear-gradient(180deg, #141214 0%, #12121600 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Row 1: Exercise info */}
      <div className="flex items-center gap-2.5 mb-2.5 min-w-0">
        <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cc, boxShadow: `0 0 6px ${cc}40` }} />
        <span className="font-heading text-[15px] text-[var(--text-primary)] truncate">{songName}</span>
        {ex.b && (
          <span className="font-readout text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 flex-shrink-0">{ex.b} BPM</span>
        )}
        <span className="font-readout text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 flex-shrink-0">{ex.m}m</span>
      </div>
      {/* Row 2: Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <InlineTimer durationSec={(ex.m || 5) * 60} />
        <RecorderBox storageKey={recKey} exerciseName={songName} compact onRecordSaved={() => { setRecordsKey(k => k + 1); setRecordsOpen(true); }} />
        <button type="button" onClick={() => setRecordsOpen(!recordsOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all border ${
            recordsOpen ? "bg-white/[0.06] border-white/[0.12] text-zinc-200" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
          }`}
          title="View recordings">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Records
        </button>
        {onNoteChange && (
          <button type="button" onClick={() => setNotesOpen(!notesOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all border ${notesOpen || note ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"}`}
            title="Session notes">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Notes
            {(bpm || note) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
          </button>
        )}
        <div className="flex-1" />
        {onDone && (
          <button type="button" onClick={onDone}
            className="text-[12px] font-medium px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
            style={{ boxShadow: "0 0 12px rgba(245,158,11,0.15)" }}>
            Done
          </button>
        )}
        <CloseButton onClick={onClose} />
      </div>
      {/* Row 3: Records panel */}
      {recordsOpen && (
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <RecordsPanel key={recordsKey} exerciseId={String(ex.id)} exerciseName={songName} storageKey={recKey} />
        </div>
      )}
      {/* Row 4: Notes collapse */}
      {notesOpen && onNoteChange && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] flex gap-3 items-start">
          <label className="w-28 flex-shrink-0">
            <span className="text-[9px] font-medium text-zinc-600 uppercase tracking-wider block mb-1">BPM Achieved</span>
            <input value={bpm || ""} onChange={e => onBpmChange?.(e.target.value)} placeholder="e.g. 120"
              className="input input-gold w-full !py-1 !text-[11px]" />
          </label>
          <label className="flex-1">
            <span className="text-[9px] font-medium text-zinc-600 uppercase tracking-wider block mb-1">Session Notes</span>
            <textarea value={note || ""} onChange={e => onNoteChange(e.target.value)}
              placeholder="What went well? What needs work?..."
              className="input w-full !h-16 resize-none !text-[11px]" />
          </label>
        </div>
      )}
    </div>
  );
}



/* ════════════════════════════════════════════════════════════════
   PRACTICE TAB CONTENT (shared by Song & Exercise windows)
   ════════════════════════════════════════════════════════════════ */
function PracticeTabContent({ ex }: { ex: Exercise }) {
  return (
    <div className="space-y-4">
      {ex.d && (
        <div className="text-[13px] text-zinc-400 leading-7">{ex.d}</div>
      )}
      {ex.t && (
        <div className="flex gap-3 items-start bg-amber-500/5 border border-amber-500/15 px-4 py-3 rounded-lg"
          style={{ boxShadow: "0 0 12px rgba(245,158,11,0.08)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
          <span className="text-[13px] text-amber-400/80 leading-5">{ex.t}</span>
        </div>
      )}
      {ex.f && (
        <div>
          <SectionLabel color="gold">FOCUS AREAS</SectionLabel>
          <div className="text-[13px] text-zinc-400 leading-6">{ex.f}</div>
        </div>
      )}
      {!ex.d && !ex.t && !ex.f && (
        <div className="text-center py-8 text-zinc-600 text-[13px]">
          No practice notes for this exercise. Jump to another tab to start practicing.
        </div>
      )}
      {/* Metronome inline - only in Practice tab */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <SectionLabel color="amber">METRONOME</SectionLabel>
        <MetronomeBox />
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   SONG WINDOW - Zone-based layout
   ════════════════════════════════════════════════════════════════ */
function SongWindow({ exercise: ex, mode, scale, style, week, day, savedYtUrl, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  const savedVid = savedYtUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const [btVideoId, setBtVideoId] = useState("");
  const [btLoading, setBtLoading] = useState(false);
  const [btSearched, setBtSearched] = useState(false);
  const [btSearchResults, setBtSearchResults] = useState<string[]>([]);
  const [btResultIndex, setBtResultIndex] = useState(0);
  const [btSearchInput, setBtSearchInput] = useState("");

  useEffect(() => {
    if (btSearched || btVideoId || savedVid?.[1]) return;
    setBtLoading(true);
    setBtSearched(true);
    const q = `${ex.songName || ex.n} backing track guitar`;
    fetch(`/api/youtube?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        const ids: string[] = data.results || data.items?.map((i: { videoId: string }) => i.videoId).filter(Boolean) || [];
        if (ids.length > 0) {
          setBtVideoId(ids[0]);
          setBtSearchResults(ids);
          setBtResultIndex(0);
        }
      })
      .catch(() => {})
      .finally(() => setBtLoading(false));
  }, [btSearched, btVideoId, savedVid, ex.songName, ex.n]);

  useEffect(() => {
    if (savedVid?.[1] && !btVideoId) setBtVideoId(savedVid[1]);
  }, [savedVid, btVideoId]);

  const [origVideoId, setOrigVideoId] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const songName = ex.songName || ex.n;

  async function handleSongBtSearch() {
    const raw = btSearchInput.trim();
    const urlMatch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) { setBtVideoId(urlMatch[1]); return; }
    const query = raw || `${songName} backing track guitar`;
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const ids: string[] = data.results || data.items?.map((i: { videoId: string }) => i.videoId).filter(Boolean) || [];
      if (ids.length > 0) {
        setBtVideoId(ids[0]);
        setBtSearchResults(ids);
        setBtResultIndex(0);
      }
    } catch { /* ignore */ }
  }

  function handleSongBtNext() {
    if (btSearchResults.length <= 1) return;
    const nextIdx = (btResultIndex + 1) % btSearchResults.length;
    setBtResultIndex(nextIdx);
    setBtVideoId(btSearchResults[nextIdx]);
  }

  type SongTab = "practice" | "tabs" | "backing" | "tutorial";
  const [activeTab, setActiveTab] = useState<SongTab>("practice");

  return (
    <div className="flex flex-col h-full">
      {/* ZONE 1: Toolbar */}
      <Toolbar ex={ex} week={week} day={day} onClose={onClose} onDone={onDone} bpm={bpm} note={note} onBpmChange={onBpmChange} onNoteChange={onNoteChange} />

      {/* ZONE 2: Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4">
          <PillTabBar tabs={[
            { id: "practice" as SongTab, label: "Practice" },
            { id: "tabs" as SongTab, label: "Tabs" },
            { id: "backing" as SongTab, label: "Backing Track" },
            { id: "tutorial" as SongTab, label: "Tutorial" },
          ]} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="bg-zinc-900/30 rounded-xl p-5 border border-white/[0.05] min-h-[300px]">
          {activeTab === "practice" && <PracticeTabContent ex={ex} />}

          {activeTab === "tabs" && <GpTabSection ex={ex} />}

          {activeTab === "backing" && (
            <div>
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => setShowOriginal(false)}
                  className={`text-[12px] px-4 py-2 rounded-lg cursor-pointer border transition-all duration-200 ${!showOriginal ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"}`}>
                  Backing Track
                </button>
                <button type="button" onClick={() => setShowOriginal(true)}
                  className={`text-[12px] px-4 py-2 rounded-lg cursor-pointer border transition-all duration-200 ${showOriginal ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"}`}>
                  Original
                </button>
              </div>
              {btLoading && (
                <div className="bg-white/[0.02] rounded-lg p-6 text-center text-[12px] text-zinc-600 mb-3">Searching for backing track...</div>
              )}
              {!showOriginal ? (
                <div>
                  {/* Search bar */}
                  <div className="flex gap-2 mb-3">
                    <input value={btSearchInput} onChange={e => setBtSearchInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSongBtSearch(); }}
                      placeholder={`${songName} backing track guitar...`}
                      className="input flex-1 !text-[12px] min-w-0" />
                    <button type="button" onClick={handleSongBtSearch} className="btn-gold !text-[11px] flex-shrink-0">Search</button>
                  </div>
                  {/* Video display */}
                  {btVideoId && (
                    <div className="relative mb-3">
                      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                        <iframe src={`https://www.youtube.com/embed/${btVideoId}?modestbranding=1&rel=0`}
                          className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Backing Track" />
                      </div>
                      {btSearchResults.length > 1 && (
                        <button type="button" onClick={handleSongBtNext}
                          className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/[0.12] text-zinc-300 text-[11px] font-medium cursor-pointer hover:bg-black/90 transition-all backdrop-blur-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>
                          Next Video
                        </button>
                      )}
                    </div>
                  )}
                  {!btVideoId && !btLoading && (
                    <div className="bg-white/[0.03] border border-dashed border-white/[0.06] rounded-lg p-6 mb-3 text-center">
                      <div className="font-label text-[12px] text-zinc-500">Search for a backing track above</div>
                    </div>
                  )}
                </div>
              ) : (
                <YouTubeEmbed videoId={origVideoId} setVideoId={setOrigVideoId} label="Original" />
              )}
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => window.open(ytSearch(`${songName} backing track guitar`), "_blank")} className="btn-ghost !text-[11px] !px-3 !py-2">Backing Track</button>
                <button type="button" onClick={() => window.open(ytSearch(`${songName} original`), "_blank")} className="btn-ghost !text-[11px] !px-3 !py-2">Original Song</button>
                <button type="button" onClick={() => window.open(ytSearch(`${songName} live`), "_blank")} className="btn-ghost !text-[11px] !px-3 !py-2">Live Version</button>
              </div>
            </div>
          )}

          {activeTab === "tutorial" && (
            <TutorialTabContent exerciseName={songName} ytQuery={`how to play ${songName} guitar`} />
          )}
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   EXERCISE WINDOW - Zone-based layout
   ════════════════════════════════════════════════════════════════ */
const BACKING_CATS = ["Improv", "Riffs", "Composition", "Songs", "Modes"];

function ExerciseWindow({ exercise: ex, mode, scale, style, week, day, savedYtUrl, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  const needsBacking = ex.bt || BACKING_CATS.includes(ex.c);

  const savedVid = savedYtUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const [ytVideoId, setYtVideoId] = useState(savedVid ? savedVid[1] : "");
  const [ytSearchInput, setYtSearchInput] = useState(savedYtUrl || "");
  const [ytSearchResults, setYtSearchResults] = useState<string[]>([]);
  const [ytResultIndex, setYtResultIndex] = useState(0);

  const suno = useSunoTrack(ex, scale, mode, style, needsBacking);

  type ExTab = "practice" | "tabs" | "backing" | "tutorial";
  const [activeTab, setActiveTab] = useState<ExTab>("practice");

  return (
    <div className="flex flex-col h-full">
      {/* ZONE 1: Toolbar */}
      <Toolbar ex={ex} week={week} day={day} onClose={onClose} onDone={onDone} bpm={bpm} note={note} onBpmChange={onBpmChange} onNoteChange={onNoteChange} />

      {/* ZONE 2: Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4">
          <PillTabBar tabs={[
            { id: "practice" as ExTab, label: "Practice" },
            { id: "tabs" as ExTab, label: "Tabs" },
            { id: "backing" as ExTab, label: "Backing Track" },
            { id: "tutorial" as ExTab, label: "Tutorial" },
          ]} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="bg-zinc-900/30 rounded-xl p-5 border border-white/[0.05] min-h-[300px]">
          {activeTab === "practice" && <PracticeTabContent ex={ex} />}

          {activeTab === "tabs" && <GpTabSection ex={ex} />}

          {activeTab === "backing" && (
            <div>
              <YouTubeBackingSection scale={scale} mode={mode} style={style} ex={ex}
                ytVideoId={ytVideoId} setYtVideoId={setYtVideoId}
                ytSearchInput={ytSearchInput} setYtSearchInput={setYtSearchInput}
                ytSearchResults={ytSearchResults} setYtSearchResults={setYtSearchResults}
                ytResultIndex={ytResultIndex} setYtResultIndex={setYtResultIndex} />
              {needsBacking && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <SunoSection ex={ex} scale={scale} mode={mode} suno={suno} />
                </div>
              )}
            </div>
          )}

          {activeTab === "tutorial" && (
            <TutorialTabContent exerciseName={ex.n} ytQuery={ex.yt} />
          )}
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   THEORY WINDOW - Zone-based layout
   ════════════════════════════════════════════════════════════════ */
const TOOL_MAP: Record<string, { label: string; hint: string }> = {
  "Ear Training": { label: "Interval Trainer", hint: "Open Ear Training tools in the Learning Center" },
  "Fretboard": { label: "Fretboard Visualizer", hint: "Open Fretboard tool in the Learning Center" },
  "Modes": { label: "Scale Explorer", hint: "Open Scales tool in the Learning Center" },
  "Keys": { label: "Circle of Fifths", hint: "Open Circle of Fifths in the Learning Center" },
  "Chords": { label: "Chord Diagram", hint: "Open Chord tools in the Learning Center" },
};

function TheoryWindow({ exercise: ex, week, day, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  type TheoryTab = "lesson" | "tool" | "tutorial" | "log";
  const [activeTab, setActiveTab] = useState<TheoryTab>("lesson");
  const tool = TOOL_MAP[ex.c] || { label: "Learning Center", hint: "Open the Learning Center for interactive tools" };

  const steps = ex.d.match(/\d+\.\s+[^.]+\./g) || [];
  const hasSteps = steps.length >= 2;
  const descWithoutSteps = hasSteps ? ex.d.replace(/\d+\.\s+[^.]+\./g, "").trim() : ex.d;

  return (
    <div className="flex flex-col h-full">
      {/* ZONE 1: Toolbar */}
      <Toolbar ex={ex} week={week} day={day} onClose={onClose} onDone={onDone} bpm={bpm} note={note} onBpmChange={onBpmChange} onNoteChange={onNoteChange} />

      {/* ZONE 2: Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4">
          <PillTabBar tabs={[
            { id: "lesson" as TheoryTab, label: "Lesson" },
            { id: "tool" as TheoryTab, label: "Tool" },
            { id: "tutorial" as TheoryTab, label: "Tutorial" },
            { id: "log" as TheoryTab, label: "Log" },
          ]} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="bg-zinc-900/30 rounded-xl p-5 border border-white/[0.05] min-h-[300px]">
          {/* LESSON TAB */}
          {activeTab === "lesson" && (
            <div>
              <SectionLabel color="gold">INSTRUCTIONS</SectionLabel>
              <div className="text-[13px] text-zinc-400 leading-7 mb-4">
                {hasSteps ? descWithoutSteps : ex.d}
              </div>

              {ex.t && (
                <div className="flex gap-3 items-start bg-amber-500/5 border border-amber-500/15 px-4 py-3 rounded-lg mb-5"
                  style={{ boxShadow: "0 0 12px rgba(245,158,11,0.08)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span className="text-[13px] text-amber-400/80 leading-5">{ex.t}</span>
                </div>
              )}

              {hasSteps && (
                <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-amber-400 mb-3">STEPS</div>
                  <ol className="space-y-3">
                    {steps.map((step, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/15 text-amber-400 text-[12px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <span className="text-[13px] text-zinc-400 leading-6">{step.replace(/^\d+\.\s+/, "")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* TOOL TAB */}
          {activeTab === "tool" && (
            <div>
              <SectionLabel color="gold">INTERACTIVE TOOL</SectionLabel>
              <div className="bg-white/[0.03] rounded-lg p-6 text-center mb-4 border border-white/[0.06]">
                <div className="font-heading text-lg text-[var(--text-primary)] mb-2">{tool.label}</div>
                <div className="text-[13px] text-zinc-500 mb-4">{tool.hint}</div>
                <div className="text-[12px] text-zinc-600 mb-4">
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
          {activeTab === "tutorial" && (
            <TutorialTabContent exerciseName={ex.n} ytQuery={ex.yt} />
          )}

          {/* LOG TAB */}
          {activeTab === "log" && (
            <div className="space-y-4">
              <div>
                <SectionLabel color="gold">SESSION LOG</SectionLabel>
                <div className="flex gap-4 items-start">
                  <label className="flex-1">
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">BPM Achieved</span>
                    <input value={bpm} onChange={(e) => onBpmChange(e.target.value)} placeholder="e.g. 120" className="input input-gold w-full" />
                  </label>
                  <label className="flex-[2]">
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Notes</span>
                    <textarea value={note} onChange={(e) => onNoteChange(e.target.value)}
                      placeholder="What went well? What needs work?..."
                      className="input w-full !h-24 resize-none" />
                  </label>
                </div>
              </div>
              <div>
                <SectionLabel color="red">RECORDINGS</SectionLabel>
                <RecorderBox storageKey={week + "-" + day + "-" + ex.id} exerciseName={ex.songName || ex.n} />
              </div>
              <div>
                <SectionLabel color="amber">METRONOME</SectionLabel>
                <MetronomeBox />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Theory doesn't use the bottom dock - metronome/recorder are inside the Log tab */}
    </div>
  );
}


/* ── Focus trap hook for modals ── */
function useFocusTrap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusable = () => el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    const firstFocusable = focusable()[0];
    if (firstFocusable) firstFocusable.focus();
    return () => {
      el.removeEventListener("keydown", trap);
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [ref]);
}


/* ════════════════════════════════════════════════════════════════
   MAIN EXPORT - routes to the correct window type
   ════════════════════════════════════════════════════════════════ */
export default function ExerciseModal(props: Props) {
  const modalType = getModalType(props.exercise);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      className="exercise-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Exercise: ${props.exercise.n}`}>
      <div className="exercise-modal-content" ref={modalRef}>
        {modalType === "song" && <SongWindow {...props} />}
        {modalType === "exercise" && <ExerciseWindow {...props} />}
        {modalType === "theory" && <TheoryWindow {...props} />}
      </div>
    </div>
  );
}

export { useFocusTrap };
