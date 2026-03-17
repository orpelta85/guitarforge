"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ── Types ──
interface TrackEffects {
  reverb: { wet: number; decay: number; enabled: boolean };
  delay: { wet: number; time: number; feedback: number; enabled: boolean };
  distortion: { wet: number; amount: number; enabled: boolean };
  eq: { low: number; mid: number; high: number; enabled: boolean };
  chorus: { wet: number; frequency: number; depth: number; enabled: boolean };
  compressor: { threshold: number; ratio: number; attack: number; release: number; enabled: boolean };
}

interface TrackInputSettings {
  deviceId: string;
  channel: "mono-l" | "mono-r" | "stereo";
  gain: number;
  monitoring: boolean;
}

interface StudioTrack {
  id: number;
  name: string;
  color: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  recordArm: boolean;
  collapsed: boolean;
  type: "recording" | "import" | "suno" | "mic" | "file" | "youtube";
  effects: TrackEffects;
  inputSettings?: TrackInputSettings;
}

type ToneModule = typeof import("tone");

interface ToneNodes {
  player: InstanceType<ToneModule["Player"]>;
  eq: InstanceType<ToneModule["EQ3"]>;
  distortion: InstanceType<ToneModule["Distortion"]>;
  chorus: InstanceType<ToneModule["Chorus"]>;
  delay: InstanceType<ToneModule["FeedbackDelay"]>;
  reverb: InstanceType<ToneModule["Reverb"]>;
  channel: InstanceType<ToneModule["Channel"]>;
}

interface WaveSurferInstance {
  destroy: () => void;
  loadBlob: (blob: Blob) => Promise<void>;
  load: (url: string) => Promise<void>;
  setTime: (t: number) => void;
  zoom: (pxPerSec: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  getWrapper: () => HTMLElement;
}

interface SavedRecording {
  id: string;
  name: string;
  date: string;
  duration: number;
  format: "wav" | "mp3";
}

// ── IndexedDB helpers ──
const IDB_NAME = "gf-studio";
const IDB_STORE = "recordings";

function openRecordingsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSaveRecording(id: string, name: string, blob: Blob, duration: number, format: "wav" | "mp3" = "wav"): Promise<SavedRecording> {
  const db = await openRecordingsDB();
  const meta: SavedRecording = { id, name, date: new Date().toISOString(), duration, format };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ ...meta, blob });
    tx.oncomplete = () => {
      const existing: SavedRecording[] = JSON.parse(localStorage.getItem("gf-recordings") || "[]");
      const updated = existing.filter((r) => r.id !== id);
      updated.unshift(meta);
      localStorage.setItem("gf-recordings", JSON.stringify(updated));
      resolve(meta);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function idbLoadRecordings(): Promise<SavedRecording[]> {
  try {
    return JSON.parse(localStorage.getItem("gf-recordings") || "[]");
  } catch { return []; }
}

async function idbGetBlob(id: string): Promise<Blob | null> {
  const db = await openRecordingsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result?.blob ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteRecording(id: string): Promise<void> {
  const db = await openRecordingsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => {
      const existing: SavedRecording[] = JSON.parse(localStorage.getItem("gf-recordings") || "[]");
      localStorage.setItem("gf-recordings", JSON.stringify(existing.filter((r) => r.id !== id)));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function idbRenameRecording(id: string, newName: string): Promise<void> {
  const db = await openRecordingsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) {
        req.result.name = newName;
        store.put(req.result);
      }
    };
    tx.oncomplete = () => {
      const existing: SavedRecording[] = JSON.parse(localStorage.getItem("gf-recordings") || "[]");
      const rec = existing.find((r) => r.id === id);
      if (rec) rec.name = newName;
      localStorage.setItem("gf-recordings", JSON.stringify(existing));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

const TRACK_COLORS = ["#C41E3A", "#D4A843", "#8b5cf6", "#06b6d4", "#22c55e", "#f97316", "#ec4899", "#14b8a6"];

const MUSICAL_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MUSICAL_MODES = ["Major", "Minor", "Dorian", "Mixolydian", "Phrygian", "Lydian"];

const SHORTCUT_HINTS: Record<string, string> = {
  rewind: "Enter",
  stop: "",
  play: "Space",
  record: "R",
  loop: "C",
  metronome: "M",
  snap: "G",
};

const DEFAULT_EFFECTS: TrackEffects = {
  reverb: { wet: 0, decay: 1.5, enabled: false },
  delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
  distortion: { wet: 0, amount: 0, enabled: false },
  eq: { low: 0, mid: 0, high: 0, enabled: false },
  chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, enabled: false },
};

interface AmpPreset {
  name: string;
  label: string;
  effects: Partial<TrackEffects>;
}

const AMP_PRESETS: AmpPreset[] = [
  {
    name: "clean", label: "Clean",
    effects: {
      eq: { low: 2, mid: 0, high: 3, enabled: true },
      chorus: { wet: 0.2, frequency: 1.5, depth: 0.7, enabled: true },
      distortion: { wet: 0, amount: 0, enabled: false },
      delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
      reverb: { wet: 0, decay: 1.5, enabled: false },
      compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, enabled: false },
    },
  },
  {
    name: "crunch", label: "Crunch",
    effects: {
      distortion: { wet: 0.4, amount: 0.3, enabled: true },
      eq: { low: 3, mid: 4, high: 1, enabled: true },
      chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
      delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
      reverb: { wet: 0, decay: 1.5, enabled: false },
      compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, enabled: false },
    },
  },
  {
    name: "highgain", label: "High Gain",
    effects: {
      distortion: { wet: 0.8, amount: 0.7, enabled: true },
      eq: { low: 5, mid: 6, high: 2, enabled: true },
      reverb: { wet: 0.15, decay: 1.5, enabled: true },
      chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
      delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
      compressor: { threshold: -20, ratio: 6, attack: 0.003, release: 0.25, enabled: true },
    },
  },
  {
    name: "lead", label: "Lead",
    effects: {
      distortion: { wet: 0.6, amount: 0.5, enabled: true },
      delay: { wet: 0.3, time: 0.25, feedback: 0.3, enabled: true },
      reverb: { wet: 0.25, decay: 1.5, enabled: true },
      eq: { low: 0, mid: 0, high: 0, enabled: false },
      chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
      compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, enabled: false },
    },
  },
  {
    name: "ambient", label: "Ambient",
    effects: {
      chorus: { wet: 0.4, frequency: 1.5, depth: 0.7, enabled: true },
      delay: { wet: 0.5, time: 0.25, feedback: 0.5, enabled: true },
      reverb: { wet: 0.6, decay: 5, enabled: true },
      distortion: { wet: 0, amount: 0, enabled: false },
      eq: { low: 0, mid: 0, high: 0, enabled: false },
      compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, enabled: false },
    },
  },
];

const TIME_SIGS: [number, number][] = [[4, 4], [3, 4], [6, 8], [2, 4], [5, 4], [7, 8]];

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

