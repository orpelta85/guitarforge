"use client";

import { memo, type Dispatch, type SetStateAction } from "react";
import ClipRegion, { type TrackRegion } from "./ClipRegion";

// Local copy of the StudioPage StudioTrack shape.  Kept narrow so the parent
// can keep its own definition private; if the parent type widens we just add
// optional fields here.
export interface TrackRowTrack {
  id: number;
  name: string;
  color: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  type: "recording" | "import" | "suno" | "drum" | "youtube";
  drumPattern?: boolean[][];
  videoId?: string;
  videoTitle?: string;
  videoThumbnail?: string;
}

const DRUM_STEPS = 16;

interface Props {
  track: TrackRowTrack;
  trackRegions: TrackRegion[];
  hasSolo: boolean;
  isEditingName: boolean;
  isExpandedDrum: boolean;
  dockPanelIsDrums: boolean;
  drumStep: number;
  pxPerSec: number;
  snapBeatSec: number;
  snapToGrid: boolean;

  // Stable handlers (parent passes useCallback-wrapped fns).
  updateTrackVol: (id: number, vol: number) => void;
  updateTrackPan: (id: number, pan: number) => void;
  toggleMute: (id: number) => void;
  toggleSolo: (id: number) => void;
  deleteTrack: (id: number) => void;
  renameTrack: (id: number, name: string) => void;
  handleDrumGridToggle: (trackId: number) => void;
  setEditingTrackName: Dispatch<SetStateAction<number | null>>;
  updateRegion: (regionId: string, patch: Partial<TrackRegion>) => void;
  splitRegion: (regionId: string, splitTime: number) => void;
  deleteRegion: (regionId: string) => void;

  // Ref attachers — stable across renders so they don't bust memo.
  attachYTContainer: (id: number, el: HTMLDivElement | null) => void;
  attachWaveformContainer: (id: number, el: HTMLDivElement | null) => void;
}

