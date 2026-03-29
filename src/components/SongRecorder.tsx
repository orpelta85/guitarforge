"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { SavedRecording } from "@/lib/types";
import { idbSaveRecording, idbLoadRecordings } from "@/lib/recorderIdb";
import { saveToLibrary } from "@/lib/recordingsLibrary";
import { decodeBlobToBuffer, mixAudioBlobs } from "@/lib/audioMix";
import DarkAudioPlayer from "./DarkAudioPlayer";

interface SongRecorderProps {
  songName: string;
  songId: number;
}

type RecordingMode = "guitar-only" | "dual";

function generateRecordingName(songName: string, existingList: SavedRecording[]): string {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const base = `${songName} - ${dateStr}`;
  const sameName = existingList.filter(r => r.name?.startsWith(base));
  if (sameName.length === 0) return base;
  return `${base} (${sameName.length})`;
}

export default function SongRecorder({ songName, songId }: SongRecorderProps) {
  const storageKey = `song-rec-${songId}`;

  const [isRec, setIsRec] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [savedList, setSavedList] = useState<SavedRecording[]>([]);
  const [micError, setMicError] = useState("");
  const [mode, setMode] = useState<RecordingMode>("guitar-only");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [librarySaved, setLibrarySaved] = useState<Set<number>>(new Set());

  // Post-mix state
  const [pendingMicBlob, setPendingMicBlob] = useState<Blob | null>(null);
  const [pendingBrowserBlob, setPendingBrowserBlob] = useState<Blob | null>(null);
  const [mixMicVol, setMixMicVol] = useState(100);
  const [mixBrowserVol, setMixBrowserVol] = useState(100);
  const [isMixing, setIsMixing] = useState(false);
  const [mixBusy, setMixBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);
  const [decoding, setDecoding] = useState(false);

  // Refs - recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const secondRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const secondChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobMapRef = useRef<Map<number, Blob>>(new Map());
  const nextIdxRef = useRef(0);
  const savedListRef = useRef<SavedRecording[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const tabStreamRef = useRef<MediaStream | null>(null);
  const isDualRef = useRef(false);

  // Level meter refs
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const levelAnimRef = useRef<number>(0);
  const [micLevel, setMicLevel] = useState(0);

  // Refs - post-mix playback (persistent AudioContext pattern)
  const mixCtxRef = useRef<AudioContext | null>(null);
  const mixMicGainRef = useRef<GainNode | null>(null);
  const mixBrowserGainRef = useRef<GainNode | null>(null);
  const mixMicBufRef = useRef<AudioBuffer | null>(null);
  const mixBrowserBufRef = useRef<AudioBuffer | null>(null);
  const mixSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playStartTimeRef = useRef(0);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved recordings
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { list, blobs } = await idbLoadRecordings(storageKey);
      if (cancelled) return;
      setSavedList(list);
      savedListRef.current = list;
      blobMapRef.current = blobs;
      const existingKeys = Array.from(blobs.keys());
      nextIdxRef.current = existingKeys.length === 0 ? 0 : Math.max(...existingKeys) + 1;
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  useEffect(() => {
    return () => {
      tabStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      destroyMixCtx();
      if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current);
      analyserSourceRef.current?.disconnect();
      if (analyserCtxRef.current && analyserCtxRef.current.state !== "closed") {
        analyserCtxRef.current.close().catch(() => {});
      }
      savedListRef.current.forEach(item => { if (item.d) URL.revokeObjectURL(item.d); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slider → gain node (real-time, no re-render needed)
  useEffect(() => {
    if (mixMicGainRef.current) mixMicGainRef.current.gain.value = mixMicVol / 100;
  }, [mixMicVol]);
  useEffect(() => {
    if (mixBrowserGainRef.current) mixBrowserGainRef.current.gain.value = mixBrowserVol / 100;
  }, [mixBrowserVol]);

  const cleanupRecording = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    tabStreamRef.current?.getTracks().forEach(t => t.stop());
    tabStreamRef.current = null;
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current);
    analyserSourceRef.current?.disconnect();
    analyserRef.current = null;
    analyserSourceRef.current = null;
    if (analyserCtxRef.current && analyserCtxRef.current.state !== "closed") {
      analyserCtxRef.current.close().catch(() => {});
    }
    analyserCtxRef.current = null;
    setMicLevel(0);
  }, []);

  // ── Persistent AudioContext for mix playback ──
  // The AudioContext + gain nodes live as long as isMixing is true.
  // Play/Stop only creates/destroys BufferSourceNodes (cheap, disposable).

  function ensureMixCtx(): AudioContext {
    if (mixCtxRef.current && mixCtxRef.current.state !== "closed") return mixCtxRef.current;
    const ctx = new AudioContext();
    mixCtxRef.current = ctx;

    const micGain = ctx.createGain();
    micGain.gain.value = mixMicVol / 100;
    micGain.connect(ctx.destination);
    mixMicGainRef.current = micGain;

    const browserGain = ctx.createGain();
    browserGain.gain.value = mixBrowserVol / 100;
    browserGain.connect(ctx.destination);
    mixBrowserGainRef.current = browserGain;

    return ctx;
  }

  function destroyMixCtx() {
    mixSourcesRef.current.forEach(s => { try { s.stop(); } catch { /* ok */ } });
    mixSourcesRef.current = [];
    mixMicGainRef.current = null;
    mixBrowserGainRef.current = null;
    if (mixCtxRef.current && mixCtxRef.current.state !== "closed") {
      mixCtxRef.current.close().catch(() => {});
    }
    mixCtxRef.current = null;
    if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
    setIsPlaying(false);
  }

  async function handlePlay() {
    if (!pendingMicBlob || !pendingBrowserBlob) return;

    // Decode once — uses robust decoder that handles webm/mp4 containers
    if (!mixMicBufRef.current || !mixBrowserBufRef.current) {
      setDecoding(true);
      try {
        const [micBuf, browserBuf] = await Promise.all([
          decodeBlobToBuffer(pendingMicBlob),
          decodeBlobToBuffer(pendingBrowserBlob),
        ]);
        mixMicBufRef.current = micBuf;
        mixBrowserBufRef.current = browserBuf;
        setPlayDuration(Math.max(micBuf.duration, browserBuf.duration));
      } catch (err) {
        setDecoding(false);
        setMicError("Failed to decode recording: " + (err instanceof Error ? err.message : "Unknown error"));
        return;
      }
      setDecoding(false);
    }

    const ctx = ensureMixCtx();

    // Stop previous sources if any
    mixSourcesRef.current.forEach(s => { try { s.stop(); } catch { /* ok */ } });
    mixSourcesRef.current = [];

    // Create new source nodes (these are one-shot, that's how Web Audio works)
    const micSrc = ctx.createBufferSource();
    micSrc.buffer = mixMicBufRef.current;
    micSrc.connect(mixMicGainRef.current!);

    const browserSrc = ctx.createBufferSource();
    browserSrc.buffer = mixBrowserBufRef.current;
    browserSrc.connect(mixBrowserGainRef.current!);

    mixSourcesRef.current = [micSrc, browserSrc];

    // Auto-stop when done
    const maxDur = Math.max(mixMicBufRef.current!.duration, mixBrowserBufRef.current!.duration);
    const longerSrc = mixMicBufRef.current!.duration >= mixBrowserBufRef.current!.duration ? micSrc : browserSrc;
    longerSrc.onended = () => {
      mixSourcesRef.current = [];
      if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
      setIsPlaying(false);
      setPlayTime(maxDur);
    };

    playStartTimeRef.current = ctx.currentTime;
    micSrc.start(0);
    browserSrc.start(0);
    setIsPlaying(true);
    setPlayTime(0);
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    playTimerRef.current = setInterval(() => {
      if (mixCtxRef.current) setPlayTime(mixCtxRef.current.currentTime - playStartTimeRef.current);
    }, 200);
  }

  function handleStop() {
    mixSourcesRef.current.forEach(s => { try { s.stop(); } catch { /* ok */ } });
    mixSourcesRef.current = [];
    if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
    setIsPlaying(false);
    // DON'T destroy the context or gain nodes — they stay alive for next play
  }

  function toggleMixPlayback() {
    if (isPlaying) handleStop(); else handlePlay();
  }

  // ── Recording ──
  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices) { setMicError("Microphone not available on this device."); return; }
    setMicError("");
    setPendingMicBlob(null);
    setPendingBrowserBlob(null);
    setIsMixing(false);
    mixMicBufRef.current = null;
    mixBrowserBufRef.current = null;
    isDualRef.current = false;

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      micStreamRef.current = micStream;

      const actualRate = micStream.getAudioTracks()[0]?.getSettings()?.sampleRate || 48000;

      if (analyserCtxRef.current && analyserCtxRef.current.state !== "closed") {
        await analyserCtxRef.current.close().catch(() => {});
        analyserCtxRef.current = null;
      }
      const aCtx = new AudioContext({ sampleRate: actualRate, latencyHint: "interactive" });
      const aSource = aCtx.createMediaStreamSource(micStream);
      const analyser = aCtx.createAnalyser();
      analyser.fftSize = 2048;
      aSource.connect(analyser);
      analyserCtxRef.current = aCtx;
      analyserSourceRef.current = aSource;
      analyserRef.current = analyser;

      const dataArr = new Float32Array(analyser.fftSize);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(dataArr);
        let peak = 0;
        for (let i = 0; i < dataArr.length; i++) {
          const abs = Math.abs(dataArr[i]);
          if (abs > peak) peak = abs;
        }
        setMicLevel(peak);
        levelAnimRef.current = requestAnimationFrame(updateLevel);
      };
      levelAnimRef.current = requestAnimationFrame(updateLevel);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
                       MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
                       MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mrOpts: MediaRecorderOptions = {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 256000,
      };

      const effectiveMode = (mode === "dual" && !navigator.mediaDevices.getDisplayMedia) ? "guitar-only" : mode;
      if (mode === "dual" && !navigator.mediaDevices.getDisplayMedia) {
        alert("Dual recording requires Chrome or Edge browser.");
      }

      if (effectiveMode === "dual") {
        // ── DUAL: record mic + browser as separate tracks ──
        let tabAudioStream: MediaStream;
        try {
          const tabStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true, video: true,
            // @ts-expect-error -- preferCurrentTab is Chrome-specific
            preferCurrentTab: true,
          });
          tabStreamRef.current = tabStream;
          tabStream.getVideoTracks().forEach(t => t.stop());
          const tabAudioTracks = tabStream.getAudioTracks();
          if (tabAudioTracks.length === 0) {
            tabStream.getTracks().forEach(t => t.stop());
            tabStreamRef.current = null;
            micStream.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
            setMicError("No audio track shared. Make sure to check 'Share tab audio'.");
            return;
          }
          tabAudioStream = new MediaStream(tabAudioTracks);
        } catch (e: unknown) {
          micStream.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
          setMicError((e as { name?: string }).name === "NotAllowedError"
            ? "Tab sharing cancelled." : "Could not capture tab audio.");
          return;
        }

        isDualRef.current = true;

        // Mic recorder
        chunksRef.current = [];
        const micRec = new MediaRecorder(micStream, mrOpts);
        micRec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mediaRecorderRef.current = micRec;

        // Browser recorder
        secondChunksRef.current = [];
        const browserRec = new MediaRecorder(tabAudioStream, mrOpts);
        browserRec.ondataavailable = (e) => { if (e.data.size > 0) secondChunksRef.current.push(e.data); };
        secondRecorderRef.current = browserRec;

        // Use promises for reliable stop detection
        const micStopped = new Promise<void>(res => { micRec.onstop = () => res(); });
        const browserStopped = new Promise<void>(res => { browserRec.onstop = () => res(); });

        // When BOTH recorders stop → show mixer
        Promise.all([micStopped, browserStopped]).then(() => {
          const micBlob = new Blob(chunksRef.current, { type: micRec.mimeType || "audio/webm" });
          const browserBlob = new Blob(secondChunksRef.current, { type: browserRec.mimeType || "audio/webm" });
          if (micBlob.size === 0 && browserBlob.size === 0) {
            setMicError("No audio data captured. Try recording again.");
            cleanupRecording();
            return;
          }
          setPendingMicBlob(micBlob);
          setPendingBrowserBlob(browserBlob);
          setIsMixing(true);
          cleanupRecording();
        });

        // If tab sharing is stopped by user/browser, stop both recorders
        tabAudioStream.getAudioTracks()[0].onended = () => {
          if (micRec.state === "recording") micRec.stop();
          if (browserRec.state === "recording") browserRec.stop();
          setIsRec(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };

        // Start both recorders at the same time for sync
        micRec.start(1000);
        browserRec.start(1000);

      } else {
        // ── GUITAR ONLY ──
        chunksRef.current = [];
        const mr = new MediaRecorder(micStream, mrOpts);
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType });
          const url = URL.createObjectURL(blob);
          cleanupRecording();

          const idx = nextIdxRef.current++;
          const autoName = generateRecordingName(songName, savedListRef.current);
          const newItem: SavedRecording = { dt: new Date().toLocaleString("en-US"), d: url, name: autoName + " [Guitar]" };
          blobMapRef.current.set(idx, blob);
          setSavedList(prev => {
            const next = [newItem, ...prev].slice(0, 10);
            const evicted = [newItem, ...prev].slice(10);
            evicted.forEach(r => { if (r.d) URL.revokeObjectURL(r.d); });
            savedListRef.current = next;
            const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
            const keptBlobs = new Map<number, Blob>();
            for (const k of allKeys.slice(0, next.length)) { const b = blobMapRef.current.get(k); if (b) keptBlobs.set(k, b); }
            idbSaveRecording(storageKey, next, keptBlobs).catch(() => {});
            return next;
          });
          setExpanded(true);
        };
        mr.start(1000);
        mediaRecorderRef.current = mr;
      }

      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      setMicError(error.name === "NotAllowedError"
        ? "Microphone access denied." : "Microphone error: " + (error.message || "Unknown error"));
    }
  }, [mode, songName, storageKey, cleanupRecording]);

  const stopRecording = useCallback(() => {
    if (!isRec) return;
    setIsRec(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (isDualRef.current) {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (secondRecorderRef.current?.state === "recording") secondRecorderRef.current.stop();
    } else {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    }
  }, [isRec]);

  // Save the final mix
  const handleSaveMix = useCallback(async () => {
    if (!pendingMicBlob || !pendingBrowserBlob) return;
    destroyMixCtx();
    setMixBusy(true);
    try {
      const mixed = await mixAudioBlobs(pendingMicBlob, pendingBrowserBlob, mixMicVol / 100, mixBrowserVol / 100);
      const url = URL.createObjectURL(mixed);
      const idx = nextIdxRef.current++;
      const autoName = generateRecordingName(songName, savedListRef.current);
      const newItem: SavedRecording = { dt: new Date().toLocaleString("en-US"), d: url, name: autoName + " [Guitar + Song]" };
      blobMapRef.current.set(idx, mixed);
      setSavedList(prev => {
        const next = [newItem, ...prev].slice(0, 10);
        const evicted = [newItem, ...prev].slice(10);
        evicted.forEach(r => { if (r.d) URL.revokeObjectURL(r.d); });
        savedListRef.current = next;
        const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
        const keptBlobs = new Map<number, Blob>();
        for (const k of allKeys.slice(0, next.length)) { const b = blobMapRef.current.get(k); if (b) keptBlobs.set(k, b); }
        idbSaveRecording(storageKey, next, keptBlobs).catch(() => {});
        return next;
      });
      setPendingMicBlob(null);
      setPendingBrowserBlob(null);
      setIsMixing(false);
      mixMicBufRef.current = null;
      mixBrowserBufRef.current = null;
      setExpanded(true);
    } catch (err) { setMicError("Failed to save mix: " + (err instanceof Error ? err.message : "Unknown error")); }
    setMixBusy(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMicBlob, pendingBrowserBlob, mixMicVol, mixBrowserVol, songName, storageKey]);

  function handleDiscardMix() {
    destroyMixCtx();
    setPendingMicBlob(null);
    setPendingBrowserBlob(null);
    setIsMixing(false);
    mixMicBufRef.current = null;
    mixBrowserBufRef.current = null;
  }

  function renameRecording(idx: number, newName: string) {
    setSavedList(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, name: newName } : r);
      savedListRef.current = next;
      idbSaveRecording(storageKey, next, blobMapRef.current).catch(() => {});
      return next;
    });
    setEditingIdx(null);
  }

  function deleteRecording(idx: number) {
    setSavedList(prev => {
      const removed = prev[idx];
      if (removed?.d) URL.revokeObjectURL(removed.d);
      const next = prev.filter((_, i) => i !== idx);
      savedListRef.current = next;
      const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
      if (allKeys[idx] !== undefined) blobMapRef.current.delete(allKeys[idx]);
      idbSaveRecording(storageKey, next, blobMapRef.current).catch(() => {});
      return next;
    });
  }

  async function handleSaveToLibrary(idx: number) {
    const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
    const blob = allKeys[idx] !== undefined ? blobMapRef.current.get(allKeys[idx]) : undefined;
    if (!blob) return;
    const item = savedList[idx];
    try {
      await saveToLibrary(`song-${songId}`, item?.name || songName, blob);
      setLibrarySaved(prev => new Set(prev).add(idx));
    } catch { /* ignore */ }
  }

  const totalSec = Math.floor(recTime);
  const fmt = Math.floor(totalSec / 60) + ":" + String(totalSec % 60).padStart(2, "0");
  const playFmt = (s: number) => Math.floor(s / 60) + ":" + String(Math.floor(s) % 60).padStart(2, "0");

  const levelMeter = isRec && (
    <div className="flex items-center gap-1.5" title={`Input level: ${Math.round(micLevel * 100)}%`}>
      <div className="w-24 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-75"
          style={{
            width: `${Math.min(micLevel * 100, 100)}%`,
            background: micLevel > 0.8 ? "#ef4444" : micLevel > 0.5 ? "#f59e0b" : "#22c55e",
          }} />
      </div>
      <span className="font-readout text-[8px] text-[#444] tabular-nums w-6">{Math.round(micLevel * 100)}%</span>
    </div>
  );

  return (
    <div className={`panel p-4 mb-4 ${isRec ? "!border-[#C41E3A]/40" : isMixing ? "!border-[#D4A843]/40" : ""}`}>
      <div className="font-label text-[10px] text-[#C41E3A] mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`led ${isRec ? "led-red" : isMixing ? "led-amber" : "led-off"}`} />
          <span className="tracking-wider">RECORDER</span>
          {isRec && <span className="text-[#C41E3A]/60 text-[9px] ml-1">{isDualRef.current ? "Guitar + Browser" : "Guitar Only"}</span>}
          {isMixing && <span className="text-[#D4A843] text-[9px] ml-1">Mixing</span>}
        </div>
        {savedList.length > 0 && !isRec && !isMixing && (
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="font-label text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors">
            {expanded ? "Hide" : "Show"} Recordings ({savedList.length})
          </button>
        )}
      </div>

      {/* Mode selector */}
      {!isRec && !isMixing && (
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={() => setMode("guitar-only")}
            className={`font-label text-[10px] px-3 py-1.5 rounded cursor-pointer border transition-all ${
              mode === "guitar-only" ? "bg-[#C41E3A]/20 text-[#C41E3A] border-[#C41E3A]/40" : "border-[var(--border-panel)] text-[var(--text-muted)]"
            }`}>Guitar Only</button>
          <button type="button" onClick={() => setMode("dual")}
            className={`font-label text-[10px] px-3 py-1.5 rounded border transition-all cursor-pointer ${
              mode === "dual" ? "bg-[#C41E3A]/20 text-[#C41E3A] border-[#C41E3A]/40" : "border-[var(--border-panel)] text-[var(--text-muted)]"
            }`}>Guitar + Browser Audio</button>
        </div>
      )}

      {/* Dual mode info */}
      {mode === "dual" && !isRec && !isMixing && (
        <div className="flex items-start gap-2 bg-[#C41E3A]/5 border border-[#C41E3A]/20 rounded px-3 py-2 mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="font-label text-[10px] text-[#C41E3A]/80">
            Guitar and browser audio are recorded as separate tracks. After recording you can mix the volumes in real-time before saving.
          </span>
        </div>
      )}

      {/* ── POST-RECORDING MIX ── */}
      {isMixing && pendingMicBlob && pendingBrowserBlob && (
        <div className="bg-[#0d0d0d] border border-[#D4A843]/30 rounded-lg px-4 py-3 mb-3">
          <div className="font-label text-[9px] text-[#D4A843] mb-3 tracking-wider">MIX - Adjust volumes and press Play to preview</div>

          {/* Guitar volume */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label text-[10px] text-[#888]">Guitar</span>
              <span className="font-readout text-[10px] text-[#555] tabular-nums">{mixMicVol}%</span>
            </div>
            <input type="range" min="0" max="200" value={mixMicVol}
              onChange={e => setMixMicVol(Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #C41E3A ${mixMicVol / 2}%, #222 ${mixMicVol / 2}%)` }} />
          </div>

          {/* Browser volume */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label text-[10px] text-[#888]">Song / Browser</span>
              <span className="font-readout text-[10px] text-[#555] tabular-nums">{mixBrowserVol}%</span>
            </div>
            <input type="range" min="0" max="200" value={mixBrowserVol}
              onChange={e => setMixBrowserVol(Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #D4A843 ${mixBrowserVol / 2}%, #222 ${mixBrowserVol / 2}%)` }} />
          </div>

          {/* Play/Stop + time */}
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={toggleMixPlayback} disabled={decoding}
              className="w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer disabled:opacity-50"
              style={{ borderColor: isPlaying ? "#D4A843" : "#333", background: isPlaying ? "#D4A843" + "20" : "transparent" }}>
              {decoding ? (
                <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="#D4A843" strokeWidth="2"><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93"/></svg>
              ) : isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <span className="font-readout text-[13px] text-[#888] tabular-nums">
              {playFmt(playTime)} / {playFmt(playDuration)}
            </span>
            {isPlaying && (
              <span className="font-label text-[9px] text-[#D4A843]/60">
                Drag sliders to adjust mix in real-time
              </span>
            )}
          </div>

          {/* Save / Discard */}
          <div className="flex gap-2 items-center border-t border-[#1a1a1a] pt-3">
            <button type="button" onClick={handleSaveMix} disabled={mixBusy}
              className="font-label text-[10px] px-3 py-1.5 rounded-lg border transition-all border-[#33CC33]/40 text-[#33CC33] hover:bg-[#33CC33]/10 disabled:opacity-50 cursor-pointer">
              {mixBusy ? "Saving..." : "Save Mix"}
            </button>
            <button type="button" onClick={handleDiscardMix}
              className="font-label text-[10px] px-3 py-1.5 rounded-lg border transition-all border-[#C41E3A]/40 text-[#C41E3A] hover:bg-[#C41E3A]/10 cursor-pointer">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Record / Stop */}
      {!isMixing && (
        <div className="flex gap-3 items-center mb-3">
          {!isRec ? (
            <button type="button" title="Record" onClick={startRecording}
              className="w-12 h-12 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555", boxShadow: "0 2px 8px rgba(196,30,58,0.3)" }} />
          ) : (
            <button type="button" title="Stop recording" onClick={stopRecording}
              className="w-12 h-12 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #444, #222 80%)", border: "2px solid #555" }}>
              <div className="w-4 h-4 bg-[#888] rounded-sm" />
            </button>
          )}
          {isRec && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
              <span className="font-readout text-lg text-[#C41E3A] tabular-nums">{fmt}</span>
              {levelMeter}
            </div>
          )}
          {!isRec && (
            <span className="font-label text-[10px] text-[#444]">
              {mode === "dual" ? "Record guitar + browser audio" : "Record guitar only"}
            </span>
          )}
        </div>
      )}

      {micError && <div className="font-label text-[10px] text-[#C41E3A] mb-2">{micError}</div>}

      {/* Saved recordings */}
      {savedList.length > 0 && expanded && !isMixing && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <div className="font-label text-[9px] text-[#444] mb-2">Recordings ({savedList.length})</div>
          {savedList.map((item, idx) => (
            <div key={idx} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                {editingIdx === idx ? (
                  <form className="flex items-center gap-1 flex-1" onSubmit={e => { e.preventDefault(); renameRecording(idx, editName); }}>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus className="input !py-0.5 !px-1.5 !text-[11px] flex-1" />
                    <button type="submit" className="font-label text-[9px] text-[#D4A843] hover:text-[#e5c060] cursor-pointer">Save</button>
                    <button type="button" onClick={() => setEditingIdx(null)} className="font-label text-[9px] text-[#555] hover:text-[#888] cursor-pointer">Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="font-heading text-[11px] text-[#999] truncate flex-1">{item.name || item.dt}</span>
                    <button type="button" onClick={() => { setEditingIdx(idx); setEditName(item.name || item.dt); }}
                      className="flex-shrink-0 text-[#444] hover:text-[#D4A843] transition-colors cursor-pointer" title="Rename">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {librarySaved.has(idx) ? (
                      <span className="flex-shrink-0 text-[#33CC33]" title="Saved to Library">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                    ) : (
                      <button type="button" onClick={() => handleSaveToLibrary(idx)}
                        className="flex-shrink-0 text-[#444] hover:text-[#33CC33] transition-colors cursor-pointer" title="Save to Library">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>
                    )}
                    <button type="button" onClick={() => deleteRecording(idx)}
                      className="flex-shrink-0 text-[#444] hover:text-[#C41E3A] transition-colors cursor-pointer" title="Delete">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                    <span className="font-readout text-[9px] text-[#333] flex-shrink-0">{item.dt}</span>
                  </>
                )}
              </div>
              <DarkAudioPlayer src={item.d} title={item.name || item.dt} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
