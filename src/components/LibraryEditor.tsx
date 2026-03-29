"use client";
import { useState, useEffect } from "react";
import type { Exercise, ExEditMap } from "@/lib/types";
import { CATS, COL } from "@/lib/constants";
import { ytSearch } from "@/lib/helpers";
import dynamic from "next/dynamic";
const GpFileUploader = dynamic(() => import("./GpFileUploader"), {
  ssr: false,
  loading: () => <div className="panel p-3 text-center font-label text-[10px] text-[#444]">Loading...</div>
});

interface Props {
  ex: Exercise;
  exEdits: ExEditMap;
  setExEdits: React.Dispatch<React.SetStateAction<ExEditMap>>;
}

function extractVid(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getLockedVideo(exerciseId: number | string, type: string): string | null {
  try { return localStorage.getItem(`gf-locked-yt-${exerciseId}-${type}`); } catch { return null; }
}

export default function LibraryEditor({ ex, exEdits, setExEdits }: Props) {
  const lockedId = getLockedVideo(ex.id, "tutorial");
  const [videoResults, setVideoResults] = useState<string[]>([]);
  const [resultIdx, setResultIdx] = useState(0);
  const [autoVideoId, setAutoVideoId] = useState(lockedId || "");
  const [autoLoading, setAutoLoading] = useState(false);
  const [showGp, setShowGp] = useState(false);
  const [isLocked, setIsLocked] = useState(!!lockedId);

  // Auto-fetch tutorial video (skip if locked)
  useEffect(() => {
    if (lockedId) { setAutoVideoId(lockedId); return; }
    setAutoLoading(true);
    fetch(`/api/youtube?q=${encodeURIComponent(ex.yt + " guitar tutorial")}`)
      .then(r => r.json())
      .then(data => {
        const ids: string[] = data.results || data.items?.map((i: { videoId: string }) => i.videoId).filter(Boolean) || [];
        if (ids.length > 0) { setAutoVideoId(ids[0]); setVideoResults(ids); setResultIdx(0); }
      })
      .catch(() => {})
      .finally(() => setAutoLoading(false));
  }, [ex.yt, lockedId]);

  function handleNextVideo() {
    if (videoResults.length <= 1) return;
    const next = (resultIdx + 1) % videoResults.length;
    setResultIdx(next);
    setAutoVideoId(videoResults[next]);
  }

  function update(key: string, value: string | number) {
    setExEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], [key]: value } }));
  }

  const savedYtUrl = exEdits[ex.id]?.ytUrl || "";
  const savedVid = extractVid(savedYtUrl);
  const displayVid = savedVid || autoVideoId;

  function toggleLock() {
    if (!displayVid) return;
    if (isLocked) {
      try { localStorage.removeItem(`gf-locked-yt-${ex.id}-tutorial`); } catch {}
      setIsLocked(false);
    } else {
      try { localStorage.setItem(`gf-locked-yt-${ex.id}-tutorial`, displayVid); } catch {}
      setIsLocked(true);
    }
  }

  return (
    <div className="px-4 py-4 border-t border-[#1a1a1a] bg-[#121214]">
      {/* Basic info */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <label className="font-label text-[10px] text-[#555]">Name
          <input value={ex.n} onChange={e => update("n", e.target.value)} className="input mt-1" />
        </label>
        <label className="font-label text-[10px] text-[#555]">Category
          <select value={ex.c} onChange={e => update("c", e.target.value)} className="input mt-1" style={{ borderColor: (COL[ex.c] || "#333") + "40", color: COL[ex.c] || "#ccc" }}>
            {CATS.filter(c => c !== "Songs").map(c => <option key={c} value={c} style={{ color: "#ccc" }}>{c}</option>)}
          </select>
        </label>
        <label className="font-label text-[10px] text-[#555]">Duration (min)
          <input type="number" value={ex.m} min={1} max={60} onChange={e => update("m", Number(e.target.value))} className="input input-gold mt-1" />
        </label>
      </div>

      <label className="font-label text-[10px] text-[#555] block mb-3">Description
        <textarea value={ex.d} onChange={e => update("d", e.target.value)} className="input mt-1 !h-16 resize-none" />
      </label>

      <label className="font-label text-[10px] text-[#555] block mb-3">Tips
        <input value={ex.t} onChange={e => update("t", e.target.value)} className="input mt-1" />
      </label>

      {/* BPM range */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="font-label text-[10px] text-[#555]">Min BPM
          <input type="number" value={ex.b ? Number(ex.b.split("-")[0]) || "" : ""} min={20} max={300}
            onChange={e => {
              const min = e.target.value;
              const max = ex.b ? ex.b.split("-")[1] || min : min;
              update("b", min + "-" + max);
            }} className="input mt-1" />
        </label>
        <label className="font-label text-[10px] text-[#555]">Max BPM
          <input type="number" value={ex.b ? Number(ex.b.split("-")[1]) || "" : ""} min={20} max={300}
            onChange={e => {
              const max = e.target.value;
              const min = ex.b ? ex.b.split("-")[0] || max : max;
              update("b", min + "-" + max);
            }} className="input mt-1" />
        </label>
      </div>

      {/* Focus areas */}
      <label className="font-label text-[10px] text-[#555] block mb-3">Focus Areas (comma-separated)
        <input value={ex.f} onChange={e => update("f", e.target.value)} className="input mt-1" placeholder="e.g. accuracy, speed, endurance" />
      </label>

      {/* YouTube tutorial — auto-embedded */}
      <div className="panel p-3 mb-3">
        <div className="font-label text-[10px] text-[#D4A843] mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`led ${displayVid ? "led-gold" : "led-off"}`} /> Tutorial Video
            {isLocked && <span className="font-readout text-[8px] px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">Locked</span>}
          </div>
          <div className="flex items-center gap-1">
            {videoResults.length > 1 && !isLocked && (
              <button type="button" onClick={handleNextVideo}
                className="btn-ghost !text-[9px] !px-2 !py-1 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>
                Next ({resultIdx + 1}/{videoResults.length})
              </button>
            )}
            {displayVid && (
              <button type="button" onClick={toggleLock}
                title={isLocked ? "Unlock video" : "Lock this video"}
                className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-all text-[14px] ${
                  isLocked ? "bg-amber-500/15 border border-amber-500/30 text-amber-400" : "bg-white/[0.04] border border-white/[0.08] text-zinc-600 hover:text-zinc-400"
                }`}>
                {isLocked ? "\uD83D\uDD12" : "\uD83D\uDD13"}
              </button>
            )}
          </div>
        </div>

        {autoLoading && <div className="text-[10px] text-[#444] mb-2">Searching YouTube...</div>}

        {displayVid && (
          <div className="aspect-video w-full rounded-sm overflow-hidden bg-black mb-2">
            <iframe src={`https://www.youtube.com/embed/${displayVid}?modestbranding=1&rel=0`}
              className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Tutorial" />
          </div>
        )}

        <label className="font-label text-[10px] text-[#555] block mb-2">YouTube URL (paste to override auto-video)
          <input placeholder="https://youtube.com/watch?v=..." value={savedYtUrl}
            onChange={e => update("ytUrl", e.target.value)} className="input mt-1" />
        </label>

        <label className="font-label text-[10px] text-[#555] block mb-2">YouTube Search Query
          <input value={ex.yt} onChange={e => update("yt", e.target.value)} className="input mt-1" />
        </label>

        <button onClick={() => window.open(ytSearch(ex.yt + " guitar tutorial"), "_blank")}
          className="btn-ghost !text-[10px] w-full justify-center">Search more on YouTube</button>
      </div>

      {/* Guitar Pro Tab */}
      <div className="panel p-3 mb-3">
        <div className="font-label text-[10px] text-[#D4A843] mb-2 flex items-center gap-2">
          <div className={`led ${ex.tex ? "led-on" : "led-off"}`} /> Guitar Pro Tab
        </div>
        {!showGp && !ex.tex ? (
          <button onClick={() => setShowGp(true)} className="btn-ghost !text-[10px] w-full justify-center">Upload GP File</button>
        ) : (
          <GpFileUploader exerciseId={String(ex.id)} tex={ex.tex} songName={ex.n} />
        )}
        <button onClick={async () => {
          try {
            const r = await fetch(`/api/gptabs?q=${encodeURIComponent(ex.n)}`);
            const data = await r.json();
            if (data.length > 0) window.open(data[0].downloadUrl, "_blank");
            else window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.n)}&in=songs&page=1`, "_blank");
          } catch { window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.n)}&in=songs&page=1`, "_blank"); }
        }} className="btn-ghost !text-[9px] w-full justify-center mt-2">Download from guitarprotabs.org</button>
      </div>

      {/* Notes */}
      <label className="font-label text-[10px] text-[#555] block mb-3">Personal Notes
        <input value={exEdits[ex.id]?.notes || ""} onChange={e => update("notes", e.target.value)} className="input mt-1" />
      </label>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => setExEdits(p => { const n = { ...p }; delete n[ex.id]; return n; })}
          className="btn-ghost !text-[#C41E3A] !text-[11px]">Reset to Default</button>
      </div>
    </div>
  );
}