function TrackRowImpl({
  track: tr,
  trackRegions,
  hasSolo,
  isEditingName,
  isExpandedDrum,
  dockPanelIsDrums,
  drumStep,
  pxPerSec,
  snapBeatSec,
  snapToGrid,
  updateTrackVol,
  updateTrackPan,
  toggleMute,
  toggleSolo,
  deleteTrack,
  renameTrack,
  handleDrumGridToggle,
  setEditingTrackName,
  updateRegion,
  splitRegion,
  deleteRegion,
  attachYTContainer,
  attachWaveformContainer,
}: Props) {
  const hasRegions = trackRegions.length > 0;
  const isMutedForRegions = hasSolo ? !tr.solo : tr.muted;

  return (
    <div className="flex border-b" style={{ borderColor: "#1a1a1a" }}>
      {/* ─── Track Header (channel strip) ─── */}
      <div className="w-[180px] sm:w-[220px] flex-shrink-0 flex flex-col justify-center px-3 py-2 gap-1.5"
        style={{ background: "#0e0e0e", borderRight: `2px solid ${tr.color}44` }}>

        {/* Track name + type icon */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tr.color }} />
          <span className="text-[9px] text-[#444] flex-shrink-0">
            {tr.type === "drum" ? "🥁" : tr.type === "suno" ? "🎵" : tr.type === "recording" ? "🎙" : tr.type === "youtube" ? "🎬" : "📁"}
          </span>
          {isEditingName ? (
            <input autoFocus defaultValue={tr.name}
              onBlur={(e) => { renameTrack(tr.id, e.target.value || tr.name); setEditingTrackName(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { renameTrack(tr.id, (e.target as HTMLInputElement).value || tr.name); setEditingTrackName(null); } }}
              className="flex-1 bg-[#0a0a0a] border border-[#D4A843] rounded px-1.5 py-0.5 text-[10px] text-[#ccc] outline-none min-w-0" />
          ) : (
            <span className="flex-1 text-[11px] text-[#ccc] font-medium truncate min-w-0 cursor-pointer hover:text-[#D4A843] transition-colors"
              onDoubleClick={() => setEditingTrackName(tr.id)}>
              {tr.name}
            </span>
          )}
        </div>

        {/* Volume fader */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-[#444] w-5 font-mono">VOL</span>
          <input type="range" min={0} max={100} value={tr.volume}
            onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
            className="flex-1 h-[2px] cursor-pointer" style={{ accentColor: tr.color }} />
          <span className="text-[8px] text-[#555] font-mono w-7 text-right">{tr.volume}%</span>
        </div>

        {/* Pan slider + S/M buttons + delete */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-[#444] w-5 font-mono">PAN</span>
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={Math.round(tr.pan * 100)}
            onChange={(e) => updateTrackPan(tr.id, parseInt(e.target.value) / 100)}
            className="flex-1 h-[6px] accent-[#D4A843] cursor-pointer"
            aria-label={`Pan ${tr.name}`}
          />

          {/* Solo (S) button - amber when active */}
          <button onClick={() => toggleSolo(tr.id)}
            className={`text-[8px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${
              tr.solo
                ? "text-[#111] border-none" : "border border-[#2a2a2a] text-[#555] hover:border-[#D4A843] hover:text-[#D4A843]"
            }`}
            style={{
              background: tr.solo ? "#D4A843" : "transparent"
            }}>
            S
          </button>

          {/* Mute (M) button - red when active */}
          <button onClick={() => toggleMute(tr.id)}
            className={`text-[8px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${tr.muted ? "text-white border-none" : "border border-[#2a2a2a] text-[#555] hover:border-[#ef4444] hover:text-[#ef4444]"}`}
            style={{ background: tr.muted ? "#ef4444" : "transparent" }}>
            M
          </button>

          {/* Drum grid toggle */}
          {tr.type === "drum" && (
            <button onClick={() => handleDrumGridToggle(tr.id)}
              className={`text-[7px] px-1.5 h-5 rounded cursor-pointer transition-all ${isExpandedDrum && dockPanelIsDrums ? "bg-[#D4A84330] text-[#D4A843] border border-[#D4A84340]" : "border border-[#2a2a2a] text-[#555] hover:border-[#444]"}`}>
              GRID
            </button>
          )}

          {/* Delete */}
          <button onClick={() => deleteTrack(tr.id)}
            className="w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#ef4444] hover:bg-[#ef444410] transition-all cursor-pointer">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Waveform / Pattern area (fills remaining width) ─── */}
      <div className="flex-1 min-w-0" style={{ background: "#0c0c0c" }}>
        {tr.type === "youtube" ? (
          <div className="h-[90px] flex items-center gap-3 px-3" style={{ opacity: tr.muted ? 0.3 : 1 }}>
            {/* Thumbnail */}
            {tr.videoThumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tr.videoThumbnail} alt="" className="h-[72px] w-[128px] object-cover rounded flex-shrink-0" style={{ border: "1px solid #222" }} />
            )}
            {/* Hidden-ish iframe container (must be in DOM for YT API) */}
            <div
              ref={(el) => { attachYTContainer(tr.id, el); }}
              className="flex-shrink-0"
              style={{ width: 140, height: 80, overflow: "hidden", borderRadius: 4, border: "1px solid #222" }}
            />
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[#ccc] font-medium truncate">{tr.videoTitle || tr.name}</div>
              <div className="text-[9px] text-[#666] truncate">youtube.com/watch?v={tr.videoId}</div>
              <div className="text-[8px] mt-1" style={{ color: "#D4A843" }}>Plays live only - not included in WAV export</div>
            </div>
          </div>
        ) : tr.type !== "drum" ? (
          <div className="relative h-[90px]" style={{ opacity: tr.muted ? 0.3 : 1 }}>
            {/* Wavesurfer container — used for the underlying audio
                engine + interaction.  Hidden when the clip editor
                is showing regions on top. */}
            <div
              ref={(el) => { attachWaveformContainer(tr.id, el); }}
              className="absolute inset-0"
              style={{ visibility: hasRegions ? "hidden" : "visible" }}
            />
            {hasRegions && trackRegions.map((region) => (
              <ClipRegion
                key={region.id}
                region={region}
                trackId={tr.id}
                trackColor={tr.color}
                trackName={tr.name}
                pxPerSec={pxPerSec}
                snapBeatSec={snapBeatSec}
                snap={snapToGrid}
                height={90}
                isMuted={isMutedForRegions}
                onUpdate={updateRegion}
                onSplit={splitRegion}
                onDelete={deleteRegion}
              />
            ))}
          </div>
        ) : (
          <div className="h-[90px] flex items-center px-3" style={{ opacity: tr.muted ? 0.3 : 1 }}>
            {/* Mini pattern preview for drum tracks */}
            {tr.drumPattern && (
              <div className="flex gap-[1px]">
                {Array.from({ length: DRUM_STEPS }, (_, stepIdx) => {
                  const activeCount = tr.drumPattern!.reduce((cnt, row) => cnt + (row[stepIdx] ? 1 : 0), 0);
                  return (
                    <div key={stepIdx} className="flex flex-col gap-[1px]"
                      style={{ marginRight: stepIdx % 4 === 3 && stepIdx < DRUM_STEPS - 1 ? "4px" : "0" }}>
                      {Array.from({ length: 4 }, (_, rowGroup) => (
                        <div key={rowGroup}
                          className="w-[6px] h-[6px] rounded-[1px]"
                          style={{
                            background: activeCount > rowGroup
                              ? drumStep === stepIdx ? "#D4A843" : `${tr.color}99`
                              : drumStep === stepIdx ? "#222" : "#181818",
                          }} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => handleDrumGridToggle(tr.id)}
              className="ml-auto text-[9px] text-[#555] hover:text-[#D4A843] cursor-pointer transition-colors">
              {isExpandedDrum && dockPanelIsDrums ? "Close Grid" : "Open Grid"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const TrackRow = memo(TrackRowImpl);
TrackRow.displayName = "TrackRow";

export default TrackRow;
