"use client";
import { useState, useRef, useEffect } from "react";

interface Track {
  id: number;
  name: string;
  audioUrl: string | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  type: "recording" | "import" | "suno";
}

interface SavedSession {
  id: number;
  name: string;
  date: string;
  tracks: Track[];
}

export default function StudioPage() {
  const [isRec, setIsRec] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [masterVol, setMasterVol] = useState(80);
  const [recTime, setRecTime] = useState(0);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [sunoLoading, setSunoLoading] = useState(false);
  const [sunoScale, setSunoScale] = useState("Am");
  const [sunoMode, setSunoMode] = useState("Aeolian");
  const [sunoStyle, setSunoStyle] = useState("Doom Metal");
  const [sunoBpm, setSunoBpm] = useState(120);
  const [showSuno, setShowSuno] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctr = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load sessions
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gf-studio-sessions");
      if (raw) setSessions(JSON.parse(raw));
    } catch {}
  }, []);

  function saveSessions(s: SavedSession[]) {
    setSessions(s);
    try { localStorage.setItem("gf-studio-sessions", JSON.stringify(s)); } catch {}
  }

  function startRec() {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((stream) => {
        chunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          stream.getTracks().forEach((t) => t.stop());
          ctr.current++;
          setTracks((p) => [...p, { id: ctr.current, name: `Take ${ctr.current}`, audioUrl: URL.createObjectURL(blob), volume: 100, muted: false, solo: false, type: "recording" }]);
        };
        mr.start(); mediaRef.current = mr; setIsRec(true); setRecTime(0);
        timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
      }).catch(() => {});
  }

  function stopRec() {
    if (mediaRef.current && isRec) { mediaRef.current.stop(); setIsRec(false); if (timerRef.current) clearInterval(timerRef.current); }
  }

  function importFile(file: File) {
    const url = URL.createObjectURL(file);
    ctr.current++;
    setTracks((p) => [...p, { id: ctr.current, name: file.name.replace(/\.[^.]+$/, ""), audioUrl: url, volume: 100, muted: false, solo: false, type: "import" }]);
  }

  async function generateSuno() {
    setSunoLoading(true);
    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale: sunoScale, mode: sunoMode, style: sunoStyle, bpm: sunoBpm }),
      });
      const data = await res.json();
      if (data.tracks) {
        data.tracks.forEach((t: { id: string; title: string; audioUrl: string }) => {
          ctr.current++;
          setTracks((p) => [...p, { id: ctr.current, name: t.title || "AI Track", audioUrl: t.audioUrl, volume: 100, muted: false, solo: false, type: "suno" }]);
        });
      }
    } catch { /* Suno not configured */ }
    setSunoLoading(false);
  }

  function saveSession() {
    const name = sessionName.trim() || `Session ${sessions.length + 1}`;
    const s: SavedSession = { id: Date.now(), name, date: new Date().toLocaleDateString("he-IL"), tracks };
    saveSessions([s, ...sessions].slice(0, 20));
    setSessionName("");
  }

  function loadSession(s: SavedSession) {
    setTracks(s.tracks);
  }

  function deleteSession(id: number) {
    saveSessions(sessions.filter(s => s.id !== id));
  }

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);
  const fmt = Math.floor(recTime / 60) + ":" + String(recTime % 60).padStart(2, "0");

  return (
    <div>
      <div className="panel p-5 mb-3">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Recording Studio</div>
        <div className="font-label text-[10px] text-[#555] mt-1">Record, import, mix, and save</div>
      </div>

      {/* Transport */}
      <div className="panel p-5 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {!isRec ? (
              <button onClick={startRec} className="w-12 h-12 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
                style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555" }} />
            ) : (
              <button onClick={stopRec} className="w-12 h-12 rounded-full cursor-pointer flex items-center justify-center"
                style={{ background: "radial-gradient(circle at 40% 40%, #444, #222 80%)", border: "2px solid #555" }}>
                <div className="w-4 h-4 bg-[#888] rounded-sm" />
              </button>
            )}
            {isRec && <><div className="led led-red" /><span className="font-readout text-xl text-[#C41E3A]">{fmt}</span></>}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(!showImport)} className={`btn-ghost !text-[10px] ${showImport ? "active" : ""}`}>Import</button>
            <button onClick={() => setShowSuno(!showSuno)} className={`btn-ghost !text-[10px] ${showSuno ? "active" : ""}`}>AI Generate</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-label text-[9px] text-[#555]">Master</span>
            <input type="range" min={0} max={100} value={masterVol} onChange={(e) => setMasterVol(Number(e.target.value))} className="w-20 accent-[#D4A843]" />
            <span className="font-readout text-[10px] text-[#D4A843]">{masterVol}%</span>
          </div>
        </div>
        <div className="vu mt-3"><div className="vu-fill" style={{ width: isRec ? "60%" : "0%" }} /></div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-2">Import Audio File</div>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); setShowImport(false); }} />
          <button onClick={() => fileRef.current?.click()} className="btn-gold">Choose File (MP3, WAV, WebM)</button>
        </div>
      )}

      {/* Suno panel */}
      {showSuno && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-3">AI Backing Track (Suno)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <label className="font-label text-[9px] text-[#555]">Key
              <input value={sunoScale} onChange={e => setSunoScale(e.target.value)} className="input mt-0.5 !text-xs" />
            </label>
            <label className="font-label text-[9px] text-[#555]">Mode
              <input value={sunoMode} onChange={e => setSunoMode(e.target.value)} className="input mt-0.5 !text-xs" />
            </label>
            <label className="font-label text-[9px] text-[#555]">Style
              <input value={sunoStyle} onChange={e => setSunoStyle(e.target.value)} className="input mt-0.5 !text-xs" />
            </label>
            <label className="font-label text-[9px] text-[#555]">BPM
              <input type="number" value={sunoBpm} onChange={e => setSunoBpm(Number(e.target.value))} className="input input-gold mt-0.5 !text-xs" />
            </label>
          </div>
          <button onClick={generateSuno} disabled={sunoLoading} className="btn-gold">
            {sunoLoading ? "Generating..." : "Generate Track"}
          </button>
          <div className="font-label text-[9px] text-[#444] mt-2">Requires Suno API. Set SUNO_API_URL in .env.local</div>
        </div>
      )}

      {/* Tracks */}
      <div className="panel p-5 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2">
          <div className="led led-gold" /> Tracks ({tracks.length})
        </div>

        {!tracks.length && (
          <div className="text-center py-10">
            <div className="font-label text-sm text-[#333]">Record, import, or generate a track to begin</div>
          </div>
        )}

        {tracks.map((tr) => (
          <div key={tr.id} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 mb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className={`led ${tr.muted ? "led-off" : "led-on"}`} />
              <span className="font-label text-[11px] text-[#aaa] flex-1">{tr.name}</span>
              <span className="font-label text-[8px] text-[#444] border border-[#222] px-1 rounded-sm">{tr.type}</span>
              <button onClick={() => setTracks(p => p.map(t => t.id === tr.id ? { ...t, muted: !t.muted } : t))}
                className={`btn-ghost !text-[9px] !px-2 !py-0.5 ${!tr.muted ? "active" : ""}`}>{tr.muted ? "Muted" : "On"}</button>
              <button onClick={() => setTracks(p => p.map(t => t.id === tr.id ? { ...t, solo: !t.solo } : t))}
                className={`btn-ghost !text-[9px] !px-2 !py-0.5 ${tr.solo ? "!border-[#D4A843] !text-[#D4A843]" : ""}`}>Solo</button>
              <button onClick={() => setTracks(p => p.filter(t => t.id !== tr.id))}
                className="btn-ghost !text-[9px] !px-2 !py-0.5 !text-[#C41E3A]">Del</button>
            </div>
            {tr.audioUrl && <>
              <div className="h-10 bg-[#111] rounded-sm border border-[#1a1a1a] mb-2 flex items-center overflow-hidden px-1">
                {Array.from({ length: 100 }, (_, i) => <div key={i} className="w-[1px] mx-[0.5px] rounded-full" style={{ height: (Math.random() * 60 + 20) + "%", background: `rgba(212,168,67,${0.3 + Math.random() * 0.4})` }} />)}
              </div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={tr.audioUrl} className="w-full h-7" />
            </>}
            <div className="flex items-center gap-2 mt-2">
              <span className="font-label text-[9px] text-[#444]">Vol</span>
              <input type="range" min={0} max={100} value={tr.volume} onChange={(e) => setTracks(p => p.map(t => t.id === tr.id ? { ...t, volume: Number(e.target.value) } : t))}
                className="flex-1 accent-[#D4A843]" />
              <span className="font-readout text-[10px] text-[#555]">{tr.volume}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Save/Load sessions */}
      <div className="panel p-5 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2">
          <div className="led led-gold" /> Sessions
        </div>
        {tracks.length > 0 && (
          <div className="flex gap-2 mb-3">
            <input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Session name..." className="input flex-1 !text-xs" />
            <button onClick={saveSession} className="btn-gold !text-[10px]">Save</button>
          </div>
        )}
        {sessions.length === 0 && <div className="font-label text-[10px] text-[#333]">No saved sessions</div>}
        {sessions.map(s => (
          <div key={s.id} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0">
            <div className="flex-1">
              <div className="text-xs font-medium text-[#ccc]">{s.name}</div>
              <div className="font-readout text-[9px] text-[#444]">{s.date} · {s.tracks.length} tracks</div>
            </div>
            <button onClick={() => loadSession(s)} className="btn-ghost !text-[9px] !px-2 !py-0.5">Load</button>
            <button onClick={() => deleteSession(s.id)} className="btn-ghost !text-[9px] !px-2 !py-0.5 !text-[#C41E3A]">Del</button>
          </div>
        ))}
      </div>
    </div>
  );
}
