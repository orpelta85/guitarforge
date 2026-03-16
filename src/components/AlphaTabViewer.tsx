"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface AlphaTabViewerProps {
  fileData?: ArrayBuffer;
  fileUrl?: string;
}

export default function AlphaTabViewer({ fileData, fileUrl }: AlphaTabViewerProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tracks, setTracks] = useState<{ index: number; name: string }[]>([]);
  const [activeTrack, setActiveTrack] = useState(0);
  const [ready, setReady] = useState(false);
  const [songInfo, setSongInfo] = useState<{ title: string; artist: string; tempo: number } | null>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    let destroyed = false;

    async function init() {
      try {
        const at = await import("@coderline/alphatab");
        if (destroyed || !mainRef.current) return;

        const s = new at.Settings();
        s.core.fontDirectory = "/alphatab/font/";
        s.core.engine = "html5";
        s.core.logLevel = 1; // warning
        s.player.enablePlayer = true;
        s.player.enableCursor = true;
        s.player.enableUserInteraction = true;
        s.player.soundFont = "/alphatab/soundfont/sonivox.sf2";
        s.display.layoutMode = 0; // page layout
        s.display.staveProfile = 4; // tab + standard
        s.notation.elements = new Map();

        const api = new at.AlphaTabApi(mainRef.current, s);
        apiRef.current = api;

        api.scoreLoaded.on((score: any) => {
          if (destroyed) return;
          setLoading(false);
          setReady(true);
          setSongInfo({ title: score.title || "", artist: score.artist || "", tempo: score.tempo || 120 });
          setTracks(score.tracks.map((t: any, i: number) => ({ index: i, name: t.name || `Track ${i + 1}` })));
        });

        api.playerStateChanged.on((e: any) => {
          if (destroyed) return;
          setPlaying(e.state === 1);
        });

        api.error.on((e: any) => {
          if (destroyed) return;
          console.error("alphaTab error:", e);
          setError("Error: " + (e?.message || String(e)));
          setLoading(false);
        });

        // Load the file
        if (fileData) {
          api.load(new Uint8Array(fileData));
        } else if (fileUrl) {
          // Fetch the file and load
          const res = await fetch(fileUrl);
          const buf = await res.arrayBuffer();
          api.load(new Uint8Array(buf));
        }

      } catch (err) {
        if (!destroyed) {
          console.error("alphaTab init error:", err);
          setError("Failed to initialize: " + String(err));
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (apiRef.current?.destroy) {
        try { apiRef.current.destroy(); } catch {}
      }
      apiRef.current = null;
    };
  }, [fileData, fileUrl]);

  function togglePlay() { apiRef.current?.playPause(); }
  function stop() { apiRef.current?.stop(); setPlaying(false); }

  function setPlaybackSpeed(s: number) {
    if (apiRef.current) apiRef.current.playbackSpeed = s;
    setSpeed(s);
  }

  function changeTrack(idx: number) {
    if (apiRef.current?.score?.tracks?.[idx]) {
      apiRef.current.renderTracks([apiRef.current.score.tracks[idx]]);
      setActiveTrack(idx);
    }
  }

  return (
    <div className="panel p-0 overflow-hidden">
      {/* Controls */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-label text-[10px] text-[#D4A843] flex items-center gap-2">
            <div className={`led ${ready ? "led-gold" : loading ? "led-off" : "led-red"}`} />
            {songInfo ? `${songInfo.artist} — ${songInfo.title} (${songInfo.tempo} BPM)` : "Tab Viewer"}
          </div>
        </div>

        {ready && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Play/Stop */}
            <button onClick={togglePlay}
              className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center ${playing ? "" : ""}`}
              style={{ background: playing ? "#C41E3A" : "#33CC33", border: "2px solid #555" }}>
              {playing
                ? <div className="w-2.5 h-2.5 bg-white rounded-sm" />
                : <span className="text-[#0A0A0A] text-xs ml-0.5">&#9654;</span>}
            </button>
            <button onClick={stop} className="btn-ghost !text-[9px] !px-2 !py-1">Stop</button>

            {/* Speed */}
            <div className="flex items-center gap-0.5 ml-2">
              <span className="font-label text-[8px] text-[#555]">Speed</span>
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5].map(s => (
                <button key={s} onClick={() => setPlaybackSpeed(s)}
                  className={`font-readout text-[9px] px-1.5 py-0.5 rounded-sm cursor-pointer border ${speed === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                  {s}x
                </button>
              ))}
            </div>

            {/* Track selector */}
            {tracks.length > 1 && (
              <select value={activeTrack} onChange={e => changeTrack(Number(e.target.value))}
                className="input !w-auto !py-1 !text-[10px] ml-2">
                {tracks.map(t => <option key={t.index} value={t.index}>{t.name}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Status messages */}
      {loading && <div className="p-6 text-center font-label text-sm text-[#444]">Loading tab...</div>}
      {error && <div className="p-6 text-center font-label text-sm text-[#C41E3A]">{error}</div>}

      {/* alphaTab render target */}
      <div ref={mainRef}
        style={{ minHeight: ready ? 350 : 0, maxHeight: 550, overflow: "auto", background: "#fff" }}
        dir="ltr" />
    </div>
  );
}
