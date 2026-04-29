"use client";

// Phase 7 Part 2 — TransportBar
// The Studio's top toolbar: BPM, metronome, mic select, preset selector,
// transport (play/stop/rewind/record/loop), time readout, project name +
// save status, snap, zoom, master volume, and the Save/Export dropdown.
//
// State strategy:
//  - Persistent business state (bpm, playing, masterVol, etc.) is read directly
//    from the Zustand `useStudioStore` — no prop drilling.
//  - Transient UI state (recording timer, export menu, project-name edit mode,
//    input device list, zoom, snap) lives as local useState in StudioPage and
//    is passed in as props.  This keeps the audio engine and recording lifecycle
//    untouched in the parent.
//  - All action handlers (playAll, stopAll, startRec, etc.) come from props so
//    the parent owns the imperative audio refs.

import { type Dispatch, type RefObject, type SetStateAction } from "react";
import { useStudioStore } from "@/stores/studioStore";
import {
  STUDIO_PRESET_LIST,
} from "@/lib/studioPresets";

interface Props {
  // ── Recording session UI (transient — local to parent) ──
  isRec: boolean;
  recTime: number;
  recLevel: number;
  inputDevices: MediaDeviceInfo[];
  selectedInputDevice: string;
  setSelectedInputDevice: Dispatch<SetStateAction<string>>;

  // ── Project header (transient) ──
  editingProjectName: boolean;
  setEditingProjectName: Dispatch<SetStateAction<boolean>>;
  saveState: "idle" | "saving" | "saved";
  lastSavedAt: number | null;

  // ── Track count + clip-edit UI ──
  tracksLength: number;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  pxPerSec: number;
  snapToGrid: boolean;
  setSnapToGrid: Dispatch<SetStateAction<boolean>>;

  // ── Save/export dropdown ──
  showExportMenu: boolean;
  setShowExportMenu: Dispatch<SetStateAction<boolean>>;
  exportMenuPos: { top: number; right: number };
  setExportMenuPos: Dispatch<SetStateAction<{ top: number; right: number }>>;
  exporting: boolean;
  exportProgress: number;
  savingToLibrary: boolean;
  exportMenuRef: RefObject<HTMLDivElement | null>;
  exportButtonRef: RefObject<HTMLButtonElement | null>;

  // ── Action handlers (parent owns the audio engine) ──
  onSetupMetronome: () => Promise<void> | void;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
  onStartRec: () => void;
  onStopRec: () => void;
  onSaveToRecordings: () => void;
  onExportMix: (format: "wav" | "mp3") => void;

  // ── Time formatter (kept in parent for parity with the rest of StudioPage) ──
  fmtTime: (sec: number) => string;
}

