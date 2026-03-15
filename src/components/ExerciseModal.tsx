"use client";
import { useState } from "react";
import type { Exercise } from "@/lib/types";
import { COL } from "@/lib/constants";
import { ytSearch, btSearch, ssSearch } from "@/lib/helpers";
import TimerBox from "./TimerBox";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import YouTubePlayerBox from "./YouTubePlayer";

interface Props {
  exercise: Exercise;
  mode: string; scale: string; style: string;
  week: number; day: string;
  bpm: string; note: string;
  onBpmChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onClose: () => void;
}

type Tab = "tools" | "video" | "tutorial" | "notes";

export default function ExerciseModal({ exercise: ex, mode, scale, style, week, day, bpm, note, onBpmChange, onNoteChange, onClose }: Props) {
  const cc = COL[ex.c] || "#888";
  const [tab, setTab] = useState<Tab>("tools");

  const backingQuery = `${scale} ${mode} ${style} backing track guitar instrumental`;
  const tutorialQuery = `${ex.yt} tutorial lesson how to play`;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/93 z-[999] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-sm max-w-[720px] w-full max-h-[94vh] overflow-auto">

        {/* Header — cream faceplate */}
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
          <button onClick={onClose}
            className="w-7 h-7 rounded-full border border-[#1A1714]/20 flex items-center justify-center text-[#1A1714]/40 text-sm cursor-pointer hover:text-[#1A1714]/70 transition-all ml-3 flex-shrink-0">
            ×
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-[#1a1a1a] bg-[#0d0d0d]">
          {([
            { id: "tools" as Tab, label: "Practice" },
            { id: "video" as Tab, label: "Backing Track" },
            { id: "tutorial" as Tab, label: "Tutorial" },
            { id: "notes" as Tab, label: "Log" },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 font-label text-[10px] cursor-pointer transition-all border-b-2 ${
                tab === id ? "border-[#D4A843] text-[#D4A843]" : "border-transparent text-[#444] hover:text-[#888]"
              }`}>{label}</button>
          ))}
        </div>

        <div className="p-5">
          {/* Description */}
          <div className="text-[13px] text-[#bbb] leading-7 mb-3">{ex.d}</div>

          {ex.t && (
            <div className="flex gap-3 items-start bg-[#D4A843]/5 border border-[#D4A843]/15 px-4 py-3 rounded-sm mb-4">
              <div className="led led-gold mt-1 flex-shrink-0" />
              <span className="text-[12px] text-[#D4A843]/80 leading-5">{ex.t}</span>
            </div>
          )}

          {/* Quick links — always visible */}
          <div className="flex gap-2 flex-wrap mb-4">
            <a href={ytSearch(ex.yt)} target="_blank" rel="noopener noreferrer" className="btn-gold no-underline !text-[10px]">YouTube</a>
            {ex.bt && <a href={btSearch(mode, scale, style)} target="_blank" rel="noopener noreferrer"
              className="btn-ghost no-underline !text-[10px]" style={{ borderColor: "#33CC33", color: "#33CC33" }}>Backing · {scale} {mode}</a>}
            {(ex.ss || ex.songUrl) && <a href={ex.songUrl || ssSearch(ex.songName || ex.n)} target="_blank" rel="noopener noreferrer"
              className="btn-ghost no-underline !text-[10px]">Songsterr Tab</a>}
            <a href={`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.songName || ex.n)}`} target="_blank" rel="noopener noreferrer"
              className="btn-ghost no-underline !text-[10px]">GP Tabs</a>
          </div>

          <div className="divider-gold mb-4" />

          {/* ── PRACTICE TAB ── */}
          {tab === "tools" && (
            <div>
              <TimerBox minutes={ex.m} />
              <MetronomeBox />
              <RecorderBox storageKey={week + "-" + day + "-" + ex.id} />
            </div>
          )}

          {/* ── BACKING TRACK TAB ── */}
          {tab === "video" && (
            <div>
              <YouTubePlayerBox query={ex.bt ? backingQuery : ex.yt} />
              <div className="panel p-3 mt-3">
                <div className="font-label text-[9px] text-[#555] mb-2">Quick Search</div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    `${scale} ${mode} backing track`,
                    `${scale} ${style} jam track`,
                    `${scale} slow blues backing`,
                    `${ex.songName || ex.n} backing track`,
                  ].map((q, i) => (
                    <a key={i} href={ytSearch(q)} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost no-underline !text-[9px] !px-2 !py-1">{q}</a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TUTORIAL TAB ── */}
          {tab === "tutorial" && (
            <div>
              <YouTubePlayerBox query={tutorialQuery} />
              <div className="panel p-3 mt-3">
                <div className="font-label text-[9px] text-[#555] mb-2">Resources</div>
                <div className="flex gap-1.5 flex-wrap">
                  <a href={ytSearch(ex.yt + " lesson")} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost no-underline !text-[9px] !px-2 !py-1">YouTube Lesson</a>
                  <a href={ytSearch(ex.yt + " slow demonstration")} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Slow Demo</a>
                  {(ex.ss || ex.songUrl) && <a href={ex.songUrl || ssSearch(ex.songName || ex.n)} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Songsterr</a>}
                  <a href={`https://guitarprotabs.org/search.php?search=${encodeURIComponent(ex.songName || ex.n)}`} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost no-underline !text-[9px] !px-2 !py-1">Guitar Pro Tabs</a>
                </div>
              </div>
            </div>
          )}

          {/* ── LOG TAB ── */}
          {tab === "notes" && (
            <div>
              <div className="panel p-4 mb-3">
                <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
                  <div className="led led-gold" /> Session Log
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <label className="font-label text-[9px] text-[#555]">
                    BPM Achieved
                    <input value={bpm} onChange={(e) => onBpmChange(e.target.value)}
                      placeholder="e.g. 120" className="input input-gold mt-1" />
                  </label>
                  <label className="font-label text-[9px] text-[#555]">
                    Date
                    <input value={new Date().toLocaleDateString("he-IL")} disabled className="input mt-1 !text-[#444]" />
                  </label>
                </div>
                <label className="font-label text-[9px] text-[#555]">
                  Notes
                  <textarea value={note} onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="What went well? What needs work? Any observations..."
                    className="input mt-1 !h-24 resize-none" />
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
