"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface TrackInfo { index: number; name: string; volume: number; isMuted: boolean; isSolo: boolean }
interface Bookmark { name: string; startBar: number; endBar: number }

export default function GpFileUploader({ exerciseId, tex, songName, gpUrl }: { exerciseId?: string; tex?: string; songName?: string; gpUrl?: string }) {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpUrlLoading, setGpUrlLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [songInfo, setSongInfo] = useState<{ title: string; artist: string; tempo: number } | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [activeTrack, setActiveTrack] = useState(0);

  // Player state
  const [masterVolume, setMasterVolume] = useState(1);
  const [metronomeVolume, setMetronomeVolume] = useState(0);
  const [countInVolume, setCountInVolume] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [currentBar, setCurrentBar] = useState(0);
  const [totalBars, setTotalBars] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [showMixer, setShowMixer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [layout, setLayout] = useState<"page" | "horizontal">("page");
  const [staveMode, setStaveMode] = useState<"tab" | "score" | "both">("both");
  const [zoomLevel, setZoomLevel] = useState(1);

  // Selection & advanced
  const [selectMode, setSelectMode] = useState<"none" | "pickA" | "pickB">("none");
  const [dragStartBar, setDragStartBar] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [speedTrainer, setSpeedTrainer] = useState(false);
  const [trainerStartSpeed, setTrainerStartSpeed] = useState(0.5);
  const [trainerEndSpeed, setTrainerEndSpeed] = useState(1);
  const [trainerStep, setTrainerStep] = useState(0.05);
  const [showFretboard, setShowFretboard] = useState(false);
  const [activeNotes, setActiveNotes] = useState<{ fret: number; string: number }[]>([]);
  const [currentBeatInfo, setCurrentBeatInfo] = useState<string>("");
  const [transpose, setTranspose] = useState(0);
  const [texLoaded, setTexLoaded] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loopCountRef = useRef(0);
  const readyCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerBlobUrlRef = useRef<string | null>(null);

  const MAX_SAVE_SIZE = 2 * 1024 * 1024; // 2MB

  // Auto-load saved tab from localStorage on mount
  useEffect(() => {
    if (!exerciseId) return;
    const key = `gf-tab-${exerciseId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.data && parsed.name) {
        const binary = atob(parsed.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        setFileData(bytes);
        setFileName(parsed.name);
        setSavedIndicator(true);
      }
    } catch {}
  }, [exerciseId]);

  function saveToLocalStorage(data: Uint8Array, name: string) {
    if (!exerciseId) return;
    if (data.byteLength > MAX_SAVE_SIZE) return;
    try {
      let binary = "";
      for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
      const b64 = btoa(binary);
      localStorage.setItem(`gf-tab-${exerciseId}`, JSON.stringify({ data: b64, name }));
      setSavedIndicator(true);
    } catch {}
  }

  // Auto-load GP file from Supabase Storage URL (with IndexedDB cache)
  useEffect(() => {
    if (!gpUrl || fileData) return;
    let cancelled = false;
    setGpUrlLoading(true);
    setError(null);

    const cacheKey = `gf-gp-cache-${gpUrl}`;

    async function loadFromCache(): Promise<Uint8Array | null> {
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("gf-gp-cache", 1);
          req.onupgradeneeded = () => { req.result.createObjectStore("files"); };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        const data = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
          const req = store.get(cacheKey);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        db.close();
        if (data) return new Uint8Array(data);
      } catch {}
      return null;
    }

    async function saveToCache(data: Uint8Array): Promise<void> {
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("gf-gp-cache", 1);
          req.onupgradeneeded = () => { req.result.createObjectStore("files"); };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(data.buffer, cacheKey);
        db.close();
      } catch {}
    }

    (async () => {
      // Try IndexedDB cache first
      const cached = await loadFromCache();
      if (cached && !cancelled) {
        setFileData(cached);
        setFileName(gpUrl.split("/").pop() || "tab.gp");
        setGpUrlLoading(false);
        return;
      }
      // Fetch from Supabase Storage
      try {
        const res = await fetch(gpUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const data = new Uint8Array(buf);
        setFileData(data);
        setFileName(gpUrl.split("/").pop() || "tab.gp");
        await saveToCache(data);
      } catch (err) {
        if (!cancelled) setError("Failed to load GP file: " + String(err));
      } finally {
        if (!cancelled) setGpUrlLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [gpUrl, fileData]);

  // Auto-load AlphaTex if provided and no file uploaded
  useEffect(() => {
    if (!tex || fileData) return;
    setTexLoaded(true);
  }, [tex, fileData]);

  function handleFile(file: File) {
    setTexLoaded(false);
    setFileName(file.name);
    setError(null); setReady(false); setLoading(true);
    setSongInfo(null); setPlayerReady(false); setCurrentBar(0); setTotalBars(0);
    setLoopStart(null); setLoopEnd(null); setIsLooping(false); setBookmarks([]);
    setActiveNotes([]); setCurrentBeatInfo("");
    if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {}
    apiRef.current = null;
    if (workerBlobUrlRef.current) { URL.revokeObjectURL(workerBlobUrlRef.current); workerBlobUrlRef.current = null; }
    if (readyCheckRef.current) { clearInterval(readyCheckRef.current); readyCheckRef.current = null; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      setFileData(data);
      saveToLocalStorage(data, file.name);
    };
    reader.onerror = () => { setError("Failed to read file"); setLoading(false); };
    reader.readAsArrayBuffer(file);
  }

  useEffect(() => {
    if ((!fileData && !texLoaded) || !mainRef.current) return;
    let dead = false;
    setLoading(true); setError(null); setReady(false);
    setSongInfo(null); setPlayerReady(false); setCurrentBar(0); setTotalBars(0);
    setActiveNotes([]); setCurrentBeatInfo("");

    (async () => {
      try {
        const at = await import("@coderline/alphatab");
        if (dead || !mainRef.current) return;
        if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {}
        apiRef.current = null;
        const base = window.location.origin;

        (at.Environment as any).createWebWorker = () => {
          const workerUrl = base + "/alphatab/alphaTab.worker.mjs";
          const script = `import ${JSON.stringify(workerUrl)}`;
          const blob = new Blob([script], { type: "application/javascript" });
          if (workerBlobUrlRef.current) URL.revokeObjectURL(workerBlobUrlRef.current);
          const blobUrl = URL.createObjectURL(blob);
          workerBlobUrlRef.current = blobUrl;
          return new Worker(blobUrl, { type: "module" });
        };

        const s = new at.Settings();
        s.core.fontDirectory = base + "/alphatab/font/";
        s.core.scriptFile = base + "/alphatab/alphaTab.mjs";
        s.core.engine = "html5";
        s.core.logLevel = 1;
        s.core.includeNoteBounds = true;
        s.player.enablePlayer = true;
        s.player.enableCursor = true;
        s.player.enableUserInteraction = true;
        s.player.soundFont = base + "/alphatab/soundfont/MuseScore_General.sf3";
        s.player.scrollElement = mainRef.current;
        s.player.scrollOffsetY = -10;
        s.display.layoutMode = 0;
        s.display.staveProfile = 4;

        const api = new at.AlphaTabApi(mainRef.current, s);
        apiRef.current = api;

        api.scoreLoaded.on((score: any) => {
          if (dead) return;
          setLoading(false); setReady(true);
          setSongInfo({ title: score.title || "Untitled", artist: score.artist || "", tempo: score.tempo || 120 });
          setTracks(score.tracks.map((t: any, i: number) => ({
            index: i, name: t.name || `Track ${i + 1}`, volume: 1, isMuted: false, isSolo: false,
          })));
          if (score.masterBars?.length) setTotalBars(score.masterBars.length);
        });

        api.playerReady.on(() => { if (!dead) setPlayerReady(true); });

        let pollCount = 0;
        if (readyCheckRef.current) clearInterval(readyCheckRef.current);
        const readyCheck = setInterval(() => {
          if (dead) { clearInterval(readyCheck); readyCheckRef.current = null; return; }
          pollCount++;
          if (api.isReadyForPlayback) { setPlayerReady(true); clearInterval(readyCheck); readyCheckRef.current = null; }
          else if (pollCount >= 30) { setPlayerReady(true); clearInterval(readyCheck); readyCheckRef.current = null; }
        }, 500);
        readyCheckRef.current = readyCheck;

        api.playerStateChanged.on((e: any) => { if (!dead) setPlaying(e.state === 1); });

        // Position tracking
        api.playedBeatChanged?.on?.((beat: any) => {
          if (dead || !beat) return;
          const bar = beat.voice?.bar;
          if (bar?.index !== undefined) setCurrentBar(bar.index + 1);
          // Extract note info for fretboard
          const notes = beat.notes || [];
          const noteData = notes.map((n: any) => ({ fret: n.fret, string: n.string })).filter((n: any) => n.fret >= 0);
          setActiveNotes(noteData);
          // Beat info
          if (notes.length > 0) {
            const info = notes.map((n: any) => `S${n.string}F${n.fret}`).join(" ");
            setCurrentBeatInfo(info);
          }
        });

        // Time tracking
        (api as any).playerPositionChanged?.on?.((e: any) => {
          if (dead) return;
          setCurrentTime(e.currentTime ?? 0);
          setTotalTime(e.endTime ?? 0);
        });

        // Click on beat in tab → dispatch to React via custom event
        api.beatMouseUp?.on?.((beat: any) => {
          if (dead || !beat?.voice?.bar) return;
          const barIdx = beat.voice.bar.index + 1;
          (api as any)._lastClickedBar = barIdx;
          // Dispatch custom event so React state can handle selectMode
          window.dispatchEvent(new CustomEvent("gf-bar-click", { detail: { bar: barIdx } }));
        });

        api.error.on((e: any) => {
          if (dead) return;
          console.error("alphaTab error:", e);
          setError(String(e?.message || e));
          setLoading(false);
        });

        if (fileData) {
          api.load(fileData);
        } else if (tex) {
          api.tex(tex);
        }
      } catch (err) {
        if (!dead) { setError("Init: " + String(err)); setLoading(false); }
      }
    })();

    return () => {
      dead = true;
      if (readyCheckRef.current) { clearInterval(readyCheckRef.current); readyCheckRef.current = null; }
      if (apiRef.current?.destroy) {
        try { apiRef.current.destroy(); } catch {}
      }
      apiRef.current = null;
      if (workerBlobUrlRef.current) { URL.revokeObjectURL(workerBlobUrlRef.current); workerBlobUrlRef.current = null; }
    };
  }, [fileData, texLoaded]);

  const applyLoopRange = useCallback((start: number, end: number) => {
    const api = apiRef.current;
    if (!api?.score?.masterBars) return;
    const s = Math.max(1, Math.min(start, totalBars));
    const e = Math.max(s, Math.min(end, totalBars));
    const startBar = api.score.masterBars[s - 1];
    const endBar = api.score.masterBars[e - 1];
    if (!startBar || !endBar) return;
    api.playbackRange = { startTick: startBar.start, endTick: endBar.start + endBar.calculateDuration() };
    api.isLooping = true;
    setIsLooping(true); setLoopStart(s); setLoopEnd(e);
  }, [totalBars]);

  // Handle bar clicks from tab notation
  useEffect(() => {
    function onBarClick(e: Event) {
      const bar = (e as CustomEvent).detail?.bar;
      if (!bar) return;

      if (selectMode === "pickA") {
        // Set as loop start
        applyLoopRange(bar, loopEnd ?? totalBars);
        setSelectMode("none");
      } else if (selectMode === "pickB") {
        // Set as loop end
        applyLoopRange(loopStart ?? 1, bar);
        setSelectMode("none");
      } else if (loopStart && !loopEnd) {
        // A was set, this click sets B
        applyLoopRange(loopStart, bar);
      } else {
        // Normal click → jump to bar
        setCurrentBar(bar);
        const api = apiRef.current;
        if (api?.score?.masterBars?.[bar - 1]) {
          api.tickPosition = api.score.masterBars[bar - 1].start;
        }
      }
    }
    window.addEventListener("gf-bar-click", onBarClick);
    return () => window.removeEventListener("gf-bar-click", onBarClick);
  }, [selectMode, loopStart, loopEnd, totalBars, applyLoopRange]);

  // Speed trainer: increase speed each loop iteration
  useEffect(() => {
    if (!speedTrainer || !isLooping || !playing) return;
    const api = apiRef.current;
    if (!api) return;

    const handler = () => {
      loopCountRef.current++;
      const newSpeed = Math.min(trainerEndSpeed, trainerStartSpeed + loopCountRef.current * trainerStep);
      api.playbackSpeed = newSpeed;
      setSpeed(newSpeed);
    };

    // Listen for playback range changed which fires on each loop restart
    api.playbackRangeChanged?.on?.(handler);
    return () => { api.playbackRangeChanged?.off?.(handler); };
  }, [speedTrainer, isLooping, playing, trainerStartSpeed, trainerEndSpeed, trainerStep]);

  // --- Controls ---
  function togglePlay() {
    const api = apiRef.current;
    if (!api) return;
    if ((api as any).player?.output?.audioContext?.state === "suspended")
      (api as any).player.output.audioContext.resume();
    api.playPause();
  }
  function doStop() { apiRef.current?.stop(); setPlaying(false); }

  function setSpd(s: number) { if (apiRef.current) apiRef.current.playbackSpeed = s; setSpeed(s); }
  function changeTrk(i: number) {
    const api = apiRef.current;
    if (api?.score?.tracks?.[i]) { api.renderTracks([api.score.tracks[i]]); setActiveTrack(i); }
  }
  function doTranspose(delta: number) {
    const api = apiRef.current;
    if (!api?.score) return;
    const newVal = transpose + delta;
    for (const track of api.score.tracks) {
      for (const staff of track.staves) {
        staff.transpositionPitch = newVal;
      }
    }
    api.render();
    setTranspose(newVal);
  }

  function setMasterVol(v: number) { if (apiRef.current) apiRef.current.masterVolume = v; setMasterVolume(v); }
  function setMetVol(v: number) { if (apiRef.current) apiRef.current.metronomeVolume = v; setMetronomeVolume(v); }
  function setCountIn(v: number) { if (apiRef.current) apiRef.current.countInVolume = v; setCountInVolume(v); }

  function toggleLoop() {
    const api = apiRef.current;
    if (!api) return;
    const newVal = !isLooping;
    api.isLooping = newVal;
    setIsLooping(newVal);
    if (!newVal) { api.playbackRange = null; setLoopStart(null); setLoopEnd(null); setSpeedTrainer(false); }
  }

  function setLoopFromCurrentBar(type: "start" | "end") {
    const bar = currentBar || (apiRef.current as any)?._lastClickedBar || 1;
    if (type === "start") applyLoopRange(bar, loopEnd ?? totalBars);
    else applyLoopRange(loopStart ?? 1, bar);
    setSelectMode("none");
  }

  function jumpToBar(bar: number) {
    const api = apiRef.current;
    if (!api?.score?.masterBars?.[bar - 1]) return;
    const mb = api.score.masterBars[bar - 1];
    api.tickPosition = mb.start;
  }

  // --- Mixer ---
  function toggleTrackMute(i: number) {
    const api = apiRef.current;
    if (!api?.score?.tracks?.[i]) return;
    const m = !tracks[i].isMuted;
    api.changeTrackMute([api.score.tracks[i]], m);
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, isMuted: m } : t));
  }
  function toggleTrackSolo(i: number) {
    const api = apiRef.current;
    if (!api?.score?.tracks?.[i]) return;
    const s = !tracks[i].isSolo;
    api.changeTrackSolo([api.score.tracks[i]], s);
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, isSolo: s } : t));
  }
  function setTrackVolume(i: number, v: number) {
    const api = apiRef.current;
    if (!api?.score?.tracks?.[i]) return;
    api.changeTrackVolume([api.score.tracks[i]], v);
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, volume: v } : t));
  }

  // --- Display ---
  function applyDisplay(l: "page" | "horizontal", s: "tab" | "score" | "both", z: number) {
    const api = apiRef.current;
    if (!api) return;
    api.settings.display.layoutMode = l === "horizontal" ? 1 : 0;
    api.settings.display.staveProfile = s === "tab" ? 1 : s === "score" ? 2 : 4;
    api.settings.display.scale = z;
    api.updateSettings(); api.render();
  }

  // --- Bookmarks ---
  function addBookmark() {
    const s = loopStart ?? 1, e = loopEnd ?? totalBars;
    const name = `Bars ${s}-${e}`;
    setBookmarks(prev => [...prev, { name, startBar: s, endBar: e }]);
  }
  function loadBookmark(b: Bookmark) {
    applyLoopRange(b.startBar, b.endBar);
    jumpToBar(b.startBar);
  }
  function deleteBookmark(i: number) {
    setBookmarks(prev => prev.filter((_, idx) => idx !== i));
  }

  // --- Speed Trainer ---
  function startSpeedTrainer() {
    if (!isLooping || !loopStart || !loopEnd) {
      applyLoopRange(loopStart ?? 1, loopEnd ?? totalBars);
    }
    loopCountRef.current = 0;
    setSpd(trainerStartSpeed);
    setSpeedTrainer(true);
  }

  function fmtTime(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // --- Fretboard ---
  const STRINGS = 6;
  const FRETS = 24;
  const stringNames = ["E", "B", "G", "D", "A", "E"];

  return (
    <div>
      {gpUrlLoading ? (
        <div className="panel p-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin mb-2" />
          <div className="font-label text-sm text-[#555]">Loading Guitar Pro tab...</div>
        </div>
      ) : !fileData && !texLoaded ? (
        <div onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.(gp[345x]?|gpx?)$/i.test(f.name)) handleFile(f); }}
          className="panel p-6 text-center cursor-pointer border-dashed !border-[#333] hover:!border-[#D4A843]/40 transition-all"
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          <div className="font-label text-sm text-[#555] mb-2">Drop Guitar Pro file or click to browse</div>
          <div className="font-label text-[10px] text-[#333]">.gp .gp3 .gp4 .gp5 .gpx</div>
          <div className="font-label text-[9px] text-[#444] mt-3">
            <button type="button" className="text-[#D4A843] underline bg-transparent border-none cursor-pointer font-label text-[9px]" onClick={async (e) => {
              e.stopPropagation();
              if (!songName) { window.open("https://guitarprotabs.org", "_blank"); return; }
              try {
                const r = await fetch(`/api/gptabs?q=${encodeURIComponent(songName)}`);
                const data = await r.json();
                if (data.length > 0) window.open(data[0].downloadUrl, "_blank");
                else window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(songName)}&in=songs&page=1`, "_blank");
              } catch { window.open(`https://guitarprotabs.org/search.php?search=${encodeURIComponent(songName)}&in=songs&page=1`, "_blank"); }
            }}>Download from guitarprotabs.org</button>
          </div>
        </div>
      ) : (
        <div className="panel p-0 overflow-hidden">
          {/* ── Header ── */}
          <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#0d0d0d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`led ${ready && playerReady ? "led-gold" : ready ? "led-on" : loading ? "led-off" : "led-red"}`} />
                <span className="font-label text-[11px] text-[#D4A843]">
                  {songInfo ? `${songInfo.artist}${songInfo.artist ? " — " : ""}${songInfo.title} (${songInfo.tempo} BPM)` : fileName}
                </span>
                {savedIndicator && <span className="font-label text-[9px] text-[#33CC33]">Saved</span>}
                {ready && !playerReady && <span className="font-label text-[9px] text-[#555]">Loading player...</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => fileRef.current?.click()} className="btn-ghost !text-[9px] !px-2 !py-1">Change</button>
                <button onClick={() => {
                  if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {}
                  apiRef.current = null; setFileData(null); setFileName(null); setReady(false);
                  setSongInfo(null); setPlayerReady(false); setShowMixer(false); setShowSettings(false);
                  setShowBookmarks(false); setShowFretboard(false);
                }} className="btn-ghost !text-[9px] !px-2 !py-1 !text-[#C41E3A]">Close</button>
                <input ref={fileRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>
            </div>
          </div>

          {/* ── Transport ── */}
          {ready && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#121214] space-y-2">
              {/* Row 1: Play, position, speed */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={togglePlay}
                  className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center shrink-0"
                  style={{ background: playing ? "#C41E3A" : playerReady ? "#33CC33" : "#555", border: "2px solid #555", opacity: playerReady ? 1 : 0.5 }}>
                  {playing ? <div className="w-2.5 h-2.5 bg-white rounded-sm" /> : <span className="text-[#121214] text-xs ml-0.5">&#9654;</span>}
                </button>
                {playing && <button onClick={doStop} className="btn-ghost !text-[9px] !px-2 !py-1">Stop</button>}

                <span className="font-readout text-[10px] text-[#888] min-w-[80px]">{fmtTime(currentTime)} / {fmtTime(totalTime)}</span>

                {/* Bar navigator */}
                {totalBars > 0 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => jumpToBar(Math.max(1, currentBar - 1))} className="text-[#555] text-[10px] cursor-pointer px-1 hover:text-[#D4A843]">◀</button>
                    <span className="font-readout text-[10px] text-[#D4A843] min-w-[60px] text-center cursor-pointer"
                      onClick={() => { const b = prompt("Jump to bar:", String(currentBar)); if (b) jumpToBar(Number(b)); }}>
                      Bar {currentBar}/{totalBars}
                    </span>
                    <button onClick={() => jumpToBar(Math.min(totalBars, currentBar + 1))} className="text-[#555] text-[10px] cursor-pointer px-1 hover:text-[#D4A843]">▶</button>
                  </div>
                )}

                {currentBeatInfo && <span className="font-readout text-[9px] text-[#555]">{currentBeatInfo}</span>}

                <div className="flex items-center gap-0.5 ml-auto">
                  <span className="font-label text-[8px] text-[#555]">Speed</span>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                    <button key={s} onClick={() => setSpd(s)}
                      className={`font-readout text-[9px] px-1.5 py-0.5 rounded-sm cursor-pointer border ${speed === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{s}x</button>
                  ))}
                </div>
              </div>

              {/* Row 2: Loop, metronome, tools */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={toggleLoop}
                  className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${isLooping ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>
                  Loop {isLooping ? "ON" : "OFF"}
                </button>

                {/* Loop range: A/B buttons - click to use current bar, or toggle pick mode */}
                <button onClick={() => {
                  if (selectMode === "pickA") { setSelectMode("none"); }
                  else if (currentBar > 0 || (apiRef.current as any)?._lastClickedBar) {
                    setLoopFromCurrentBar("start");
                  } else { setSelectMode("pickA"); }
                }}
                  onDoubleClick={() => setSelectMode(selectMode === "pickA" ? "none" : "pickA")}
                  className={`font-label text-[9px] px-1.5 py-1 rounded cursor-pointer border ${selectMode === "pickA" ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/20 animate-pulse" : loopStart ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/10" : "border-[#222] text-[#555] hover:border-[#33CC33] hover:text-[#33CC33]"}`}
                  title="Click: set A from current bar. Double-click: pick A from tab">A{loopStart ? `:${loopStart}` : ""}</button>
                {isLooping && (
                  <span className="font-readout text-[10px] text-[#D4A843]">{loopStart ?? 1} - {loopEnd ?? totalBars}</span>
                )}
                <button onClick={() => {
                  if (selectMode === "pickB") { setSelectMode("none"); }
                  else if (currentBar > 0 || (apiRef.current as any)?._lastClickedBar) {
                    setLoopFromCurrentBar("end");
                  } else { setSelectMode("pickB"); }
                }}
                  onDoubleClick={() => setSelectMode(selectMode === "pickB" ? "none" : "pickB")}
                  className={`font-label text-[9px] px-1.5 py-1 rounded cursor-pointer border ${selectMode === "pickB" ? "border-[#C41E3A] text-[#C41E3A] bg-[#C41E3A]/20 animate-pulse" : loopEnd ? "border-[#C41E3A] text-[#C41E3A] bg-[#C41E3A]/10" : "border-[#222] text-[#555] hover:border-[#C41E3A] hover:text-[#C41E3A]"}`}
                  title="Click: set B from current bar. Double-click: pick B from tab">B{loopEnd ? `:${loopEnd}` : ""}</button>
                {selectMode === "pickA" && <span className="font-label text-[8px] text-[#33CC33] animate-pulse">Click a bar in tab to set A</span>}
                {selectMode === "pickB" && <span className="font-label text-[8px] text-[#C41E3A] animate-pulse">Click a bar in tab to set B</span>}
                {selectMode === "none" && !isLooping && <span className="font-label text-[8px] text-[#444]">Click tab to jump</span>}

                <div className="w-px h-4 bg-[#222]" />

                <button onClick={() => setMetVol(metronomeVolume > 0 ? 0 : 1)}
                  className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${metronomeVolume > 0 ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/10" : "border-[#222] text-[#555]"}`}>
                  Met
                </button>
                {metronomeVolume > 0 && (
                  <input type="range" min="0" max="1" step="0.1" value={metronomeVolume}
                    onChange={e => setMetVol(Number(e.target.value))} className="w-12 h-1 accent-[#33CC33]" />
                )}

                <button onClick={() => setCountIn(countInVolume > 0 ? 0 : 1)}
                  className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${countInVolume > 0 ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>
                  Count-in
                </button>

                {tracks.length > 1 && (
                  <select value={activeTrack} onChange={e => changeTrk(Number(e.target.value))} className="input !w-auto !py-1 !text-[10px]">
                    {tracks.map(t => <option key={t.index} value={t.index}>{t.name}</option>)}
                  </select>
                )}

                <div className="flex items-center gap-1">
                  <span className="font-label text-[8px] text-[#555]">Transpose</span>
                  <button onClick={() => doTranspose(-1)} className="font-readout text-[9px] px-1.5 py-0.5 rounded cursor-pointer border border-[#222] text-[#555] hover:text-[#D4A843]">-</button>
                  <span className={`font-readout text-[9px] min-w-[20px] text-center ${transpose !== 0 ? "text-[#D4A843]" : "text-[#555]"}`}>{transpose > 0 ? `+${transpose}` : transpose}</span>
                  <button onClick={() => doTranspose(1)} className="font-readout text-[9px] px-1.5 py-0.5 rounded cursor-pointer border border-[#222] text-[#555] hover:text-[#D4A843]">+</button>
                  {transpose !== 0 && <button onClick={() => { setTranspose(0); doTranspose(-transpose); }} className="font-label text-[8px] text-[#555] hover:text-[#C41E3A] cursor-pointer">Reset</button>}
                </div>

                <div className="flex gap-1 ml-auto">
                  <button onClick={() => setShowFretboard(!showFretboard)}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${showFretboard ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                    Fretboard
                  </button>
                  <button onClick={() => setShowMixer(!showMixer)}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${showMixer ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                    Mixer
                  </button>
                  <button onClick={() => setShowBookmarks(!showBookmarks)}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${showBookmarks ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                    Clips
                  </button>
                  <button onClick={() => setShowSettings(!showSettings)}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${showSettings ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                    Display
                  </button>
                </div>
              </div>

              {/* Master volume */}
              <div className="flex items-center gap-2">
                <span className="font-label text-[8px] text-[#555] w-10">Volume</span>
                <input type="range" min="0" max="1" step="0.05" value={masterVolume}
                  onChange={e => setMasterVol(Number(e.target.value))} className="flex-1 h-1 accent-[#D4A843]" />
                <span className="font-readout text-[9px] text-[#666] w-8 text-right">{Math.round(masterVolume * 100)}%</span>
              </div>
            </div>
          )}

          {/* ── Fretboard ── */}
          {showFretboard && ready && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#080808] overflow-x-auto">
              <div className="font-label text-[10px] text-[#D4A843] mb-1">Fretboard</div>
              <div className="relative" style={{ minWidth: 600 }}>
                {Array.from({ length: STRINGS }, (_, si) => (
                  <div key={si} className="flex items-center h-5">
                    <span className="font-readout text-[8px] text-[#555] w-4 text-right mr-1">{stringNames[si]}</span>
                    <div className="flex flex-1 relative">
                      {/* Nut */}
                      <div className="w-1 h-5 bg-[#888] mr-px" />
                      {Array.from({ length: FRETS }, (_, fi) => {
                        const isActive = activeNotes.some(n => n.string === si + 1 && n.fret === fi);
                        const isDot = si === 2 && [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fi);
                        const isDoubleDot = si === 1 && [12, 24].includes(fi);
                        return (
                          <div key={fi}
                            className="relative border-r border-[#333] flex items-center justify-center"
                            style={{ width: Math.max(16, 32 - fi * 0.4), height: 20, background: isActive ? "#D4A843" : "transparent" }}>
                            {isActive && <span className="font-readout text-[7px] text-[#121214] font-bold">{fi}</span>}
                            {isDot && !isActive && <div className="absolute w-1 h-1 rounded-full bg-[#333]" />}
                            {isDoubleDot && !isActive && <div className="absolute w-1 h-1 rounded-full bg-[#333]" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Fret numbers */}
                <div className="flex ml-5">
                  <div className="w-1 mr-px" />
                  {Array.from({ length: FRETS }, (_, fi) => (
                    <div key={fi} className="text-center font-readout text-[7px] text-[#333]"
                      style={{ width: Math.max(16, 32 - fi * 0.4) }}>
                      {[1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fi) ? fi : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Speed Trainer ── */}
          {isLooping && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#080808]">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => speedTrainer ? setSpeedTrainer(false) : startSpeedTrainer()}
                  className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${speedTrainer ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/10" : "border-[#222] text-[#555]"}`}>
                  Speed Trainer {speedTrainer ? "ON" : "OFF"}
                </button>
                {speedTrainer && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="font-label text-[8px] text-[#555]">From</span>
                      <input type="number" min={0.1} max={2} step={0.05} value={trainerStartSpeed}
                        onChange={e => setTrainerStartSpeed(Number(e.target.value))}
                        className="w-14 bg-[#111] border border-[#333] text-[#D4A843] text-[10px] text-center rounded px-1 py-0.5 font-readout" />
                      <span className="font-label text-[8px] text-[#555]">To</span>
                      <input type="number" min={0.1} max={3} step={0.05} value={trainerEndSpeed}
                        onChange={e => setTrainerEndSpeed(Number(e.target.value))}
                        className="w-14 bg-[#111] border border-[#333] text-[#D4A843] text-[10px] text-center rounded px-1 py-0.5 font-readout" />
                      <span className="font-label text-[8px] text-[#555]">+</span>
                      <input type="number" min={0.01} max={0.5} step={0.01} value={trainerStep}
                        onChange={e => setTrainerStep(Number(e.target.value))}
                        className="w-14 bg-[#111] border border-[#333] text-[#D4A843] text-[10px] text-center rounded px-1 py-0.5 font-readout" />
                    </div>
                    <span className="font-readout text-[9px] text-[#888]">Current: {speed.toFixed(2)}x</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Mixer ── */}
          {showMixer && ready && tracks.length > 0 && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#080808]">
              <div className="font-label text-[10px] text-[#D4A843] mb-2">Mixer</div>
              <div className="space-y-1.5 max-h-[200px] overflow-auto">
                {tracks.map(t => (
                  <div key={t.index} className="flex items-center gap-2">
                    <span className={`font-label text-[9px] w-28 truncate cursor-pointer ${activeTrack === t.index ? "text-[#D4A843]" : "text-[#888]"}`}
                      onClick={() => changeTrk(t.index)}>{t.name}</span>
                    <button onClick={() => toggleTrackMute(t.index)}
                      className={`font-label text-[8px] px-1.5 py-0.5 rounded cursor-pointer border ${t.isMuted ? "border-[#C41E3A] text-[#C41E3A] bg-[#C41E3A]/10" : "border-[#222] text-[#555]"}`}>M</button>
                    <button onClick={() => toggleTrackSolo(t.index)}
                      className={`font-label text-[8px] px-1.5 py-0.5 rounded cursor-pointer border ${t.isSolo ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>S</button>
                    <input type="range" min="0" max="1" step="0.05" value={t.volume}
                      onChange={e => setTrackVolume(t.index, Number(e.target.value))} className="flex-1 h-1 accent-[#D4A843]" />
                    <span className="font-readout text-[8px] text-[#555] w-7 text-right">{Math.round(t.volume * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bookmarks/Clips ── */}
          {showBookmarks && ready && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#080808]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label text-[10px] text-[#D4A843]">Clips / Bookmarks</span>
                <button onClick={addBookmark}
                  className="font-label text-[9px] px-2 py-0.5 rounded cursor-pointer border border-[#D4A843] text-[#D4A843]">
                  + Save Current Range
                </button>
              </div>
              {bookmarks.length === 0 && <div className="font-label text-[9px] text-[#444]">No clips saved. Set a loop range and save it.</div>}
              <div className="space-y-1 max-h-[120px] overflow-auto">
                {bookmarks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => loadBookmark(b)}
                      className="font-label text-[9px] text-[#888] hover:text-[#D4A843] cursor-pointer flex-1 text-left">
                      {b.name} (bars {b.startBar}-{b.endBar})
                    </button>
                    <button onClick={() => deleteBookmark(i)} className="text-[#555] hover:text-[#C41E3A] text-[9px] cursor-pointer">x</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Display settings ── */}
          {showSettings && ready && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#080808]">
              <div className="font-label text-[10px] text-[#D4A843] mb-2">Display</div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="font-label text-[8px] text-[#555]">Layout</span>
                  {(["page", "horizontal"] as const).map(m => (
                    <button key={m} onClick={() => { setLayout(m); applyDisplay(m, staveMode, zoomLevel); }}
                      className={`font-label text-[9px] px-2 py-0.5 rounded cursor-pointer border ${layout === m ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                      {m === "page" ? "Page" : "Scroll"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-label text-[8px] text-[#555]">View</span>
                  {(["tab", "score", "both"] as const).map(m => (
                    <button key={m} onClick={() => { setStaveMode(m); applyDisplay(layout, m, zoomLevel); }}
                      className={`font-label text-[9px] px-2 py-0.5 rounded cursor-pointer border ${staveMode === m ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                      {m === "tab" ? "Tab" : m === "score" ? "Notes" : "Both"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-label text-[8px] text-[#555]">Zoom</span>
                  {[0.6, 0.8, 1, 1.2, 1.5].map(z => (
                    <button key={z} onClick={() => { setZoomLevel(z); applyDisplay(layout, staveMode, z); }}
                      className={`font-readout text-[9px] px-1.5 py-0.5 rounded cursor-pointer border ${zoomLevel === z ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>
                      {Math.round(z * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading && <div className="p-6 text-center font-label text-sm text-[#444]">Loading tab...</div>}
          {error && <div className="p-4 text-center font-label text-[11px] text-[#C41E3A]">{error}</div>}

          <div ref={mainRef} style={{ minHeight: ready ? 350 : 0, maxHeight: 550, overflow: "auto", overscrollBehavior: "contain", background: "#fff" }} dir="ltr" />
        </div>
      )}
    </div>
  );
}