export default function TransportBar({
  isRec,
  recTime,
  recLevel,
  inputDevices,
  selectedInputDevice,
  setSelectedInputDevice,
  editingProjectName,
  setEditingProjectName,
  saveState,
  lastSavedAt,
  tracksLength,
  zoom,
  setZoom,
  pxPerSec,
  snapToGrid,
  setSnapToGrid,
  showExportMenu,
  setShowExportMenu,
  exportMenuPos,
  setExportMenuPos,
  exporting,
  exportProgress,
  savingToLibrary,
  exportMenuRef,
  exportButtonRef,
  onSetupMetronome,
  onPlay,
  onStop,
  onRewind,
  onStartRec,
  onStopRec,
  onSaveToRecordings,
  onExportMix,
  fmtTime,
}: Props) {
  // ── Read persistent state directly from Zustand ──
  const bpm = useStudioStore((s) => s.bpm);
  const setBpm = useStudioStore((s) => s.setBpm);
  const playing = useStudioStore((s) => s.playing);
  const looping = useStudioStore((s) => s.looping);
  const setLooping = useStudioStore((s) => s.setLooping);
  const masterVol = useStudioStore((s) => s.masterVol);
  const setMasterVol = useStudioStore((s) => s.setMasterVol);
  const metronomeOn = useStudioStore((s) => s.metronomeOn);
  const setMetronomeOn = useStudioStore((s) => s.setMetronomeOn);
  const metronomeVolume = useStudioStore((s) => s.metronomeVolume);
  const setMetronomeVolume = useStudioStore((s) => s.setMetronomeVolume);
  const currentTime = useStudioStore((s) => s.currentTime);
  const duration = useStudioStore((s) => s.duration);
  const studioPresetId = useStudioStore((s) => s.studioPresetId);
  const setStudioPresetId = useStudioStore((s) => s.setStudioPresetId);
  const projectName = useStudioStore((s) => s.projectName);
  const setProjectName = useStudioStore((s) => s.setProjectName);

  return (
    <div
      className="flex flex-wrap items-center min-h-14 px-2 sm:px-4 py-1 sm:py-0 gap-1 sm:gap-2 border-b flex-shrink-0 sm:flex-nowrap sm:overflow-x-auto scrollbar-hide"
      style={{ background: "linear-gradient(180deg, #151515 0%, #111111 100%)", borderColor: "#1e1e1e" }}>

      {/* LEFT: BPM + Metronome + Mic */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
          <input type="number" min={40} max={300} value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-11 h-6 bg-transparent text-[#D4A843] text-xs text-center font-mono focus:outline-none" />
          <span className="text-[8px] text-[#444] font-medium tracking-wider">BPM</span>
        </div>

        <button onClick={async () => { await onSetupMetronome(); setMetronomeOn(!metronomeOn); }}
          title="Metronome (M)"
          className={`w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer ${metronomeOn ? "text-[#D4A843]" : "text-[#555] hover:text-[#888]"}`}
          style={{ background: metronomeOn ? "#2a2418" : "#0e0e0e", border: metronomeOn ? "1px solid #D4A84355" : "1px solid #1e1e1e" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L8 22h8L12 2z"/><path d="M12 8l6-3"/></svg>
        </button>
        <div className="flex items-center gap-1" title={`Metronome volume ${Math.round(metronomeVolume * 100)}%`}>
          <span className="text-[8px] text-[#555] font-medium tracking-wider">VOL</span>
          <input type="range" min={0} max={1} step={0.05} value={metronomeVolume}
            onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
            className="w-[60px] accent-[#D4A843]" />
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/>
          </svg>
          <select value={selectedInputDevice}
            onChange={(e) => setSelectedInputDevice(e.target.value)}
            dir="ltr"
            className="bg-[#0e0e0e] border border-[#1e1e1e] rounded px-1.5 py-0.5 text-[9px] text-[#666] outline-none focus:border-[#D4A843] cursor-pointer max-w-[120px] truncate">
            {inputDevices.map((d) => {
              const raw = d.label || `Mic ${d.deviceId.slice(0, 6)}`;
              const label = /^(default|ברירת|standard)/i.test(raw)
                ? "Default Mic"
                : (raw.length > 30 ? raw.slice(0, 30) + "..." : raw);
              return <option key={d.deviceId} value={d.deviceId}>{label}</option>;
            })}
            {inputDevices.length === 0 && <option value="">No devices</option>}
          </select>
        </div>

        {/* Preset selector — 5 buttons: Clean / Rock / Metal / Ambient / Lofi.
            Drives every track's EQ3 / Compressor / Saturation / Pan per AUDIO_SPEC §3. */}
        <div className="hidden md:flex items-center gap-0.5 rounded-md p-0.5"
          style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
          title="Studio preset (per-track EQ, compression, saturation, pan)">
          <span className="text-[7px] text-[#444] font-medium tracking-wider px-1">PRESET</span>
          {STUDIO_PRESET_LIST.map(p => (
            <button key={p.id}
              onClick={() => setStudioPresetId(p.id)}
              className="text-[9px] px-1.5 py-[3px] rounded font-semibold transition-all cursor-pointer"
              style={{
                background: studioPresetId === p.id ? "#D4A843" : "transparent",
                color: studioPresetId === p.id ? "#111" : "#666",
                border: studioPresetId === p.id ? "none" : "1px solid transparent",
              }}
              title={`${p.label} preset`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* CENTER: Transport controls */}
      <div className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5">
        <button onClick={onRewind} title="Rewind (Enter)"
          className="w-10 h-10 sm:w-8 sm:h-8 rounded flex items-center justify-center transition-all cursor-pointer group"
          style={{ background: "#1a1a1a", border: "1px solid #252525" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#777] group-hover:text-[#ccc] transition-colors">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        {!playing ? (
          <button onClick={onPlay} title="Play (Space)" disabled={tracksLength === 0}
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer group disabled:opacity-30"
            style={{ background: "linear-gradient(180deg, #1a3a1a 0%, #143014 100%)", border: "1px solid #33aa3355", boxShadow: "0 2px 8px rgba(34,197,94,0.1)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-[#4ade80] group-hover:text-white transition-colors">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        ) : (
          <button onClick={onStop} title="Pause (Space)"
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer"
            style={{ background: "linear-gradient(180deg, #1a3a1a 0%, #143014 100%)", border: "1px solid #22c55e", boxShadow: "0 0 12px rgba(34,197,94,0.25)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
            </svg>
          </button>
        )}

        <button onClick={onStop} title="Stop"
          className="w-10 h-10 sm:w-8 sm:h-8 rounded flex items-center justify-center transition-all cursor-pointer group"
          style={{ background: "#1a1a1a", border: "1px solid #252525" }}>
          <div className="w-3 h-3 rounded-[2px] bg-[#777] group-hover:bg-[#ccc] transition-colors" />
        </button>

        {/* Record */}
        {!isRec ? (
          <button onClick={onStartRec} title="Record (R)"
            className="w-10 h-10 sm:w-8 sm:h-8 rounded flex items-center justify-center transition-all cursor-pointer group"
            style={{ background: "#1e1215", border: "1px solid #C41E3A44" }}>
            <div className="w-3.5 h-3.5 rounded-full group-hover:scale-110 transition-transform" style={{ background: "radial-gradient(circle at 40% 35%, #ff4466, #C41E3A)" }} />
          </button>
        ) : (
          <button onClick={onStopRec} title="Stop Recording"
            className="w-10 h-10 sm:w-8 sm:h-8 rounded flex items-center justify-center transition-all cursor-pointer"
            style={{ background: "#C41E3A", border: "1px solid #ee3355", animation: "pulse 1.5s ease-in-out infinite" }}>
            <div className="w-3 h-3 rounded-sm bg-white" />
          </button>
        )}

        {/* Loop */}
        <button onClick={() => setLooping(!looping)} title="Loop (C)"
          className={`hidden sm:flex w-8 h-8 rounded items-center justify-center transition-all cursor-pointer ${looping ? "text-[#D4A843]" : "text-[#555] hover:text-[#888]"}`}
          style={{ background: looping ? "#2a2418" : "#1a1a1a", border: looping ? "1px solid #D4A84355" : "1px solid #252525" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
          </svg>
        </button>

        <div className="hidden sm:block w-px h-6 bg-[#1e1e1e] mx-1" />

        {/* Time display */}
        <div className="hidden sm:flex px-3 py-1 rounded font-mono text-sm items-center min-w-[120px] justify-center relative overflow-hidden"
          style={{ background: "#050505", border: "1px solid #1a1a1a", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)" }}>
          <span className="text-[#D4A84322] absolute tracking-[2px]" style={{ fontFamily: "'Courier New', monospace", fontSize: "15px" }}>88:88.8</span>
          <span className="text-[#D4A843] relative tracking-[2px]" style={{ fontFamily: "'Courier New', monospace", fontSize: "15px", textShadow: "0 0 8px rgba(212,168,67,0.4)" }}>{fmtTime(currentTime)}</span>
        </div>
        <span className="hidden sm:inline text-[10px] text-[#333] font-mono">/</span>
        <span className="hidden sm:inline text-[10px] text-[#444] font-mono">{fmtTime(duration)}</span>

        {/* Recording indicator */}
        {isRec && (
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
            <span className="font-mono text-[11px] text-[#C41E3A]">{fmtTime(recTime)}</span>
            <div className="w-14 h-1.5 bg-[#0a0a0a] rounded overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
              <div className="h-full transition-all duration-75 rounded" style={{
                width: `${Math.min(100, recLevel * 100)}%`,
                background: recLevel > 0.8 ? "linear-gradient(90deg, #22c55e, #ef4444)" : "linear-gradient(90deg, #22c55e, #D4A843)",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Master volume + Save + Track count */}
      <div className="flex items-center gap-2">
        {/* Project name + auto-save status (Phase 3a) */}
        <div className="hidden md:flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }} title="Project name (auto-saves)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          {editingProjectName ? (
            <input
              type="text"
              value={projectName}
              autoFocus
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setEditingProjectName(false)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setEditingProjectName(false); } }}
              maxLength={48}
              className="w-28 bg-transparent text-[10px] text-[#D4A843] focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingProjectName(true)}
              className="text-[10px] text-[#D4A843] hover:text-[#e8c66a] cursor-text max-w-[140px] truncate"
              title="Click to rename project">
              {projectName || "Untitled"}
            </button>
          )}
          <span
            className="text-[7px] font-mono tracking-wider"
            style={{ color: saveState === "saving" ? "#D4A843" : saveState === "saved" ? "#22c55e" : "#444" }}
            title={lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Not saved yet"}>
            {saveState === "saving" ? "SAVING…" : lastSavedAt ? "SAVED" : ""}
          </span>
        </div>

        <span className="text-[8px] text-[#333] font-mono hidden sm:inline">{tracksLength} trk</span>
        {looping && <span className="text-[7px] text-[#D4A843] bg-[#D4A84315] px-1 py-0.5 rounded font-bold tracking-wider">LOOP</span>}

        {/* Phase 3c: Snap-to-grid toggle */}
        <button
          onClick={() => setSnapToGrid((v) => !v)}
          title="Snap to Grid (G)"
          className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-all cursor-pointer ${snapToGrid ? "text-[#D4A843]" : "text-[#555] hover:text-[#888]"}`}
          style={{ background: snapToGrid ? "#2a2418" : "#0e0e0e", border: snapToGrid ? "1px solid #D4A84355" : "1px solid #1e1e1e" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          <span>SNAP</span>
        </button>

        {/* Phase 3c: Zoom slider */}
        <div className="hidden md:flex items-center gap-1" title={`Zoom ${zoom}% (${Math.round(pxPerSec)} px/sec)`}>
          <span className="text-[7px] text-[#444] font-mono">ZOOM</span>
          <input
            type="range"
            min={0}
            max={100}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-16 accent-[#D4A843] h-[2px] cursor-pointer"
          />
          <span className="text-[8px] text-[#444] font-mono w-7 text-right">{zoom}%</span>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="flex-shrink-0">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/>
          </svg>
          <input type="range" min={0} max={100} value={masterVol}
            onChange={(e) => setMasterVol(Number(e.target.value))}
            className="w-16 accent-[#D4A843] h-1 cursor-pointer" />
          <span className="text-[8px] text-[#444] font-mono w-6">{masterVol}%</span>
        </div>

        <div ref={exportMenuRef} className="relative">
          <button
            ref={exportButtonRef}
            onClick={() => {
              const btn = exportButtonRef.current;
              if (btn) {
                const r = btn.getBoundingClientRect();
                setExportMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
              }
              setShowExportMenu((v) => !v);
            }}
            disabled={tracksLength === 0 || savingToLibrary || exporting}
            className="text-[9px] font-semibold px-2.5 py-1.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            style={{
              background: tracksLength > 0 ? "linear-gradient(180deg, #D4A843 0%, #B8922E 100%)" : "#1a1a1a",
              color: tracksLength > 0 ? "#111" : "#555",
              border: tracksLength > 0 ? "none" : "1px solid #252525",
            }}
            title="Save / Export"
            aria-haspopup="menu"
            aria-expanded={showExportMenu}>
            {exporting ? `Export ${exportProgress}%` : savingToLibrary ? "..." : "Save"}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showExportMenu && (
            <div
              role="menu"
              className="fixed w-44 rounded-md shadow-lg z-[100] overflow-hidden"
              style={{
                background: "#0e0e0e",
                border: "1px solid #2a2a2a",
                top: exportMenuPos.top,
                right: exportMenuPos.right,
              }}>
              <button
                role="menuitem"
                onClick={() => { setShowExportMenu(false); onSaveToRecordings(); }}
                disabled={tracksLength === 0 || savingToLibrary}
                className="w-full text-left text-[10px] px-3 py-2 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2 disabled:opacity-40"
                style={{ color: "#ccc" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save to Recordings
              </button>
              <div style={{ borderTop: "1px solid #1e1e1e" }} />
              <button
                role="menuitem"
                onClick={() => onExportMix("wav")}
                disabled={tracksLength === 0 || exporting}
                className="w-full text-left text-[10px] px-3 py-2 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2 disabled:opacity-40"
                style={{ color: "#ccc" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download WAV
              </button>
              <button
                role="menuitem"
                onClick={() => onExportMix("mp3")}
                disabled={tracksLength === 0 || exporting}
                className="w-full text-left text-[10px] px-3 py-2 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2 disabled:opacity-40"
                style={{ color: "#ccc" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download MP3
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
