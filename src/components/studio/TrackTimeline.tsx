"use client";
import { useEffect, useRef } from "react";

// Canvas-based timeline ruler showing bar / beat / sub-beat ticks.  Drives the
// horizontal pixel-per-second scale used by all clip regions.
interface Props {
  bpm: number;
  pxPerSec: number;
  totalSeconds: number;
  timeSignature?: [number, number]; // [num, denom], default [4,4]
  height?: number;
}

export default function TrackTimeline({
  bpm,
  pxPerSec,
  totalSeconds,
  timeSignature = [4, 4],
  height = 28,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beatsPerBar = timeSignature[0];
  const secPerBeat = 60 / bpm;
  const secPerBar = secPerBeat * beatsPerBar;
  const totalSec = Math.max(totalSeconds, secPerBar * 16);
  const widthPx = Math.max(200, Math.ceil(totalSec * pxPerSec));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = widthPx * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthPx, height);

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, widthPx, height);

    const totalBars = Math.ceil(totalSec / secPerBar) + 2;
    const showSixteenths = pxPerSec >= 100;

    for (let bar = 0; bar < totalBars; bar++) {
      const barX = bar * secPerBar * pxPerSec;
      // Major bar line
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(barX, 0, 1, height);
      // Bar number label
      ctx.fillStyle = "#666";
      ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      ctx.fillText(String(bar + 1), barX + 4, 4);

      // Beat ticks
      for (let beat = 0; beat < beatsPerBar; beat++) {
        const beatX = barX + beat * secPerBeat * pxPerSec;
        const isDownbeat = beat === 0;
        ctx.fillStyle = isDownbeat ? "#555" : "#333";
        const tickH = isDownbeat ? 10 : 6;
        ctx.fillRect(beatX, height - tickH, 1, tickH);

        if (showSixteenths) {
          // 4 sixteenths per beat
          for (let s = 1; s < 4; s++) {
            const subX = beatX + (s / 4) * secPerBeat * pxPerSec;
            ctx.fillStyle = "#252525";
            ctx.fillRect(subX, height - 3, 1, 3);
          }
        }
      }
    }
  }, [widthPx, height, pxPerSec, secPerBar, secPerBeat, beatsPerBar, totalSec]);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ height: `${height}px`, width: `${widthPx}px`, background: "#1a1a1a", borderBottom: "1px solid #252525" }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
