"use client";
import { useState, useRef, useEffect } from "react";

export default function GpFileUploader() {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const [songInfo, setSongInfo] = useState<{ title: string; artist: string; tempo: number } | null>(null);
  const [tracks, setTracks] = useState<{ index: number; name: string }[]>([]);
  const [activeTrack, setActiveTrack] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setError(null); setReady(false); setLoading(true);
    setSongInfo(null); setPlayerReady(false);
    // Destroy old
    if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {};
    apiRef.current = null;
    if (mainRef.current) mainRef.current.innerHTML = "";

    const reader = new FileReader();
    reader.onload = (e) => setFileData(new Uint8Array(e.target?.result as ArrayBuffer));
    reader.onerror = () => { setError("Failed to read file"); setLoading(false); };
    reader.readAsArrayBuffer(file);
  }

  useEffect(() => {
    if (!fileData || !mainRef.current) return;
    let dead = false;

    (async () => {
      try {
        const at = await import("@coderline/alphatab");
        if (dead || !mainRef.current) return;
        if (mainRef.current) mainRef.current.innerHTML = "";

        const s = new at.Settings();
        s.core.fontDirectory = "/alphatab/font/";
        // Worker script for audio synthesis
        s.core.scriptFile = "/alphatab/alphaTab.worker.mjs";
        s.core.engine = "html5";
        s.core.logLevel = 2; // info
        // Player
        s.player.enablePlayer = true;
        s.player.enableCursor = true;
        s.player.enableUserInteraction = true;
        s.player.soundFont = "/alphatab/soundfont/sonivox.sf2";
        // Use ScriptProcessor instead of AudioWorklets (works on localhost HTTP)
        s.player.outputMode = 1; // WebAudioScriptProcessor
        // Display
        s.display.layoutMode = 0;
        s.display.staveProfile = 4;

        const api = new at.AlphaTabApi(mainRef.current, s);
        apiRef.current = api;

        api.scoreLoaded.on((score: any) => {
          if (dead) return;
          setLoading(false); setReady(true);
          setSongInfo({ title: score.title || "Untitled", artist: score.artist || "", tempo: score.tempo || 120 });
          setTracks(score.tracks.map((t: any, i: number) => ({ index: i, name: t.name || `Track ${i + 1}` })));
        });

        api.playerReady.on(() => {
          if (dead) return;
          setPlayerReady(true);
          console.log("alphaTab: player ready, isReadyForPlayback:", api.isReadyForPlayback);
        });

        // Also check readiness periodically since event might not fire
        const readyCheck = setInterval(() => {
          if (dead) { clearInterval(readyCheck); return; }
          if (api.isReadyForPlayback) {
            setPlayerReady(true);
            console.log("alphaTab: player ready (poll)");
            clearInterval(readyCheck);
          }
        }, 500);

        api.playerStateChanged.on((e: any) => {
          if (dead) return;
          setPlaying(e.state === 1);
        });

        api.error.on((e: any) => {
          if (dead) return;
          console.error("alphaTab error:", e);
          setError(String(e?.message || e));
          setLoading(false);
        });

        console.log("alphaTab: loading", fileData.length, "bytes");
        api.load(fileData);

      } catch (err) {
        if (!dead) { setError("Init: " + String(err)); setLoading(false); }
      }
    })();

    return () => { dead = true; };
  }, [fileData]);

  function togglePlay() {
    const api = apiRef.current;
    if (!api) return;
    // Ensure AudioContext is resumed (browser policy)
    if ((api as any).player?.output?.audioContext?.state === "suspended") {
      (api as any).player.output.audioContext.resume();
    }
    api.playPause();
  }
  function doStop() { apiRef.current?.stop(); setPlaying(false); }
  function setSpd(s: number) { if (apiRef.current) apiRef.current.playbackSpeed = s; setSpeed(s); }
  function changeTrk(i: number) {
    const api = apiRef.current;
    if (api?.score?.tracks?.[i]) { api.renderTracks([api.score.tracks[i]]); setActiveTrack(i); }
  }

  return (
    <div>
      {!fileData ? (
        <div onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.(gp[345x]?|gpx?)$/i.test(f.name)) handleFile(f); }}
          className="panel p-6 text-center cursor-pointer border-dashed !border-[#333] hover:!border-[#D4A843]/40 transition-all"
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          <div className="font-label text-sm text-[#555] mb-2">Drop Guitar Pro file or click to browse</div>
          <div className="font-label text-[10px] text-[#333]">.gp .gp3 .gp4 .gp5 .gpx</div>
          <div className="font-label text-[9px] text-[#444] mt-3">
            Download free tabs from{" "}
            <a href="https://guitarprotabs.org" target="_blank" rel="noopener noreferrer"
              className="text-[#D4A843] underline" onClick={e => e.stopPropagation()}>guitarprotabs.org</a>
          </div>
        </div>
      ) : (
        <div className="panel p-0 overflow-hidden">
          {/* Header + controls */}
          <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`led ${ready && playerReady ? "led-gold" : ready ? "led-on" : loading ? "led-off" : "led-red"}`} />
                <span className="font-label text-[11px] text-[#D4A843]">
                  {songInfo ? `${songInfo.artist}${songInfo.artist ? " — " : ""}${songInfo.title} (${songInfo.tempo} BPM)` : fileName}
                </span>
                {ready && !playerReady && <span className="font-label text-[9px] text-[#555]">Loading player...</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => fileRef.current?.click()} className="btn-ghost !text-[9px] !px-2 !py-1">Change</button>
                <button onClick={() => {
                  if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {};
                  apiRef.current = null; setFileData(null); setFileName(null); setReady(false); setSongInfo(null); setPlayerReady(false);
                }} className="btn-ghost !text-[9px] !px-2 !py-1 !text-[#C41E3A]">Close</button>
                <input ref={fileRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>
            </div>

            {ready && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={togglePlay}
                  className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center"
                  style={{ background: playing ? "#C41E3A" : playerReady ? "#33CC33" : "#555", border: "2px solid #555", opacity: playerReady ? 1 : 0.5 }}>
                  {playing ? <div className="w-2.5 h-2.5 bg-white rounded-sm" /> : <span className="text-[#0A0A0A] text-xs ml-0.5">&#9654;</span>}
                </button>
                {playing && <button onClick={doStop} className="btn-ghost !text-[9px] !px-2 !py-1">Stop</button>}

                <div className="flex items-center gap-0.5 ml-1">
                  <span className="font-label text-[8px] text-[#555]">Speed</span>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5].map(s => (
                    <button key={s} onClick={() => setSpd(s)}
                      className={`font-readout text-[9px] px-1.5 py-0.5 rounded-sm cursor-pointer border ${speed === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{s}x</button>
                  ))}
                </div>

                {tracks.length > 1 && (
                  <select value={activeTrack} onChange={e => changeTrk(Number(e.target.value))} className="input !w-auto !py-1 !text-[10px] ml-1">
                    {tracks.map(t => <option key={t.index} value={t.index}>{t.name}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {loading && <div className="p-6 text-center font-label text-sm text-[#444]">Loading tab...</div>}
          {error && <div className="p-4 text-center font-label text-[11px] text-[#C41E3A]">{error}</div>}

          <div ref={mainRef} style={{ minHeight: ready ? 350 : 0, maxHeight: 550, overflow: "auto", background: "#fff" }} dir="ltr" />
        </div>
      )}
    </div>
  );
}
