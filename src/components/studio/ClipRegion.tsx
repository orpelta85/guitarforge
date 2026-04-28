"use client";
import { useEffect, useRef } from "react";

export interface TrackRegion {
  id: string;
  startTime: number;
  duration: number;
  offset: number;
  /** Cached peaks across the entire source buffer (0..1).  Optional —
   * computed lazily by the parent when the AudioBuffer is decoded. */
  peaks?: Float32Array;
  /** Total duration of the source AudioBuffer (used for trim clamping). */
  bufferDuration: number;
}

interface Props {
  region: TrackRegion;
  trackId: number;
  trackColor: string;
  trackName: string;
  pxPerSec: number;
  snapBeatSec: number; // step for snap-to-grid
  snap: boolean;
  height?: number;
  isMuted?: boolean;
  onUpdate: (regionId: string, patch: Partial<TrackRegion>) => void;
  onSplit: (regionId: string, splitTime: number) => void;
  onDelete: (regionId: string) => void;
}

type DragMode = "move" | "trim-left" | "trim-right";

interface DragState {
  mode: DragMode;
  startX: number;
  origStartTime: number;
  origDuration: number;
  origOffset: number;
}

const EDGE_HIT_PX = 8;

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: Float32Array | undefined,
  color: string,
  trimStart: number,
  trimEnd: number,
  muted: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const mid = height / 2;

  // Center line
  ctx.fillStyle = muted ? "#1a1a1a" : color + "22";
  ctx.fillRect(0, mid, width, 1);

  if (!peaks || peaks.length === 0) return;

  const startIdx = Math.max(0, Math.floor(trimStart * peaks.length));
  const endIdx = Math.min(peaks.length, Math.floor(trimEnd * peaks.length));
  const visible = peaks.slice(startIdx, endIdx);
  if (visible.length === 0) return;
  const step = width / visible.length;
  ctx.fillStyle = muted ? "#333" : color + "99";
  for (let i = 0; i < visible.length; i++) {
    const h = visible[i] * mid * 0.9;
    const x = i * step;
    ctx.fillRect(x, mid - h, Math.max(1, step - 0.5), h * 2);
  }
}

export default function ClipRegion({
  region,
  trackColor,
  trackName,
  pxPerSec,
  snapBeatSec,
  snap,
  height = 90,
  isMuted = false,
  onUpdate,
  onSplit,
  onDelete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const left = region.startTime * pxPerSec;
  const width = Math.max(4, region.duration * pxPerSec);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width)) * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    const trimStart = region.bufferDuration > 0 ? region.offset / region.bufferDuration : 0;
    const trimEnd =
      region.bufferDuration > 0
        ? (region.offset + region.duration) / region.bufferDuration
        : 1;
    drawWaveform(canvas, region.peaks, trackColor, trimStart, trimEnd, isMuted);
  }, [
    width,
    height,
    region.peaks,
    region.offset,
    region.duration,
    region.bufferDuration,
    trackColor,
    isMuted,
  ]);

  // Global mousemove / mouseup driven drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dt = dx / pxPerSec;

      if (drag.mode === "move") {
        let newStart = Math.max(0, drag.origStartTime + dt);
        if (snap && snapBeatSec > 0) {
          newStart = Math.round(newStart / snapBeatSec) * snapBeatSec;
        }
        onUpdate(region.id, { startTime: newStart });
      } else if (drag.mode === "trim-left") {
        // Trim from the left: keep the right edge fixed, move start + offset.
        const maxTrim = drag.origDuration - 0.05;
        const trimDelta = Math.max(-drag.origOffset, Math.min(maxTrim, dt));
        const snapped = snap && snapBeatSec > 0
          ? Math.round(trimDelta / snapBeatSec) * snapBeatSec
          : trimDelta;
        onUpdate(region.id, {
          startTime: drag.origStartTime + snapped,
          offset: drag.origOffset + snapped,
          duration: drag.origDuration - snapped,
        });
      } else {
        // trim-right: keep start fixed, change duration.
        const newDur = Math.max(0.05, drag.origDuration + dt);
        const maxDur = region.bufferDuration - region.offset;
        const clampedDur = Math.min(newDur, maxDur);
        const finalDur = snap && snapBeatSec > 0
          ? Math.max(0.05, Math.round(clampedDur / snapBeatSec) * snapBeatSec)
          : clampedDur;
        onUpdate(region.id, { duration: finalDur });
      }
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [region.id, region.bufferDuration, region.offset, pxPerSec, snap, snapBeatSec, onUpdate]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left only
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let mode: DragMode = "move";
    if (relX < EDGE_HIT_PX) mode = "trim-left";
    else if (relX > rect.width - EDGE_HIT_PX) mode = "trim-right";
    dragRef.current = {
      mode,
      startX: e.clientX,
      origStartTime: region.startTime,
      origDuration: region.duration,
      origOffset: region.offset,
    };
    document.body.style.cursor = mode === "move" ? "grabbing" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < EDGE_HIT_PX || relX > rect.width - EDGE_HIT_PX) {
      e.currentTarget.style.cursor = "col-resize";
    } else {
      e.currentTarget.style.cursor = "grab";
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relTime = (relX / rect.width) * region.duration;
    const splitTime = region.startTime + relTime;
    // Build a tiny bespoke context menu using a Promise via window event so we
    // don't pull in another component just for this — but for simplicity we
    // open a window.confirm-style prompt: the parent passed split + delete
    // callbacks, so wire them to two prompts.
    const action = window.prompt(
      `Region: ${trackName}\nSplit at ${splitTime.toFixed(2)}s? Type:\n  s = split\n  d = delete\n  (cancel to do nothing)`,
      "s",
    );
    if (action === "s") onSplit(region.id, splitTime);
    else if (action === "d") onDelete(region.id);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relTime = (relX / rect.width) * region.duration;
    onSplit(region.id, region.startTime + relTime);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-0 select-none"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        background: trackColor + "11",
        borderRadius: "2px",
        border: `1px solid ${trackColor}55`,
        opacity: isMuted ? 0.5 : 1,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      title="Drag to move - Drag edge to trim - Double-click to split - Right-click for menu"
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      {/* Trim edge indicators */}
      <div
        className="absolute top-0 bottom-0 left-0 w-[3px] rounded-l pointer-events-none"
        style={{ background: trackColor + "66" }}
      />
      <div
        className="absolute top-0 bottom-0 right-0 w-[3px] rounded-r pointer-events-none"
        style={{ background: trackColor + "66" }}
      />
      {/* Label */}
      <div className="absolute top-0.5 left-1 z-[5] pointer-events-none">
        <span
          className="text-[8px] font-medium px-1 py-px rounded"
          style={{ color: trackColor, background: "#121214cc" }}
        >
          {trackName}
        </span>
      </div>
    </div>
  );
}
