"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { loadMetronomeVolume, saveMetronomeVolume, METRONOME_VOL_KEY, DEFAULT_METRONOME_VOLUME } from "@/lib/metronomeAudio";
import { buildCabinetIR, getCabinetPreset } from "@/lib/audioIr";
import {
  TAB_PLAYER_PRESETS,
  TAB_PLAYER_PRESET_LIST,
  buildShaperCurve,
  type TabPlayerPresetId,
  type TabPlayerPreset,
} from "@/lib/audioPresets";

const TAB_PLAYER_PRESET_KEY = "gf.tabplayer.preset";
const DEFAULT_TAB_PLAYER_PRESET: TabPlayerPresetId = "rock";

function loadTabPlayerPreset(): TabPlayerPresetId {
  if (typeof window === "undefined") return DEFAULT_TAB_PLAYER_PRESET;
  try {
    const v = window.localStorage.getItem(TAB_PLAYER_PRESET_KEY);
    if (v === "metal" || v === "rock" || v === "clean") return v;
  } catch { /* ignore */ }
  return DEFAULT_TAB_PLAYER_PRESET;
}

interface TrackInfo { index: number; name: string; volume: number; isMuted: boolean; isSolo: boolean }
interface Bookmark { name: string; startBar: number; endBar: number }

// Order two beats by absolute playback position (earliest first).
function orderBeats(a: any, b: any): [any, any] {
  const aT = a?.absolutePlaybackStart ?? 0;
  const bT = b?.absolutePlaybackStart ?? 0;
  return aT <= bT ? [a, b] : [b, a];
}

