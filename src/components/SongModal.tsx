"use client";
import { useState, useEffect } from "react";
import type { SongEntry } from "@/lib/types";
import { ytSearch } from "@/lib/helpers";
import dynamic from "next/dynamic";
const GpFileUploader = dynamic(() => import("./GpFileUploader"), {
  ssr: false,
  loading: () => <div className="panel p-4 text-center font-label text-sm text-[#444]">Loading viewer...</div>
});

interface Props {
  song: SongEntry;
  onClose: () => void;
}

type Tab = "practice" | "tutorial" | "notes";

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "#22c55e",
  Intermediate: "#f59e0b",
  Advanced: "#ef4444",
};

const PROGRESS_OPTIONS = [
  { value: "not-started", label: "Not Started" },
  { value: "learning", label: "Learning" },
  { value: "slow", label: "Can Play Slow" },
  { value: "full-speed", label: "Can Play Full Speed" },
  { value: "mastered", label: "Mastered" },
];

export default function SongModal({ song, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("practice");

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

  const ytQuery = `how to play ${song.title} ${song.artist} guitar tutorial`;
  const dc = song.difficulty ? DIFFICULTY_COLORS[song.difficulty] || "#888" : "#888";

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="exercise-modal-overlay">
      <div className="exercise-modal-content">

        {/* Close button */}
        <button type="button" onClick={onClose}
          className="sticky top-3 float-left ml-3 z-10 w-9 h-9 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-[#888] text-lg cursor-pointer hover:bg-[#333] hover:text-white transition-colors"
          aria-label="Close">
          ×
        </button>

        {/* Header */}
        <div className="faceplate px-3 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {song.genre && <span className="tag" style={{ border: "1px solid #D4A84360", color: "#D4A843", background: "#D4A84315" }}>{song.genre}</span>}
            {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
            {song.tempo && <span className="font-readout text-[10px] text-[#1A1714]/50">{song.tempo} BPM</span>}
            {song.key && <span className="font-readout text-[10px] text-[#1A1714]/50">Key: {song.key}</span>}
          </div>
          <div className="font-heading text-xl font-bold text-[#1A1714]">{song.title}</div>
          <div className="font-label text-[12px] text-[#1A1714]/60 mt-1">{song.artist}</div>
          {song.album && <div className="font-label text-[9px] text-[#1A1714]/40 mt-0.5">{song.album}{song.year ? ` (${song.year})` : ""}</div>}
          {song.tuning && <div className="font-label text-[9px] text-[#1A1714]/40 mt-0.5">Tuning: {song.tuning}</div>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a] bg-[#0d0d0d]">
          {([
            { id: "practice" as Tab, label: "Practice" },
            { id: "tutorial" as Tab, label: "Tutorial" },
            { id: "notes" as Tab, label: "Notes" },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 font-label text-[10px] cursor-pointer border-b-2 transition-all ${
                tab === id ? "border-[#D4A843] text-[#D4A843]" : "border-transparent text-[#444]"
              }`}>{label}</button>
          ))}
        </div>

        <div className="p-3 sm:p-5">

          {/* Practice Tab */}
          {tab === "practice" && (
            <div>
              {/* GP file uploader */}
              <div className="mb-4">
                <div className="font-label text-[10px] text-[#D4A843] mb-2 flex items-center gap-2">
                  <div className="led led-gold" /> Guitar Pro Tab
                </div>
                <GpFileUploader exerciseId={`song-${song.id}`} songName={song.title} />
                <div className="flex gap-1 flex-wrap mt-2">
                  <button type="button" onClick={async () => {
                    try {
                      const r = await fetch(`/api/gptabs?q=${encodeURIComponent(song.title)}`);
                      const data = await r.json();
                      if (data.length > 0) window.open(data[0].downloadUrl, "_blank");
                      else window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(song.title)}&in=songs&page=1`, "_blank");
                    } catch { window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(song.title)}&in=songs&page=1`, "_blank"); }
                  }} className="btn-ghost !text-[9px] !px-2 !py-1">Download tabs</button>
                  {song.songsterrUrl && (
                    <a href={song.songsterrUrl} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Open in Songsterr</a>
                  )}
                  {!song.songsterrUrl && (
                    <a href={`https://www.songsterr.com/?pattern=${encodeURIComponent(song.title + " " + song.artist)}`} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Search Songsterr</a>
                  )}
                </div>
              </div>

              <div className="divider-gold mb-4" />

              {/* Song details */}
              <div className="panel p-4">
                <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> Song Info
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  {song.artist && <div><span className="text-[#555]">Artist: </span><span className="text-[#bbb]">{song.artist}</span></div>}
                  {song.album && <div><span className="text-[#555]">Album: </span><span className="text-[#bbb]">{song.album}</span></div>}
                  {song.year && <div><span className="text-[#555]">Year: </span><span className="text-[#bbb]">{song.year}</span></div>}
                  {song.genre && <div><span className="text-[#555]">Genre: </span><span className="text-[#bbb]">{song.genre}</span></div>}
                  {song.tempo && <div><span className="text-[#555]">Tempo: </span><span className="text-[#bbb]">{song.tempo} BPM</span></div>}
                  {song.key && <div><span className="text-[#555]">Key: </span><span className="text-[#bbb]">{song.key}</span></div>}
                  {song.tuning && <div><span className="text-[#555]">Tuning: </span><span className="text-[#bbb]">{song.tuning}</span></div>}
                  {song.difficulty && <div><span className="text-[#555]">Difficulty: </span><span style={{ color: dc }}>{song.difficulty}</span></div>}
                </div>
              </div>
            </div>
          )}

          {/* Tutorial Tab */}
          {tab === "tutorial" && (
            <div>
              <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
                <div className="led led-gold" /> Tutorial — {song.title}
              </div>

              {tutorialLoading && (
                <div className="panel p-6 text-center font-label text-sm text-[#444] mb-3">Searching YouTube for tutorial...</div>
              )}

              {tutorialVideoId && (
                <div className="aspect-video w-full rounded-sm overflow-hidden bg-black mb-3">
                  <iframe src={`https://www.youtube.com/embed/${tutorialVideoId}?modestbranding=1&rel=0`}
                    className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Tutorial" />
                </div>
              )}

              {!tutorialVideoId && !tutorialLoading && (
                <div className="panel p-4 mb-3 text-center">
                  <div className="font-label text-sm text-[#444]">Paste a YouTube URL below</div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input value={manualUrl} onChange={e => setManualUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadManualUrl()}
                  placeholder="Paste YouTube URL..."
                  className="input flex-1 !text-xs" />
                <button onClick={loadManualUrl} className="btn-gold !text-[10px]">Load</button>
              </div>

              <button onClick={() => window.open(ytSearch(ytQuery), "_blank")}
                className="btn-ghost w-full justify-center !text-[11px]">
                Search more tutorials on YouTube
              </button>
            </div>
          )}

          {/* Notes Tab */}
          {tab === "notes" && (
            <div>
              <div className="panel p-4 mb-3">
                <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> Progress
                </div>

                {/* Star rating */}
                <div className="mb-3">
                  <div className="font-label text-[9px] text-[#555] mb-1">Difficulty Rating</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setRating(s === rating ? 0 : s)}
                        className={`text-xl cursor-pointer bg-transparent border-none transition-colors ${s <= rating ? "text-[#D4A843]" : "text-[#333]"}`}
                        style={{ textShadow: s <= rating ? "0 0 6px rgba(212,168,67,0.4)" : "none" }}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress status */}
                <div className="mb-3">
                  <div className="font-label text-[9px] text-[#555] mb-1">Status</div>
                  <div className="flex gap-1 flex-wrap">
                    {PROGRESS_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setProgress(opt.value)}
                        className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer border transition-all ${
                          progress === opt.value
                            ? "bg-[#D4A843] text-[#121214] border-[#D4A843]"
                            : "border-[#333] text-[#666]"
                        }`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes textarea */}
              <div className="panel p-4">
                <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> Notes
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
