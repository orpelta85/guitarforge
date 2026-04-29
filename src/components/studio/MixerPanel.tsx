"use client";

// Phase 7 Part 2 — MixerPanel
// The vertical fader / channel-strip view shown in the bottom dock when the
// "Mixer" tab is active.  Reads `tracks` and `masterVol` straight from Zustand;
// the parent passes only the per-track volume + solo/mute handlers.

import { useStudioStore, type StudioTrack } from "@/stores/studioStore";

interface Props {
  updateTrackVol: (id: number, vol: number) => void;
  toggleMute: (id: number) => void;
  /**
   * Solo handler — kept matching the parent signature.  The mixer's "S" button
   * uses an inline mute-others toggle (spec'd this way prior to extraction)
   * which is why solo isn't simply `toggleSolo` from the parent.  We expose
   * both so the parent can keep its solo-state logic in one place.
   */
  onSoloToggle: (trackId: number) => void;
  /** True when the given track is the only un-muted one (solo-by-mute mode). */
  isSoloByMute: (trackId: number) => boolean;
}

export default function MixerPanel({
  updateTrackVol,
  toggleMute,
  onSoloToggle,
  isSoloByMute,
}: Props) {
  const tracks: StudioTrack[] = useStudioStore((s) => s.tracks);
  const masterVol = useStudioStore((s) => s.masterVol);
  const setMasterVol = useStudioStore((s) => s.setMasterVol);

  if (tracks.length === 0) {
    return (
      <div className="text-center py-10 text-[#444] text-[11px]">
        No tracks to mix. Add some tracks first.
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
      {tracks.map((tr) => {
        const soloActive = isSoloByMute(tr.id);
        return (
          <div key={tr.id} className="flex flex-col items-center gap-2 px-3 py-2 rounded-lg min-w-[70px]"
            style={{ background: "#0e0e0e", border: `1px solid ${tr.color}33` }}>
            <div className="w-2 h-2 rounded-full" style={{ background: tr.color }} />
            <span className="text-[8px] text-[#888] truncate max-w-[60px] text-center">{tr.name}</span>
            {/* Vertical fader representation */}
            <div className="relative w-3 h-32 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
              <div className="absolute bottom-0 w-full rounded-full transition-all" style={{ height: `${tr.volume}%`, background: `${tr.color}88` }} />
            </div>
            <input type="range" min={0} max={100} value={tr.volume}
              onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
              className="w-20 h-[2px] cursor-pointer -rotate-0" style={{ accentColor: tr.color }} />
            <span className="text-[8px] text-[#555] font-mono">{tr.volume}%</span>
            <div className="flex gap-1">
              <button onClick={() => onSoloToggle(tr.id)}
                className={`text-[7px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${
                  soloActive ? "text-[#111]" : "border border-[#2a2a2a] text-[#555] hover:border-[#D4A843] hover:text-[#D4A843]"
                }`}
                style={{ background: soloActive ? "#D4A843" : "transparent" }}>
                S
              </button>
              <button onClick={() => toggleMute(tr.id)}
                className={`text-[7px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${tr.muted ? "text-white" : "border border-[#2a2a2a] text-[#555] hover:border-[#ef4444] hover:text-[#ef4444]"}`}
                style={{ background: tr.muted ? "#ef4444" : "transparent" }}>
                M
              </button>
            </div>
          </div>
        );
      })}

      {/* Master channel */}
      <div className="flex flex-col items-center gap-2 px-3 py-2 rounded-lg min-w-[70px]"
        style={{ background: "#0e0e0e", border: "1px solid #D4A84333" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: "#D4A843" }} />
        <span className="text-[8px] text-[#D4A843] font-medium">Master</span>
        <div className="relative w-3 h-32 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
          <div className="absolute bottom-0 w-full rounded-full transition-all" style={{ height: `${masterVol}%`, background: "#D4A84388" }} />
        </div>
        <input type="range" min={0} max={100} value={masterVol}
          onChange={(e) => setMasterVol(Number(e.target.value))}
          className="w-20 h-[2px] cursor-pointer accent-[#D4A843]" />
        <span className="text-[8px] text-[#555] font-mono">{masterVol}%</span>
      </div>
    </div>
  );
}
