"use client";
import { useState, useEffect } from "react";
import type { Exercise } from "@/lib/types";
import { COL } from "@/lib/constants";
import { ytSearch, ssSearch } from "@/lib/helpers";
import TimerBox from "./TimerBox";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import dynamic from "next/dynamic";
const GpFileUploader = dynamic(() => import("./GpFileUploader"), {
  ssr: false,
  loading: () => <div className="panel p-4 text-center font-label text-sm text-[#444]">Loading viewer...</div>
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

type Tab = "practice" | "tutorial" | "log";
const BACKING_CATS = ["אילתור", "ריפים", "יצירה", "שירים", "מודוסים"];

/* ── Tutorial Tab Component ── */
function TutorialTab({ exerciseName, ytQuery, tutorialVideoId, setTutorialVideoId, tutorialLoading, setTutorialLoading, tutorialSearched, setTutorialSearched }: {
  exerciseName: string; ytQuery: string;
  tutorialVideoId: string; setTutorialVideoId: (v: string) => void;
  tutorialLoading: boolean; setTutorialLoading: (v: boolean) => void;
  tutorialSearched: boolean; setTutorialSearched: (v: boolean) => void;
}) {
  const [manualUrl, setManualUrl] = useState("");

  // Auto-fetch first video on tab open
  useEffect(() => {
    if (tutorialSearched || tutorialVideoId) return;
    setTutorialLoading(true);
    setTutorialSearched(true);
    fetch(`/api/youtube?q=${encodeURIComponent(ytQuery + " guitar tutorial")}`)
      .then(r => r.json())
      .then(data => {
        if (data.items?.[0]?.videoId) {
          setTutorialVideoId(data.items[0].videoId);
        }
      })
      .catch(() => {})
      .finally(() => setTutorialLoading(false));
  }, [ytQuery, tutorialSearched, tutorialVideoId, setTutorialLoading, setTutorialSearched, setTutorialVideoId]);

  function loadManual() {
    const m = manualUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (m) setTutorialVideoId(m[1]);
  }

  return (
    <div>
      <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
        <div className="led led-gold" /> Tutorial — {exerciseName}
      </div>

      {/* Loading */}
      {tutorialLoading && (
        <div className="panel p-6 text-center font-label text-sm text-[#444] mb-3">Searching YouTube for tutorial...</div>
      )}

      {/* Auto-loaded video */}
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

      {/* Paste URL to change/set video */}
      <div className="flex gap-2 mb-3">
        <input value={manualUrl} onChange={e => setManualUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && loadManual()}
          placeholder="Paste YouTube URL..."
          className="input flex-1 !text-xs" />
        <button onClick={loadManual} className="btn-gold !text-[10px]">Load</button>
      </div>

      {/* Search for more tutorials — opens YouTube search */}
      <button onClick={() => window.open(ytSearch(ytQuery + " guitar tutorial"), "_blank")}
        className="btn-ghost w-full justify-center !text-[11px]">
        Search more tutorials on YouTube
      </button>
    </div>
  );
}

export default function ExerciseModal({ exercise: ex, mode, scale, style, week, day, savedYtUrl, bpm, note, onBpmChange, onNoteChange, onClose, onDone }: Props) {
  const cc = COL[ex.c] || "#888";
  const [tab, setTab] = useState<Tab>("practice");
  // Auto-load saved YouTube URL if exists
  const savedVid = savedYtUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const [ytVideoId, setYtVideoId] = useState(savedVid ? savedVid[1] : "");
  const [ytSearchInput, setYtSearchInput] = useState(savedYtUrl || "");
  const [tutorialVideoId, setTutorialVideoId] = useState("");
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const [tutorialSearched, setTutorialSearched] = useState(false);

  const needsBacking = ex.bt || BACKING_CATS.includes(ex.c);

  // YouTube: only embed works, not search results page
  // So we provide search links that open in the iframe-compatible embed format
  function searchYouTube(query: string) {
    // Open YouTube search in a new tab — iframe search doesn't work
    window.open(ytSearch(query), "_blank");
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/93 z-[999] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-sm max-w-[760px] w-full max-h-[94vh] overflow-auto">

        {/* Header */}
        <div className="faceplate px-5 py-4 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag" style={{ border: `1px solid ${cc}60`, color: cc, background: cc + "15" }}>{ex.c}</span>
              {ex.b && <span className="font-readout text-[10px] text-[#1A1714]/50">{ex.b} BPM</span>}
              <span className="font-readout text-[10px] text-[#1A1714]/50">{ex.m} min</span>
            </div>
            <div className="font-heading text-xl font-bold text-[#1A1714] mt-2">{ex.n}</div>
            <div className="font-label text-[9px] text-[#1A1714]/40 mt-1">{ex.f}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {onDone && <button onClick={onDone} className="font-label text-[10px] px-3 py-1.5 rounded-sm bg-[#33CC33] text-[#0A0A0A] cursor-pointer">Done</button>}
            <button onClick={onClose} className="w-7 h-7 rounded-full border border-[#1A1714]/20 flex items-center justify-center text-[#1A1714]/40 text-sm cursor-pointer hover:text-[#1A1714]/70">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a] bg-[#0d0d0d]">
          {([
            { id: "practice" as Tab, label: "Practice" },
            { id: "tutorial" as Tab, label: "Tutorial" },
            { id: "log" as Tab, label: "Log" },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 font-label text-[10px] cursor-pointer border-b-2 transition-all ${
                tab === id ? "border-[#D4A843] text-[#D4A843]" : "border-transparent text-[#444]"
              }`}>{label}</button>
          ))}
        </div>

        <div className="p-5">

          {/* ═══ PRACTICE TAB ═══ */}
          {tab === "practice" && (
            <div>
              {/* Description + tips */}
              <div className="text-[13px] text-[#bbb] leading-7 mb-3">{ex.d}</div>
              {ex.t && (
                <div className="flex gap-3 items-start bg-[#D4A843]/5 border border-[#D4A843]/15 px-4 py-3 rounded-sm mb-4">
                  <div className="led led-gold mt-1 flex-shrink-0" />
                  <span className="text-[12px] text-[#D4A843]/80 leading-5">{ex.t}</span>
                </div>
              )}

              <div className="divider-gold mb-4" />

              {/* Backing Track section — for backing exercises */}
              {needsBacking && (
                <div className="mb-4">
                  <div className="font-label text-[10px] text-[#D4A843] mb-2 flex items-center gap-2">
                    <div className="led led-gold" /> Backing Track
                  </div>

                  {/* YouTube video embed — if user pasted a video ID */}
                  {ytVideoId && (
                    <div className="aspect-video w-full rounded-sm overflow-hidden bg-black mb-2">
                      <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
                        className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Backing" />
                    </div>
                  )}

                  {/* Paste YouTube URL or video ID */}
                  <div className="flex gap-2 mb-2">
                    <input value={ytSearchInput} onChange={e => setYtSearchInput(e.target.value)}
                      placeholder="Paste YouTube URL here..."
                      onKeyDown={e => {
                        if (e.key !== "Enter") return;
                        const m = ytSearchInput.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                        if (m) setYtVideoId(m[1]);
                      }}
                      className="input flex-1 !text-xs" />
                    <button onClick={() => {
                      const m = ytSearchInput.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                      if (m) setYtVideoId(m[1]);
                    }} className="btn-gold !text-[10px]">Load</button>
                  </div>

                  {/* Search buttons — open YouTube in new tab to find tracks */}
                  <div className="font-label text-[9px] text-[#555] mb-1">Find a backing track on YouTube:</div>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => searchYouTube(`${scale} ${mode} backing track guitar`)} className="btn-ghost !text-[9px] !px-2 !py-1">{scale} {mode}</button>
                    <button onClick={() => searchYouTube(`${scale} ${style} jam track`)} className="btn-ghost !text-[9px] !px-2 !py-1">{style} Jam</button>
                    <button onClick={() => searchYouTube(`${scale} slow blues backing track`)} className="btn-ghost !text-[9px] !px-2 !py-1">Slow Blues</button>
                    {ex.songName && <button onClick={() => searchYouTube(`${ex.songName} backing track`)} className="btn-ghost !text-[9px] !px-2 !py-1">{ex.songName}</button>}
                  </div>
                  <div className="font-label text-[8px] text-[#333] mt-1">Copy the URL from YouTube and paste above to play here</div>
                </div>
              )}

              {/* Guitar Pro Tab — available in ALL exercises */}
              <div className="mb-4">
                <div className="font-label text-[10px] text-[#D4A843] mb-2 flex items-center gap-2">
                  <div className="led led-gold" /> Guitar Pro Tab
                </div>
                <GpFileUploader />
                <div className="flex gap-1 flex-wrap mt-2">
                  <a href={`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.songName || ex.n)}`} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Download tabs</a>
                  {(ex.ss || ex.songUrl) && <a href={ex.songUrl || ssSearch(ex.songName || ex.n)} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Songsterr</a>}
                </div>
              </div>

              <div className="divider-gold mb-4" />

              {/* Practice tools */}
              <TimerBox minutes={ex.m} />
              <MetronomeBox />
              <RecorderBox storageKey={week + "-" + day + "-" + ex.id} />
            </div>
          )}

          {/* ═══ TUTORIAL TAB ═══ */}
          {tab === "tutorial" && (
            <TutorialTab
              exerciseName={ex.n}
              ytQuery={ex.yt}
              tutorialVideoId={tutorialVideoId}
              setTutorialVideoId={setTutorialVideoId}
              tutorialLoading={tutorialLoading}
              setTutorialLoading={setTutorialLoading}
              tutorialSearched={tutorialSearched}
              setTutorialSearched={setTutorialSearched}
            />
          )}

          {/* ═══ LOG TAB ═══ */}
          {tab === "log" && (
            <div>
              <div className="panel p-4 mb-3">
                <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> Session Log
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <label className="font-label text-[9px] text-[#555]">BPM Achieved
                    <input value={bpm} onChange={(e) => onBpmChange(e.target.value)} placeholder="e.g. 120" className="input input-gold mt-1" />
                  </label>
                  <label className="font-label text-[9px] text-[#555]">Date
                    <input value={new Date().toLocaleDateString("he-IL")} disabled className="input mt-1 !text-[#444]" />
                  </label>
                </div>
                <label className="font-label text-[9px] text-[#555]">Notes
                  <textarea value={note} onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="What went well? What needs work?..."
                    className="input mt-1 !h-20 resize-none" />
                </label>
              </div>
              <RecorderBox storageKey={week + "-" + day + "-" + ex.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