function dbDisplay(vol: number): string {
  if (vol <= 0) return "-inf";
  const db = 20 * Math.log10(vol / 100);
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}`;
}

export default function StudioPage() {
  // ── State ──
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isRec, setIsRec] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [bpm, setBpm] = useState(120);
  const [timeSigIdx, setTimeSigIdx] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPanel, setShowPanel] = useState<"none" | "import" | "suno" | "youtube">("none");
  const [fxTrackId, setFxTrackId] = useState<number | null>(null);
  const [ytQuery, setYtQuery] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");
  const [sunoScale, setSunoScale] = useState("Am");
  const [sunoMode, setSunoMode] = useState("Aeolian");
  const [sunoStyle, setSunoStyle] = useState("Blues Rock");
  const [sunoBpm, setSunoBpm] = useState(120);
  const [sunoLoading, setSunoLoading] = useState(false);
  const [sunoError, setSunoError] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [editingTrackName, setEditingTrackName] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(240);
  const [bottomTab, setBottomTab] = useState<"mixer" | "fx" | "editor" | "input" | "none">("none");
  const [trackMenuId, setTrackMenuId] = useState<number | null>(null);
  const [vuLevels, setVuLevels] = useState<Record<number, number>>({});
  const [projectName, setProjectName] = useState("New Project");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState("");
  const [monitoring, setMonitoring] = useState(false);
  const [showTimeSigPicker, setShowTimeSigPicker] = useState(false);
  const [showMetronomeSettings, setShowMetronomeSettings] = useState(false);
  const [metronomeVol, setMetronomeVol] = useState(50);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [projectKey, setProjectKey] = useState("Am");
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [colorPickerTrackId, setColorPickerTrackId] = useState<number | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const inputLevelRef = useRef<number>(0);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const [inputSettingsTrackId, setInputSettingsTrackId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showRecordingsPanel, setShowRecordingsPanel] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [previewingRecId, setPreviewingRecId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const timeSig = TIME_SIGS[timeSigIdx];

  // ── Refs ──
  const toneRef = useRef<ToneModule | null>(null);
  const masterGainRef = useRef<InstanceType<ToneModule["Gain"]> | null>(null);
  const toneNodesRef = useRef<Record<number, ToneNodes>>({});
  const wsRef = useRef<Record<number, WaveSurferInstance>>({});
  const recWsRef = useRef<WaveSurferInstance | null>(null);
  const recPluginRef = useRef<{ stopRecording: () => void; destroy: () => void } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recAnalyserRef = useRef<AnalyserNode | null>(null);
  const recAudioCtxRef = useRef<AudioContext | null>(null);
  const recLevelAnimRef = useRef<number>(0);
  const [recLevel, setRecLevel] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<number>(0);
  const metronomeRef = useRef<{
    loop: InstanceType<ToneModule["Loop"]>;
    synth: InstanceType<ToneModule["MembraneSynth"]>;
    gain: InstanceType<ToneModule["Gain"]>;
  } | null>(null);
  const ctr = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const trackContainersRef = useRef<Record<number, HTMLDivElement | null>>({});
  const recContainerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const sidebarDragRef = useRef(false);
  const bottomDragRef = useRef(false);
  const vuAnimRef = useRef<number>(0);
  const playStartRef = useRef<{ wallTime: number; offset: number } | null>(null);

  // ── Tone.js initialization ──
  const ensureTone = useCallback(async () => {
    if (toneRef.current) return toneRef.current;
    const Tone = await import("tone");
    await Tone.start();
    toneRef.current = Tone;
    const gain = new Tone.Gain(masterVol / 100).toDestination();
    masterGainRef.current = gain;
    return Tone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Master volume sync ──
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVol / 100;
    }
  }, [masterVol]);

  // ── Metronome ──
  const setupMetronome = useCallback(async () => {
    const Tone = await ensureTone();
    if (metronomeRef.current) return;
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    });
    const gain = new Tone.Gain(metronomeVol / 100).toDestination();
    synth.connect(gain);
    const loop = new Tone.Loop((time: number) => {
      synth.triggerAttackRelease("C2", "16n", time);
    }, "4n");
    metronomeRef.current = { loop, synth, gain };
  }, [ensureTone, metronomeVol]);

  useEffect(() => {
    if (!metronomeRef.current) return;
    const Tone = toneRef.current;
    if (!Tone) return;
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (!metronomeRef.current) return;
    if (metronomeOn) {
      metronomeRef.current.loop.start(0);
    } else {
      metronomeRef.current.loop.stop();
    }
  }, [metronomeOn]);

  useEffect(() => {
    if (metronomeRef.current) {
      metronomeRef.current.gain.gain.value = metronomeVol / 100;
    }
  }, [metronomeVol]);

  // ── Zoom sync ──
  useEffect(() => {
    const pxPerSec = 20 + (zoom / 100) * 300;
    Object.values(wsRef.current).forEach((ws) => {
      try { ws.zoom(pxPerSec); } catch { /* not ready */ }
    });
  }, [zoom]);

  // ── Solo/mute logic ──
  const applySoloMute = useCallback((trks: StudioTrack[]) => {
    const hasSolo = trks.some((t) => t.solo);
    trks.forEach((t) => {
      const nodes = toneNodesRef.current[t.id];
      if (!nodes) return;
      const audible = hasSolo ? t.solo : !t.muted;
      nodes.channel.mute = !audible;
    });
  }, []);

  // ── Apply effects to Tone nodes ──
  const applyEffects = useCallback((trackId: number, fx: TrackEffects) => {
    const nodes = toneNodesRef.current[trackId];
    if (!nodes) return;
    nodes.eq.low.value = fx.eq.enabled ? fx.eq.low : 0;
    nodes.eq.mid.value = fx.eq.enabled ? fx.eq.mid : 0;
    nodes.eq.high.value = fx.eq.enabled ? fx.eq.high : 0;
    nodes.distortion.wet.value = fx.distortion.enabled ? fx.distortion.wet : 0;
    nodes.distortion.distortion = fx.distortion.amount;
    nodes.chorus.wet.value = fx.chorus.enabled ? fx.chorus.wet : 0;
    nodes.chorus.frequency.value = fx.chorus.frequency;
    nodes.chorus.depth = fx.chorus.depth;
    nodes.delay.wet.value = fx.delay.enabled ? fx.delay.wet : 0;
    nodes.delay.feedback.value = fx.delay.feedback;
    nodes.reverb.wet.value = fx.reverb.enabled ? fx.reverb.wet : 0;
    nodes.reverb.decay = Math.max(0.1, fx.reverb.decay);
  }, []);

  // ── Create Tone nodes for a track ──
  const createToneNodes = useCallback(async (track: StudioTrack): Promise<ToneNodes | null> => {
    if (!track.audioUrl) return null;
    const Tone = await ensureTone();
    const master = masterGainRef.current;
    if (!master) return null;

    const player = new Tone.Player({ url: track.audioUrl, loop: false });
    const eq = new Tone.EQ3(0, 0, 0);
    const distortion = new Tone.Distortion(0);
    distortion.wet.value = 0;
    const chorus = new Tone.Chorus(1.5, 0.7, 0);
    chorus.wet.value = 0;
    const delay = new Tone.FeedbackDelay(0.25, 0.3);
    delay.wet.value = 0;
    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;
    const channel = new Tone.Channel(0, 0);

    player.chain(eq, distortion, chorus, delay, reverb, channel, master);

    const dbVol = track.volume > 0 ? 20 * Math.log10(track.volume / 100) : -Infinity;
    channel.volume.value = dbVol;
    channel.pan.value = track.pan / 100;

    const nodes: ToneNodes = { player, eq, distortion, chorus, delay, reverb, channel };
    toneNodesRef.current[track.id] = nodes;

    return nodes;
  }, [ensureTone]);

  // ── Create wavesurfer for a track ──
  const createWavesurfer = useCallback(async (track: StudioTrack, container: HTMLDivElement) => {
    const WaveSurfer = (await import("wavesurfer.js")).default;
    const ws = WaveSurfer.create({
      container,
      waveColor: track.color + "66",
      progressColor: track.color,
      cursorColor: "#f59e0b",
      cursorWidth: 2,
      height: 56,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      interact: true,
      normalize: true,
      backend: "WebAudio",
      media: document.createElement("audio"),
    }) as unknown as WaveSurferInstance;

    if (track.audioBlob) {
      await ws.loadBlob(track.audioBlob);
    } else if (track.audioUrl) {
      await ws.load(track.audioUrl);
    }

    ws.on("interaction", (progress: unknown) => {
      const p = progress as number;
      const dur = ws.getDuration();
      if (dur > 0 && toneRef.current) {
        const seekTime = p * dur;
        Object.values(toneNodesRef.current).forEach((n) => {
          if (n.player.loaded) n.player.seek(seekTime);
        });
        Object.values(wsRef.current).forEach((w) => {
          try { w.setTime(seekTime); } catch { /* skip */ }
        });
        setCurrentTime(seekTime);
      }
    });

    wsRef.current[track.id] = ws;
    const dur = ws.getDuration();
    if (dur > 0) setDuration((prev) => Math.max(prev, dur));
    return ws;
  }, []);

  // ── Add track helper ──
  const addTrack = useCallback(async (name: string, url: string, type: StudioTrack["type"], blob?: Blob) => {
    ctr.current++;
    const id = ctr.current;
    const color = TRACK_COLORS[(id - 1) % TRACK_COLORS.length];
    const newTrack: StudioTrack = {
      id, name, color,
      audioBlob: blob || null,
      audioUrl: url,
      volume: 100,
      pan: 0,
      muted: false,
      solo: false,
      recordArm: false,
      collapsed: false,
      type,
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS)),
    };
    setTracks((p) => [...p, newTrack]);

    setTimeout(async () => {
      if (!mountedRef.current) return;
      const container = trackContainersRef.current[id];
      if (container) await createWavesurfer(newTrack, container);
      await createToneNodes(newTrack);
    }, 100);
  }, [createWavesurfer, createToneNodes]);

  // ── Add empty mic track (for record-ready track) ──
  const addMicTrack = useCallback(() => {
    ctr.current++;
    const id = ctr.current;
    const color = TRACK_COLORS[(id - 1) % TRACK_COLORS.length];
    const newTrack: StudioTrack = {
      id, name: `Mic ${id}`, color,
      audioBlob: null, audioUrl: null,
      volume: 100, pan: 0,
      muted: false, solo: false, recordArm: true, collapsed: false,
      type: "mic",
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS)),
      inputSettings: { deviceId: selectedInputDevice, channel: "stereo", gain: 100, monitoring: false },
    };
    setTracks((p) => [...p, newTrack]);
    setShowAddTrackMenu(false);
  }, [selectedInputDevice]);

  // ── Add YouTube track placeholder ──
  const addYoutubeTrack = useCallback(() => {
    setShowRightPanel(true);
    setShowAddTrackMenu(false);
  }, []);

  // ── Recording ──
  const startRec = useCallback(async () => {
    if (!navigator.mediaDevices) { alert("Microphone not available"); return; }
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedInputDevice
          ? { deviceId: { exact: selectedInputDevice }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Set up AnalyserNode for live level meter
      const audioCtx = new AudioContext();
      recAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      recAnalyserRef.current = analyser;

      // Start live level meter animation
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tickLevel = () => {
        if (!recAnalyserRef.current) return;
        recAnalyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setRecLevel(Math.min(1, rms * 3));
        recLevelAnimRef.current = requestAnimationFrame(tickLevel);
      };
      recLevelAnimRef.current = requestAnimationFrame(tickLevel);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      recChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (!mountedRef.current) return;
        // Stop level meter
        if (recLevelAnimRef.current) cancelAnimationFrame(recLevelAnimRef.current);
        recAnalyserRef.current = null;
        if (recAudioCtxRef.current) { try { recAudioCtxRef.current.close(); } catch { /* ok */ } recAudioCtxRef.current = null; }
        setRecLevel(0);

        const chunks = recChunksRef.current;
        recChunksRef.current = [];
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);

        // Find armed mic track to assign recording to, or create new track
        const armedTrack = tracks.find((t) => t.type === "mic" && t.recordArm && !t.audioUrl);
        if (armedTrack) {
          // Update the armed track with the recorded audio
          setTracks((prev) => prev.map((t) => t.id === armedTrack.id ? { ...t, audioBlob: blob, audioUrl: url, recordArm: false } : t));
          setTimeout(async () => {
            if (!mountedRef.current) return;
            const container = trackContainersRef.current[armedTrack.id];
            const updatedTrack = { ...armedTrack, audioBlob: blob, audioUrl: url, recordArm: false };
            if (container) await createWavesurfer(updatedTrack, container);
            await createToneNodes(updatedTrack);
          }, 100);
        } else {
          addTrack(`Recording ${ctr.current + 1}`, url, "recording", blob);
        }

        // Release mic
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start(100); // Collect data every 100ms for live updates
      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch (err) {
      alert("Microphone access denied: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [addTrack, selectedInputDevice, tracks, createWavesurfer, createToneNodes]);

  const stopRec = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRec(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Playback ──
  const playAll = useCallback(async () => {
    const Tone = await ensureTone();
    await setupMetronome();
    setTracks((prev) => { applySoloMute(prev); return prev; });

    const startOffset = currentTime;
    Object.entries(toneNodesRef.current).forEach(([, nodes]) => {
      if (nodes.player.loaded) {
        try { nodes.player.start(Tone.now(), startOffset); } catch { /* already started */ }
      }
    });

    if (metronomeOn) {
      Tone.getTransport().bpm.value = bpm;
      Tone.getTransport().start();
    }

    setPlaying(true);
    playStartRef.current = { wallTime: performance.now(), offset: startOffset };

    const tickFn = () => {
      if (!mountedRef.current || !playStartRef.current) return;
      const elapsed = (performance.now() - playStartRef.current.wallTime) / 1000;
      const ct = playStartRef.current.offset + elapsed;

      if (ct >= duration && duration > 0) {
        if (looping) {
          Object.values(toneNodesRef.current).forEach((nodes) => {
            try { nodes.player.stop(); nodes.player.start(undefined, 0); } catch { /* ok */ }
          });
          Object.values(wsRef.current).forEach((ws) => {
            try { ws.setTime(0); } catch { /* skip */ }
          });
          setCurrentTime(0);
          playStartRef.current = { wallTime: performance.now(), offset: 0 };
          animRef.current = requestAnimationFrame(tickFn);
          return;
        } else {
          if (animRef.current) cancelAnimationFrame(animRef.current);
          setPlaying(false);
          setCurrentTime(duration);
          playStartRef.current = null;
          Object.values(toneNodesRef.current).forEach((nodes) => {
            try { nodes.player.stop(); } catch { /* ok */ }
          });
          return;
        }
      }

      setCurrentTime(ct);
      Object.values(wsRef.current).forEach((ws) => {
        try { ws.setTime(ct); } catch { /* skip */ }
      });
      animRef.current = requestAnimationFrame(tickFn);
    };
    animRef.current = requestAnimationFrame(tickFn);
  }, [ensureTone, setupMetronome, applySoloMute, currentTime, metronomeOn, bpm, duration, looping]);

  const stopAll = useCallback(() => {
    Object.values(toneNodesRef.current).forEach((nodes) => {
      try { nodes.player.stop(); } catch { /* ok */ }
    });
    if (toneRef.current) {
      toneRef.current.getTransport().stop();
      toneRef.current.getTransport().position = 0;
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    playStartRef.current = null;
    setPlaying(false);
    setCurrentTime(0);
    Object.values(wsRef.current).forEach((ws) => {
      try { ws.setTime(0); } catch { /* skip */ }
    });
  }, []);

  const rewindToStart = useCallback(() => {
    setCurrentTime(0);
    Object.values(wsRef.current).forEach((ws) => {
      try { ws.setTime(0); } catch { /* skip */ }
    });
    if (playing) {
      Object.values(toneNodesRef.current).forEach((nodes) => {
        try { nodes.player.stop(); nodes.player.start(undefined, 0); } catch { /* ok */ }
      });
      playStartRef.current = { wallTime: performance.now(), offset: 0 };
    }
  }, [playing]);

  // ── Track controls ──
  const updateTrackVol = useCallback((id: number, vol: number) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, volume: vol } : t));
    const nodes = toneNodesRef.current[id];
    if (nodes) {
      const dbVol = vol > 0 ? 20 * Math.log10(vol / 100) : -Infinity;
      nodes.channel.volume.value = dbVol;
    }
  }, []);

  const updateTrackPan = useCallback((id: number, pan: number) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, pan } : t));
    const nodes = toneNodesRef.current[id];
    if (nodes) nodes.channel.pan.value = pan / 100;
  }, []);

  const toggleMute = useCallback((id: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, muted: !t.muted } : t);
      applySoloMute(next);
      return next;
    });
  }, [applySoloMute]);

  const toggleSolo = useCallback((id: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, solo: !t.solo } : t);
      applySoloMute(next);
      return next;
    });
  }, [applySoloMute]);

  const toggleRecordArm = useCallback((id: number) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, recordArm: !t.recordArm } : t));
  }, []);

  const toggleCollapsed = useCallback((id: number) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, collapsed: !t.collapsed } : t));
  }, []);

  const deleteTrack = useCallback((id: number) => {
    const ws = wsRef.current[id];
    if (ws) { try { ws.destroy(); } catch { /* ok */ } delete wsRef.current[id]; }
    const nodes = toneNodesRef.current[id];
    if (nodes) {
      try { nodes.player.stop(); } catch { /* ok */ }
      try { nodes.player.dispose(); } catch { /* ok */ }
      try { nodes.eq.dispose(); } catch { /* ok */ }
      try { nodes.distortion.dispose(); } catch { /* ok */ }
      try { nodes.chorus.dispose(); } catch { /* ok */ }
      try { nodes.delay.dispose(); } catch { /* ok */ }
      try { nodes.reverb.dispose(); } catch { /* ok */ }
      try { nodes.channel.dispose(); } catch { /* ok */ }
      delete toneNodesRef.current[id];
    }
    delete trackContainersRef.current[id];
    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (track?.audioUrl) URL.revokeObjectURL(track.audioUrl);
      return prev.filter((t) => t.id !== id);
    });
    if (fxTrackId === id) setFxTrackId(null);
    if (selectedTrackId === id) setSelectedTrackId(null);
  }, [fxTrackId, selectedTrackId]);

  // ── Effects update ──
  const updateTrackEffects = useCallback((id: number, fx: TrackEffects) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, effects: fx } : t));
    applyEffects(id, fx);
  }, [applyEffects]);

  const applyPreset = useCallback((id: number, preset: AmpPreset) => {
    const base = JSON.parse(JSON.stringify(DEFAULT_EFFECTS)) as TrackEffects;
    const merged: TrackEffects = { ...base };
    if (preset.effects.eq) merged.eq = { ...base.eq, ...preset.effects.eq };
    if (preset.effects.distortion) merged.distortion = { ...base.distortion, ...preset.effects.distortion };
    if (preset.effects.chorus) merged.chorus = { ...base.chorus, ...preset.effects.chorus };
    if (preset.effects.delay) merged.delay = { ...base.delay, ...preset.effects.delay };
    if (preset.effects.reverb) merged.reverb = { ...base.reverb, ...preset.effects.reverb };
    if (preset.effects.compressor) merged.compressor = { ...base.compressor, ...preset.effects.compressor };
    updateTrackEffects(id, merged);
  }, [updateTrackEffects]);

  // ── Import file ──
  const importFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    addTrack(file.name.replace(/\.[^.]+$/, ""), url, "import", file);
    setShowPanel("none");
  }, [addTrack]);

  // ── Drop handler ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith("audio/")) importFile(f);
    }
  }, [importFile]);

  // ── YouTube ──
  const extractVid = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  const loadYt = () => { const vid = extractVid(ytQuery); if (vid) setYtVideoId(vid); };

  // ── Suno ──
  const generateSuno = useCallback(async () => {
    setSunoLoading(true);
    setSunoError("");
    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale: sunoScale, mode: sunoMode, style: sunoStyle, bpm: sunoBpm }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.tracks) {
        data.tracks.forEach((t: { title: string; audioUrl: string }) =>
          addTrack(t.title || "AI Track", t.audioUrl, "suno")
        );
      } else {
        throw new Error("No tracks returned");
      }
      setShowPanel("none");
    } catch (err) {
      setSunoError(err instanceof Error ? err.message : "Failed to generate track");
    }
    setSunoLoading(false);
  }, [sunoScale, sunoMode, sunoStyle, sunoBpm, addTrack]);

  // ── Export/Mixdown ──
  const exportMix = useCallback(async () => {
    if (tracks.length === 0) return;
    setExporting(true);
    setExportProgress(10);
    const Tone = await ensureTone();
    const maxDur = Math.max(...tracks.map((t) => {
      const ws = wsRef.current[t.id];
      return ws ? ws.getDuration() : 0;
    }), 1);
    try {
      setExportProgress(20);
      const buffer = await Tone.Offline(async ({ transport }) => {
        const offGain = new Tone.Gain(masterVol / 100).toDestination();
        for (const track of tracks) {
          if (!track.audioUrl) continue;
          const hasSolo = tracks.some((t) => t.solo);
          const audible = hasSolo ? track.solo : !track.muted;
          if (!audible) continue;
          const player = new Tone.Player(track.audioUrl);
          const eq = new Tone.EQ3(
            track.effects.eq.enabled ? track.effects.eq.low : 0,
            track.effects.eq.enabled ? track.effects.eq.mid : 0,
            track.effects.eq.enabled ? track.effects.eq.high : 0,
          );
          const dist = new Tone.Distortion(track.effects.distortion.amount);
          dist.wet.value = track.effects.distortion.enabled ? track.effects.distortion.wet : 0;
          const ch = new Tone.Chorus(track.effects.chorus.frequency, track.effects.chorus.depth, 0);
          ch.wet.value = track.effects.chorus.enabled ? track.effects.chorus.wet : 0;
          const del = new Tone.FeedbackDelay(track.effects.delay.time, track.effects.delay.feedback);
          del.wet.value = track.effects.delay.enabled ? track.effects.delay.wet : 0;
          const rev = new Tone.Reverb(Math.max(0.1, track.effects.reverb.decay));
          rev.wet.value = track.effects.reverb.enabled ? track.effects.reverb.wet : 0;
          const chan = new Tone.Channel(
            track.volume > 0 ? 20 * Math.log10(track.volume / 100) : -Infinity,
            track.pan / 100,
          );
          player.chain(eq, dist, ch, del, rev, chan, offGain);
          await Tone.loaded();
          player.start(0);
        }
        transport.start(0);
      }, maxDur, 2, 44100);
      setExportProgress(70);
      const wavBlob = audioBufferToWav(buffer);
      setExportProgress(90);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, "-")}-${Date.now()}.wav`;
      a.click();
      setExportProgress(100);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert("Export failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setExporting(false);
    setExportProgress(0);
  }, [tracks, masterVol, ensureTone, projectName]);

  // ── WAV encoder ──
  function audioBufferToWav(buffer: { numberOfChannels: number; sampleRate: number; length: number; getChannelData: (ch: number) => Float32Array }): Blob {
    const numCh = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = buffer.length * blockAlign;
    const arrayBuf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuf);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuf], { type: "audio/wav" });
  }

  // ── Load saved recordings on mount ──
  useEffect(() => {
    idbLoadRecordings().then(setSavedRecordings).catch(() => {});
  }, []);

  // ── Save to library ──
  const saveToLibrary = useCallback(async () => {
    if (tracks.length === 0) return;
    setSavingToLibrary(true);
    const Tone = await ensureTone();
    const maxDur = Math.max(...tracks.map((t) => {
      const ws = wsRef.current[t.id];
      return ws ? ws.getDuration() : 0;
    }), 1);
    try {
      const buffer = await Tone.Offline(async ({ transport }) => {
        const offGain = new Tone.Gain(masterVol / 100).toDestination();
        for (const track of tracks) {
          if (!track.audioUrl) continue;
          const hasSolo = tracks.some((t) => t.solo);
          const audible = hasSolo ? track.solo : !track.muted;
          if (!audible) continue;
          const player = new Tone.Player(track.audioUrl);
          const eq = new Tone.EQ3(
            track.effects.eq.enabled ? track.effects.eq.low : 0,
            track.effects.eq.enabled ? track.effects.eq.mid : 0,
            track.effects.eq.enabled ? track.effects.eq.high : 0,
          );
          const dist = new Tone.Distortion(track.effects.distortion.amount);
          dist.wet.value = track.effects.distortion.enabled ? track.effects.distortion.wet : 0;
          const ch = new Tone.Chorus(track.effects.chorus.frequency, track.effects.chorus.depth, 0);
          ch.wet.value = track.effects.chorus.enabled ? track.effects.chorus.wet : 0;
          const del = new Tone.FeedbackDelay(track.effects.delay.time, track.effects.delay.feedback);
          del.wet.value = track.effects.delay.enabled ? track.effects.delay.wet : 0;
          const rev = new Tone.Reverb(Math.max(0.1, track.effects.reverb.decay));
          rev.wet.value = track.effects.reverb.enabled ? track.effects.reverb.wet : 0;
          const chan = new Tone.Channel(
            track.volume > 0 ? 20 * Math.log10(track.volume / 100) : -Infinity,
            track.pan / 100,
          );
          player.chain(eq, dist, ch, del, rev, chan, offGain);
          await Tone.loaded();
          player.start(0);
        }
        transport.start(0);
      }, maxDur, 2, 44100);
      const wavBlob = audioBufferToWav(buffer);
      const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = projectName || "Untitled";
      const meta = await idbSaveRecording(id, name, wavBlob, maxDur);
      setSavedRecordings((prev) => [meta, ...prev.filter((r) => r.id !== id)]);
      setShowRecordingsPanel(true);
    } catch (err) {
      alert("Save failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setSavingToLibrary(false);
    setShowExportMenu(false);
  }, [tracks, masterVol, ensureTone, projectName]);

  // ── Recordings panel helpers ──
  const previewRecording = useCallback(async (id: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
      previewAudioRef.current = null;
    }
    if (previewingRecId === id) {
      setPreviewingRecId(null);
      return;
    }
    const blob = await idbGetBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { setPreviewingRecId(null); URL.revokeObjectURL(url); };
    audio.play();
    previewAudioRef.current = audio;
    setPreviewingRecId(id);
  }, [previewingRecId]);

  const downloadRecording = useCallback(async (rec: SavedRecording) => {
    const blob = await idbGetBlob(rec.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rec.name.replace(/\s+/g, "-")}.${rec.format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  const removeRecording = useCallback(async (id: string) => {
    await idbDeleteRecording(id);
    setSavedRecordings((prev) => prev.filter((r) => r.id !== id));
    if (previewingRecId === id && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingRecId(null);
    }
  }, [previewingRecId]);

  const renameRecordingItem = useCallback(async (id: string, newName: string) => {
    await idbRenameRecording(id, newName);
    setSavedRecordings((prev) => prev.map((r) => r.id === id ? { ...r, name: newName } : r));
    setEditingRecId(null);
  }, []);

  const importRecordingToProject = useCallback(async (rec: SavedRecording) => {
    const blob = await idbGetBlob(rec.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    addTrack(rec.name, url, "import", blob);
  }, [addTrack]);

  const filteredRecordings = useMemo(() => {
    if (!recSearchQuery.trim()) return savedRecordings;
    const q = recSearchQuery.toLowerCase();
    return savedRecordings.filter((r) => r.name.toLowerCase().includes(q));
  }, [savedRecordings, recSearchQuery]);

  // ── Track rename ──
  const renameTrack = useCallback((id: number, name: string) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, name } : t));
  }, []);

  // ── VU meter simulation ──
  useEffect(() => {
    const tick = () => {
      if (!mountedRef.current) return;
      const levels: Record<number, number> = {};
      tracks.forEach((t) => {
        const hasSolo = tracks.some((tr) => tr.solo);
        const audible = hasSolo ? t.solo : !t.muted;
        if (playing && audible) {
          levels[t.id] = 0.3 + Math.random() * 0.5 + (t.volume / 100) * 0.2;
        } else if (isRec && t.type === "recording") {
          levels[t.id] = 0.4 + Math.random() * 0.4;
        } else {
          levels[t.id] = 0;
        }
      });
      setVuLevels(levels);
      vuAnimRef.current = requestAnimationFrame(tick);
    };
    if (playing || isRec) {
      vuAnimRef.current = requestAnimationFrame(tick);
    } else {
      setVuLevels({});
    }
    return () => { if (vuAnimRef.current) cancelAnimationFrame(vuAnimRef.current); };
  }, [playing, isRec, tracks]);

  // ── Resizable panels ──
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (sidebarDragRef.current) setSidebarWidth(Math.max(180, Math.min(400, e.clientX)));
      if (bottomDragRef.current) setBottomPanelHeight(Math.max(150, Math.min(500, window.innerHeight - e.clientY)));
    };
    const onMouseUp = () => {
      sidebarDragRef.current = false;
      bottomDragRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ── Enumerate input devices ──
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setInputDevices(inputs);
      if (inputs.length > 0 && !selectedInputDevice) setSelectedInputDevice(inputs[0].deviceId);
    }).catch(() => {});
  }, [selectedInputDevice]);

  // ── Input level meter (when monitoring) ──
  useEffect(() => {
    if (!monitoring || !mediaStreamRef.current) {
      setInputLevel(0);
      return;
    }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(mediaStreamRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      inputLevelRef.current = avg;
      setInputLevel(avg);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ctx.close(); };
  }, [monitoring]);

  // ── Track color change ──
  const changeTrackColor = useCallback((id: number, color: string) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, color } : t));
    const ws = wsRef.current[id];
    if (ws) {
      try {
        const wrapper = ws.getWrapper();
        const wave = wrapper.querySelector("wave") as HTMLElement | null;
        if (wave) wave.style.color = color;
      } catch { /* ok */ }
    }
    setColorPickerTrackId(null);
  }, []);

  // ── Selected track helpers ──
  const selectedTrack = useMemo(() =>
    selectedTrackId !== null ? tracks.find((t) => t.id === selectedTrackId) ?? null : null
  , [selectedTrackId, tracks]);

  useEffect(() => {
    if (selectedTrackId !== null && bottomTab === "none") setBottomTab("fx");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrackId]);

  // ── Measure ruler data ──
  const measures = useMemo(() => {
    const beatsPerMeasure = timeSig[0];
    const secPerBeat = 60 / bpm;
    const secPerMeasure = secPerBeat * beatsPerMeasure;
    const totalMeasures = duration > 0 ? Math.ceil(duration / secPerMeasure) + 2 : 16;
    return Array.from({ length: totalMeasures }, (_, i) => ({
      measure: i + 1,
      time: i * secPerMeasure,
      width: secPerMeasure,
    }));
  }, [bpm, duration, timeSig]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      Object.values(wsRef.current).forEach((ws) => { try { ws.destroy(); } catch { /* ok */ } });
      if (recWsRef.current) { try { recWsRef.current.destroy(); } catch { /* ok */ } }
      Object.values(toneNodesRef.current).forEach((nodes) => {
        try { nodes.player.stop(); } catch { /* ok */ }
        try { nodes.player.dispose(); } catch { /* ok */ }
        try { nodes.eq.dispose(); } catch { /* ok */ }
        try { nodes.distortion.dispose(); } catch { /* ok */ }
        try { nodes.chorus.dispose(); } catch { /* ok */ }
        try { nodes.delay.dispose(); } catch { /* ok */ }
        try { nodes.reverb.dispose(); } catch { /* ok */ }
        try { nodes.channel.dispose(); } catch { /* ok */ }
      });
      if (metronomeRef.current) {
        try { metronomeRef.current.loop.dispose(); } catch { /* ok */ }
        try { metronomeRef.current.synth.dispose(); } catch { /* ok */ }
        try { metronomeRef.current.gain.dispose(); } catch { /* ok */ }
      }
      if (masterGainRef.current) { try { masterGainRef.current.dispose(); } catch { /* ok */ } }
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { try { mediaRecorderRef.current.stop(); } catch { /* ok */ } }
      if (recLevelAnimRef.current) cancelAnimationFrame(recLevelAnimRef.current);
      if (recAudioCtxRef.current) { try { recAudioCtxRef.current.close(); } catch { /* ok */ } }
    };
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case " ": e.preventDefault(); playing ? stopAll() : playAll(); break;
        case "r": if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); isRec ? stopRec() : startRec(); } break;
        case "m": if (!e.ctrlKey) { e.preventDefault(); setupMetronome().then(() => setMetronomeOn((p) => !p)); } break;
        case "c": if (!e.ctrlKey) { e.preventDefault(); setLooping((p) => !p); } break;
        case "g": if (!e.ctrlKey) { e.preventDefault(); setSnapToGrid((p) => !p); } break;
        case "enter": e.preventDefault(); rewindToStart(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playing, stopAll, playAll, isRec, stopRec, startRec, setupMetronome, rewindToStart]);

  const fxTrack = selectedTrack ?? (fxTrackId !== null ? tracks.find((t) => t.id === fxTrackId) ?? null : null);
  const pxPerSec = 20 + (zoom / 100) * 300;

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none" style={{ background: "#0a0a0a", fontFamily: "'Inter', system-ui, sans-serif" }} dir="ltr">
      {/* ═══════════════════ TOP BAR ═══════════════════ */}
      <div className="flex items-center h-11 px-3 gap-2 border-b flex-shrink-0" style={{ background: "#111111", borderColor: "#1e1e1e" }}>
        {/* Left: Project Name */}
        <div className="flex items-center gap-2 min-w-[140px]">
          {editingProjectName ? (
            <input autoFocus value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setEditingProjectName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingProjectName(false)}
              className="bg-[#1a1a1a] border border-[#f59e0b] rounded px-2 py-0.5 text-xs text-[#eee] outline-none w-32"
            />
          ) : (
            <span className="text-xs text-[#ccc] font-medium cursor-pointer hover:text-[#f59e0b] transition-colors truncate max-w-[160px]"
              onClick={() => setEditingProjectName(true)}>
              {projectName}
            </span>
          )}
        </div>

        {/* Left-center: Metronome + BPM + Time Sig */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: "#0e0e0e" }}>
          {/* Metronome */}
          <div className="relative">
            <button onClick={async () => { await setupMetronome(); setMetronomeOn(!metronomeOn); }}
              title="Metronome (M)"
              className={`w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer ${metronomeOn ? "text-[#f59e0b] bg-[#f59e0b15]" : "text-[#555] hover:text-[#888]"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L8 22h8L12 2z"/><path d="M12 8l6-3"/></svg>
            </button>
            <button onClick={() => setShowMetronomeSettings(!showMetronomeSettings)}
              className="absolute -right-1 -bottom-0.5 w-3 h-3 rounded-full bg-[#1a1a1a] border border-[#333] text-[#555] text-[6px] flex items-center justify-center cursor-pointer hover:border-[#555]">
              &#9662;
            </button>
            {showMetronomeSettings && (
              <div className="absolute top-9 left-0 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl p-3 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                <div className="text-[9px] text-[#888] mb-2 font-medium">Metronome Settings</div>
                <label className="flex items-center gap-2 text-[9px] text-[#666]">
                  Volume
                  <input type="range" min={0} max={100} value={metronomeVol}
                    onChange={(e) => setMetronomeVol(Number(e.target.value))}
                    className="flex-1 accent-[#f59e0b] h-1" />
                  <span className="text-[#888] w-6 text-right">{metronomeVol}</span>
                </label>
                <button onClick={() => setShowMetronomeSettings(false)} className="mt-2 text-[8px] text-[#555] hover:text-[#888] cursor-pointer">Close</button>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-[#222]" />

          {/* BPM */}
          <div className="flex items-center gap-1">
            <input type="number" min={40} max={300} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-11 h-6 bg-transparent border border-[#2a2a2a] rounded text-[#f59e0b] text-[11px] text-center font-mono focus:border-[#f59e0b] outline-none hover:border-[#444] transition-colors" />
            <span className="text-[9px] text-[#444] font-medium">bpm</span>
          </div>

          <div className="w-px h-5 bg-[#222]" />

          {/* Time Signature */}
          <div className="relative">
            <button onClick={() => setShowTimeSigPicker(!showTimeSigPicker)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono text-[#aaa] hover:text-[#ccc] hover:bg-[#1a1a1a] transition-colors cursor-pointer">
              <span>{timeSig[0]}</span>
              <span className="text-[#444]">/</span>
              <span>{timeSig[1]}</span>
            </button>
            {showTimeSigPicker && (
              <div className="absolute top-8 left-0 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl py-1 min-w-[64px]">
                {TIME_SIGS.map(([n, d], idx) => (
                  <button key={idx} onClick={() => { setTimeSigIdx(idx); setShowTimeSigPicker(false); }}
                    className={`w-full text-center text-[11px] font-mono px-3 py-1 cursor-pointer transition-colors ${idx === timeSigIdx ? "text-[#f59e0b] bg-[#f59e0b11]" : "text-[#888] hover:bg-[#222] hover:text-[#ccc]"}`}>
                    {n}/{d}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-[#222]" />

          {/* Key */}
          <div className="relative">
            <button onClick={() => setShowKeyPicker(!showKeyPicker)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-[#aaa] hover:text-[#ccc] hover:bg-[#1a1a1a] transition-colors cursor-pointer">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <span>{projectKey}</span>
            </button>
            {showKeyPicker && (
              <div className="absolute top-8 left-0 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl p-2 min-w-[140px]">
                <div className="text-[8px] text-[#555] mb-1.5 font-medium uppercase tracking-wider">Project Key</div>
                <div className="grid grid-cols-4 gap-0.5 mb-2">
                  {MUSICAL_KEYS.map((k) => (
                    <button key={k} onClick={() => { setProjectKey(k + (projectKey.includes("m") ? "m" : "")); }}
                      className={`text-[9px] py-0.5 rounded cursor-pointer transition-colors ${projectKey.startsWith(k) ? "bg-[#f59e0b] text-[#111] font-bold" : "text-[#888] hover:bg-[#222]"}`}>{k}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {MUSICAL_MODES.map((m) => (
                    <button key={m} onClick={() => { setProjectKey(projectKey.replace(/[A-G]#?/, "$&") + (m === "Minor" ? "m" : "")); setShowKeyPicker(false); }}
                      className="text-[8px] py-0.5 rounded text-[#666] hover:bg-[#222] hover:text-[#aaa] cursor-pointer transition-colors">{m}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Transport Controls */}
        <div className="flex-1 flex items-center justify-center gap-1.5">
          {/* Rewind */}
          <button onClick={rewindToStart} title={`Rewind (${SHORTCUT_HINTS.rewind})`}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer group hover:shadow-[0_0_10px_rgba(255,255,255,0.06)]"
            style={{ background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)", border: "1px solid #333", boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#888] group-hover:text-[#ccc] transition-colors">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          {/* Stop */}
          <button onClick={stopAll} title="Stop"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer group hover:shadow-[0_0_10px_rgba(255,255,255,0.06)]"
            style={{ background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)", border: "1px solid #333", boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            <div className="w-3 h-3 rounded-[2px] bg-[#888] group-hover:bg-[#ccc] transition-colors" />
          </button>

          {/* Play */}
          {!playing ? (
            <button onClick={playAll} title={`Play (${SHORTCUT_HINTS.play})`}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer group hover:shadow-[0_0_14px_rgba(34,197,94,0.25)]"
              disabled={tracks.length === 0}
              style={{
                background: tracks.length > 0 ? "linear-gradient(180deg, #2a8a2a 0%, #1a6a1a 100%)" : "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)",
                border: tracks.length > 0 ? "1px solid #33aa33" : "1px solid #333",
                boxShadow: tracks.length > 0 ? "0 0 12px rgba(34,197,94,0.2), 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" : "0 2px 4px rgba(0,0,0,0.3)",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={`ml-0.5 ${tracks.length > 0 ? "text-[#4ade80]" : "text-[#555]"} group-hover:text-white transition-colors`}>
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          ) : (
            <button onClick={stopAll} title={`Pause (${SHORTCUT_HINTS.play})`}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer hover:shadow-[0_0_14px_rgba(34,197,94,0.3)]"
              style={{
                background: "linear-gradient(180deg, #2a8a2a 0%, #1a6a1a 100%)",
                border: "1px solid #22c55e",
                boxShadow: "0 0 16px rgba(34,197,94,0.3), 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
              </svg>
            </button>
          )}

          {/* Record */}
          {!isRec ? (
            <button onClick={startRec} title={`Record (${SHORTCUT_HINTS.record})`}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer group hover:shadow-[0_0_12px_rgba(196,30,58,0.3)]"
              style={{
                background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)",
                border: "1px solid #333",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}>
              <div className="w-3.5 h-3.5 rounded-full group-hover:brightness-125 transition-all" style={{ background: "radial-gradient(circle at 40% 35%, #ff4466 0%, #C41E3A 50%, #8a1525 100%)" }} />
            </button>
          ) : (
            <button onClick={stopRec} title="Stop Recording"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              style={{
                background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)",
                border: "1px solid #ee3355",
                boxShadow: "0 0 16px rgba(196,30,58,0.5), 0 0 32px rgba(196,30,58,0.2), 0 2px 4px rgba(0,0,0,0.3)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
              <div className="w-3.5 h-3.5 rounded-full" style={{ background: "radial-gradient(circle at 40% 35%, #ff6688 0%, #ee3355 40%, #C41E3A 100%)", boxShadow: "0 0 8px rgba(238,51,85,0.6)" }} />
            </button>
          )}

          {/* Loop */}
          <button onClick={() => setLooping(!looping)} title={`Loop (${SHORTCUT_HINTS.loop})`}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer hover:shadow-[0_0_10px_rgba(245,158,11,0.15)] ${looping ? "shadow-[0_0_10px_rgba(245,158,11,0.25)]" : ""}`}
            style={{
              background: looping ? "linear-gradient(180deg, #3a3020 0%, #2a2010 100%)" : "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)",
              border: looping ? "1px solid #f59e0b66" : "1px solid #333",
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={looping ? "#f59e0b" : "#666"} strokeWidth="2" style={looping ? { filter: "drop-shadow(0 0 3px rgba(245,158,11,0.4))" } : {}}>
              <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-[#222] mx-1" />

          {/* Time Display — segment-display style */}
          <div className="px-3 py-1 rounded font-mono text-sm flex items-center min-w-[120px] justify-center relative overflow-hidden"
            style={{ background: "#050505", border: "1px solid #1a1a1a", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)" }}>
            <span className="text-[#f59e0b33] absolute tracking-[2px]" style={{ fontFamily: "'Courier New', monospace", fontSize: "15px" }}>88:88.8</span>
            <span className="text-[#f59e0b] relative tracking-[2px]" style={{ fontFamily: "'Courier New', monospace", fontSize: "15px", textShadow: "0 0 8px rgba(245,158,11,0.4), 0 0 2px rgba(245,158,11,0.6)" }}>{fmtTime(currentTime)}</span>
          </div>

          {/* Recording indicator */}
          {isRec && (
            <div className="flex items-center gap-1.5 ml-1">
              <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
              <span className="font-mono text-xs text-[#C41E3A]">{fmtTime(recTime)}</span>
            </div>
          )}
        </div>

        {/* Right: Master volume + Export */}
        <div className="flex items-center gap-3 min-w-[260px] justify-end">
          {/* Master volume */}
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className="flex-shrink-0">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
            </svg>
            <input type="range" min={0} max={100} value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="w-20 accent-[#f59e0b] h-1 cursor-pointer" />
            <span className="font-mono text-[9px] text-[#666] w-12 text-right">{dbDisplay(masterVol)} dB</span>
          </div>

          <div className="w-px h-5 bg-[#222]" />

          {/* Export dropdown */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={tracks.length === 0}
              title="Export / Save"
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              style={{
                background: tracks.length > 0 ? "linear-gradient(180deg, #f59e0b 0%, #d48a08 100%)" : "transparent",
                color: tracks.length > 0 ? "#111" : "#555",
                border: tracks.length > 0 ? "none" : "1px solid #333",
                boxShadow: tracks.length > 0 ? "0 2px 8px rgba(245,158,11,0.2)" : "none",
              }}>
              {exporting ? `${exportProgress}%` : "Export"}
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
            {showExportMenu && (
              <div className="absolute top-9 right-0 z-50 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[180px]"
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { saveToLibrary(); }}
                  disabled={savingToLibrary}
                  className="w-full text-left text-[10px] text-[#ccc] hover:bg-[#2a2a2a] px-3 py-2 cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50">
                  <span className="text-[14px]">{savingToLibrary ? "\u23F3" : "\uD83D\uDCBE"}</span>
                  <div>
                    <div className="font-medium">{savingToLibrary ? "Saving..." : "Save to Library"}</div>
                    <div className="text-[8px] text-[#666]">Save to recordings library</div>
                  </div>
                </button>
                <button onClick={() => { exportMix(); setShowExportMenu(false); }}
                  disabled={exporting}
                  className="w-full text-left text-[10px] text-[#ccc] hover:bg-[#2a2a2a] px-3 py-2 cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50">
                  <span className="text-[14px]">{exporting ? "\u23F3" : "\uD83D\uDCE5"}</span>
                  <div className="flex-1">
                    <div className="font-medium">{exporting ? "Exporting..." : "Download WAV"}</div>
                    <div className="text-[8px] text-[#666]">{exporting ? `${exportProgress}%` : "Export and download file"}</div>
                    {exporting && (
                      <div className="w-full h-[3px] bg-[#222] rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-[#f59e0b] rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Recordings panel toggle */}
          <button onClick={() => { setShowRecordingsPanel(!showRecordingsPanel); if (!showRecordingsPanel) setShowRightPanel(false); }}
            className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors relative ${showRecordingsPanel ? "text-[#f59e0b] bg-[#f59e0b11]" : "text-[#555] hover:text-[#888]"}`}
            title="My Recordings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
            </svg>
            {savedRecordings.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#f59e0b] text-[#111] text-[6px] font-bold rounded-full flex items-center justify-center">{savedRecordings.length > 9 ? "9+" : savedRecordings.length}</span>
            )}
          </button>

          {/* Right panel toggle */}
          <button onClick={() => { setShowRightPanel(!showRightPanel); if (!showRightPanel) setShowRecordingsPanel(false); }}
            className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${showRightPanel ? "text-[#f59e0b] bg-[#f59e0b11]" : "text-[#555] hover:text-[#888]"}`}
            title="Import Sources">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ═══════════════════ MAIN LAYOUT ═══════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ═══════════════════ LEFT SIDEBAR: Track List ═══════════════════ */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: sidebarWidth, background: "#141414", borderRight: "1px solid #1e1e1e" }}>
          {/* Sidebar header with Add Track */}
          <div className="flex items-center h-[26px] px-2 gap-1 flex-shrink-0" style={{ background: "#181818", borderBottom: "1px solid #1e1e1e" }}>
            <div className="relative">
              <button onClick={() => setShowAddTrackMenu(!showAddTrackMenu)}
                className="flex items-center gap-1 text-[9px] text-[#888] hover:text-[#f59e0b] transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#f59e0b08]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                <span>Add Track</span>
              </button>
              {showAddTrackMenu && (
                <div className="absolute top-7 left-0 z-50 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[180px]"
                  onClick={(e) => e.stopPropagation()}>
                  <button onClick={addMicTrack}
                    className="w-full text-left text-[10px] text-[#ccc] hover:bg-[#2a2a2a] px-3 py-2 cursor-pointer transition-colors flex items-center gap-2.5">
                    <span className="text-[14px]">&#127908;</span>
                    <div>
                      <div className="font-medium">Record</div>
                      <div className="text-[8px] text-[#666]">Mic / Audio Interface</div>
                    </div>
                  </button>
                  <button onClick={() => { fileRef.current?.click(); setShowAddTrackMenu(false); }}
                    className="w-full text-left text-[10px] text-[#ccc] hover:bg-[#2a2a2a] px-3 py-2 cursor-pointer transition-colors flex items-center gap-2.5">
                    <span className="text-[14px]">&#128193;</span>
                    <div>
                      <div className="font-medium">Upload File</div>
                      <div className="text-[8px] text-[#666]">WAV, MP3, OGG, FLAC</div>
                    </div>
                  </button>
                  <button onClick={addYoutubeTrack}
                    className="w-full text-left text-[10px] text-[#ccc] hover:bg-[#2a2a2a] px-3 py-2 cursor-pointer transition-colors flex items-center gap-2.5">
                    <span className="text-[14px]">&#128279;</span>
                    <div>
                      <div className="font-medium">YouTube / URL</div>
                      <div className="text-[8px] text-[#666]">Import from link</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg,audio/flac,audio/*" className="hidden" multiple
              onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach((f) => importFile(f)); }} />

            <div className="flex-1" />

            {/* Snap */}
            <button onClick={() => setSnapToGrid(!snapToGrid)} title="Snap to Grid (G)"
              className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer text-[8px] transition-colors ${snapToGrid ? "text-[#f59e0b] bg-[#f59e0b11]" : "text-[#444]"}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          </div>

          {/* Track entries */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
            {tracks.map((tr, idx) => {
              const isSelected = selectedTrackId === tr.id;
              const level = vuLevels[tr.id] ?? 0;
              return (
                <div key={tr.id}
                  className={`relative transition-colors cursor-pointer ${isSelected ? "bg-[#1c1c14]" : "hover:bg-[#1a1a1a]"}`}
                  onClick={() => setSelectedTrackId(tr.id)}
                  onContextMenu={(e) => { e.preventDefault(); setColorPickerTrackId(colorPickerTrackId === tr.id ? null : tr.id); }}
                  style={{
                    borderLeft: `3px solid ${isSelected ? tr.color : tr.color + "aa"}`,
                    borderBottom: "1px solid #1a1a1a",
                    boxShadow: isSelected ? `inset 4px 0 16px -4px ${tr.color}55, inset 0 0 0 1px ${tr.color}11` : "none",
                  }}>
                  {/* Row 1: Icon + Track Name + Gear + Menu */}
                  <div className="flex items-center gap-1 px-2 pt-1.5 pb-0.5">
                    <span className="font-mono text-[7px] text-[#333] w-3 text-center flex-shrink-0 leading-none">{String(idx + 1).padStart(2, "0")}</span>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tr.color }} />

                    {editingTrackName === tr.id ? (
                      <input autoFocus defaultValue={tr.name}
                        onBlur={(e) => { renameTrack(tr.id, e.target.value || tr.name); setEditingTrackName(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { renameTrack(tr.id, (e.target as HTMLInputElement).value || tr.name); setEditingTrackName(null); } }}
                        className="flex-1 bg-[#0a0a0a] border border-[#f59e0b] rounded px-1 py-0 text-[10px] text-[#ccc] outline-none min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={`flex-1 text-[10px] truncate min-w-0 font-medium ${isSelected ? "text-[#ccc]" : "text-[#999]"}`}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTrackName(tr.id); }}>
                        {tr.name}
                      </span>
                    )}

                    {/* Gear icon for mic/recording tracks */}
                    {(tr.type === "mic" || tr.type === "recording") && (
                      <button onClick={(e) => { e.stopPropagation(); setInputSettingsTrackId(inputSettingsTrackId === tr.id ? null : tr.id); }}
                        className={`w-4 h-4 flex items-center justify-center cursor-pointer transition-colors rounded hover:bg-[#ffffff08] ${inputSettingsTrackId === tr.id ? "text-[#f59e0b]" : "text-[#3a3a3a] hover:text-[#888]"}`}
                        title="Input Settings">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                      </button>
                    )}

                    {/* Menu (...) */}
                    <button onClick={(e) => { e.stopPropagation(); setTrackMenuId(trackMenuId === tr.id ? null : tr.id); }}
                      className="text-[#3a3a3a] hover:text-[#888] text-[10px] w-5 h-4 flex items-center justify-center cursor-pointer transition-colors rounded hover:bg-[#ffffff08]"
                      title="More actions">&#8943;</button>

                    {/* Collapse toggle */}
                    <button onClick={(e) => { e.stopPropagation(); toggleCollapsed(tr.id); }}
                      className="text-[#3a3a3a] hover:text-[#888] text-[9px] cursor-pointer w-4 h-4 flex items-center justify-center transition-colors"
                      title="Collapse">
                      {tr.collapsed ? "\u25B6" : "\u25BC"}
                    </button>
                  </div>

                  {/* Row 2: M S Fx RecArm VU ── Volume ── Pan */}
                  {!tr.collapsed && (
                    <>
                      <div className="flex items-center gap-1 px-2 py-0.5">
                        {/* Mute */}
                        <button onClick={(e) => { e.stopPropagation(); toggleMute(tr.id); }}
                          className={`text-[7px] font-bold w-[18px] h-[15px] rounded-[3px] cursor-pointer flex items-center justify-center transition-all ${tr.muted ? "bg-[#3b82f6] text-white shadow-[0_0_4px_rgba(59,130,246,0.3)]" : "bg-transparent border border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]"}`}
                          title="Mute">
                          M
                        </button>
                        {/* Solo */}
                        <button onClick={(e) => { e.stopPropagation(); toggleSolo(tr.id); }}
                          className={`text-[7px] font-bold w-[18px] h-[15px] rounded-[3px] cursor-pointer flex items-center justify-center transition-all ${tr.solo ? "bg-[#f59e0b] text-[#111] shadow-[0_0_4px_rgba(245,158,11,0.3)]" : "bg-transparent border border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]"}`}
                          title="Solo">
                          S
                        </button>
                        {/* Fx */}
                        <button onClick={(e) => { e.stopPropagation(); setFxTrackId(fxTrackId === tr.id ? null : tr.id); setSelectedTrackId(tr.id); setBottomTab("fx"); }}
                          className={`text-[7px] font-medium px-1 h-[15px] rounded-[3px] cursor-pointer flex items-center justify-center transition-all ${fxTrackId === tr.id ? "bg-[#8b5cf6] text-white" : "bg-transparent border border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]"}`}
                          title="Effects">
                          Fx
                        </button>
                        {/* Record arm */}
                        <button onClick={(e) => { e.stopPropagation(); toggleRecordArm(tr.id); }}
                          className={`w-[15px] h-[15px] rounded-full cursor-pointer flex items-center justify-center transition-all ${tr.recordArm ? "shadow-[0_0_8px_rgba(196,30,58,0.5)]" : "hover:border-[#555]"}`}
                          style={tr.recordArm ? { background: "radial-gradient(circle at 40% 35%, #ff4466, #C41E3A)", animation: "pulse 2s ease-in-out infinite" } : { background: "transparent", border: "1px solid #333" }}
                          title="Record Arm">
                          {!tr.recordArm && <div className="w-1.5 h-1.5 rounded-full bg-[#444]" />}
                        </button>

                        {/* Mini VU meter */}
                        <div className="w-8 h-[4px] bg-[#080808] rounded-[1px] overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                          <div className="h-full transition-all duration-75 rounded-[1px]" style={{
                            width: `${Math.min(100, level * 100)}%`,
                            background: level > 0.85 ? "linear-gradient(90deg, #22c55e 0%, #eab308 60%, #ef4444 100%)"
                              : level > 0.6 ? "linear-gradient(90deg, #22c55e 0%, #eab308 100%)"
                              : "#22c55e",
                          }} />
                        </div>
                      </div>

                      {/* Volume slider + Pan indicator */}
                      <div className="flex items-center gap-1 px-2 pb-1">
                        <input type="range" min={0} max={100} value={tr.volume}
                          onChange={(e) => { e.stopPropagation(); updateTrackVol(tr.id, Number(e.target.value)); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 accent-[#888] h-[3px] cursor-pointer" style={{ accentColor: tr.color }} />
                        <span className="font-mono text-[7px] text-[#555] w-7 text-right whitespace-nowrap">
                          {tr.pan === 0 ? "C" : tr.pan < 0 ? `L${Math.abs(tr.pan)}` : `R${tr.pan}`}
                        </span>
                      </div>

                      {/* Per-track input settings panel (gear icon) */}
                      {inputSettingsTrackId === tr.id && (tr.type === "mic" || tr.type === "recording") && (
                        <div className="mx-2 mb-1.5 p-2 rounded-md space-y-1.5" style={{ background: "#0e0e0e", border: "1px solid #222" }}
                          onClick={(e) => e.stopPropagation()}>
                          <div className="text-[8px] text-[#666] font-medium uppercase tracking-wider mb-1">Input Settings</div>
                          <label className="block">
                            <span className="text-[7px] text-[#555]">Input Device</span>
                            <select value={tr.inputSettings?.deviceId || selectedInputDevice}
                              onChange={(e) => {
                                const did = e.target.value;
                                setTracks((p) => p.map((t) => t.id === tr.id ? { ...t, inputSettings: { ...(t.inputSettings || { deviceId: "", channel: "stereo" as const, gain: 100, monitoring: false }), deviceId: did } } : t));
                              }}
                              className="w-full bg-[#151515] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[9px] text-[#aaa] outline-none cursor-pointer">
                              {inputDevices.map((d) => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Device (${d.deviceId.slice(0, 8)}...)`}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[7px] text-[#555]">Channel</span>
                            <select value={tr.inputSettings?.channel || "stereo"}
                              onChange={(e) => {
                                const ch = e.target.value as "mono-l" | "mono-r" | "stereo";
                                setTracks((p) => p.map((t) => t.id === tr.id ? { ...t, inputSettings: { ...(t.inputSettings || { deviceId: "", channel: "stereo" as const, gain: 100, monitoring: false }), channel: ch } } : t));
                              }}
                              className="w-full bg-[#151515] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[9px] text-[#aaa] outline-none cursor-pointer">
                              <option value="mono-l">Mono L</option>
                              <option value="mono-r">Mono R</option>
                              <option value="stereo">Stereo</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[7px] text-[#555]">Input Gain</span>
                            <div className="flex items-center gap-1">
                              <input type="range" min={0} max={200} value={tr.inputSettings?.gain ?? 100}
                                onChange={(e) => {
                                  const g = Number(e.target.value);
                                  setTracks((p) => p.map((t) => t.id === tr.id ? { ...t, inputSettings: { ...(t.inputSettings || { deviceId: "", channel: "stereo" as const, gain: 100, monitoring: false }), gain: g } } : t));
                                }}
                                className="flex-1 accent-[#f59e0b] h-[2px] cursor-pointer" />
                              <span className="text-[7px] text-[#666] font-mono w-6 text-right">{tr.inputSettings?.gain ?? 100}%</span>
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-[7px] text-[#555]">Monitor</span>
                            <button onClick={() => {
                              const cur = tr.inputSettings?.monitoring ?? false;
                              setTracks((p) => p.map((t) => t.id === tr.id ? { ...t, inputSettings: { ...(t.inputSettings || { deviceId: "", channel: "stereo" as const, gain: 100, monitoring: false }), monitoring: !cur } } : t));
                            }}
                              className={`w-7 h-[14px] rounded-full transition-all cursor-pointer relative ${tr.inputSettings?.monitoring ? "bg-[#f59e0b]" : "bg-[#2a2a2a]"}`}>
                              <div className={`absolute top-[2px] w-[10px] h-[10px] rounded-full bg-white transition-all shadow-sm ${tr.inputSettings?.monitoring ? "left-[13px]" : "left-[2px]"}`} />
                            </button>
                          </div>
                          {/* Input level meter */}
                          <div className="flex items-center gap-1">
                            <span className="text-[7px] text-[#555]">Level</span>
                            <div className="flex-1 h-[4px] bg-[#080808] rounded-[1px] overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                              <div className="h-full transition-all duration-75 rounded-[1px]" style={{
                                width: `${Math.min(100, (isRec && tr.recordArm ? 0.4 + Math.random() * 0.4 : 0) * 100)}%`,
                                background: "linear-gradient(90deg, #22c55e 0%, #eab308 70%, #ef4444 100%)",
                              }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Color picker (on right-click) */}
                  {colorPickerTrackId === tr.id && (
                    <div className="absolute top-0 right-2 z-50 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl p-2 min-w-[90px]"
                      onClick={(e) => e.stopPropagation()}>
                      <div className="text-[8px] text-[#555] mb-1.5 font-medium">Track Color</div>
                      <div className="grid grid-cols-4 gap-1">
                        {TRACK_COLORS.map((c) => (
                          <button key={c} onClick={() => changeTrackColor(tr.id, c)}
                            className={`w-5 h-5 rounded-full cursor-pointer transition-all hover:scale-110 ${tr.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-[#1e1e1e]" : ""}`}
                            style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Context menu */}
                  {trackMenuId === tr.id && (
                    <div className="absolute top-8 right-2 z-50 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[130px]"
                      onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditingTrackName(tr.id); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#2a2a2a] px-3 py-1.5 cursor-pointer transition-colors">Rename</button>
                      <button onClick={() => { setColorPickerTrackId(tr.id); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#2a2a2a] px-3 py-1.5 cursor-pointer transition-colors">Change Color</button>
                      <button onClick={() => { updateTrackPan(tr.id, 0); updateTrackVol(tr.id, 100); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#2a2a2a] px-3 py-1.5 cursor-pointer transition-colors">Reset Controls</button>
                      <button onClick={() => { const newTr = [...tracks]; const i = newTr.findIndex((t) => t.id === tr.id); if (i > 0) { [newTr[i-1], newTr[i]] = [newTr[i], newTr[i-1]]; setTracks(newTr); } setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#2a2a2a] px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-30"
                        disabled={idx === 0}>Move Up</button>
                      <button onClick={() => { const newTr = [...tracks]; const i = newTr.findIndex((t) => t.id === tr.id); if (i < newTr.length - 1) { [newTr[i], newTr[i+1]] = [newTr[i+1], newTr[i]]; setTracks(newTr); } setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#2a2a2a] px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-30"
                        disabled={idx === tracks.length - 1}>Move Down</button>
                      <div className="border-t border-[#2a2a2a] my-1" />
                      <button onClick={() => { deleteTrack(tr.id); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#C41E3A] hover:bg-[#1a0a0a] px-3 py-1.5 cursor-pointer transition-colors">Delete Track</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Master track section at bottom — visually distinct */}
          <div style={{ background: "linear-gradient(180deg, #181614 0%, #141210 100%)", borderTop: "2px solid #f59e0b22" }}>
            <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "radial-gradient(circle at 40% 35%, #fbbf24, #f59e0b, #d48a08)", boxShadow: "0 0 6px rgba(245,158,11,0.3)" }} />
              <span className="text-[9px] text-[#f59e0b] font-bold tracking-wider uppercase">Master Track</span>
              <div className="flex-1" />
              {/* Stereo Master VU */}
              <div className="flex gap-[2px]">
                <div className="w-[5px] h-[14px] bg-[#080808] rounded-[1px] overflow-hidden flex flex-col-reverse" style={{ border: "1px solid #1a1a1a" }}>
                  <div className="w-full transition-all duration-75" style={{
                    height: `${playing || isRec ? Math.min(100, (masterVol / 100) * 60 + Math.random() * 30) : 0}%`,
                    background: "linear-gradient(0deg, #22c55e 0%, #eab308 65%, #ef4444 100%)",
                  }} />
                </div>
                <div className="w-[5px] h-[14px] bg-[#080808] rounded-[1px] overflow-hidden flex flex-col-reverse" style={{ border: "1px solid #1a1a1a" }}>
                  <div className="w-full transition-all duration-75" style={{
                    height: `${playing || isRec ? Math.min(100, (masterVol / 100) * 55 + Math.random() * 28) : 0}%`,
                    background: "linear-gradient(0deg, #22c55e 0%, #eab308 65%, #ef4444 100%)",
                  }} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 pb-2">
              <input type="range" min={0} max={100} value={masterVol}
                onChange={(e) => setMasterVol(Number(e.target.value))}
                className="flex-1 accent-[#f59e0b] h-[3px] cursor-pointer" />
              <span className="font-mono text-[8px] text-[#f59e0b] w-7 text-right">{dbDisplay(masterVol)}</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════ Sidebar Resize Handle ═══════════════════ */}
        <div
          className="w-[3px] cursor-col-resize hover:bg-[#f59e0b33] active:bg-[#f59e0b55] transition-colors flex-shrink-0"
          style={{ background: "#1a1a1a" }}
          onMouseDown={() => { sidebarDragRef.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
        />

        {/* ═══════════════════ CENTER: Timeline + Bottom Panel ═══════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Measure ruler */}
          <div className="h-[28px] flex-shrink-0 overflow-hidden relative" style={{ background: "#1a1a1a", borderBottom: "1px solid #252525" }}>
            <div className="absolute top-0 left-0 h-full flex">
              {measures.map((m) => (
                <div key={m.measure} className="relative h-full" style={{ width: `${pxPerSec * m.width}px`, borderRight: "1px solid #2a2a2a" }}>
                  <span className="absolute top-1 left-2 font-mono text-[9px] text-[#666] font-semibold">{m.measure}</span>
                  {/* Beat ticks — show subdivisions when zoomed in */}
                  {Array.from({ length: timeSig[0] * (zoom > 60 ? 2 : 1) }).map((_, bi) => {
                    const isBeat = bi % (zoom > 60 ? 2 : 1) === 0;
                    const isDownbeat = bi === 0;
                    return (
                      <div key={bi} className="absolute bottom-0" style={{ left: `${(bi / (timeSig[0] * (zoom > 60 ? 2 : 1))) * 100}%` }}>
                        <div className="absolute bottom-0 w-px" style={{
                          height: isDownbeat ? "10px" : isBeat ? "6px" : "3px",
                          background: isDownbeat ? "#555" : isBeat ? "#333" : "#252525",
                        }} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Playhead on ruler */}
            <div className="absolute top-0 h-full z-10 pointer-events-none" style={{ left: `${currentTime * pxPerSec}px` }}>
              <div className="w-px h-full bg-[#f59e0b]" style={{ boxShadow: "0 0 4px rgba(245,158,11,0.3)" }} />
              <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-[#f59e0b]" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", filter: "drop-shadow(0 1px 2px rgba(245,158,11,0.4))" }} />
            </div>
          </div>

          {/* Zoom bar */}
          <div className="h-5 flex items-center px-2 gap-2 flex-shrink-0" style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
            <button onClick={() => setZoom(Math.max(0, zoom - 10))} className="text-[#555] hover:text-[#888] text-xs cursor-pointer transition-colors">-</button>
            <input type="range" min={0} max={100} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 accent-[#555] h-[2px] cursor-pointer" />
            <button onClick={() => setZoom(Math.min(100, zoom + 10))} className="text-[#555] hover:text-[#888] text-xs cursor-pointer transition-colors">+</button>
            <div className="flex-1" />
            <span className="text-[8px] text-[#333] font-mono">{tracks.length} tracks</span>
          </div>

          {/* Track waveforms area */}
          <div className="flex-1 overflow-auto relative" style={{ background: "#0c0c0c" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}>
            {/* Recording live level meter */}
            {isRec && (
              <div style={{ borderLeft: "3px solid #C41E3A", borderBottom: "1px solid #1a1a1a" }}>
                <div className="flex items-center gap-2 px-2 py-1" style={{ background: "#15090a" }}>
                  <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
                  <span className="text-[9px] text-[#C41E3A] font-medium">Recording...</span>
                  <span className="font-mono text-[9px] text-[#C41E3A]">{fmtTime(recTime)}</span>
                </div>
                <div className="min-h-[56px] flex items-center px-3 gap-2" style={{ background: "#0a0808" }}>
                  {/* Live level bar */}
                  <div className="flex-1 h-6 rounded overflow-hidden relative" style={{ background: "#111" }}>
                    <div
                      className="h-full rounded transition-all duration-75"
                      style={{
                        width: `${Math.min(100, recLevel * 100)}%`,
                        background: recLevel > 0.8 ? "linear-gradient(90deg, #22c55e 0%, #f59e0b 60%, #ef4444 100%)" : recLevel > 0.4 ? "linear-gradient(90deg, #22c55e 0%, #f59e0b 100%)" : "linear-gradient(90deg, #22c55e 0%, #22c55e 100%)",
                        boxShadow: recLevel > 0.1 ? `0 0 8px rgba(34,197,94,${recLevel * 0.5})` : "none",
                      }}
                    />
                    {/* Grid lines */}
                    {[25, 50, 75].map((p) => (
                      <div key={p} className="absolute top-0 bottom-0 w-px bg-[#1a1a1a]" style={{ left: `${p}%` }} />
                    ))}
                  </div>
                  <span className="font-mono text-[8px] text-[#666] w-8 text-right">{recLevel > 0 ? `${Math.round(20 * Math.log10(Math.max(0.001, recLevel)))} dB` : "-inf"}</span>
                </div>
              </div>
            )}

            {/* Empty state — BandLab style */}
            {tracks.length === 0 && !isRec && (
              <div className="flex items-center justify-center h-full"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.querySelector<HTMLDivElement>(".drop-zone")?.classList.add("border-[#f59e0b44]"); }}
                onDragLeave={(e) => { e.currentTarget.querySelector<HTMLDivElement>(".drop-zone")?.classList.remove("border-[#f59e0b44]"); }}>
                <div className="drop-zone border-2 border-dashed rounded-2xl px-20 py-16 text-center transition-all"
                  style={{ borderColor: "#333", maxWidth: "420px" }}>
                  <div className="text-[48px] leading-none mb-4 opacity-20" style={{ color: "#555" }}>{"\u266A"}</div>
                  <div className="text-[#555] text-[15px] font-medium mb-2">Drop a loop or audio file</div>
                  <div className="text-[#333] text-[11px] leading-relaxed">or use <span className="text-[#C41E3A]">Record</span> / <span className="text-[#888]">Add Track</span> to get started</div>
                </div>
              </div>
            )}

            {/* Track waveforms */}
            {tracks.map((tr) => {
              const isSelected = selectedTrackId === tr.id;
              const hasSolo = tracks.some((t) => t.solo);
              const audible = hasSolo ? tr.solo : !tr.muted;
              return (
                <div key={tr.id}
                  className={`transition-colors relative ${isSelected ? "bg-[#12120e]" : ""}`}
                  style={{
                    borderLeft: `3px solid ${tr.color}`,
                    borderBottom: "1px solid #1a1a1a",
                    opacity: !audible ? 0.3 : 1,
                  }}
                  onClick={() => setSelectedTrackId(tr.id)}>
                  {tr.collapsed ? (
                    <div className="h-4 flex items-center px-2">
                      <span className="text-[8px] text-[#444]">{tr.name}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div
                        ref={(el) => { if (el) trackContainersRef.current[tr.id] = el; }}
                        className="min-h-[56px] cursor-pointer"
                        style={{ background: isSelected ? "#0e0e0a" : "#0a0a0a" }}
                      />
                      {/* Track name label on waveform */}
                      <div className="absolute top-0.5 left-1 z-[5] pointer-events-none">
                        <span className="text-[8px] font-medium px-1 py-px rounded" style={{ color: tr.color, background: "#0a0a0acc" }}>{tr.name}</span>
                      </div>
                      {/* Recording indicator for armed tracks */}
                      {isRec && tr.recordArm && (
                        <div className="absolute top-0.5 right-1 z-[5] flex items-center gap-1 pointer-events-none">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#C41E3A] animate-pulse" />
                          <span className="text-[7px] text-[#C41E3A] font-mono">REC</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Vertical playhead across all waveforms */}
            {(duration > 0 || currentTime > 0) && (
              <div className="absolute top-0 bottom-0 w-px bg-[#f59e0b] z-10 pointer-events-none"
                style={{ left: `${currentTime * pxPerSec}px`, boxShadow: "0 0 4px rgba(245,158,11,0.3)" }} />
            )}
          </div>

          {/* ═══════════════════ BOTTOM PANEL ═══════════════════ */}
          {bottomTab !== "none" && (
            <>
              {/* Bottom resize handle — thin line with grab cursor */}
              <div
                className="h-[5px] cursor-row-resize flex-shrink-0 group relative"
                style={{ background: "#111" }}
                onMouseDown={() => { bottomDragRef.current = true; document.body.style.cursor = "row-resize"; document.body.style.userSelect = "none"; }}>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[2px] rounded-full bg-[#2a2a2a] group-hover:bg-[#f59e0b55] transition-colors" />
              </div>

              {/* Bottom panel tabs */}
              <div className="flex items-center h-7 px-2 gap-0.5 flex-shrink-0" style={{ background: "#141414", borderBottom: "1px solid #1e1e1e" }}>
                {(["mixer", "fx", "editor", "input"] as const).map((tab) => (
                  <button key={tab} onClick={() => setBottomTab(tab)}
                    className={`text-[9px] px-2.5 py-1 rounded-t-md cursor-pointer transition-all font-medium ${bottomTab === tab ? "bg-[#1a1a1a] text-[#ccc] border-t border-x border-[#2a2a2a]" : "text-[#555] hover:text-[#888] hover:bg-[#1a1a1a55]"}`}>
                    {tab === "mixer" ? "Mixer" : tab === "fx" ? "Effects" : tab === "editor" ? "Editor" : "Input/Output"}
                  </button>
                ))}
                <div className="flex-1" />
                {fxTrack && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: fxTrack.color }} />
                    <span className="text-[9px] text-[#666] font-medium">{fxTrack.name}</span>
                  </div>
                )}
                <button onClick={() => setBottomTab("none")}
                  className="text-[#444] hover:text-[#888] text-xs ml-2 cursor-pointer w-5 h-5 rounded flex items-center justify-center hover:bg-[#222] transition-colors">
                  &#10005;
                </button>
              </div>

              {/* Bottom panel content */}
              <div className="overflow-auto flex-shrink-0" style={{ height: bottomPanelHeight, background: "#111" }}>
                {/* ── MIXER TAB ── */}
                {bottomTab === "mixer" && (
                  <div className="flex gap-0 h-full overflow-x-auto">
                    {tracks.map((tr) => {
                      const level = vuLevels[tr.id] ?? 0;
                      return (
                        <div key={tr.id}
                          className={`flex flex-col items-center px-2 py-2 min-w-[68px] border-r transition-colors ${selectedTrackId === tr.id ? "bg-[#151512]" : "hover:bg-[#131313]"}`}
                          style={{ borderColor: "#1e1e1e" }}
                          onClick={() => setSelectedTrackId(tr.id)}>
                          {/* Pan knob */}
                          <div className="flex items-center gap-0.5 mb-1.5">
                            <span className="text-[6px] text-[#444]">L</span>
                            <input type="range" min={-100} max={100} value={tr.pan}
                              onChange={(e) => updateTrackPan(tr.id, Number(e.target.value))}
                              className="w-10 accent-[#888] h-[2px] cursor-pointer" />
                            <span className="text-[6px] text-[#444]">R</span>
                          </div>
                          {/* Vertical fader area with VU meters */}
                          <div className="flex items-end gap-[3px] flex-1 mb-1">
                            {/* VU meter L - thin bar with proper gradient */}
                            <div className="w-[4px] rounded-[1px] overflow-hidden flex flex-col-reverse" style={{ height: "100%", background: "#060606", border: "1px solid #181818" }}>
                              <div className="w-full transition-all duration-75" style={{
                                height: `${Math.min(100, level * 100)}%`,
                                background: "linear-gradient(0deg, #22c55e 0%, #22c55e 50%, #eab308 75%, #ef4444 100%)",
                              }} />
                            </div>
                            {/* Fader */}
                            <div className="flex flex-col items-center" style={{ height: "100%" }}>
                              <input type="range" min={0} max={100} value={tr.volume}
                                onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
                                className="cursor-pointer accent-[#ccc]"
                                style={{ writingMode: "vertical-lr", direction: "rtl", width: "14px", height: "100%" }} />
                            </div>
                            {/* VU meter R - thin bar */}
                            <div className="w-[4px] rounded-[1px] overflow-hidden flex flex-col-reverse" style={{ height: "100%", background: "#060606", border: "1px solid #181818" }}>
                              <div className="w-full transition-all duration-75" style={{
                                height: `${Math.min(100, level * 100 * 0.9)}%`,
                                background: "linear-gradient(0deg, #22c55e 0%, #22c55e 50%, #eab308 75%, #ef4444 100%)",
                              }} />
                            </div>
                          </div>
                          {/* dB display */}
                          <span className="font-mono text-[7px] text-[#555] mb-1">{dbDisplay(tr.volume)}</span>
                          {/* M / S buttons */}
                          <div className="flex gap-0.5 mb-1">
                            <button onClick={(e) => { e.stopPropagation(); toggleMute(tr.id); }}
                              className={`text-[7px] font-bold w-[16px] h-[13px] rounded-[2px] cursor-pointer flex items-center justify-center transition-all ${tr.muted ? "bg-[#3b82f6] text-white shadow-[0_0_4px_rgba(59,130,246,0.3)]" : "border border-[#2a2a2a] text-[#555] hover:border-[#444]"}`}>
                              M
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleSolo(tr.id); }}
                              className={`text-[7px] font-bold w-[16px] h-[13px] rounded-[2px] cursor-pointer flex items-center justify-center transition-all ${tr.solo ? "bg-[#f59e0b] text-[#111] shadow-[0_0_4px_rgba(245,158,11,0.3)]" : "border border-[#2a2a2a] text-[#555] hover:border-[#444]"}`}>
                              S
                            </button>
                          </div>
                          {/* Track name at bottom */}
                          <span className="text-[8px] text-[#777] font-medium mt-0.5 truncate w-full text-center">{tr.name}</span>
                          {/* Color indicator */}
                          <div className="w-full h-[3px] rounded-full mt-0.5" style={{ background: tr.color }} />
                        </div>
                      );
                    })}
                    {/* Master channel — visually distinct */}
                    <div className="flex flex-col items-center px-3 py-2 min-w-[76px]" style={{ background: "linear-gradient(180deg, #161410 0%, #121008 100%)", borderLeft: "2px solid #f59e0b33" }}>
                      <div className="mb-1.5" />
                      <div className="flex items-end gap-[3px] flex-1 mb-1">
                        <div className="w-[5px] rounded-[1px] overflow-hidden flex flex-col-reverse" style={{ height: "100%", background: "#060606", border: "1px solid #181818" }}>
                          <div className="w-full transition-all duration-75" style={{
                            height: `${playing || isRec ? Math.min(100, (masterVol / 100) * 60 + Math.random() * 30) : 0}%`,
                            background: "linear-gradient(0deg, #22c55e 0%, #22c55e 50%, #eab308 75%, #ef4444 100%)",
                          }} />
                        </div>
                        <div className="flex flex-col items-center" style={{ height: "100%" }}>
                          <input type="range" min={0} max={100} value={masterVol}
                            onChange={(e) => setMasterVol(Number(e.target.value))}
                            className="cursor-pointer accent-[#f59e0b]"
                            style={{ writingMode: "vertical-lr", direction: "rtl", width: "16px", height: "100%" }} />
                        </div>
                        <div className="w-[5px] rounded-[1px] overflow-hidden flex flex-col-reverse" style={{ height: "100%", background: "#060606", border: "1px solid #181818" }}>
                          <div className="w-full transition-all duration-75" style={{
                            height: `${playing || isRec ? Math.min(100, (masterVol / 100) * 55 + Math.random() * 28) : 0}%`,
                            background: "linear-gradient(0deg, #22c55e 0%, #22c55e 50%, #eab308 75%, #ef4444 100%)",
                          }} />
                        </div>
                      </div>
                      <span className="font-mono text-[7px] text-[#f59e0b] mb-1">{dbDisplay(masterVol)}</span>
                      <span className="text-[8px] text-[#f59e0b] font-bold mt-0.5">MASTER</span>
                      <div className="w-full h-[3px] rounded-full mt-0.5 bg-[#f59e0b]" />
                    </div>
                    {tracks.length === 0 && (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] text-[#333]">Add tracks to use the mixer</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── FX TAB ── */}
                {bottomTab === "fx" && fxTrack && (
                  <div className="p-3">
                    {/* Presets */}
                    <div className="flex gap-1.5 mb-3 flex-wrap items-center">
                      <span className="text-[8px] text-[#555] uppercase tracking-wider font-medium">Presets</span>
                      {AMP_PRESETS.map((p) => (
                        <button key={p.name} onClick={() => applyPreset(fxTrack.id, p)}
                          className="text-[9px] px-2 py-0.5 rounded border border-[#2a2a2a] text-[#777] hover:text-[#ccc] hover:border-[#444] hover:bg-[#1a1a1a] transition-all cursor-pointer">{p.label}</button>
                      ))}
                      <button onClick={() => updateTrackEffects(fxTrack.id, JSON.parse(JSON.stringify(DEFAULT_EFFECTS)))}
                        className="text-[9px] px-2 py-0.5 rounded border border-[#2a1515] text-[#C41E3A] hover:border-[#C41E3A] hover:bg-[#1a0a0a] transition-all cursor-pointer">Reset All</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      <EffectSection title="EQ3" enabled={fxTrack.effects.eq.enabled}
                        onToggle={() => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, enabled: !fxTrack.effects.eq.enabled } })}>
                        <FxKnob label="Low" value={fxTrack.effects.eq.low} min={-12} max={12} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, low: v } })} />
                        <FxKnob label="Mid" value={fxTrack.effects.eq.mid} min={-12} max={12} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, mid: v } })} />
                        <FxKnob label="High" value={fxTrack.effects.eq.high} min={-12} max={12} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, high: v } })} />
                      </EffectSection>

                      <EffectSection title="Reverb" enabled={fxTrack.effects.reverb.enabled}
                        onToggle={() => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, enabled: !fxTrack.effects.reverb.enabled } })}>
                        <FxKnob label="Wet" value={fxTrack.effects.reverb.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, wet: v } })} />
                        <FxKnob label="Decay" value={fxTrack.effects.reverb.decay} min={0.1} max={10} step={0.1}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, decay: v } })} />
                      </EffectSection>

                      <EffectSection title="Delay" enabled={fxTrack.effects.delay.enabled}
                        onToggle={() => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, enabled: !fxTrack.effects.delay.enabled } })}>
                        <FxKnob label="Wet" value={fxTrack.effects.delay.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, wet: v } })} />
                        <FxKnob label="Time" value={fxTrack.effects.delay.time} min={0.01} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, time: v } })} />
                        <FxKnob label="Feedback" value={fxTrack.effects.delay.feedback} min={0} max={0.9} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, feedback: v } })} />
                      </EffectSection>

                      <EffectSection title="Compressor" enabled={fxTrack.effects.compressor.enabled}
                        onToggle={() => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, compressor: { ...fxTrack.effects.compressor, enabled: !fxTrack.effects.compressor.enabled } })}>
                        <FxKnob label="Threshold" value={fxTrack.effects.compressor.threshold} min={-60} max={0} step={1}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, compressor: { ...fxTrack.effects.compressor, threshold: v } })} />
                        <FxKnob label="Ratio" value={fxTrack.effects.compressor.ratio} min={1} max={20} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, compressor: { ...fxTrack.effects.compressor, ratio: v } })} />
                      </EffectSection>

                      <EffectSection title="Distortion" enabled={fxTrack.effects.distortion.enabled}
                        onToggle={() => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, enabled: !fxTrack.effects.distortion.enabled } })}>
                        <FxKnob label="Wet" value={fxTrack.effects.distortion.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, wet: v } })} />
                        <FxKnob label="Amount" value={fxTrack.effects.distortion.amount} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, amount: v } })} />
                      </EffectSection>

                      <EffectSection title="Chorus" enabled={fxTrack.effects.chorus.enabled}
                        onToggle={() => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, enabled: !fxTrack.effects.chorus.enabled } })}>
                        <FxKnob label="Wet" value={fxTrack.effects.chorus.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, wet: v } })} />
                        <FxKnob label="Freq" value={fxTrack.effects.chorus.frequency} min={0.1} max={10} step={0.1}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, frequency: v } })} />
                        <FxKnob label="Depth" value={fxTrack.effects.chorus.depth} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, depth: v } })} />
                      </EffectSection>
                    </div>
                  </div>
                )}
                {bottomTab === "fx" && !fxTrack && (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[10px] text-[#333]">Select a track to edit effects</span>
                  </div>
                )}

                {/* ── EDITOR TAB ── */}
                {bottomTab === "editor" && fxTrack && (
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                      <div>
                        <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-2">Pan</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] text-[#444]">L</span>
                          <input type="range" min={-100} max={100} value={fxTrack.pan}
                            onChange={(e) => updateTrackPan(fxTrack.id, Number(e.target.value))}
                            className="flex-1 accent-[#888] h-[3px] cursor-pointer" />
                          <span className="text-[8px] text-[#444]">R</span>
                          <span className="font-mono text-[9px] text-[#666] w-8 text-right">
                            {fxTrack.pan === 0 ? "C" : fxTrack.pan < 0 ? `L${Math.abs(fxTrack.pan)}` : `R${fxTrack.pan}`}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-2">Volume</span>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={100} value={fxTrack.volume}
                            onChange={(e) => updateTrackVol(fxTrack.id, Number(e.target.value))}
                            className="flex-1 accent-[#888] h-[3px] cursor-pointer" style={{ accentColor: fxTrack.color }} />
                          <span className="font-mono text-[9px] text-[#666] w-12 text-right">{dbDisplay(fxTrack.volume)} dB</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-4 text-[9px] text-[#444]">
                      <span>Type: {fxTrack.type}</span>
                      <span>Color: <span className="inline-block w-2 h-2 rounded-full align-middle" style={{ background: fxTrack.color }} /></span>
                    </div>
                  </div>
                )}

                {/* ── INPUT/OUTPUT TAB ── */}
                {bottomTab === "input" && (
                  <div className="p-4">
                    <div className="max-w-lg space-y-4">
                      <div>
                        <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-2">Input Device</span>
                        <select value={selectedInputDevice}
                          onChange={(e) => setSelectedInputDevice(e.target.value)}
                          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-[10px] text-[#aaa] outline-none focus:border-[#f59e0b] transition-colors cursor-pointer">
                          {inputDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0, 8)}...)`}</option>
                          ))}
                          {inputDevices.length === 0 && <option value="">No devices found — click to allow access</option>}
                        </select>
                        {inputDevices.length === 0 && (
                          <button onClick={async () => {
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                              stream.getTracks().forEach((t) => t.stop());
                              const devices = await navigator.mediaDevices.enumerateDevices();
                              const inputs = devices.filter((d) => d.kind === "audioinput");
                              setInputDevices(inputs);
                              if (inputs.length > 0) setSelectedInputDevice(inputs[0].deviceId);
                            } catch { /* denied */ }
                          }}
                            className="mt-1 text-[9px] text-[#f59e0b] hover:text-[#fbbf24] cursor-pointer transition-colors">
                            Request microphone access
                          </button>
                        )}
                      </div>

                      {/* Input Level Meter */}
                      <div>
                        <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-2">Input Level</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[8px] bg-[#080808] rounded-[2px] overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                            <div className="h-full transition-all duration-75 rounded-[1px]" style={{
                              width: `${Math.min(100, (monitoring ? inputLevel : isRec ? 0.4 + Math.random() * 0.3 : 0) * 100)}%`,
                              background: "linear-gradient(90deg, #22c55e 0%, #22c55e 50%, #eab308 75%, #ef4444 100%)",
                            }} />
                          </div>
                          <span className="font-mono text-[8px] text-[#555] w-10 text-right">
                            {monitoring ? `${(inputLevel * 100).toFixed(0)}%` : isRec ? "REC" : "---"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium">Monitoring</span>
                        <button onClick={() => setMonitoring(!monitoring)}
                          className={`w-9 h-[18px] rounded-full transition-all cursor-pointer relative ${monitoring ? "bg-[#f59e0b]" : "bg-[#2a2a2a]"}`}>
                          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${monitoring ? "left-[19px]" : "left-[2px]"}`} />
                        </button>
                        <span className={`text-[8px] font-medium ${monitoring ? "text-[#f59e0b]" : "text-[#444]"}`}>{monitoring ? "ON" : "OFF"}</span>
                      </div>

                      <div className="flex gap-6">
                        <div>
                          <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-1">Sample Rate</span>
                          <span className="text-[10px] text-[#666] font-mono">44100 Hz</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-1">Buffer Size</span>
                          <span className="text-[10px] text-[#666] font-mono">128 samples</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#555] uppercase tracking-wider font-medium block mb-1">Bit Depth</span>
                          <span className="text-[10px] text-[#666] font-mono">16-bit</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════ RIGHT PANEL: Import Sources ═══════════════════ */}
        {showRightPanel && (
          <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 260, background: "#131313", borderLeft: "1px solid #1e1e1e" }}>
            <div className="flex items-center h-7 px-3 flex-shrink-0" style={{ background: "#181818", borderBottom: "1px solid #1e1e1e" }}>
              <span className="text-[9px] text-[#888] font-medium uppercase tracking-wider">Import Sources</span>
              <div className="flex-1" />
              <button onClick={() => setShowRightPanel(false)}
                className="text-[#444] hover:text-[#888] text-xs cursor-pointer">&#10005;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* File import */}
              <div className="rounded-lg p-3" style={{ background: "#1a1a1a", border: "1px solid #222" }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-[10px] text-[#aaa] font-medium">Import File</span>
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="w-full text-[9px] py-2 rounded-md border border-dashed border-[#333] text-[#666] hover:text-[#aaa] hover:border-[#555] transition-all cursor-pointer">
                  Choose audio file...
                </button>
              </div>

              {/* YouTube */}
              <div className="rounded-lg p-3" style={{ background: "#1a1a1a", border: "1px solid #222" }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#C41E3A"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6a3 3 0 00-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
                  <span className="text-[10px] text-[#aaa] font-medium">YouTube</span>
                </div>
                <div className="flex gap-1 mb-2">
                  <input value={ytQuery} onChange={(e) => setYtQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadYt()}
                    placeholder="Paste URL..."
                    className="flex-1 bg-[#0e0e0e] border border-[#2a2a2a] rounded px-2 py-1 text-[9px] text-[#aaa] outline-none focus:border-[#C41E3A] transition-colors" />
                  <button onClick={loadYt} className="text-[8px] px-2 py-1 bg-[#C41E3A] text-white rounded hover:brightness-110 cursor-pointer transition-all">Load</button>
                </div>
                {ytVideoId && (
                  <div className="aspect-video w-full rounded overflow-hidden bg-black mb-2">
                    <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
                      className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="YouTube" />
                  </div>
                )}
                <div className="flex gap-1 flex-wrap">
                  {["Metal Backing", "Blues Jam", "Rock Track"].map((q) => (
                    <button key={q} onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q + " backing track")}`, "_blank")}
                      className="text-[7px] px-1.5 py-0.5 rounded border border-[#222] text-[#444] hover:text-[#888] hover:border-[#333] cursor-pointer transition-colors">{q}</button>
                  ))}
                </div>
              </div>

              {/* Suno AI */}
              <div className="rounded-lg p-3" style={{ background: "#1a1a1a", border: "1px solid #222" }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span className="text-[10px] text-[#aaa] font-medium">AI Track (Suno)</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <label className="flex-1">
                      <span className="text-[7px] text-[#444] block">Key</span>
                      <input value={sunoScale} onChange={(e) => setSunoScale(e.target.value)}
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[9px] text-[#aaa] outline-none focus:border-[#8b5cf6]" />
                    </label>
                    <label className="flex-1">
                      <span className="text-[7px] text-[#444] block">Mode</span>
                      <input value={sunoMode} onChange={(e) => setSunoMode(e.target.value)}
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[9px] text-[#aaa] outline-none focus:border-[#8b5cf6]" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[7px] text-[#444] block">Style</span>
                    <input value={sunoStyle} onChange={(e) => setSunoStyle(e.target.value)}
                      className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[9px] text-[#aaa] outline-none focus:border-[#8b5cf6]" />
                  </label>
                  <label className="block">
                    <span className="text-[7px] text-[#444] block">BPM</span>
                    <input type="number" value={sunoBpm} onChange={(e) => setSunoBpm(Number(e.target.value))}
                      className="w-20 bg-[#0e0e0e] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[9px] text-[#f59e0b] outline-none focus:border-[#f59e0b]" />
                  </label>
                  <button onClick={generateSuno} disabled={sunoLoading}
                    className="w-full text-[9px] py-1.5 rounded-md bg-[#8b5cf6] text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all font-medium">
                    {sunoLoading ? "Generating..." : "Generate Track"}
                  </button>
                  {sunoError && <div className="text-[9px] text-[#C41E3A]">{sunoError}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ RIGHT PANEL: My Recordings ═══════════════════ */}
        {showRecordingsPanel && (
          <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 260, background: "#141414", borderLeft: "1px solid #1e1e1e" }}>
            <div className="flex items-center h-7 px-3 flex-shrink-0" style={{ background: "#181818", borderBottom: "1px solid #1e1e1e" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="mr-1.5 flex-shrink-0">
                <path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
              </svg>
              <span className="text-[9px] text-[#888] font-medium" dir="rtl">{"\u05D4\u05D4\u05E7\u05DC\u05D8\u05D5\u05EA \u05E9\u05DC\u05D9"}</span>
              <div className="flex-1" />
              <button onClick={() => setShowRecordingsPanel(false)}
                className="text-[#444] hover:text-[#888] text-xs cursor-pointer">&#10005;</button>
            </div>

            {/* Search */}
            <div className="px-3 pt-2 pb-1 flex-shrink-0">
              <div className="relative">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="absolute left-2 top-1/2 -translate-y-1/2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  value={recSearchQuery}
                  onChange={(e) => setRecSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded px-2 pl-7 py-1 text-[9px] text-[#aaa] outline-none focus:border-[#f59e0b33] transition-colors"
                  style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)" }}
                />
              </div>
            </div>

            {/* Recordings list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
              {filteredRecordings.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" className="mb-2">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <span className="text-[10px] text-[#444]" dir="rtl">{"\u05D0\u05D9\u05DF \u05D4\u05E7\u05DC\u05D8\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA"}</span>
                  <span className="text-[8px] text-[#333] mt-1">Export &gt; Save to Library</span>
                </div>
              )}
              {filteredRecordings.map((rec) => {
                const isPreviewing = previewingRecId === rec.id;
                const isEditing = editingRecId === rec.id;
                const date = new Date(rec.date);
                const dateStr = `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                const durMin = Math.floor(rec.duration / 60);
                const durSec = Math.floor(rec.duration % 60);
                const durStr = `${durMin}:${String(durSec).padStart(2, "0")}`;
                return (
                  <div key={rec.id}
                    className="rounded-lg mt-1.5 p-2 transition-all hover:bg-[#222] group"
                    style={{
                      background: "#1a1a1a",
                      borderLeft: isPreviewing ? "2px solid #f59e0b" : "2px solid transparent",
                    }}>
                    <div className="flex items-start gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={isPreviewing ? "#f59e0b" : "#555"} className="mt-0.5 flex-shrink-0">
                        <path d="M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={rec.name}
                            onBlur={(e) => renameRecordingItem(rec.id, e.target.value || rec.name)}
                            onKeyDown={(e) => { if (e.key === "Enter") renameRecordingItem(rec.id, (e.target as HTMLInputElement).value || rec.name); if (e.key === "Escape") setEditingRecId(null); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-[#0a0a0a] border border-[#f59e0b] rounded px-1 py-0 text-[9px] text-[#ccc] outline-none"
                          />
                        ) : (
                          <div className="text-[9px] text-[#ccc] font-medium truncate">{rec.name}</div>
                        )}
                        <div className="text-[7px] text-[#555] mt-0.5 flex items-center gap-1.5">
                          <span>{durStr}</span>
                          <span>{"\u00B7"}</span>
                          <span>{dateStr}</span>
                          <span>{"\u00B7"}</span>
                          <span className="uppercase">{rec.format}</span>
                        </div>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => previewRecording(rec.id)}
                        title={isPreviewing ? "Stop" : "Preview"}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${isPreviewing ? "text-[#f59e0b] bg-[#f59e0b11]" : "text-[#555] hover:text-[#f59e0b]"}`}>
                        {isPreviewing ? (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ) : (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>
                      <button onClick={() => setEditingRecId(rec.id)}
                        title="Rename"
                        className="w-5 h-5 rounded flex items-center justify-center text-[#555] hover:text-[#f59e0b] transition-colors cursor-pointer">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => downloadRecording(rec)}
                        title="Download"
                        className="w-5 h-5 rounded flex items-center justify-center text-[#555] hover:text-[#f59e0b] transition-colors cursor-pointer">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      <button onClick={() => importRecordingToProject(rec)}
                        title="Add to project"
                        className="w-5 h-5 rounded flex items-center justify-center text-[#555] hover:text-[#22c55e] transition-colors cursor-pointer">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                      </button>
                      <div className="flex-1" />
                      <button onClick={() => removeRecording(rec.id)}
                        title="Delete"
                        className="w-5 h-5 rounded flex items-center justify-center text-[#444] hover:text-[#ef4444] transition-colors cursor-pointer">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ BOTTOM STATUS BAR ═══════════════════ */}
      <div className="flex items-center h-5 px-3 flex-shrink-0" style={{ background: "#0e0e0e", borderTop: "1px solid #1a1a1a" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => { if (bottomTab === "mixer") setBottomTab("none"); else setBottomTab("mixer"); }}
            className={`text-[8px] cursor-pointer transition-colors ${bottomTab === "mixer" ? "text-[#f59e0b]" : "text-[#444] hover:text-[#888]"}`}>
            Mixer
          </button>
          <button onClick={() => { if (bottomTab === "fx") setBottomTab("none"); else setBottomTab("fx"); }}
            className={`text-[8px] cursor-pointer transition-colors ${bottomTab === "fx" ? "text-[#8b5cf6]" : "text-[#444] hover:text-[#888]"}`}>
            Effects
          </button>
          <button onClick={() => { if (bottomTab === "editor") setBottomTab("none"); else setBottomTab("editor"); }}
            className={`text-[8px] cursor-pointer transition-colors ${bottomTab === "editor" ? "text-[#f59e0b]" : "text-[#444] hover:text-[#888]"}`}>
            Editor
          </button>
          <button onClick={() => { if (bottomTab === "input") setBottomTab("none"); else setBottomTab("input"); }}
            className={`text-[8px] cursor-pointer transition-colors ${bottomTab === "input" ? "text-[#f59e0b]" : "text-[#444] hover:text-[#888]"}`}>
            I/O
          </button>
          <div className="w-px h-3 bg-[#222]" />
          <button onClick={() => { setShowRecordingsPanel(!showRecordingsPanel); if (!showRecordingsPanel) setShowRightPanel(false); }}
            className={`text-[8px] cursor-pointer transition-colors ${showRecordingsPanel ? "text-[#f59e0b]" : "text-[#444] hover:text-[#888]"}`}>
            Library {savedRecordings.length > 0 ? `(${savedRecordings.length})` : ""}
          </button>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[8px] text-[#333] font-mono">
          <span>{timeSig[0]}/{timeSig[1]}</span>
          <span>{bpm} BPM</span>
          <span>{projectKey}</span>
          <span>{tracks.length} tracks</span>
          {snapToGrid && <span className="text-[#444]">SNAP</span>}
          {looping && <span className="text-[#f59e0b44]">LOOP</span>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ SUB-COMPONENTS ═══════════════════

function EffectSection({ title, enabled, onToggle, children }: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg transition-all ${enabled ? "opacity-100" : "opacity-50 hover:opacity-70"}`}
      style={{ background: enabled ? "#0e0e0c" : "#0a0a0a", border: `1px solid ${enabled ? "#2a2a28" : "#1a1a1a"}`, boxShadow: enabled ? "0 1px 4px rgba(0,0,0,0.2)" : "none" }}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-t-lg" style={{ background: enabled ? "#151512" : "#0e0e0e", borderBottom: `1px solid ${enabled ? "#222" : "#1a1a1a"}` }}>
        <button onClick={onToggle}
          className={`w-[16px] h-[16px] rounded-[4px] cursor-pointer flex items-center justify-center transition-all text-[8px] font-bold ${enabled ? "bg-[#f59e0b] text-[#111] shadow-[0_0_6px_rgba(245,158,11,0.2)]" : "border border-[#333] text-transparent hover:border-[#555]"}`}>
          {enabled ? "\u2713" : ""}
        </button>
        <span className={`text-[10px] font-semibold transition-colors ${enabled ? "text-[#ccc]" : "text-[#555]"}`}>{title}</span>
        <div className="flex-1" />
        <div className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-[#22c55e]" : "bg-[#333]"}`} />
      </div>
      <div className="flex gap-3 flex-wrap p-2.5">{children}</div>
    </div>
  );
}

function FxKnob({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.startY - e.clientY) * ((max - min) / 150);
      const raw = dragRef.current.startVal + delta;
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [min, max, step, onChange]);

  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className="text-[7px] text-[#555] font-medium">{label}</span>
      <div
        className="w-8 h-8 rounded-full cursor-grab active:cursor-grabbing relative transition-all hover:shadow-[0_0_8px_rgba(245,158,11,0.15)]"
        style={{ background: "linear-gradient(180deg, #222 0%, #1a1a1a 100%)", border: "2px solid #333" }}
        onMouseDown={(e) => { dragRef.current = { startY: e.clientY, startVal: value }; document.body.style.cursor = "grabbing"; }}
        onDoubleClick={() => onChange(min + (max - min) / 2)}>
        {/* Knob track arc */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="#222" strokeWidth="2"
            strokeDasharray={`${pct * 75.4} 999`}
            strokeDashoffset="-18.85"
            transform="rotate(-225 16 16)" />
          <circle cx="16" cy="16" r="12" fill="none" stroke="#f59e0b" strokeWidth="2"
            strokeDasharray={`${pct * 75.4} 999`}
            strokeDashoffset="-18.85"
            transform="rotate(-225 16 16)"
            opacity="0.6" />
        </svg>
        {/* Pointer */}
        <div className="absolute top-[3px] left-1/2 w-[2px] h-[8px] bg-[#f59e0b] rounded-full"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 950%" }} />
      </div>
      <span className="font-mono text-[7px] text-[#555]">
        {Math.abs(value) < 10 ? value.toFixed(2) : value.toFixed(1)}
      </span>
    </div>
  );
}
