"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface Track {
  id: number;
  name: string;
  audioUrl: string | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  type: "recording" | "import" | "suno";
}

export default function StudioPage() {
  const [isRec, setIsRec] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [masterVol, setMasterVol] = useState(80);
  const [recTime, setRecTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showPanel, setShowPanel] = useState<"none"|"import"|"suno"|"youtube">("none");
  const [ytQuery, setYtQuery] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");
  const [sunoScale, setSunoScale] = useState("Am");
  const [sunoMode, setSunoMode] = useState("Aeolian");
  const [sunoStyle, setSunoStyle] = useState("Blues Rock");
  const [sunoBpm, setSunoBpm] = useState(120);
  const [sunoLoading, setSunoLoading] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioEls = useRef<Record<number, HTMLAudioElement>>({});
  const ctr = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function addTrack(name: string, url: string, type: Track["type"]) {
    ctr.current++;
    setTracks(p => [...p, { id: ctr.current, name, audioUrl: url, volume: 100, muted: false, solo: false, type }]);
  }

  // ── RECORDING ──
  function startRec() {
    if (!navigator.mediaDevices) { alert("Microphone not available"); return; }
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then((stream) => {
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const url = URL.createObjectURL(blob);
        stream.getTracks().forEach(t => t.stop());
        addTrack(`Recording ${ctr.current + 1}`, url, "recording");
      };
      mr.start(100); // collect data every 100ms
      mediaRef.current = mr;
      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    }).catch((err) => { alert("Microphone access denied: " + err.message); });
  }

  function stopRec() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setIsRec(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // ── PLAYBACK ──
  async function playAll() {
    const hasSolo = tracks.some(t => t.solo);
    const playable = tracks.filter(t => {
      const el = audioEls.current[t.id];
      if (!el || !t.audioUrl) return false;
      el.volume = (t.volume / 100) * (masterVol / 100);
      const shouldPlay = hasSolo ? t.solo : !t.muted;
      if (shouldPlay) { el.currentTime = 0; return true; }
      return false;
    });
    await Promise.all(playable.map(t => {
      const el = audioEls.current[t.id];
      return el.play().catch(() => {});
    }));
    setPlaying(true);
  }

  function stopAll() {
    Object.values(audioEls.current).forEach(el => { el.pause(); el.currentTime = 0; });
    setPlaying(false);
  }

  function updateTrackVol(id: number, vol: number) {
    setTracks(p => p.map(t => t.id === id ? { ...t, volume: vol } : t));
    const el = audioEls.current[id];
    if (el) el.volume = (vol / 100) * (masterVol / 100);
  }

  function toggleMute(id: number) {
    setTracks(p => p.map(t => {
      if (t.id !== id) return t;
      const m = !t.muted;
      const el = audioEls.current[id];
      if (el) { if (m) el.pause(); else if (playing) el.play().catch(() => {}); }
      return { ...t, muted: m };
    }));
  }

  function toggleSolo(id: number) {
    setTracks(p => {
      const next = p.map(t => t.id === id ? { ...t, solo: !t.solo } : t);
      if (playing) {
        const hasSolo = next.some(t => t.solo);
        next.forEach(t => {
          const el = audioEls.current[t.id];
          if (!el) return;
          const on = hasSolo ? t.solo : !t.muted;
          if (on) el.play().catch(() => {}); else el.pause();
        });
      }
      return next;
    });
  }

  function deleteTrack(id: number) {
    const el = audioEls.current[id]; if (el) el.pause();
    delete audioEls.current[id];
    const track = tracks.find(t => t.id === id);
    if (track?.audioUrl) URL.revokeObjectURL(track.audioUrl);
    setTracks(p => p.filter(t => t.id !== id));
  }

  // ── IMPORT ──
  function importFile(file: File) {
    addTrack(file.name.replace(/\.[^.]+$/, ""), URL.createObjectURL(file), "import");
    setShowPanel("none");
  }

  // ── YOUTUBE ──
  function extractVid(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function loadYt() {
    const vid = extractVid(ytQuery);
    if (vid) setYtVideoId(vid);
    // If not a URL, treat as search
  }

  // ── SUNO ──
  const [sunoError, setSunoError] = useState("");

  async function generateSuno() {
    setSunoLoading(true);
    setSunoError("");
    try {
      const res = await fetch("/api/suno", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale: sunoScale, mode: sunoMode, style: sunoStyle, bpm: sunoBpm }) });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.tracks) data.tracks.forEach((t: { title: string; audioUrl: string }) => addTrack(t.title || "AI Track", t.audioUrl, "suno"));
      else throw new Error("No tracks returned");
      setShowPanel("none");
    } catch (err) {
      setSunoError(err instanceof Error ? err.message : "Failed to generate track");
    }
    setSunoLoading(false);
  }

  // BUG 1 FIX: Master volume updates all audio elements
  useEffect(() => {
    tracks.forEach(tr => {
      const el = audioEls.current[tr.id];
      if (el) el.volume = (tr.volume / 100) * (masterVol / 100);
    });
  }, [masterVol, tracks]);

  // BUG 4 FIX: Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      tracks.forEach(tr => { if (tr.audioUrl) URL.revokeObjectURL(tr.audioUrl); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = Math.floor(recTime / 60) + ":" + String(recTime % 60).padStart(2, "0");
  const typeCol: Record<string, string> = { recording: "#C41E3A", import: "#D4A843", suno: "#8b5cf6" };

  return (
    <div>
      <div className="panel p-5 mb-3">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Recording Studio</div>
        <div className="font-label text-[10px] text-[#555] mt-1">Record · Import · Mix · Play</div>
      </div>

      {/* ── TRANSPORT ── */}
      <div className="panel p-4 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Record button */}
          {!isRec ? (
            <button onClick={startRec} title="Record"
              className="w-12 h-12 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
              style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555" }} />
          ) : (
            <button onClick={stopRec} title="Stop Recording"
              className="w-12 h-12 rounded-full cursor-pointer flex items-center justify-center flex-shrink-0"
              style={{ background: "radial-gradient(circle at 40% 40%, #555, #222 80%)", border: "2px solid #555" }}>
              <div className="w-4 h-4 bg-[#ccc] rounded-sm" />
            </button>
          )}

          {isRec && (
            <div className="flex items-center gap-2">
              <div className="led led-red" />
              <span className="font-readout text-xl text-[#C41E3A]">{fmt}</span>
              <span className="font-label text-[9px] text-[#555]">REC</span>
            </div>
          )}

          {/* Play/Stop all */}
          {tracks.length > 0 && !isRec && (
            !playing ? (
              <button onClick={playAll} title="Play All" className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #33CC33, #1a8a1a)", border: "2px solid #555" }}>
                <span className="text-[#0A0A0A] text-sm ml-0.5">&#9654;</span>
              </button>
            ) : (
              <button onClick={stopAll} title="Stop All" className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #888, #444)", border: "2px solid #555" }}>
                <div className="w-3 h-3 bg-[#ccc] rounded-sm" />
              </button>
            )
          )}

          <div className="flex-1" />

          {/* Source buttons */}
          <button onClick={() => setShowPanel(showPanel === "import" ? "none" : "import")}
            className={`btn-ghost !text-[10px] ${showPanel === "import" ? "active" : ""}`}>Import</button>
          <button onClick={() => setShowPanel(showPanel === "youtube" ? "none" : "youtube")}
            className={`btn-ghost !text-[10px] ${showPanel === "youtube" ? "active" : ""}`}>YouTube</button>
          <button onClick={() => setShowPanel(showPanel === "suno" ? "none" : "suno")}
            className={`btn-ghost !text-[10px] ${showPanel === "suno" ? "active" : ""}`}>AI</button>

          {/* Master volume */}
          <div className="flex items-center gap-1">
            <span className="font-label text-[8px] text-[#555]">MST</span>
            <input type="range" min={0} max={100} value={masterVol}
              onChange={(e) => { setMasterVol(Number(e.target.value)); }}
              className="w-14 accent-[#D4A843]" />
            <span className="font-readout text-[10px] text-[#D4A843] w-7">{masterVol}</span>
          </div>
        </div>
        <div className="vu mt-2"><div className="vu-fill" style={{ width: isRec ? "65%" : playing ? "40%" : "0%" }} /></div>
      </div>

      {/* ── IMPORT PANEL ── */}
      {showPanel === "import" && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-2">Import Audio File</div>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); }} />
          <button onClick={() => fileRef.current?.click()} className="btn-gold">Choose File</button>
          <span className="font-label text-[9px] text-[#444] ml-2">MP3, WAV, OGG, WebM</span>
        </div>
      )}

      {/* ── YOUTUBE PANEL (embedded, stays inside) ── */}
      {showPanel === "youtube" && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-2">YouTube — Paste URL to embed</div>
          <div className="flex gap-2 mb-3">
            <input value={ytQuery} onChange={e => setYtQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadYt()}
              placeholder="Paste YouTube URL here..." className="input flex-1 !text-xs" />
            <button onClick={loadYt} className="btn-gold !text-[10px]">Load</button>
          </div>

          {ytVideoId && (
            <div className="aspect-video w-full rounded-sm overflow-hidden bg-black mb-2">
              <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
                className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="YouTube" />
            </div>
          )}

          <div className="font-label text-[9px] text-[#555] mb-1">Find a backing track:</div>
          <div className="flex gap-1 flex-wrap">
            {["Am Blues Backing Track", "Rock Jam Track", "Metal Backing Track", "Funk Guitar Jam"].map(q => (
              <button key={q} onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank")}
                className="btn-ghost !text-[9px] !px-2 !py-1">{q}</button>
            ))}
          </div>
          <div className="font-label text-[8px] text-[#333] mt-1">Copy URL from YouTube and paste above</div>
        </div>
      )}

      {/* ── SUNO PANEL ── */}
      {showPanel === "suno" && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-3">AI Backing Track (Suno)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <label className="font-label text-[9px] text-[#555]">Key<input value={sunoScale} onChange={e => setSunoScale(e.target.value)} className="input mt-0.5 !text-xs" /></label>
            <label className="font-label text-[9px] text-[#555]">Mode<input value={sunoMode} onChange={e => setSunoMode(e.target.value)} className="input mt-0.5 !text-xs" /></label>
            <label className="font-label text-[9px] text-[#555]">Style<input value={sunoStyle} onChange={e => setSunoStyle(e.target.value)} className="input mt-0.5 !text-xs" /></label>
            <label className="font-label text-[9px] text-[#555]">BPM<input type="number" value={sunoBpm} onChange={e => setSunoBpm(Number(e.target.value))} className="input input-gold mt-0.5 !text-xs" /></label>
          </div>
          <button onClick={generateSuno} disabled={sunoLoading} className="btn-gold">{sunoLoading ? "Generating..." : "Generate"}</button>
          <span className="font-label text-[9px] text-[#444] ml-2">Requires SUNO_API_URL</span>
          {sunoError && <div className="font-label text-[10px] text-[#C41E3A] mt-2">{sunoError}</div>}
        </div>
      )}

      {/* ── MIXER ── */}
      <div className="panel p-4 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2">
          <div className="led led-gold" /> Mixer · {tracks.length} track{tracks.length !== 1 ? "s" : ""}
        </div>

        {!tracks.length && (
          <div className="text-center py-8">
            <div className="font-label text-sm text-[#333] mb-2">No tracks yet</div>
            <div className="font-label text-[10px] text-[#222]">Press the red button to record, or import/add a backing track</div>
          </div>
        )}

        {tracks.map((tr) => (
          <div key={tr.id} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <div className={`led ${tr.muted ? "led-off" : "led-on"}`} />
              <div className="w-2 h-4 rounded-sm flex-shrink-0" style={{ background: typeCol[tr.type] || "#888" }} />
              <span className="font-label text-[11px] text-[#aaa] flex-1 truncate">{tr.name}</span>
              <button onClick={() => toggleMute(tr.id)}
                className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${!tr.muted ? "border-[#33CC33] text-[#33CC33]" : "border-[#333] text-[#555]"}`}>
                {tr.muted ? "MUTE" : "ON"}
              </button>
              <button onClick={() => toggleSolo(tr.id)}
                className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${tr.solo ? "border-[#D4A843] text-[#D4A843]" : "border-[#333] text-[#555]"}`}>
                SOLO
              </button>
              <button onClick={() => deleteTrack(tr.id)}
                className="font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border border-[#333] text-[#C41E3A]">DEL</button>
            </div>

            {/* Audio player with waveform */}
            {tr.audioUrl && (
              <div>
                <div className="h-12 bg-[#111] rounded-sm border border-[#1a1a1a] mb-2 flex items-end overflow-hidden px-0.5">
                  {Array.from({ length: 120 }, (_, i) => {
                    // Seeded pseudo-random per track for realistic waveform
                    const seed = (tr.id * 1000 + i * 37 + 7) % 97;
                    const base = (seed / 97) * 60 + 10;
                    const envelope = 1 - Math.abs(i - 60) / 70;
                    const h = Math.max(5, base * Math.max(0.15, envelope));
                    return <div key={i} className="flex-1 mx-[0.2px] rounded-t-sm transition-all" style={{
                      height: h + "%",
                      background: tr.muted ? "#1a1a1a" : `rgba(212,168,67,${0.2 + (seed / 97) * 0.3})`,
                    }} />;
                  })}
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  ref={el => { if (el) audioEls.current[tr.id] = el; }}
                  controls src={tr.audioUrl} className="w-full h-8"
                  onEnded={() => setPlaying(false)} />
              </div>
            )}

            {/* Volume */}
            <div className="flex items-center gap-2 mt-2">
              <span className="font-label text-[8px] text-[#444] w-6">VOL</span>
              <input type="range" min={0} max={100} value={tr.volume}
                onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
                className="flex-1 accent-[#D4A843]" />
              <span className="font-readout text-[10px] text-[#555] w-7 text-right">{tr.volume}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