// Walk the beat chain from startBeat to endBeat (inclusive) within the same voice/track.
// Uses beat.nextBeat when available (alphaTab flattens this across bars in a voice).
function collectBeatsBetween(startBeat: any, endBeat: any): any[] {
  if (!startBeat || !endBeat) return [];
  if (startBeat === endBeat) return [startBeat];
  const [a, b] = orderBeats(startBeat, endBeat);
  const out: any[] = [];
  let cur: any = a;
  let guard = 0;
  while (cur && guard < 10000) {
    out.push(cur);
    if (cur === b) break;
    const next = cur.nextBeat;
    if (!next) break;
    cur = next;
    guard++;
  }
  return out;
}

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
  const [sfProgress, setSfProgress] = useState(0);
  const [sfError, setSfError] = useState<string | null>(null);
  const [songInfo, setSongInfo] = useState<{ title: string; artist: string; tempo: number } | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [activeTrack, setActiveTrack] = useState(0);

  // Player state
  const [masterVolume, setMasterVolume] = useState(1);
  const [metronomeVolume, setMetronomeVolume] = useState<number>(() =>
    typeof window !== "undefined" ? loadMetronomeVolume() : DEFAULT_METRONOME_VOLUME
  );
  const [metronomeOn, setMetronomeOn] = useState(false);
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
  const [viewerCollapsed, setViewerCollapsed] = useState(false);
  const [activeNotes, setActiveNotes] = useState<{ fret: number; string: number }[]>([]);
  const [currentBeatInfo, setCurrentBeatInfo] = useState<string>("");
  const [transpose, setTranspose] = useState(0);
  const [texLoaded, setTexLoaded] = useState(false);

  // Audio enhancement state
  const [reverbEnabled, setReverbEnabled] = useState(false);
  const [reverbMix, setReverbMix] = useState(0.1);
  const [tonePreset, setTonePreset] = useState<TabPlayerPresetId>(() => loadTabPlayerPreset());

  useEffect(() => {
    try { window.localStorage.setItem(TAB_PLAYER_PRESET_KEY, tonePreset); } catch { /* ignore */ }
  }, [tonePreset]);

  const mainRef = useRef<HTMLDivElement>(null);
  const overlayWrapRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loopCountRef = useRef(0);
  const readyCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerBlobUrlRef = useRef<string | null>(null);

  // Interactive bar selection overlay (UG-style drag-to-loop)
  // Beat-level selection: selStart/selEnd hold beat references, not bar numbers.
  const [selStart, setSelStart] = useState<any | null>(null);
  const [selEnd, setSelEnd] = useState<any | null>(null);
  const [hoverBar, setHoverBar] = useState<number | null>(null);
  const [playingBeat, setPlayingBeat] = useState<any | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);
  const dragStateRef = useRef<{ mode: "none" | "new" | "left" | "right"; anchorBeat: any | null }>({ mode: "none", anchorBeat: null });
  const scrollTickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyLoopRangeByBeatsRef = useRef<((a: any, b: any) => void) | null>(null);
  // RAF-throttle for playing-beat updates (alphaTab fires many times/sec during playback).
  const pendingBeatRef = useRef<any | null>(null);
  const beatRafRef = useRef<number>(0);
  // Smooth autoscroll bookkeeping.
  const lastScrolledRowYRef = useRef<number>(-1);
  const lastScrollAtRef = useRef<number>(0);
  const audioNodesRef = useRef<{
    ctx: AudioContext;
    sourceNode: AudioNode;
    highpass: BiquadFilterNode;
    shaper: WaveShaperNode;
    cabinetConvolver: ConvolverNode;
    postCabGain: GainNode;
    compressor: DynamicsCompressorNode;
    roomConvolver: ConvolverNode;
    roomDry: GainNode;
    roomWet: GainNode;
    limiter: DynamicsCompressorNode;
    presetId: TabPlayerPresetId;
  } | null>(null);

  const MAX_SAVE_SIZE = 2 * 1024 * 1024; // 2MB

  // Listen for external changes to the shared metronome volume key
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== METRONOME_VOL_KEY) return;
      const v = loadMetronomeVolume();
      setMetronomeVolume(v);
      if (apiRef.current) {
        try { apiRef.current.metronomeVolume = metronomeOn ? v : 0; } catch { /* ok */ }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [metronomeOn]);

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

  // Compute room wet/dry levels from preset + user reverb override.
  // Matches AUDIO_SPEC §2.5: when the user toggles reverb ON, slider drives wet
  // (scaled x1.5, capped at 0.9); when OFF, use preset default wet.
  function computeRoomLevels(preset: TabPlayerPreset, enabled: boolean, mix: number): { wet: number; dry: number } {
    const wetRaw = enabled ? mix * 1.5 : preset.roomWetDefault;
    const wet = Math.min(0.9, Math.max(0, wetRaw));
    const dry = 1.0 - wet * 0.5;
    return { wet, dry };
  }

  // Hook into alphaTab's audio output to wire the tone chain:
  // source -> HighPass -> WaveShaper -> CabinetIR -> PostCabGain -> Compressor
  //        -> (dry + Room IR wet) -> Master Limiter -> ctx.destination
  function enhanceAudioOutput(api: any) {
    try {
      const output = (api as any).player?.output;
      if (!output) return;

      const checkCtx = () => {
        const ctx: AudioContext | undefined = output.audioContext ?? output._context;
        if (!ctx) return;
        if (audioNodesRef.current?.ctx === ctx) return;

        const preset = TAB_PLAYER_PRESETS[tonePreset];

        // 1. High-pass (remove sub-bass rumble below the preset cutoff).
        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = preset.highPassHz;
        highpass.Q.value = preset.highPassQ;

        // 2. WaveShaper (tanh-based soft saturation — preset-tuned drive).
        const shaper = ctx.createWaveShaper();
        shaper.curve = buildShaperCurve(preset);
        shaper.oversample = preset.shaperOversample;

        // 3. Cabinet IR (replaces synthetic lowpass + fake reverb).
        const cabinetConvolver = ctx.createConvolver();
        cabinetConvolver.buffer = buildCabinetIR(ctx, getCabinetPreset(preset.cabinet));

        // 4. Post-cab trim (convolution changes level).
        const postCabGain = ctx.createGain();
        postCabGain.gain.value = preset.postCabGain;

        // 5. Tone compressor (per-preset threshold / ratio / attack / release).
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = preset.compThresholdDb;
        compressor.ratio.value = preset.compRatio;
        compressor.attack.value = preset.compAttackSec;
        compressor.release.value = preset.compReleaseSec;
        compressor.knee.value = preset.compKneeDb;

        // 6. Room IR (stereo studio ambience) — parallel wet/dry send.
        const roomConvolver = ctx.createConvolver();
        roomConvolver.buffer = buildCabinetIR(ctx, getCabinetPreset(preset.room));
        const levels = computeRoomLevels(preset, reverbEnabled, reverbMix);
        const roomDry = ctx.createGain();
        roomDry.gain.value = levels.dry;
        const roomWet = ctx.createGain();
        roomWet.gain.value = levels.wet;

        // 7. Master brick-wall limiter (output safety — Phase 1 kept as-is).
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = preset.limiterThresholdDb;
        limiter.ratio.value = preset.limiterRatio;
        limiter.attack.value = preset.limiterAttackSec;
        limiter.release.value = preset.limiterReleaseSec;
        limiter.knee.value = preset.limiterKneeDb;

        const sourceNode = output._gainNode ?? output.gainNode ?? output._masterGain;
        if (sourceNode) {
          try { sourceNode.disconnect(); } catch { /* ok */ }

          // Serial: source -> HP -> shaper -> cabinet -> postGain -> compressor.
          sourceNode.connect(highpass);
          highpass.connect(shaper);
          shaper.connect(cabinetConvolver);
          cabinetConvolver.connect(postCabGain);
          postCabGain.connect(compressor);

          // Parallel: dry to limiter + room wet to limiter.
          compressor.connect(roomDry);
          roomDry.connect(limiter);
          compressor.connect(roomConvolver);
          roomConvolver.connect(roomWet);
          roomWet.connect(limiter);

          limiter.connect(ctx.destination);

          audioNodesRef.current = {
            ctx,
            sourceNode,
            highpass,
            shaper,
            cabinetConvolver,
            postCabGain,
            compressor,
            roomConvolver,
            roomDry,
            roomWet,
            limiter,
            presetId: preset.id,
          };
        }
      };

      checkCtx();
      setTimeout(checkCtx, 500);
      setTimeout(checkCtx, 1500);
      setTimeout(checkCtx, 3000);
    } catch (err) {
      console.warn("Audio enhancement failed:", err);
    }
  }

  // Update room send levels when user toggles reverb or drags the mix slider.
  useEffect(() => {
    const nodes = audioNodesRef.current;
    if (!nodes) return;
    const preset = TAB_PLAYER_PRESETS[nodes.presetId];
    const { wet, dry } = computeRoomLevels(preset, reverbEnabled, reverbMix);
    const now = nodes.ctx.currentTime;
    nodes.roomWet.gain.cancelScheduledValues(now);
    nodes.roomDry.gain.cancelScheduledValues(now);
    nodes.roomWet.gain.linearRampToValueAtTime(wet, now + 0.05);
    nodes.roomDry.gain.linearRampToValueAtTime(dry, now + 0.05);
  }, [reverbEnabled, reverbMix]);

  // Swap tone preset at runtime: crossfade numeric params over 50 ms, rebuild
  // the cabinet convolver instantly. (<1 ms audio seam is inaudible.)
  useEffect(() => {
    const nodes = audioNodesRef.current;
    if (!nodes) return;
    if (nodes.presetId === tonePreset) return;
    const preset = TAB_PLAYER_PRESETS[tonePreset];
    const ctx = nodes.ctx;
    const now = ctx.currentTime;
    const end = now + 0.050;

    nodes.highpass.frequency.cancelScheduledValues(now);
    nodes.highpass.Q.cancelScheduledValues(now);
    nodes.highpass.frequency.linearRampToValueAtTime(preset.highPassHz, end);
    nodes.highpass.Q.linearRampToValueAtTime(preset.highPassQ, end);

    // WaveShaper curve swap: assignment is sample-accurate enough at audio rate.
    nodes.shaper.curve = buildShaperCurve(preset);
    nodes.shaper.oversample = preset.shaperOversample;

    // Rebuild cabinet IR (new preset = different cab).
    nodes.cabinetConvolver.buffer = buildCabinetIR(ctx, getCabinetPreset(preset.cabinet));

    nodes.postCabGain.gain.cancelScheduledValues(now);
    nodes.postCabGain.gain.linearRampToValueAtTime(preset.postCabGain, end);

    nodes.compressor.threshold.cancelScheduledValues(now);
    nodes.compressor.ratio.cancelScheduledValues(now);
    nodes.compressor.attack.cancelScheduledValues(now);
    nodes.compressor.release.cancelScheduledValues(now);
    nodes.compressor.knee.cancelScheduledValues(now);
    nodes.compressor.threshold.linearRampToValueAtTime(preset.compThresholdDb, end);
    nodes.compressor.ratio.linearRampToValueAtTime(preset.compRatio, end);
    nodes.compressor.attack.linearRampToValueAtTime(preset.compAttackSec, end);
    nodes.compressor.release.linearRampToValueAtTime(preset.compReleaseSec, end);
    nodes.compressor.knee.linearRampToValueAtTime(preset.compKneeDb, end);

    nodes.roomConvolver.buffer = buildCabinetIR(ctx, getCabinetPreset(preset.room));
    const { wet, dry } = computeRoomLevels(preset, reverbEnabled, reverbMix);
    nodes.roomWet.gain.cancelScheduledValues(now);
    nodes.roomDry.gain.cancelScheduledValues(now);
    nodes.roomWet.gain.linearRampToValueAtTime(wet, end);
    nodes.roomDry.gain.linearRampToValueAtTime(dry, end);

    nodes.limiter.threshold.cancelScheduledValues(now);
    nodes.limiter.ratio.cancelScheduledValues(now);
    nodes.limiter.attack.cancelScheduledValues(now);
    nodes.limiter.release.cancelScheduledValues(now);
    nodes.limiter.knee.cancelScheduledValues(now);
    nodes.limiter.threshold.linearRampToValueAtTime(preset.limiterThresholdDb, end);
    nodes.limiter.ratio.linearRampToValueAtTime(preset.limiterRatio, end);
    nodes.limiter.attack.linearRampToValueAtTime(preset.limiterAttackSec, end);
    nodes.limiter.release.linearRampToValueAtTime(preset.limiterReleaseSec, end);
    nodes.limiter.knee.linearRampToValueAtTime(preset.limiterKneeDb, end);

    nodes.presetId = preset.id;
  }, [tonePreset, reverbEnabled, reverbMix]);

  useEffect(() => {
    if (!fileData && !texLoaded) return;
    let dead = false;
    let rafId = 0;
    setLoading(true); setError(null); setReady(false);
    setSongInfo(null); setPlayerReady(false); setCurrentBar(0); setTotalBars(0);
    setActiveNotes([]); setCurrentBeatInfo("");

    // Wait for mainRef to be attached. The panel DOM mounts on the same
    // commit that flips fileData, but rare render races can leave the ref
    // null for one frame — retry via RAF until it's available (or unmounts).
    const waitForRef = (attempts: number): Promise<HTMLDivElement | null> => new Promise(resolve => {
      if (dead) return resolve(null);
      if (mainRef.current) return resolve(mainRef.current);
      if (attempts <= 0) return resolve(null);
      rafId = requestAnimationFrame(() => resolve(waitForRef(attempts - 1)));
    });

    (async () => {
      try {
        const el = await waitForRef(30);
        if (dead || !el) { setLoading(false); return; }
        const at = await import("@coderline/alphatab");
        if (dead || !mainRef.current) return;
        if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {}
        apiRef.current = null;
        // Clean up previous audio nodes
        if (audioNodesRef.current) {
          try {
            audioNodesRef.current.highpass.disconnect();
            audioNodesRef.current.shaper.disconnect();
            audioNodesRef.current.cabinetConvolver.disconnect();
            audioNodesRef.current.postCabGain.disconnect();
            audioNodesRef.current.compressor.disconnect();
            audioNodesRef.current.roomConvolver.disconnect();
            audioNodesRef.current.roomDry.disconnect();
            audioNodesRef.current.roomWet.disconnect();
            audioNodesRef.current.limiter.disconnect();
          } catch { /* ok */ }
          audioNodesRef.current = null;
        }
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
        s.player.enableAnimatedBeatCursor = true;
        s.player.enableElementHighlighting = true;
        s.player.enableUserInteraction = true;
        // sonivox.sf3 — 977KB compressed, fast to load, reliable playback.
        // GeneralUser-GS.sf2 (32MB) caused long loads + silent Play regressions.
        s.player.soundFont = base + "/alphatab/soundfont/sonivox.sf3";
        // We manage autoscroll manually inside playedBeatChanged so the
        // line-change transition is a smooth native scrollTo({behavior:'smooth'})
        // instead of alphaTab's instant jump. Setting scrollElement to null
        // disables alphaTab's internal scroll controller.
        s.player.scrollElement = null as any;
        s.player.scrollOffsetY = 0;
        s.player.scrollMode = 0 as any; // ScrollMode.Off
        s.display.layoutMode = 0;
        s.display.staveProfile = 4;

        // CRITICAL: Register a capture-phase mousedown blocker on mainRef
        // BEFORE alphaTab does. Same-element capture listeners fire in
        // registration order, so by registering first we guarantee our check
        // runs before alphaTab's — if the event target is a drag handle we
        // stopImmediatePropagation so alphaTab never sees the click and never
        // overwrites the existing loop selection with a new single-beat one.
        const handleBlocker = (e: Event) => {
          const t = e.target as HTMLElement | null;
          if (t && (t.closest?.(".gf-handle") || t.classList?.contains("gf-handle"))) {
            e.stopImmediatePropagation();
          }
        };
        mainRef.current.addEventListener("mousedown", handleBlocker, true);
        mainRef.current.addEventListener("mouseup", handleBlocker, true);
        mainRef.current.addEventListener("click", handleBlocker, true);
        (mainRef.current as any)._gfHandleBlocker = handleBlocker;

        const api = new at.AlphaTabApi(mainRef.current, s);
        apiRef.current = api;

        api.scoreLoaded.on((score: any) => {
          if (dead) return;
          // GeneralUser GS provides high-quality samples for all guitar programs
          // (24-31), so no program remapping is needed. The previous hack that
          // forced overdriven/distortion (27-31) to clean guitar (25) was a
          // workaround for sonivox.sf2's poor distorted tones.

          // alphaTex stretches sixteenth notes to quarters when a bar has fewer
          // notes than the time signature expects. Compensate by detecting the
          // intended duration from the tex string and adjusting playbackSpeed.
          if (tex && !fileData) {
            const durMatch = tex.match(/:(\d+)/);
            const intended = durMatch ? parseInt(durMatch[1], 10) : 0;
            const firstBeat = score.tracks?.[0]?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats?.[0];
            const renderedTicks = firstBeat?.playbackDuration || 0;
            // alphaTab uses 960 ticks per quarter. :16 intended = 240 ticks.
            // If rendered > intended, ratio is the stretch factor.
            if (intended >= 8 && renderedTicks > 0) {
              const intendedTicks = 3840 / intended; // :16 → 240, :8 → 480, :4 → 960
              const stretch = renderedTicks / intendedTicks;
              if (stretch > 1.1) api.playbackSpeed = stretch;
            }
          }

          setLoading(false); setReady(true);
          setSongInfo({ title: score.title || "Untitled", artist: score.artist || "", tempo: score.tempo || 120 });
          setTracks(score.tracks.map((t: any, i: number) => ({
            index: i, name: t.name || `Track ${i + 1}`, volume: 1, isMuted: false, isSolo: false,
          })));
          if (score.masterBars?.length) setTotalBars(score.masterBars.length);
        });

        api.playerReady.on(() => {
          if (!dead) {
            setPlayerReady(true);
            // Hook audio enhancement chain after player is ready
            enhanceAudioOutput(api);
            // Apply shared metronome volume (respects ON/OFF state)
            try { api.metronomeVolume = metronomeOn ? loadMetronomeVolume() : 0; } catch { /* ok */ }
          }
        });

        // Track soundfont download progress + errors so Play is never silent.
        try {
          (api as any).soundFontLoad?.on?.((e: any) => {
            if (dead) return;
            const total = e?.total || 0;
            const loaded = e?.loaded || 0;
            if (total > 0) setSfProgress(Math.round((loaded / total) * 100));
          });
          (api as any).soundFontLoaded?.on?.(() => {
            if (!dead) { setSfProgress(100); setSfError(null); }
          });
          (api as any).soundFontLoadFailed?.on?.((err: any) => {
            if (!dead) { setSfError(String(err?.message || err)); console.error("[alphaTab] soundFont load failed:", err); }
          });
          (api as any).error?.on?.((err: any) => {
            console.error("[alphaTab] error:", err);
          });
        } catch (e) { console.warn("[alphaTab] could not attach soundfont listeners", e); }

        let pollCount = 0;
        if (readyCheckRef.current) clearInterval(readyCheckRef.current);
        const readyCheck = setInterval(() => {
          if (dead) { clearInterval(readyCheck); readyCheckRef.current = null; return; }
          pollCount++;
          if (api.isReadyForPlayback) { setPlayerReady(true); clearInterval(readyCheck); readyCheckRef.current = null; }
          else if (pollCount >= 30) { setPlayerReady(true); clearInterval(readyCheck); readyCheckRef.current = null; }
        }, 500);
        readyCheckRef.current = readyCheck;

        api.playerStateChanged.on((e: any) => {
          if (dead) return;
          setPlaying(e.state === 1);
          // Reset autoscroll memory on stop so next playback can scroll again
          // from the top even if cursor returns to the same row.
          if (e.state !== 1) {
            lastScrolledRowYRef.current = -1;
            lastScrollAtRef.current = 0;
          }
        });

        // Position tracking — RAF-throttled so React state only updates once per frame.
        // alphaTab fires playedBeatChanged at ~60fps during playback; doing setState in
        // the listener triggers a re-render of the whole GpFileUploader tree on every
        // tick, which manifests as visible "lag" in the playing-beat highlight and the
        // fretboard overlay. Coalescing into one RAF flush keeps visuals smooth.
        api.playedBeatChanged?.on?.((beat: any) => {
          if (dead || !beat) return;
          pendingBeatRef.current = beat;
          if (beatRafRef.current) return;
          beatRafRef.current = requestAnimationFrame(() => {
            beatRafRef.current = 0;
            const b = pendingBeatRef.current;
            if (!b || dead) return;
            pendingBeatRef.current = null;
            const bar = b.voice?.bar;
            if (bar?.index !== undefined) setCurrentBar(bar.index + 1);
            setPlayingBeat(b);
            const notes = b.notes || [];
            const noteData = notes.map((n: any) => ({ fret: n.fret, string: n.string })).filter((n: any) => n.fret >= 0);
            setActiveNotes(noteData);
            if (notes.length > 0) {
              const info = notes.map((n: any) => `S${n.string}F${n.fret}`).join(" ");
              setCurrentBeatInfo(info);
            }
            // Smooth line-change autoscroll: only scroll when the beat's row leaves
            // the comfort zone (middle 60% of viewport). We track the last row-y
            // we already scrolled to so we never re-fire scrollTo for the same row.
            try {
              const main = mainRef.current;
              const lookup = apiRef.current?.renderer?.boundsLookup;
              if (!main || !lookup) return;
              const bb: any = lookup.findBeat?.(b);
              const barB: any = bb?.barBounds;
              const beatY = barB?.realBounds?.y ?? bb?.realBounds?.y;
              const beatH = barB?.realBounds?.h ?? bb?.realBounds?.h ?? 0;
              if (typeof beatY !== "number") return;
              const viewH = main.clientHeight;
              const scrollTop = main.scrollTop;
              const comfortTop = scrollTop + viewH * 0.2;
              const comfortBot = scrollTop + viewH * 0.8 - beatH;
              const outOfView = beatY < comfortTop || beatY > comfortBot;
              // Debounce: don't re-scroll for the exact same row, and wait at least
              // 400ms between smooth scrolls so the browser animation can settle.
              const sameRow = Math.abs(beatY - lastScrolledRowYRef.current) < 4;
              const now = performance.now();
              if (outOfView && !sameRow && now - lastScrollAtRef.current > 400) {
                const target = Math.max(0, beatY - viewH * 0.3);
                main.scrollTo({ top: target, behavior: "smooth" });
                lastScrolledRowYRef.current = beatY;
                lastScrollAtRef.current = now;
              }
            } catch { /* ignore scroll errors */ }
          });
        });

        // Time tracking
        (api as any).playerPositionChanged?.on?.((e: any) => {
          if (dead) return;
          setCurrentTime(e.currentTime ?? 0);
          setTotalTime(e.endTime ?? 0);
        });

        // Drag-to-select (GP-style): mouseDown starts, mouseMove updates, mouseUp finalizes.
        // Selection is beat-level, not bar-level — user can highlight 2 notes in the middle of a bar.
        api.beatMouseDown?.on?.((beat: any) => {
          if (dead || !beat?.voice?.bar) return;
          // If a handle drag is active, ignore alphaTab's selection start so we don't
          // overwrite the existing selection with a single-beat click.
          if (dragStateRef.current.mode === "left" || dragStateRef.current.mode === "right") return;
          const barIdx = beat.voice.bar.index + 1;
          (api as any)._lastClickedBar = barIdx;
          (api as any)._dragDidMove = false;
          dragStateRef.current = { mode: "new", anchorBeat: beat };
          setSelStart(beat); setSelEnd(beat);
        });
        api.beatMouseMove?.on?.((beat: any) => {
          if (dead || !beat?.voice?.bar) return;
          const st = dragStateRef.current;
          if (st.mode !== "new" || !st.anchorBeat) return;
          if (beat !== st.anchorBeat) (api as any)._dragDidMove = true;
          const [a, b] = orderBeats(st.anchorBeat, beat);
          setSelStart(a); setSelEnd(b);
        });
        api.beatMouseUp?.on?.((beat: any) => {
          if (dead) return;
          const st = dragStateRef.current;
          // If a handle drag is in progress, let onHandleMouseDown's own mouseup handler
          // finalize the selection — do NOT reset state or clear selection here.
          if (st.mode === "left" || st.mode === "right") return;
          const didMove = !!(api as any)._dragDidMove;
          dragStateRef.current = { mode: "none", anchorBeat: null };

          if (!beat?.voice?.bar) {
            // click outside any beat = clear selection
            if (!didMove) { setSelStart(null); setSelEnd(null); }
            return;
          }
          const barIdx = beat.voice.bar.index + 1;
          (api as any)._lastClickedBar = barIdx;

          if (didMove && st.anchorBeat) {
            const [a, b] = orderBeats(st.anchorBeat, beat);
            setSelStart(a); setSelEnd(b);
            // Auto-activate loop on drag selection (beat-level)
            applyLoopRangeByBeatsRef.current?.(a, b);
          } else {
            // Pure click (no drag) — legacy behavior for A/B pick modes, else jump.
            // Include the beat's absolutePlaybackStart so the seek lands on the EXACT
            // clicked beat, not the start of the bar. (Previously only `bar` was passed
            // and the handler used masterBars[bar-1].start — snapping to bar start.)
            const beatTick: number | null =
              typeof beat.absolutePlaybackStart === "number" && Number.isFinite(beat.absolutePlaybackStart)
                ? beat.absolutePlaybackStart
                : null;
            window.dispatchEvent(new CustomEvent("gf-bar-click", { detail: { bar: barIdx, beatTick } }));
            // Clear any existing selection when clicking on a beat without drag
            setSelStart(null); setSelEnd(null);
          }
        });

        // Hover indicator
        api.beatMouseMove?.on?.((beat: any) => {
          if (dead || !beat?.voice?.bar) return;
          if (dragStateRef.current.mode !== "none") return;
          setHoverBar(beat.voice.bar.index + 1);
        });

        // Recompute overlay positions when layout/rendering changes
        api.postRenderFinished?.on?.(() => {
          if (dead) return;
          setOverlayTick(t => t + 1);
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
      if (beatRafRef.current) { cancelAnimationFrame(beatRafRef.current); beatRafRef.current = 0; }
      pendingBeatRef.current = null;
      lastScrolledRowYRef.current = -1;
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
    const startTick = startBar.start;
    const endTick = endBar.start + endBar.calculateDuration();
    api.playbackRange = { startTick, endTick };
    api.isLooping = true;
    // Pull the cursor into the loop range if it's currently outside — otherwise
    // playback continues forward from the pre-loop position and the loop never
    // takes effect (the user sees "plays through the whole tab").
    const cur = Number(api.tickPosition ?? 0);
    if (!(cur >= startTick && cur < endTick)) {
      try { api.tickPosition = startTick; } catch { /* ok */ }
    }
    setIsLooping(true); setLoopStart(s); setLoopEnd(e);
  }, [totalBars]);

  // Beat-level loop: uses absolutePlaybackStart + playbackDuration for precise sub-bar looping.
  const applyLoopRangeByBeats = useCallback((beatA: any, beatB: any) => {
    const api = apiRef.current;
    if (!api || !beatA || !beatB) return;
    const [a, b] = orderBeats(beatA, beatB);
    const startTick = a.absolutePlaybackStart ?? 0;
    const endTick = (b.absolutePlaybackStart ?? 0) + (b.playbackDuration ?? 0);
    if (!Number.isFinite(startTick) || !Number.isFinite(endTick) || endTick <= startTick) return;
    api.playbackRange = { startTick, endTick };
    api.isLooping = true;
    // Same rationale as applyLoopRange: if cursor is outside the range, yank it
    // in so the very next playback frame is already inside the loop. Without
    // this, clicking Play after drag-selecting bars 4-6 while the cursor sat
    // at bar 1 would play bars 1-3 first and never honor the loop.
    const cur = Number(api.tickPosition ?? 0);
    if (!(cur >= startTick && cur < endTick)) {
      try { api.tickPosition = startTick; } catch { /* ok */ }
    }
    setIsLooping(true);
    const aBar = (a.voice?.bar?.index ?? 0) + 1;
    const bBar = (b.voice?.bar?.index ?? 0) + 1;
    setLoopStart(aBar); setLoopEnd(bBar);
  }, []);

  // Keep ref updated so event handlers (inside scoreLoaded closure) can call current version.
  useEffect(() => { applyLoopRangeByBeatsRef.current = applyLoopRangeByBeats; }, [applyLoopRangeByBeats]);

  // Handle bar clicks from tab notation
  useEffect(() => {
    function onBarClick(e: Event) {
      const detail = (e as CustomEvent).detail;
      const bar = detail?.bar;
      const beatTick: number | null = typeof detail?.beatTick === "number" ? detail.beatTick : null;
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
        // Normal click → jump to exact clicked beat (fall back to bar start if tick missing)
        setCurrentBar(bar);
        const api = apiRef.current;
        if (beatTick !== null && Number.isFinite(beatTick)) {
          try { api.tickPosition = beatTick; } catch { /* ok */ }
        } else if (api?.score?.masterBars?.[bar - 1]) {
          api.tickPosition = api.score.masterBars[bar - 1].start;
        }
      }
    }
    window.addEventListener("gf-bar-click", onBarClick);
    return () => window.removeEventListener("gf-bar-click", onBarClick);
  }, [selectMode, loopStart, loopEnd, totalBars, applyLoopRange]);

  // Auto-activate loop when a drag selection is made
  useEffect(() => {
    function onRangeSelected(e: Event) {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      const a = Number(d.start), b = Number(d.end);
      if (!a || !b) return;
      applyLoopRange(a, b);
    }
    window.addEventListener("gf-range-selected", onRangeSelected);
    return () => window.removeEventListener("gf-range-selected", onRangeSelected);
  }, [applyLoopRange]);


  // ESC clears selection and disables loop; scroll / resize triggers overlay recompute
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelStart(null); setSelEnd(null);
        const api = apiRef.current;
        if (api) { api.isLooping = false; api.playbackRange = null; }
        setIsLooping(false); setLoopStart(null); setLoopEnd(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let rafId = 0;
    function bump() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        setOverlayTick(t => t + 1);
      });
    }
    el.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("resize", bump);
    return () => {
      el.removeEventListener("scroll", bump);
      window.removeEventListener("scroll", bump);
      window.removeEventListener("resize", bump);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ready]);

  // Speed trainer: increase speed each loop iteration.
  // Detect loop restart by watching position: when currentTime drops
  // significantly (big backwards jump), it means alphaTab looped back to A.
  useEffect(() => {
    if (!speedTrainer || !isLooping || !playing) return;
    const api = apiRef.current;
    if (!api) return;

    let lastTime = -1;
    const handler = (e: any) => {
      const t = e?.currentTime ?? 0;
      // Loop restart heuristic: time jumped backwards by >500ms
      if (lastTime > 0 && t + 500 < lastTime) {
        loopCountRef.current++;
        const newSpeed = Math.min(trainerEndSpeed, trainerStartSpeed + loopCountRef.current * trainerStep);
        api.playbackSpeed = newSpeed;
        setSpeed(newSpeed);
      }
      lastTime = t;
    };

    api.playerPositionChanged?.on?.(handler);
    return () => { api.playerPositionChanged?.off?.(handler); };
  }, [speedTrainer, isLooping, playing, trainerStartSpeed, trainerEndSpeed, trainerStep]);

  // --- Controls ---
  function togglePlay() {
    const api = apiRef.current;
    if (!api) return;
    if (!api.isReadyForPlayback) {
      console.warn("[alphaTab] Play requested but player not ready yet", { sfProgress, sfError });
      return;
    }
    if ((api as any).player?.output?.audioContext?.state === "suspended")
      (api as any).player.output.audioContext.resume();
    // Try to enhance audio on first play (audio context may only exist now)
    if (!audioNodesRef.current) enhanceAudioOutput(api);
    api.playPause();
  }
  function doStop() { apiRef.current?.stop(); setPlaying(false); }

  function setSpd(s: number) { if (apiRef.current) apiRef.current.playbackSpeed = s; setSpeed(s); }
  const [bpmInput, setBpmInput] = useState<string | null>(null);
  function changeTrk(i: number) {
    const api = apiRef.current;
    if (api?.score?.tracks?.[i]) { api.renderTracks([api.score.tracks[i]]); setActiveTrack(i); }
  }
  // Mixer: select "active" track visually (for focus/transpose) WITHOUT limiting playback
  // to a single track — otherwise Mute/Solo/Volume on other tracks do nothing audible.
  function focusTrack(i: number) {
    setActiveTrack(i);
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
  function setMetVol(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    if (apiRef.current) apiRef.current.metronomeVolume = metronomeOn ? clamped : 0;
    setMetronomeVolume(clamped);
    saveMetronomeVolume(clamped);
  }
  function toggleMetronome() {
    const next = !metronomeOn;
    setMetronomeOn(next);
    // If turning on with zero/undefined volume, bring it up to an audible default
    // so the user actually hears clicks.
    let vol = metronomeVolume;
    if (next && (!vol || vol <= 0.01)) {
      vol = DEFAULT_METRONOME_VOLUME;
      setMetronomeVolume(vol);
      saveMetronomeVolume(vol);
    }
    if (apiRef.current) {
      try { apiRef.current.metronomeVolume = next ? vol : 0; } catch { /* ok */ }
    }
  }
  function setCountIn(v: number) { if (apiRef.current) apiRef.current.countInVolume = v; setCountInVolume(v); }

  function toggleLoop() {
    const api = apiRef.current;
    if (!api) return;
    const newVal = !isLooping;
    api.isLooping = newVal;
    setIsLooping(newVal);
    if (!newVal) { api.playbackRange = null; setLoopStart(null); setLoopEnd(null); setSpeedTrainer(false); }
  }

  // Keyboard shortcuts: Space = play/pause, L = loop toggle, M = mixer, Esc = close mixer / cancel selection
  useEffect(() => {
    if (!ready) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Don't hijack keys when typing into inputs
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (playerReady) togglePlay();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        toggleLoop();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setShowMixer(v => !v);
      } else if (e.key === "Escape") {
        if (showMixer) { setShowMixer(false); e.preventDefault(); }
        else if (selectMode !== "none") { setSelectMode("none"); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, playerReady, showMixer, selectMode, isLooping]);

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
    // alphaTab expects a gain multiplier (1.0 = normal, 0 = silent).
    // Slider is 0-1 → pass through directly; at 0 the track is essentially silent.
    const clamped = Math.max(0, Math.min(1, v));
    try { api.changeTrackVolume([api.score.tracks[i]], clamped); } catch { /* ok */ }
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, volume: clamped } : t));
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

  // --- Overlay rect computation ---
  // Returns array of {x,y,w,h} rectangles (one per staff-system line inside the selected bar range)
  // in mainRef-relative coordinates (accounting for scroll).
  function computeBarRects(startBar: number, endBar: number): Array<{ x: number; y: number; w: number; h: number }> {
    const api = apiRef.current;
    const main = mainRef.current;
    if (!api?.renderer?.boundsLookup || !main) return [];
    const lookup = api.renderer.boundsLookup;
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    // Group bars by staff-system (y value) — merge horizontally
    let current: { y: number; h: number; xMin: number; xMax: number } | null = null;
    for (let i = startBar - 1; i <= endBar - 1; i++) {
      const mbb: any = lookup.findMasterBarByIndex?.(i);
      if (!mbb?.realBounds) continue;
      const b = mbb.realBounds;
      if (current && Math.abs(current.y - b.y) < 2) {
        current.xMin = Math.min(current.xMin, b.x);
        current.xMax = Math.max(current.xMax, b.x + b.w);
        current.h = Math.max(current.h, b.h);
      } else {
        if (current) rects.push({ x: current.xMin, y: current.y, w: current.xMax - current.xMin, h: current.h });
        current = { y: b.y, h: b.h, xMin: b.x, xMax: b.x + b.w };
      }
    }
    if (current) rects.push({ x: current.xMin, y: current.y, w: current.xMax - current.xMin, h: current.h });
    // Convert to overlay-relative (subtract scroll of mainRef)
    return rects.map(r => ({ x: r.x - main.scrollLeft, y: r.y - main.scrollTop, w: r.w, h: r.h }));
  }

  // --- Beat-level rect computation ---
  // Returns rectangles covering the beats from startBeat to endBeat inclusive.
  // Multiple rects when the selection spans multiple staff-system lines.
  // Uses beat.visualBounds (tighter) for the X span, but expands Y to cover the entire
  // staff system (realBounds of the master bar) so the highlight feels like GP.
  function computeBeatRects(startBeat: any, endBeat: any): Array<{ x: number; y: number; w: number; h: number }> {
    const api = apiRef.current;
    const main = mainRef.current;
    if (!api?.renderer?.boundsLookup || !main || !startBeat || !endBeat) return [];
    const lookup = api.renderer.boundsLookup;
    const beats = collectBeatsBetween(startBeat, endBeat);
    if (beats.length === 0) return [];

    type Row = { y: number; h: number; xMin: number; xMax: number };
    const rows: Row[] = [];
    for (const beat of beats) {
      const bb: any = lookup.findBeat?.(beat);
      if (!bb) continue;
      // Prefer visualBounds for X (tight around the note), use parent barBounds for full staff height.
      const vis: any = bb.visualBounds || bb.realBounds;
      if (!vis) continue;
      // Try to expand vertically to the bar's staff-system height
      const barB: any = bb.barBounds || lookup.findMasterBarByIndex?.(beat.voice?.bar?.index ?? -1);
      const y = barB?.realBounds?.y ?? vis.y;
      const h = barB?.realBounds?.h ?? vis.h;
      const x = vis.x;
      const w = vis.w;

      // Group by staff row (same y within 2px)
      const existing = rows.find(r => Math.abs(r.y - y) < 2);
      if (existing) {
        existing.xMin = Math.min(existing.xMin, x);
        existing.xMax = Math.max(existing.xMax, x + w);
        existing.h = Math.max(existing.h, h);
      } else {
        rows.push({ y, h, xMin: x, xMax: x + w });
      }
    }
    return rows.map(r => ({
      x: r.xMin - main.scrollLeft,
      y: r.y - main.scrollTop,
      w: r.xMax - r.xMin,
      h: r.h,
    }));
  }

  const selRects = (selStart && selEnd) ? computeBeatRects(selStart, selEnd) : [];
  const hoverRects = (hoverBar && !(selStart && selEnd)) ? computeBarRects(hoverBar, hoverBar) : [];
  const playingBeatRects = (playing && playingBeat) ? computeBeatRects(playingBeat, playingBeat) : [];
  // overlayTick is consumed so React re-renders when layout changes
  void overlayTick;

  // --- Drag handle logic (beat-level) ---
  // Pointer-events based: setPointerCapture on the handle so movement is tracked even
  // when the pointer leaves the tab area or the browser window. RAF-throttled beat
  // resolution; selection state updates only when the resolved beat actually changes
  // (prevents re-render spam). Final commit (applyLoopRangeByBeats) runs on pointerup.
  function onHandlePointerDown(side: "left" | "right", ev: React.PointerEvent<HTMLDivElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    const main: HTMLDivElement | null = mainRef.current;
    const api = apiRef.current;
    if (!main || !api?.renderer?.boundsLookup) return;
    const mainEl: HTMLDivElement = main;
    const anchorBeat = side === "left" ? selEnd : selStart;
    if (!anchorBeat) return;
    dragStateRef.current = { mode: side, anchorBeat };

    // NOTE: We intentionally do NOT call setPointerCapture on the handle DOM
    // node. During drag, React re-renders the overlay (because setSelStart/End
    // change selRects, which changes where the handle is rendered). If the
    // handle DOM node is remounted, its pointer capture is lost and subsequent
    // pointer events fall through to the canvas — alphaTab then clears the
    // selection. Instead, attach listeners to the `document`, which is stable
    // across renders.

    let latestA: any = selStart;
    let latestB: any = selEnd;
    let lastBeat: any = null;
    let rafId = 0;
    let pendingEvent: PointerEvent | null = null;

    function process(e: PointerEvent) {
      const rect = mainEl.getBoundingClientRect();
      const clampedClientX = Math.max(rect.left, Math.min(rect.right, e.clientX));
      const clampedClientY = Math.max(rect.top, Math.min(rect.bottom, e.clientY));
      const x = clampedClientX - rect.left + mainEl.scrollLeft;
      const y = clampedClientY - rect.top + mainEl.scrollTop;
      const beat = api.renderer.boundsLookup.getBeatAtPos?.(x, y);
      if (!beat || beat === lastBeat) return;
      lastBeat = beat;
      const anchor = dragStateRef.current.anchorBeat;
      if (!anchor) return;
      const [a, b] = orderBeats(anchor, beat);
      latestA = a; latestB = b;
      setSelStart(a); setSelEnd(b);
    }

    function onMove(e: PointerEvent) {
      // Only respond to the primary pointer (guard against multi-touch)
      if (dragStateRef.current.mode !== side) return;
      pendingEvent = e;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (pendingEvent) { process(pendingEvent); pendingEvent = null; }
      });
    }
    function onUp(e: PointerEvent) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      // Flush any pending event so final position is accurate
      if (pendingEvent) { process(pendingEvent); pendingEvent = null; }
      process(e);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      if (latestA && latestB) applyLoopRangeByBeats(latestA, latestB);
      // Keep dragStateRef.mode as the handle side for a brief window so that
      // alphaTab's beatMouseDown / beatMouseUp listeners (which may fire from
      // synthesized mouse events on the canvas) see the guard and skip
      // clearing the selection.
      setTimeout(() => {
        dragStateRef.current = { mode: "none", anchorBeat: null };
      }, 250);
    }
    // Document-level capture-phase listeners: always receive events regardless
    // of React re-renders or which element the pointer is currently over.
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  }

  function onOverlayDoubleClick(ev: React.MouseEvent) {
    const main = mainRef.current;
    const api = apiRef.current;
    if (!main || !api?.renderer?.boundsLookup) return;
    const rect = main.getBoundingClientRect();
    const x = ev.clientX - rect.left + main.scrollLeft;
    const y = ev.clientY - rect.top + main.scrollTop;
    const beat = api.renderer.boundsLookup.getBeatAtPos?.(x, y);
    if (!beat?.voice?.bar) return;
    // Double-click on beat = loop this single beat
    setSelStart(beat); setSelEnd(beat);
    applyLoopRangeByBeats(beat, beat);
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" className="hidden"
        title="Select Guitar Pro file" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      {gpUrlLoading ? (
        <div className="panel p-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin mb-2" />
          <div className="font-label text-sm text-[#555]">Loading Guitar Pro tab...</div>
        </div>
      ) : !fileData && !texLoaded ? (
        <div onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.(gp[345x]?|gpx?)$/i.test(f.name)) handleFile(f); }}
          className="panel p-6 text-center border-dashed !border-[#333] hover:!border-[#D4A843]/40 transition-all">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.07] text-[12px] font-medium cursor-pointer transition-all mx-auto mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Open GP / GuitarPro File
          </button>
          <div className="font-label text-sm text-[#555] mb-2">or drop a file here</div>
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
                {ready && !playerReady && (
                  <span className="font-label text-[9px] text-[#555]">
                    {sfError ? `Sound error: ${sfError}` : sfProgress > 0 && sfProgress < 100 ? `Loading sounds ${sfProgress}%` : "Loading player..."}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setViewerCollapsed(v => !v)} className="btn-ghost !text-[9px] !px-2 !py-1" title={viewerCollapsed ? "Show tab" : "Hide tab"}>
                  {viewerCollapsed ? "▼ Show" : "▲ Hide"}
                </button>
                <button onClick={() => {
                  if (apiRef.current?.destroy) try { apiRef.current.destroy(); } catch {}
                  apiRef.current = null; setFileData(null); setFileName(null); setReady(false);
                  setSongInfo(null); setPlayerReady(false); setShowMixer(false); setShowSettings(false);
                  setShowBookmarks(false); setShowFretboard(false); setTexLoaded(false); setViewerCollapsed(false);
                }} className="btn-ghost !text-[9px] !px-2 !py-1">Change</button>
              </div>
            </div>
          </div>

          {/* ── Transport + Sheet Music (collapsible) ── */}
          {!viewerCollapsed && ready && (
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#121214] space-y-2">
              {/* Row 1: Play, position, speed */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={togglePlay}
                  title={playing ? "Pause (Space)" : "Play (Space)"}
                  aria-label={playing ? "Pause" : "Play"}
                  className="gf-play-btn gf-tool-btn w-11 h-11 rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-105 focus:outline-none"
                  style={{
                    background: playing
                      ? "radial-gradient(circle at 30% 30%, #44dd44, #22aa22)"
                      : playerReady
                        ? "radial-gradient(circle at 30% 30%, #fbbf24, #d4a843)"
                        : "#555",
                    border: "1px solid " + (playing ? "#55ee55" : "#fde68a"),
                    boxShadow: playing
                      ? "0 2px 8px rgba(51,204,51,0.45), inset 0 1px 0 rgba(255,255,255,0.25)"
                      : playerReady
                        ? "0 2px 10px rgba(212,168,67,0.5), inset 0 1px 0 rgba(255,255,255,0.3)"
                        : "none",
                    opacity: playerReady ? 1 : 0.5
                  }}>
                  {playing ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="2" y="1" width="3" height="10" rx="0.5" fill="#0a0a0a" />
                      <rect x="7" y="1" width="3" height="10" rx="0.5" fill="#0a0a0a" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ marginLeft: 2 }}>
                      <path d="M3 2 L11 7 L3 12 Z" fill="#0a0a0a" />
                    </svg>
                  )}
                </button>
                {playing && (
                  <button onClick={doStop}
                    title="Stop"
                    aria-label="Stop"
                    className="btn-ghost !text-[9px] !px-2 !py-1 flex items-center gap-1 text-[#aaa] hover:!text-white">
                    <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" fill="currentColor" /></svg>
                    Stop
                  </button>
                )}

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

                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="font-readout text-[11px] text-[#555]">{"\u2669"}=</span>
                  <input
                    type="number"
                    disabled={speedTrainer}
                    title={speedTrainer ? "Speed Trainer is ON - it controls BPM automatically. Turn it OFF to change manually." : "Playback BPM (main speed)"}
                    value={bpmInput ?? (songInfo ? Math.round(songInfo.tempo * speed) : Math.round(120 * speed))}
                    onChange={e => setBpmInput(e.target.value)}
                    onBlur={() => {
                      if (bpmInput !== null) {
                        const bpmVal = Math.max(20, Math.min(400, Number(bpmInput)));
                        const tempo = songInfo?.tempo || 120;
                        setSpd(Math.max(0.1, Math.min(3, bpmVal / tempo)));
                        setBpmInput(null);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && bpmInput !== null) {
                        const bpmVal = Math.max(20, Math.min(400, Number(bpmInput)));
                        const tempo = songInfo?.tempo || 120;
                        setSpd(Math.max(0.1, Math.min(3, bpmVal / tempo)));
                        setBpmInput(null);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="gf-tool-input w-16 text-center font-readout text-[12px] bg-[#1a1a1a] border border-[#333] rounded-md px-1.5 py-1 text-[#D4A843] outline-none focus:border-[#D4A843] hover:border-[#D4A843]/50 transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="font-readout text-[9px] text-[#444]">{Math.round(speed * 100)}%</span>
                </div>
              </div>

              {/* Row 2: Loop, metronome, tools */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={toggleLoop}
                  className={`gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${isLooping ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555] hover:border-[#D4A843]/40 hover:text-[#D4A843]/70"}`}>
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

                <button onClick={toggleMetronome}
                  className={`gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${metronomeOn ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/10" : "border-[#222] text-[#555] hover:border-[#33CC33]/40 hover:text-[#33CC33]/70"}`}>
                  Met
                </button>
                <input type="range" min="0" max="1" step="0.05" value={metronomeVolume}
                  onChange={e => setMetVol(Number(e.target.value))} className="w-12 h-1 accent-[#33CC33]" />

                <button onClick={() => setCountIn(countInVolume > 0 ? 0 : 1)}
                  className={`gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${countInVolume > 0 ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555] hover:border-[#D4A843]/40 hover:text-[#D4A843]/70"}`}>
                  Count-in
                </button>

                {tracks.length > 1 && (
                  <select value={activeTrack} onChange={e => changeTrk(Number(e.target.value))} className="gf-track-select gf-tool-input input !w-auto !py-1 !text-[10px]">
                    {tracks.map(t => <option key={t.index} value={t.index}>{t.name}</option>)}
                  </select>
                )}

                <div className="flex items-center gap-1">
                  <span className="font-label text-[8px] text-[#555]">Transpose</span>
                  <button onClick={() => doTranspose(-1)} className="gf-spin-btn gf-tool-btn font-readout text-[9px] px-1.5 py-0.5 rounded cursor-pointer border border-[#222] text-[#555] transition-colors duration-120">-</button>
                  <span className={`font-readout text-[9px] min-w-[20px] text-center ${transpose !== 0 ? "text-[#D4A843]" : "text-[#555]"}`}>{transpose > 0 ? `+${transpose}` : transpose}</span>
                  <button onClick={() => doTranspose(1)} className="gf-spin-btn gf-tool-btn font-readout text-[9px] px-1.5 py-0.5 rounded cursor-pointer border border-[#222] text-[#555] transition-colors duration-120">+</button>
                  {transpose !== 0 && <button onClick={() => { setTranspose(0); doTranspose(-transpose); }} className="font-label text-[8px] text-[#555] hover:text-[#C41E3A] cursor-pointer">Reset</button>}
                </div>

                <div className="flex gap-1 ml-auto">
                  <button onClick={() => setShowFretboard(!showFretboard)}
                    className={`gf-mixer-btn gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${showFretboard ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>
                    Fretboard
                  </button>
                  <button onClick={() => setShowMixer(!showMixer)}
                    className={`gf-mixer-btn gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${showMixer ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>
                    Mixer
                  </button>
                  <button onClick={() => setShowBookmarks(!showBookmarks)}
                    className={`gf-mixer-btn gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${showBookmarks ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>
                    Clips
                  </button>
                  <button onClick={() => setShowSettings(!showSettings)}
                    className={`gf-mixer-btn gf-tool-btn font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${showSettings ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"}`}>
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

              {/* Audio Enhancement */}
              <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
                <div className="font-label text-[9px] text-[#888] mb-1">Audio Enhancement</div>

                {/* Tone preset selector (Metal / Rock / Clean) */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label text-[8px] text-[#555] w-10">Tone</span>
                  <div className="flex gap-1 flex-1">
                    {TAB_PLAYER_PRESET_LIST.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setTonePreset(p.id)}
                        title={`${p.label} tone`}
                        className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors duration-120 ${
                          tonePreset === p.id
                            ? "border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/10"
                            : "border-[#222] text-[#555] hover:border-[#333] hover:text-[#888]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setReverbEnabled(!reverbEnabled)}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${reverbEnabled ? "border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/10" : "border-[#222] text-[#555]"}`}>
                    Reverb {reverbEnabled ? "ON" : "OFF"}
                  </button>
                  {reverbEnabled && (
                    <div className="flex items-center gap-1 flex-1">
                      <span className="font-label text-[8px] text-[#555]">Mix</span>
                      <input type="range" min="0.05" max="0.6" step="0.05" value={reverbMix} title="Reverb mix"
                        onChange={e => setReverbMix(Number(e.target.value))} className="flex-1 h-1 accent-[#8B5CF6]" />
                      <span className="font-readout text-[9px] text-[#666] w-8 text-right">{Math.round(reverbMix * 100)}%</span>
                    </div>
                  )}
                </div>
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
                    <span className="font-readout text-[8px] text-[#bbb] font-semibold w-4 text-right mr-1">{stringNames[si]}</span>
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
                    <div key={fi} className={`text-center font-readout text-[7px] ${[3,5,7,9,12,15,17,19,21,24].includes(fi) ? "text-[#D4A843]" : "text-[#888]"}`}
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
                  title="Speed Trainer: gradually increases BPM after each successful loop (e.g. +5% every loop). When ON, it drives the main BPM automatically."
                  className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border ${speedTrainer ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/10" : "border-[#222] text-[#555]"}`}>
                  Speed Trainer {speedTrainer ? "ON" : "OFF"}
                </button>
                <span className="font-label text-[9px] text-[#666] italic">
                  Gradually raises BPM after each loop. When ON, it overrides the main speed.
                </span>
                {speedTrainer && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="font-label text-[8px] text-[#555]" title="Starting speed multiplier (1.0 = original BPM)">From</span>
                      <input type="number" min={0.1} max={2} step={0.05} value={trainerStartSpeed}
                        title="Starting speed multiplier (e.g. 0.5 = half speed)"
                        onChange={e => setTrainerStartSpeed(Number(e.target.value))}
                        className="w-14 bg-[#111] border border-[#333] text-[#D4A843] text-[10px] text-center rounded px-1 py-0.5 font-readout" />
                      <span className="font-label text-[8px] text-[#555]" title="Target (max) speed multiplier">To</span>
                      <input type="number" min={0.1} max={3} step={0.05} value={trainerEndSpeed}
                        title="Target speed multiplier (e.g. 1.0 = full speed)"
                        onChange={e => setTrainerEndSpeed(Number(e.target.value))}
                        className="w-14 bg-[#111] border border-[#333] text-[#D4A843] text-[10px] text-center rounded px-1 py-0.5 font-readout" />
                      <span className="font-label text-[8px] text-[#555]" title="Step added each loop iteration">Step</span>
                      <input type="number" min={0.01} max={0.5} step={0.01} value={trainerStep}
                        title="Speed increment per completed loop (e.g. 0.05 = +5%)"
                        onChange={e => setTrainerStep(Number(e.target.value))}
                        className="w-14 bg-[#111] border border-[#333] text-[#D4A843] text-[10px] text-center rounded px-1 py-0.5 font-readout" />
                    </div>
                    <span className="font-readout text-[9px] text-[#888]">Current: {speed.toFixed(2)}x</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Mixer Drawer (slides in from right) ── */}
          {ready && tracks.length > 0 && (
            <div
              aria-hidden={!showMixer}
              style={{
                position: "fixed",
                top: 0, right: 0, bottom: 0,
                width: 320,
                background: "linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 100%)",
                borderLeft: "1px solid rgba(245,158,11,0.18)",
                boxShadow: showMixer ? "-12px 0 40px rgba(0,0,0,0.6)" : "none",
                transform: showMixer ? "translateX(0)" : "translateX(100%)",
                transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                pointerEvents: showMixer ? "auto" : "none",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div style={{ width: 6, height: 18, borderRadius: 2, background: "linear-gradient(180deg, #fbbf24, #d4a843)" }} />
                  <span className="font-label text-[13px] tracking-[0.14em] uppercase" style={{ color: "#D4A843" }}>Mixer</span>
                </div>
                <button
                  onClick={() => setShowMixer(false)}
                  aria-label="Close mixer"
                  title="Close (Esc)"
                  className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                  style={{ border: "1px solid #2a2a2a", color: "#888" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Master section */}
              <div className="px-4 py-3 border-b border-[#1a1a1a]" style={{ background: "rgba(245,158,11,0.03)" }}>
                <div className="font-label text-[9px] tracking-[0.14em] uppercase text-[#888] mb-2">Master</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label text-[9px] text-[#888] w-12">Volume</span>
                  <input type="range" min="0" max="1" step="0.05" value={masterVolume}
                    onChange={e => setMasterVol(Number(e.target.value))} className="flex-1 h-1 accent-[#D4A843]" />
                  <span className="font-readout text-[9px] text-[#888] w-9 text-right">{Math.round(masterVolume * 100)}%</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={toggleMetronome}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors ${metronomeOn ? "border-[#33CC33] text-[#33CC33] bg-[#33CC33]/10" : "border-[#2a2a2a] text-[#666]"}`}
                    style={{ minWidth: 50 }}
                  >
                    Met {metronomeOn ? "ON" : "OFF"}
                  </button>
                  <input type="range" min="0" max="1" step="0.05" value={metronomeVolume}
                    onChange={e => setMetVol(Number(e.target.value))} className="flex-1 h-1 accent-[#33CC33]" />
                  <span className="font-readout text-[9px] text-[#666] w-9 text-right">{Math.round(metronomeVolume * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCountIn(countInVolume > 0 ? 0 : 1)}
                    className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors ${countInVolume > 0 ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#2a2a2a] text-[#666]"}`}>
                    Count-in {countInVolume > 0 ? "ON" : "OFF"}
                  </button>
                  <span className="font-readout text-[10px] text-[#D4A843] ml-auto">{songInfo ? `${Math.round(songInfo.tempo * speed)} BPM` : ""}</span>
                </div>
              </div>

              {/* Tracks — vertical channel strips */}
              <div className="gf-mixer-scroll flex-1 overflow-auto px-3 py-3">
                <div className="font-label text-[9px] tracking-[0.14em] uppercase text-[#888] mb-2">Channels</div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {tracks.map(t => {
                    const isActive = activeTrack === t.index;
                    const trackColor = isActive ? "#D4A843" : "#444";
                    // Determine instrument icon (simple heuristic)
                    const name = t.name.toLowerCase();
                    const isBass = name.includes("bass");
                    const isDrum = name.includes("drum") || name.includes("perc");
                    const isVocal = name.includes("voc") || name.includes("sing");
                    return (
                      <div
                        key={t.index}
                        onClick={() => changeTrk(t.index)}
                        className="gf-track-strip shrink-0 cursor-pointer transition-all duration-150"
                        style={{
                          width: 72,
                          padding: "10px 6px",
                          borderRadius: 6,
                          background: isActive ? "rgba(245,158,11,0.06)" : "#0d0d0d",
                          border: isActive ? "1px solid rgba(245,158,11,0.45)" : "1px solid #1a1a1a",
                          boxShadow: isActive ? "0 0 14px rgba(245,158,11,0.15)" : "none",
                        }}
                      >
                        {/* Color strip */}
                        <div style={{ height: 3, borderRadius: 2, background: trackColor, marginBottom: 8, opacity: isActive ? 1 : 0.4 }} />
                        {/* Instrument icon */}
                        <div className="flex justify-center mb-1.5" style={{ color: trackColor }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            {isDrum ? (
                              <>
                                <ellipse cx="8" cy="5" rx="5.5" ry="1.8" stroke="currentColor" strokeWidth="1.2" />
                                <path d="M2.5 5 L2.5 11 Q8 13 13.5 11 L13.5 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                              </>
                            ) : isVocal ? (
                              <>
                                <rect x="6" y="2" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
                                <path d="M4 8 Q4 12 8 12 Q12 12 12 8 M8 12 L8 14" stroke="currentColor" strokeWidth="1.2" fill="none" />
                              </>
                            ) : isBass ? (
                              <>
                                <path d="M5 2 L5 10 Q5 13 8 13 Q11 13 11 10 L11 2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                                <circle cx="8" cy="10" r="1.5" fill="currentColor" />
                              </>
                            ) : (
                              <>
                                <circle cx="11" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                                <path d="M10 8 L14 2 L15 3 L11 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                              </>
                            )}
                          </svg>
                        </div>
                        {/* Name */}
                        <div className="font-label text-[9px] truncate text-center mb-2" style={{ color: isActive ? "#D4A843" : "#aaa" }} title={t.name}>
                          {t.name}
                        </div>
                        {/* S/M buttons */}
                        <div className="flex gap-1 justify-center mb-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleTrackSolo(t.index); }}
                            className={`font-label text-[8px] w-6 h-5 rounded cursor-pointer border transition-colors ${t.isSolo ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/15" : "border-[#2a2a2a] text-[#555] hover:text-[#D4A843]"}`}
                            title="Solo">S</button>
                          <button onClick={(e) => { e.stopPropagation(); toggleTrackMute(t.index); }}
                            className={`font-label text-[8px] w-6 h-5 rounded cursor-pointer border transition-colors ${t.isMuted ? "border-[#C41E3A] text-[#C41E3A] bg-[#C41E3A]/15" : "border-[#2a2a2a] text-[#555] hover:text-[#C41E3A]"}`}
                            title="Mute">M</button>
                        </div>
                        {/* Vertical slider (rotated range) */}
                        <div style={{ height: 100, position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
                          {/* Track */}
                          <div style={{
                            position: "absolute",
                            top: 4, bottom: 4,
                            width: 4,
                            background: "linear-gradient(180deg, #1a1a1a, #0a0a0a)",
                            borderRadius: 2,
                            border: "1px solid #222",
                          }} />
                          {/* Fill */}
                          <div style={{
                            position: "absolute",
                            bottom: 4,
                            height: `calc(${t.volume * 100}% - 8px)`,
                            width: 4,
                            background: `linear-gradient(180deg, ${trackColor}, ${isActive ? "#8a6b1d" : "#2a2a2a"})`,
                            borderRadius: 2,
                            minHeight: 0,
                            opacity: t.isMuted ? 0.2 : 1,
                            transition: "opacity 150ms ease",
                          }} />
                          {/* Range input rotated for vertical */}
                          <input
                            type="range" min="0" max="1" step="0.01" value={t.volume}
                            onChange={e => setTrackVolume(t.index, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`${t.name} volume`}
                            style={{
                              appearance: "none",
                              WebkitAppearance: "slider-vertical" as any,
                              width: 20,
                              height: 100,
                              background: "transparent",
                              cursor: "pointer",
                              writingMode: "vertical-lr" as any,
                              direction: "rtl" as any,
                            }}
                          />
                        </div>
                        {/* Volume readout */}
                        <div className="font-readout text-[8px] text-center mt-1" style={{ color: isActive ? "#D4A843" : "#555" }}>
                          {Math.round(t.volume * 100)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-[#1a1a1a] font-label text-[8px] text-[#555] tracking-wider">
                Press <span className="text-[#888]">Esc</span> to close &middot; <span className="text-[#888]">M</span> to toggle
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

          {!viewerCollapsed && loading && (
            <div className="p-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4A843]/25 bg-[#D4A843]/[0.04]" style={{ animation: "gfLoadingPulse 1.5s ease-in-out infinite" }}>
                <div className="w-3.5 h-3.5 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
                <span className="font-label text-[11px] tracking-[0.08em] uppercase text-[#D4A843]">Loading tab</span>
              </div>
            </div>
          )}
          {!viewerCollapsed && error && (
            <div className="mx-4 my-3 p-3 rounded-md border border-[#C41E3A]/40 bg-[#C41E3A]/[0.06] flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" className="mt-px shrink-0" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="#C41E3A" strokeWidth="1.4" fill="none" />
                <path d="M7 4 L7 8 M7 10 L7 10.5" stroke="#C41E3A" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="font-label text-[11px] text-[#ff6b8a] leading-snug">{error}</span>
            </div>
          )}

          <div ref={overlayWrapRef} style={{ position: "relative" }} onDoubleClick={onOverlayDoubleClick}
            onMouseLeave={() => setHoverBar(null)}>
            <div
              ref={mainRef}
              className="gf-main-scroll"
              style={{
                minHeight: ready && !viewerCollapsed ? 350 : 0,
                maxHeight: viewerCollapsed ? 0 : 550,
                overflow: "auto",
                // overscrollBehavior blocks wheel/touch scroll chaining AND also
                // guards against programmatic scroll-chaining where any focus-based
                // scroll (alphaTab highlightElements, scrollIntoView-like calls) can
                // end up scrolling the modal body and pushing the toolbar off-screen.
                overscrollBehavior: "contain",
                // CSS containment: limits layout / paint / style side-effects of the
                // heavy alphaTab canvas subtree to this box so autoscroll here cannot
                // trigger layout-induced scrolling on ancestors.
                contain: "layout paint",
                background: viewerCollapsed ? "transparent" : "#fff",
              }}
              dir="ltr"
            />

            {/* Interactive overlay: hover + selection + drag handles + playing-bar highlight */}
            {ready && !viewerCollapsed && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
                {/* Playing-beat highlight (GP-style cream/yellow wash on the current beat) */}
                {playingBeatRects.map((r, i) => (
                  <div key={`pb-${i}`} style={{
                    position: "absolute", left: r.x - 2, top: r.y, width: r.w + 4, height: r.h,
                    background: "rgba(255, 235, 120, 0.35)",
                    borderRadius: 2,
                    transition: "left 120ms cubic-bezier(0.4, 0, 0.2, 1), top 180ms cubic-bezier(0.4, 0, 0.2, 1), width 120ms cubic-bezier(0.4, 0, 0.2, 1)",
                    willChange: "left, top, width",
                    pointerEvents: "none",
                  }} />
                ))}
                {/* Hover bar outline */}
                {hoverRects.map((r, i) => (
                  <div key={`h-${i}`} style={{
                    position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h,
                    border: "1px solid rgba(245,158,11,0.3)",
                    borderRadius: 2,
                    transition: "opacity 100ms ease-out",
                  }} />
                ))}
                {/* Selection fill + border (beat-level) — premium gradient + shimmer */}
                {selRects.map((r, i) => (
                  <div key={`s-${i}`} style={{
                    position: "absolute", left: r.x - 2, top: r.y, width: r.w + 4, height: r.h,
                    background: "linear-gradient(180deg, rgba(245,158,11,0.30) 0%, rgba(245,158,11,0.18) 100%)",
                    border: "1.5px solid rgba(245,158,11,0.9)",
                    outline: "1px solid rgba(120,75,0,0.55)",
                    outlineOffset: "-3px",
                    borderRadius: 4,
                    boxShadow: "0 0 12px rgba(245,158,11,0.28), inset 0 0 12px rgba(245,158,11,0.08)",
                    animation: "gfSelFadeIn 140ms ease-out, gfSelShimmer 5s ease-in-out infinite",
                    overflow: "hidden",
                  }} />
                ))}
                {/* Floating Loop label (centered above selection) */}
                {selRects.length > 0 && (() => {
                  const first = selRects[0];
                  const last = selRects[selRects.length - 1];
                  const cx = (first.x + last.x + last.w) / 2;
                  const barsCount = (loopEnd ?? 0) - (loopStart ?? 0) + 1;
                  return (
                    <div style={{
                      position: "absolute",
                      left: cx - 70, top: Math.max(2, first.y - 24),
                      width: 140,
                      textAlign: "center",
                      pointerEvents: "none",
                      animation: "gfLoopLabelIn 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        background: "linear-gradient(180deg, rgba(26,26,26,0.95), rgba(10,10,10,0.95))",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        border: "1px solid rgba(245,158,11,0.45)",
                        borderRadius: 10,
                        color: "#D4A843",
                        fontSize: 10,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08)",
                      }}>
                        Loop &middot; {barsCount > 0 ? barsCount : 1} bar{barsCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })()}
                {/* Drag handles (left = first rect's left edge, right = last rect's right edge) */}
                {selRects.length > 0 && (() => {
                  const first = selRects[0];
                  const last = selRects[selRects.length - 1];
                  const handleStyle = (left: number, top: number): React.CSSProperties => ({
                    position: "absolute",
                    left: left - 14, top: top - 14,
                    width: 28, height: 28,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(245,158,11,0.95), rgba(212,168,67,0.9))",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    border: "1.5px solid rgba(10,10,10,0.85)",
                    boxShadow: "0 2px 10px rgba(245,158,11,0.55), 0 0 0 2px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
                    cursor: "ew-resize",
                    pointerEvents: "auto",
                    zIndex: 1000,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#0a0a0a",
                    transition: "transform 150ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 150ms ease-out",
                  });
                  return (
                    <>
                      <div
                        className="gf-handle"
                        style={{ ...handleStyle(first.x, first.y + first.h / 2), touchAction: "none" }}
                        onPointerDown={(e) => onHandlePointerDown("left", e)}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        title="Drag to resize loop start"
                      >
                        <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M6.5 2 L3 5 L6.5 8" stroke="#0a0a0a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div
                        className="gf-handle"
                        style={{ ...handleStyle(last.x + last.w, last.y + last.h / 2), touchAction: "none" }}
                        onPointerDown={(e) => onHandlePointerDown("right", e)}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        title="Drag to resize loop end"
                      >
                        <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M3.5 2 L7 5 L3.5 8" stroke="#0a0a0a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <style jsx>{`
            @keyframes gfSelFadeIn {
              from { opacity: 0; transform: scale(0.98) translateY(-2px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes gfSelShimmer {
              0%, 100% { box-shadow: 0 0 12px rgba(245,158,11,0.28), inset 0 0 12px rgba(245,158,11,0.08); }
              50% { box-shadow: 0 0 18px rgba(245,158,11,0.38), inset 0 0 18px rgba(245,158,11,0.14); }
            }
            @keyframes gfDrawerIn {
              from { transform: translateX(100%); opacity: 0.6; }
              to { transform: translateX(0); opacity: 1; }
            }
            @keyframes gfLoadingPulse {
              0%, 100% { opacity: 0.55; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.02); }
            }
            @keyframes gfLoopLabelIn {
              from { opacity: 0; transform: translateY(4px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            /* Drag handles */
            :global(.gf-handle) {
              cursor: grab;
            }
            :global(.gf-handle:hover) {
              transform: scale(1.12);
              box-shadow: 0 3px 16px rgba(245,158,11,0.8), 0 0 0 3px rgba(245,158,11,0.24), inset 0 1px 0 rgba(255,255,255,0.45) !important;
            }
            :global(.gf-handle:active) {
              transform: scale(1.2);
              cursor: grabbing;
              box-shadow: 0 5px 22px rgba(245,158,11,0.9), 0 0 0 4px rgba(245,158,11,0.3), inset 0 2px 0 rgba(255,255,255,0.55) !important;
            }
            /* Toolbar buttons — focus-visible amber ring */
            :global(.gf-tool-btn:focus-visible),
            :global(.gf-tool-input:focus-visible) {
              outline: 2px solid rgba(245,158,11,0.55);
              outline-offset: 2px;
            }
            /* Play button micro-bounce on active */
            :global(.gf-play-btn:active) {
              transform: scale(0.94) !important;
              transition: transform 90ms ease-out !important;
            }
            /* Mixer launcher — amber tint on hover */
            :global(.gf-mixer-btn:hover) {
              background: rgba(245,158,11,0.08) !important;
              border-color: rgba(245,158,11,0.45) !important;
              color: #D4A843 !important;
            }
            /* Spinbutton +/- */
            :global(.gf-spin-btn:hover) {
              background: rgba(245,158,11,0.1);
              border-color: rgba(245,158,11,0.5) !important;
              color: #D4A843 !important;
            }
            :global(.gf-spin-btn:active) {
              transform: scale(0.92);
            }
            /* Native select polish */
            :global(.gf-track-select) {
              transition: border-color 140ms ease-out, background-color 140ms ease-out;
            }
            :global(.gf-track-select:hover) {
              border-color: rgba(245,158,11,0.45) !important;
            }
            :global(.gf-track-select:focus) {
              border-color: rgba(245,158,11,0.8) !important;
              outline: 2px solid rgba(245,158,11,0.35);
              outline-offset: 1px;
            }
            /* Track strip hover */
            :global(.gf-track-strip:hover) {
              background: rgba(255,255,255,0.035) !important;
            }
            /* Custom scrollbar on the alphaTab viewport */
            :global(.gf-main-scroll) {
              scrollbar-width: thin;
              scrollbar-color: rgba(245,158,11,0.25) transparent;
            }
            :global(.gf-main-scroll::-webkit-scrollbar) {
              width: 6px;
              height: 6px;
            }
            :global(.gf-main-scroll::-webkit-scrollbar-track) {
              background: transparent;
            }
            :global(.gf-main-scroll::-webkit-scrollbar-thumb) {
              background: rgba(245,158,11,0.25);
              border-radius: 3px;
              transition: background-color 160ms ease-out;
            }
            :global(.gf-main-scroll::-webkit-scrollbar-thumb:hover) {
              background: rgba(245,158,11,0.55);
            }
            /* Mixer drawer scrollbar */
            :global(.gf-mixer-scroll) {
              scrollbar-width: thin;
              scrollbar-color: rgba(245,158,11,0.22) transparent;
            }
            :global(.gf-mixer-scroll::-webkit-scrollbar) {
              width: 6px;
              height: 6px;
            }
            :global(.gf-mixer-scroll::-webkit-scrollbar-track) { background: transparent; }
            :global(.gf-mixer-scroll::-webkit-scrollbar-thumb) {
              background: rgba(245,158,11,0.22);
              border-radius: 3px;
            }
            :global(.gf-mixer-scroll::-webkit-scrollbar-thumb:hover) {
              background: rgba(245,158,11,0.5);
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
