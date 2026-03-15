"use client";
import { useState } from "react";
import type { Exercise } from "@/lib/types";
import { COL } from "@/lib/constants";
import { ytSearch, btSearch, ssSearch } from "@/lib/helpers";
import TimerBox from "./TimerBox";
import MetronomeBox from "./MetronomeBox";
import RecorderBox from "./RecorderBox";
import YouTubePlayerBox from "./YouTubePlayer";

interface ExerciseModalProps {
  exercise: Exercise;
  mode: string; scale: string; style: string;
  week: number; day: string;
  bpm: string; note: string;
  onBpmChange: (val: string) => void;
  onNoteChange: (val: string) => void;
  onClose: () => void;
}

type ModalTab = "tools" | "video" | "tutorial";

export default function ExerciseModal({ exercise: ex, mode, scale, style, week, day, bpm, note, onBpmChange, onNoteChange, onClose }: ExerciseModalProps) {
  const cc = COL[ex.c] || "#888";
  const [tab, setTab] = useState<ModalTab>("tools");

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/93 z-[999] flex items-center justify-center p-3">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-sm max-w-[700px] w-full max-h-[92vh] overflow-auto">
        {/* Header — cream faceplate */}
        <div className="faceplate px-5 py-4 flex justify-between items-start">
          <div>
            <span className="tag" style={{ border: `1px solid ${cc}60`, color: cc, background: cc + "15" }}>{ex.c}</span>
            <div className="font-heading text-xl font-bold text-[#1A1714] mt-2">{ex.n}</div>
            <div className="font-label text-[9px] text-[#1A1714]/50 mt-1">{ex.f}</div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full border border-[#1A1714]/20 flex items-center justify-center text-[#1A1714]/50 text-sm cursor-pointer hover:text-[#1A1714]/70 transition-all">
            ×
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-[#1a1a1a]">
          {([
            { id: "tools" as ModalTab, label: "Practice Tools" },
            { id: "video" as ModalTab, label: "Backing Track" },
            { id: "tutorial" as ModalTab, label: "Tutorial" },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 font-label text-[10px] cursor-pointer transition-all border-b-2 ${
                tab === id ? "border-[#D4A843] text-[#D4A843]" : "border-transparent text-[#555] hover:text-[#888]"
              }`}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Description — always visible */}
          <div className="text-[13px] text-[#ccc] leading-7 mb-3">{ex.d}</div>

          {ex.t && (
            <div className="flex gap-3 items-start bg-[#D4A843]/5 border border-[#D4A843]/15 px-4 py-3 rounded-sm mb-4">
              <div className="led led-gold mt-1 flex-shrink-0" />
              <span className="text-[12px] text-[#D4A843]/80 leading-5">{ex.t}</span>
            </div>
          )}

          <div className="divider-gold mb-4" />

          {/* Tab: Practice Tools */}
          {tab === "tools" && (
            <div>
              <TimerBox minutes={ex.m} />
              <MetronomeBox />
              <RecorderBox storageKey={week + "-" + day + "-" + ex.id} />
            </div>
          )}

          {/* Tab: Backing Track / Video */}
          {tab === "video" && (
            <div>
              {ex.bt ? (
                <YouTubePlayerBox query={scale + " " + mode + " " + style + " backing track guitar"} />
              ) : (
                <YouTubePlayerBox query={ex.yt} />
              )}

              {/* Quick links */}
              <div className="flex gap-2 flex-wrap">
                <a href={ytSearch(ex.yt)} target="_blank" rel="noopener noreferrer" className="btn-ghost no-underline !text-[10px]">Search YouTube</a>
                {ex.bt && <a href={btSearch(mode, scale, style)} target="_blank" rel="noopener noreferrer"
                  className="btn-ghost no-underline !text-[10px]" style={{ borderColor: "#33CC33", color: "#33CC33" }}>Backing {scale} {mode}</a>}
              </div>
            </div>
          )}

          {/* Tab: Tutorial */}
          {tab === "tutorial" && (
            <div>
              <YouTubePlayerBox query={ex.yt + " tutorial lesson"} />

              <div className="flex gap-2 flex-wrap">
                <a href={ytSearch(ex.yt)} target="_blank" rel="noopener noreferrer" className="btn-ghost no-underline !text-[10px]">YouTube Tutorial</a>
                {(ex.ss || ex.songUrl) && <a href={ex.songUrl || ssSearch(ex.songName || ex.n)} target="_blank" rel="noopener noreferrer"
                  className="btn-ghost no-underline !text-[10px]">Tab / Songsterr</a>}
              </div>
            </div>
          )}

          {/* Session Log — always visible */}
          <div className="bg-[#0A0A0A] rounded-sm p-4 border border-[#1a1a1a] mt-4">
            <div className="font-label text-[10px] text-[#555] mb-2 flex items-center gap-2">
              <div className="led led-gold" /> Session Log
            </div>
            <div className="flex gap-2">
              <input placeholder="BPM" value={bpm} onChange={(e) => onBpmChange(e.target.value)} className="input input-gold !w-20" />
              <input placeholder="Notes..." value={note} onChange={(e) => onNoteChange(e.target.value)} className="input flex-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
