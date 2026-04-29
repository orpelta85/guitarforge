"use client";

// Phase 7 Part 2 — DrumMachineGrid
// The 16-step drum sequencer rendered inside the bottom dock when the active
// drum track is selected.  Pure presentational + cell-toggle: drum scheduling
// (look-ahead Web Audio loop) lives in StudioPage so it can stay in lock-step
// with the master transport.
//
// The component reads `bpm` from Zustand directly; the parent only passes the
// drum-specific transient state (current step, active track, playback state)
// and the cell/preset/clear handlers.

import { useStudioStore } from "@/stores/studioStore";

export const DRUM_INSTRUMENTS = [
  { name: "Kick", short: "KCK" },
  { name: "Snare", short: "SNR" },
  { name: "HiHat Closed", short: "HHC" },
  { name: "HiHat Open", short: "HHO" },
  { name: "Clap", short: "CLP" },
  { name: "Ride", short: "RDE" },
  { name: "Tom Low", short: "TML" },
  { name: "Tom High", short: "TMH" },
] as const;

export const DRUM_STEPS = 16;

interface DrumPreset {
  name: string;
  pattern: boolean[][];
}

interface ActiveDrumTrack {
  id: number;
  name: string;
  drumPattern?: boolean[][];
}

interface Props {
  activeDrumTrack: ActiveDrumTrack | undefined;
  drumPlaying: boolean;
  drumStep: number;
  drumPresets: DrumPreset[];

  onTogglePlay: () => void;
  onClearPattern: (trackId: number) => void;
  onLoadPreset: (trackId: number, presetIdx: number) => void;
  onToggleCell: (trackId: number, instrIdx: number, stepIdx: number) => void;
}

export default function DrumMachineGrid({
  activeDrumTrack,
  drumPlaying,
  drumStep,
  drumPresets,
  onTogglePlay,
  onClearPattern,
  onLoadPreset,
  onToggleCell,
}: Props) {
  const bpm = useStudioStore((s) => s.bpm);

  if (!activeDrumTrack || !activeDrumTrack.drumPattern) {
    return (
      <div className="text-center py-10 text-[#444] text-[11px]">
        No drum track selected. Add a drum track and click GRID to edit.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${drumPlaying ? "bg-[#ef4444] text-white" : "bg-[#D4A843] text-[#111]"}`}>
          {drumPlaying ? "Stop" : "Play Pattern"}
        </button>
        <span className="text-[10px] text-[#555] font-mono">{bpm} BPM</span>
        <button onClick={() => onClearPattern(activeDrumTrack.id)}
          className="text-[10px] text-[#555] hover:text-[#ef4444] cursor-pointer transition-colors px-2 py-1 rounded border border-[#1e1e1e]">Clear</button>
        <select title="Drum preset"
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (idx >= 0 && idx < drumPresets.length) {
              onLoadPreset(activeDrumTrack.id, idx);
            }
            e.target.value = "";
          }}
          defaultValue=""
          className="bg-[#1a1a1a] text-[10px] text-[#888] border border-[#2a2a2a] rounded px-2 py-1 cursor-pointer">
          <option value="" disabled>Presets...</option>
          {drumPresets.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
        <span className="text-[9px] text-[#333] ml-auto">{activeDrumTrack.name}</span>
      </div>

      {/* Step grid - bigger cells (32px) with beat grouping */}
      <div className="inline-block" style={{ minWidth: "fit-content" }}>
        <div className="flex items-center mb-1" style={{ paddingLeft: 80 }}>
          {Array.from({ length: DRUM_STEPS }, (_, i) => (
            <div key={i}
              className={`flex items-center justify-center text-[8px] font-mono ${drumStep === i ? "text-[#D4A843] font-bold" : i % 4 === 0 ? "text-[#666]" : "text-[#333]"}`}
              style={{ width: 32, marginRight: i % 4 === 3 && i < DRUM_STEPS - 1 ? 6 : 0 }}>
              {i + 1}
            </div>
          ))}
        </div>
        {DRUM_INSTRUMENTS.map((instr, instrIdx) => (
          <div key={instr.name} className="flex items-center mb-[2px]">
            <div className="w-[80px] flex-shrink-0 text-[10px] text-[#888] truncate pr-2 text-right font-medium">{instr.name}</div>
            {activeDrumTrack.drumPattern![instrIdx].map((on, stepIdx) => (
              <button key={stepIdx}
                onClick={() => onToggleCell(activeDrumTrack.id, instrIdx, stepIdx)}
                style={{
                  width: 32,
                  height: 32,
                  marginRight: stepIdx % 4 === 3 && stepIdx < DRUM_STEPS - 1 ? 6 : 0,
                  borderRadius: 3,
                  border: on ? "1px solid #D4A84366" : stepIdx % 4 === 0 ? "1px solid #2a2a2a" : "1px solid #1e1e1e",
                  background: on
                    ? drumStep === stepIdx ? "#D4A843" : "#D4A84399"
                    : drumStep === stepIdx ? "#252525" : stepIdx % 4 === 0 ? "#1a1a1a" : "#141414",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
