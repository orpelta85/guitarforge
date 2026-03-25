"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SCALES, MODES, STYLES } from "@/lib/constants";
import { buildStyle, saveToLibrary as saveSunoToLibrary, getAllLibraryTracks, deleteFromLibrary, updateLibraryTrack, getLibraryStats, getDailyUsage, recordUsage } from "@/lib/suno";
import type { LibraryTrack } from "@/lib/suno";
import LooperBox from "./LooperBox";

// ── Types ──
interface StudioTrack {
  id: number;
  name: string;
  color: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  volume: number;
  muted: boolean;
  type: "recording" | "import" | "suno" | "drum";
  drumPattern?: boolean[][];
}

type ToneModule = typeof import("tone");

interface SimpleToneNodes {
  player: InstanceType<ToneModule["Player"]>;
  gain: InstanceType<ToneModule["Gain"]>;
}

interface WaveSurferInstance {
  destroy: () => void;
  loadBlob: (blob: Blob) => Promise<void>;
  load: (url: string) => Promise<void>;
  setTime: (t: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
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

// ── Drum Machine ──
const DRUM_INSTRUMENTS = [
  { name: "Kick", short: "KCK" },
  { name: "Snare", short: "SNR" },
  { name: "HiHat Closed", short: "HHC" },
  { name: "HiHat Open", short: "HHO" },
  { name: "Clap", short: "CLP" },
  { name: "Ride", short: "RDE" },
  { name: "Tom Low", short: "TML" },
  { name: "Tom High", short: "TMH" },
] as const;
const DRUM_STEPS = 16;

const DRUM_PRESETS: { name: string; pattern: boolean[][] }[] = [
  { name: "Basic Rock", pattern: [
    [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
    [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
    [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
  ]},
  { name: "Metal Double Bass", pattern: [
    [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
    [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,true,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,false],
  ]},
  { name: "Blast Beat", pattern: [
    [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    [false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true],
    [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
  ]},
  { name: "Half-Time", pattern: [
    [true,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false],
    [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
  ]},
  { name: "Shuffle", pattern: [
    [true,false,false,false,false,false,true,false,true,false,false,false,false,false,true,false],
    [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
    [true,false,false,true,false,false,true,false,false,true,false,false,true,false,false,true],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
  ]},
  { name: "Punk Fast", pattern: [
    [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
    [false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false],
    [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
  ]},
];

function createEmptyDrumPattern(): boolean[][] {
  return DRUM_INSTRUMENTS.map(() => Array(DRUM_STEPS).fill(false));
}

function synthDrumHit(ctx: AudioContext, instrument: number, time: number, output?: AudioNode) {
  const t = time;
  const dest = output || ctx.destination;
  switch (instrument) {
    case 0: { // Kick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(dest);
      osc.start(t); osc.stop(t + 0.25);
      break;
    }
    case 1: { // Snare
      const bufSize = Math.ceil(ctx.sampleRate * 0.15);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.6, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      noise.connect(ng).connect(dest);
      noise.start(t); noise.stop(t + 0.15);
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 180;
      og.gain.setValueAtTime(0.7, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(og).connect(dest);
      osc.start(t); osc.stop(t + 0.1);
      break;
    }
    case 2: { // HiHat Closed
      const bufSize = Math.ceil(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(hp).connect(g).connect(dest);
      noise.start(t); noise.stop(t + 0.05);
      break;
    }
    case 3: { // HiHat Open
      const bufSize = Math.ceil(ctx.sampleRate * 0.2);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      noise.connect(hp).connect(g).connect(dest);
      noise.start(t); noise.stop(t + 0.2);
      break;
    }
    case 4: { // Clap
      const bufSize = Math.ceil(ctx.sampleRate * 0.1);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 2500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      noise.connect(bp).connect(g).connect(dest);
      noise.start(t); noise.stop(t + 0.1);
      break;
    }
    case 5: { // Ride
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle"; osc.frequency.value = 800;
      og.gain.setValueAtTime(0.15, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(og).connect(dest);
      osc.start(t); osc.stop(t + 0.4);
      const bufSize = Math.ceil(ctx.sampleRate * 0.3);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 8000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.1, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      noise.connect(hp).connect(ng).connect(dest);
      noise.start(t); noise.stop(t + 0.3);
      break;
    }
    case 6: { // Tom Low
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g).connect(dest);
      osc.start(t); osc.stop(t + 0.25);
      break;
    }
    case 7: { // Tom High
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.12);
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g).connect(dest);
      osc.start(t); osc.stop(t + 0.2);
      break;
    }
  }
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

interface StudioPageProps {
  channelScale?: string;
  channelMode?: string;
  channelStyle?: string;
}

export default function StudioPage({ channelScale, channelMode, channelStyle }: StudioPageProps = {}) {
  // ── State ──
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isRec, setIsRec] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [recLevel, setRecLevel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [bpm, setBpm] = useState(120);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState("");
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [previewingRecId, setPreviewingRecId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState<number | null>(null);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const [showLooper, setShowLooper] = useState(false);
  const [drumPlaying, setDrumPlaying] = useState(false);
  const [drumStep, setDrumStep] = useState(-1);
  const [expandedDrumTrackId, setExpandedDrumTrackId] = useState<number | null>(null);
  const [showSunoPanel, setShowSunoPanel] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  // Suno state
  const [sunoScale, setSunoScale] = useState(channelScale || "Am");
  const [sunoMode, setSunoMode] = useState(channelMode || "Aeolian");
  const [sunoStyle, setSunoStyle] = useState(channelStyle || "Metal");
  const [sunoBpm, setSunoBpm] = useState(120);
  const [sunoLoading, setSunoLoading] = useState(false);
  const [sunoError, setSunoError] = useState("");
  const [sunoCredits, setSunoCredits] = useState<number | null>(null);
  const [sunoCreditsLoading, setSunoCreditsLoading] = useState(false);
  const [sunoConfirm, setSunoConfirm] = useState(false);
  const [sunoTab, setSunoTab] = useState<"generate" | "library" | "credits">("generate");
  const [sunoCustomPrompt, setSunoCustomPrompt] = useState(false);
  const [sunoPromptText, setSunoPromptText] = useState("");
  const [sunoGeneratedTracks, setSunoGeneratedTracks] = useState<{ id: string; title: string; audioUrl: string; duration: number }[]>([]);
  const [sunoLibrary, setSunoLibrary] = useState<LibraryTrack[]>([]);
  const [sunoLibSearch, setSunoLibSearch] = useState("");
  const [sunoLibStats, setSunoLibStats] = useState<{ count: number; totalBytes: number }>({ count: 0, totalBytes: 0 });
  const [sunoPlayingId, setSunoPlayingId] = useState<string | null>(null);
  const [sunoDailyUsage, setSunoDailyUsage] = useState({ date: "", used: 0, generations: 0 });
  const sunoAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Refs ──
  const toneRef = useRef<ToneModule | null>(null);
  const masterGainRef = useRef<InstanceType<ToneModule["Gain"]> | null>(null);
  const toneNodesRef = useRef<Record<number, SimpleToneNodes>>({});
  const wsRef = useRef<Record<number, WaveSurferInstance>>({});
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recAnalyserRef = useRef<AnalyserNode | null>(null);
  const recAudioCtxRef = useRef<AudioContext | null>(null);
  const recLevelAnimRef = useRef<number>(0);
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
  const mountedRef = useRef(true);
  const playStartRef = useRef<{ wallTime: number; offset: number } | null>(null);
  const drumAudioCtxRef = useRef<AudioContext | null>(null);
  const drumTimerRef = useRef<number | null>(null);
  const drumGainRef = useRef<GainNode | null>(null);
  const drumMasterGainRef = useRef<GainNode | null>(null);
  const drumNextNoteTimeRef = useRef(0);
  const drumCurrentStepRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

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
    if (masterGainRef.current) masterGainRef.current.gain.value = masterVol / 100;
    if (drumMasterGainRef.current) drumMasterGainRef.current.gain.value = masterVol / 100;
  }, [masterVol]);

  // ── Metronome ──
  const setupMetronome = useCallback(async () => {
    const Tone = await ensureTone();
    if (metronomeRef.current) return;
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.008, octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    });
    const gain = new Tone.Gain(0.5).toDestination();
    synth.connect(gain);
    const loop = new Tone.Loop((time: number) => {
      synth.triggerAttackRelease("C2", "16n", time);
    }, "4n");
    metronomeRef.current = { loop, synth, gain };
  }, [ensureTone]);

  useEffect(() => {
    if (!metronomeRef.current || !toneRef.current) return;
    toneRef.current.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (!metronomeRef.current) return;
    if (metronomeOn) metronomeRef.current.loop.start(0);
    else metronomeRef.current.loop.stop();
  }, [metronomeOn]);

  // ── Create simplified Tone nodes (Player + Gain only) ──
  const createToneNodes = useCallback(async (track: StudioTrack): Promise<SimpleToneNodes | null> => {
    if (!track.audioUrl) return null;
    const Tone = await ensureTone();
    const master = masterGainRef.current;
    if (!master) return null;
    const player = new Tone.Player({ url: track.audioUrl, loop: false });
    const gain = new Tone.Gain(track.volume / 100);
    player.chain(gain, master);
    if (track.muted) gain.gain.value = 0;
    toneNodesRef.current[track.id] = { player, gain };
    return { player, gain };
  }, [ensureTone]);

  // ── Create wavesurfer for a track ──
  const createWavesurfer = useCallback(async (track: StudioTrack, container: HTMLDivElement) => {
    const WaveSurfer = (await import("wavesurfer.js")).default;
    const ws = WaveSurfer.create({
      container,
      waveColor: track.color + "66",
      progressColor: track.color,
      cursorColor: "#D4A843",
      cursorWidth: 2,
      height: 90,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      interact: true,
      normalize: true,
      backend: "WebAudio",
      media: document.createElement("audio"),
    }) as unknown as WaveSurferInstance;

    if (track.audioBlob) await ws.loadBlob(track.audioBlob);
    else if (track.audioUrl) await ws.load(track.audioUrl);

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
    const id = Date.now() + ctr.current;
    const color = TRACK_COLORS[(id - 1) % TRACK_COLORS.length];
    const newTrack: StudioTrack = {
      id, name, color,
      audioBlob: blob || null,
      audioUrl: url,
      volume: 100,
      muted: false,
      type,
    };
    setTracks((p) => [...p, newTrack]);
    setTimeout(async () => {
      if (!mountedRef.current) return;
      const container = trackContainersRef.current[id];
      if (container) await createWavesurfer(newTrack, container);
      await createToneNodes(newTrack);
    }, 100);
  }, [createWavesurfer, createToneNodes]);

  // ── Add Drum Machine track ──
  const addDrumTrack = useCallback(() => {
    ctr.current++;
    const id = Date.now() + ctr.current;
    const color = TRACK_COLORS[(id - 1) % TRACK_COLORS.length];
    const drumCount = tracks.filter(t => t.type === "drum").length;
    const newTrack: StudioTrack = {
      id, name: drumCount === 0 ? "Drum Machine" : `Drum Machine ${drumCount + 1}`, color,
      audioBlob: null, audioUrl: null,
      volume: 100, muted: false,
      type: "drum",
      drumPattern: createEmptyDrumPattern(),
    };
    setTracks((p) => [...p, newTrack]);
    setExpandedDrumTrackId(id);
    setShowAddTrackMenu(false);
  }, []);

  // ── Drum pattern toggle ──
  const toggleDrumCell = useCallback((trackId: number, instrIdx: number, stepIdx: number) => {
    setTracks((prev) => prev.map((t) => {
      if (t.id !== trackId || !t.drumPattern) return t;
      const pat = t.drumPattern.map((row) => [...row]);
      pat[instrIdx][stepIdx] = !pat[instrIdx][stepIdx];
      return { ...t, drumPattern: pat };
    }));
  }, []);

  // ── Drum playback (look-ahead scheduler) ──
  const DRUM_LOOKAHEAD_MS = 25;
  const DRUM_SCHEDULE_AHEAD_S = 0.1;

  const startDrumPlayback = useCallback((pattern: boolean[][], trackId?: number) => {
    if (!drumAudioCtxRef.current) drumAudioCtxRef.current = new AudioContext();
    const ctx = drumAudioCtxRef.current;

    // Create a master gain node for drums that respects master volume
    const drumMasterGain = ctx.createGain();
    drumMasterGain.gain.value = masterVol / 100;
    drumMasterGain.connect(ctx.destination);
    drumMasterGainRef.current = drumMasterGain;

    // Per-track gain sits before the master gain
    const gainNode = ctx.createGain();
    gainNode.connect(drumMasterGain);
    drumGainRef.current = gainNode;

    if (trackId !== undefined) {
      const track = tracks.find(t => t.id === trackId);
      if (track) gainNode.gain.value = track.muted ? 0 : track.volume / 100;
    }

    const stepDuration = (60 / bpm) / 4;
    drumCurrentStepRef.current = 0;
    drumNextNoteTimeRef.current = ctx.currentTime;
    setDrumPlaying(true);
    setDrumStep(0);

    const scheduler = () => {
      while (drumNextNoteTimeRef.current < ctx.currentTime + DRUM_SCHEDULE_AHEAD_S) {
        const step = drumCurrentStepRef.current;
        for (let i = 0; i < DRUM_INSTRUMENTS.length; i++) {
          if (pattern[i][step]) synthDrumHit(ctx, i, drumNextNoteTimeRef.current, gainNode);
        }
        const delay = Math.max(0, (drumNextNoteTimeRef.current - ctx.currentTime) * 1000);
        const stepSnap = step;
        setTimeout(() => setDrumStep(stepSnap), delay);
        drumNextNoteTimeRef.current += stepDuration;
        drumCurrentStepRef.current = (step + 1) % DRUM_STEPS;
      }
      drumTimerRef.current = window.setTimeout(scheduler, DRUM_LOOKAHEAD_MS);
    };
    scheduler();
  }, [bpm, tracks, masterVol]);

  const stopDrumPlayback = useCallback(() => {
    if (drumTimerRef.current !== null) { clearTimeout(drumTimerRef.current); drumTimerRef.current = null; }
    if (drumGainRef.current) { drumGainRef.current.disconnect(); drumGainRef.current = null; }
    if (drumMasterGainRef.current) { drumMasterGainRef.current.disconnect(); drumMasterGainRef.current = null; }
    setDrumPlaying(false);
    setDrumStep(-1);
  }, []);

  // Keep drum gain in sync with track controls
  useEffect(() => {
    if (!drumPlaying || !drumGainRef.current) return;
    const drumTrack = tracks.find(t => t.type === "drum" && t.id === expandedDrumTrackId);
    if (!drumTrack) return;
    drumGainRef.current.gain.value = drumTrack.muted ? 0 : drumTrack.volume / 100;
  }, [tracks, drumPlaying, expandedDrumTrackId]);

  // Save drum patterns to localStorage
  useEffect(() => {
    const drumTracks = tracks.filter(t => t.type === "drum" && t.drumPattern);
    if (drumTracks.length === 0) return;
    const data = drumTracks.map(t => ({ id: t.id, name: t.name, pattern: t.drumPattern }));
    try { localStorage.setItem("gf-studio-drums", JSON.stringify(data)); } catch {}
  }, [tracks]);

  // Restore drum patterns on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gf-studio-drums");
      if (!raw) return;
      const saved = JSON.parse(raw) as { id: number; name: string; pattern: boolean[][] }[];
      if (!saved.length) return;
      setTracks(prev => {
        if (prev.some(t => t.type === "drum")) return prev;
        return [...prev, ...saved.map(s => ({
          id: s.id, name: s.name, color: TRACK_COLORS[(s.id - 1) % TRACK_COLORS.length],
          audioBlob: null, audioUrl: null, volume: 100,
          muted: false,
          type: "drum" as const,
          drumPattern: s.pattern,
        }))];
      });
    } catch {}
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

      const audioCtx = new AudioContext();
      recAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      recAnalyserRef.current = analyser;

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

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      recChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (!mountedRef.current) return;
        if (recLevelAnimRef.current) cancelAnimationFrame(recLevelAnimRef.current);
        recAnalyserRef.current = null;
        if (recAudioCtxRef.current) { try { recAudioCtxRef.current.close(); } catch { /* ok */ } recAudioCtxRef.current = null; }
        setRecLevel(0);

        const chunks = recChunksRef.current;
        recChunksRef.current = [];
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        addTrack(`Recording ${ctr.current + 1}`, url, "recording", blob);

        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start(100);
      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch (err) {
      alert("Microphone access denied: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [addTrack, selectedInputDevice]);

  const stopRec = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRec(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Playback ──
  const playAll = useCallback(async () => {
    const Tone = await ensureTone();
    await setupMetronome();

    // Apply mute state
    tracks.forEach((t) => {
      const nodes = toneNodesRef.current[t.id];
      if (nodes) nodes.gain.gain.value = t.muted ? 0 : t.volume / 100;
    });

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

    // Start drum machine for all drum tracks (merged pattern)
    const drumTracks = tracks.filter(t => t.type === "drum" && t.drumPattern && !t.muted);
    if (drumTracks.length > 0) {
      const merged = createEmptyDrumPattern();
      drumTracks.forEach(t => {
        t.drumPattern!.forEach((row, i) => {
          row.forEach((cell, j) => { if (cell) merged[i][j] = true; });
        });
      });
      stopDrumPlayback();
      startDrumPlayback(merged);
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
          stopDrumPlayback();
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
  }, [ensureTone, setupMetronome, tracks, currentTime, metronomeOn, bpm, duration, looping, startDrumPlayback, stopDrumPlayback]);

  const stopAll = useCallback(() => {
    Object.values(toneNodesRef.current).forEach((nodes) => {
      try { nodes.player.stop(); } catch { /* ok */ }
    });
    if (toneRef.current) {
      toneRef.current.getTransport().stop();
      toneRef.current.getTransport().position = 0;
    }
    // Stop drum machine when transport stops
    stopDrumPlayback();
    if (animRef.current) cancelAnimationFrame(animRef.current);
    playStartRef.current = null;
    setPlaying(false);
    setCurrentTime(0);
    Object.values(wsRef.current).forEach((ws) => {
      try { ws.setTime(0); } catch { /* skip */ }
    });
  }, [stopDrumPlayback]);

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
    if (nodes) nodes.gain.gain.value = vol / 100;
  }, []);

  const toggleMute = useCallback((id: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, muted: !t.muted } : t);
      next.forEach((t) => {
        const nodes = toneNodesRef.current[t.id];
        if (nodes) nodes.gain.gain.value = t.muted ? 0 : t.volume / 100;
      });
      return next;
    });
  }, []);

  const deleteTrack = useCallback((id: number) => {
    const ws = wsRef.current[id];
    if (ws) { try { ws.destroy(); } catch { /* ok */ } delete wsRef.current[id]; }
    const nodes = toneNodesRef.current[id];
    if (nodes) {
      try { nodes.player.stop(); } catch { /* ok */ }
      try { nodes.player.dispose(); } catch { /* ok */ }
      try { nodes.gain.dispose(); } catch { /* ok */ }
      delete toneNodesRef.current[id];
    }
    delete trackContainersRef.current[id];
    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (track?.audioUrl) URL.revokeObjectURL(track.audioUrl);
      return prev.filter((t) => t.id !== id);
    });
    if (expandedDrumTrackId === id) setExpandedDrumTrackId(null);
  }, [expandedDrumTrackId]);

  // ── Import file ──
  const importFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    addTrack(file.name.replace(/\.[^.]+$/, ""), url, "import", file);
  }, [addTrack]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith("audio/")) importFile(f);
    }
  }, [importFile]);

  // ── Track rename ──
  const renameTrack = useCallback((id: number, name: string) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, name } : t));
  }, []);

  // ── Suno ──
  const fetchSunoCredits = useCallback(async () => {
    setSunoCreditsLoading(true);
    try {
      const res = await fetch("/api/suno");
      const data = await res.json();
      if (typeof data.credits_left === "number") setSunoCredits(data.credits_left);
    } catch { /* non-critical */ }
    setSunoCreditsLoading(false);
  }, []);

  const loadSunoLibrary = useCallback(async () => {
    const tracks = await getAllLibraryTracks();
    setSunoLibrary(tracks);
    const stats = await getLibraryStats();
    setSunoLibStats(stats);
  }, []);

  useEffect(() => {
    if (showSunoPanel) {
      fetchSunoCredits();
      loadSunoLibrary();
      setSunoDailyUsage(getDailyUsage());
    }
  }, [showSunoPanel, fetchSunoCredits, loadSunoLibrary]);

  useEffect(() => {
    if (sunoTab === "credits") setSunoDailyUsage(getDailyUsage());
  }, [sunoTab]);

  const sunoStylePreview = useMemo(() => {
    if (sunoCustomPrompt) return sunoPromptText;
    return buildStyle(sunoScale, sunoMode, sunoStyle, sunoBpm);
  }, [sunoScale, sunoMode, sunoStyle, sunoBpm, sunoCustomPrompt, sunoPromptText]);

  const generateSuno = useCallback(async () => {
    setSunoLoading(true);
    setSunoError("");
    setSunoConfirm(false);
    setSunoGeneratedTracks([]);
    try {
      const stylePayload = sunoCustomPrompt ? sunoPromptText : undefined;
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scale: sunoScale, mode: sunoMode, style: sunoStyle, bpm: sunoBpm,
          title: `${sunoScale} ${sunoMode} ${sunoStyle} ${sunoBpm}bpm`,
          ...(stylePayload ? { customStyle: stylePayload } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        const generated = data.tracks.map((t: { id: string; title: string; audioUrl: string; duration: number }) => ({
          id: t.id || crypto.randomUUID(), title: t.title || "AI Track", audioUrl: t.audioUrl, duration: t.duration || 0,
        }));
        setSunoGeneratedTracks(generated);
        recordUsage(10);
        for (const t of generated) {
          try {
            const audioRes = await fetch(t.audioUrl);
            const blob = await audioRes.blob();
            await saveSunoToLibrary({
              id: t.id, audioBlob: blob, audioUrl: t.audioUrl, title: t.title,
              style: sunoCustomPrompt ? sunoPromptText : buildStyle(sunoScale, sunoMode, sunoStyle, sunoBpm),
              params: { scale: sunoScale, mode: sunoMode, style: sunoStyle, bpm: sunoBpm },
              duration: t.duration, createdAt: Date.now(), source: "generate", favorite: false,
            });
          } catch { /* save failure non-critical */ }
        }
        loadSunoLibrary();
        fetchSunoCredits();
        setSunoDailyUsage(getDailyUsage());
      } else {
        throw new Error("No tracks returned");
      }
    } catch (err) {
      setSunoError(err instanceof Error ? err.message : "Failed to generate track");
    }
    setSunoLoading(false);
  }, [sunoScale, sunoMode, sunoStyle, sunoBpm, sunoCustomPrompt, sunoPromptText, fetchSunoCredits, loadSunoLibrary]);

  const sunoPlayTrack = useCallback((url: string, id: string) => {
    if (sunoAudioRef.current) { sunoAudioRef.current.pause(); sunoAudioRef.current = null; }
    if (sunoPlayingId === id) { setSunoPlayingId(null); return; }
    const audio = new Audio(url);
    audio.onended = () => setSunoPlayingId(null);
    audio.play();
    sunoAudioRef.current = audio;
    setSunoPlayingId(id);
  }, [sunoPlayingId]);

  const sunoDeleteTrack = useCallback(async (id: string) => {
    await deleteFromLibrary(id);
    loadSunoLibrary();
  }, [loadSunoLibrary]);

  const sunoToggleFavorite = useCallback(async (id: string, current: boolean) => {
    await updateLibraryTrack(id, { favorite: !current });
    loadSunoLibrary();
  }, [loadSunoLibrary]);

  const sunoAddToDaw = useCallback((title: string, url: string) => {
    addTrack(title || "AI Track", url, "suno");
  }, [addTrack]);

  // ── Save to recordings (mixdown all audio tracks) ──
  const saveToRecordings = useCallback(async () => {
    if (tracks.length === 0) return;
    setSavingToLibrary(true);
    try {
      // Collect all tracks that have audio blobs
      const audioTracks = tracks.filter(t => t.audioBlob && !t.muted);
      if (audioTracks.length === 0) {
        alert("No audio tracks to save (drum-only export not yet supported)");
        setSavingToLibrary(false);
        return;
      }

      // If only one audio track, save it directly
      if (audioTracks.length === 1) {
        const t = audioTracks[0];
        const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const ws = wsRef.current[t.id];
        const dur = ws ? ws.getDuration() : 0;
        const meta = await idbSaveRecording(id, t.name, t.audioBlob!, dur);
        setSavedRecordings((prev) => [meta, ...prev.filter((r) => r.id !== id)]);
      } else {
        // Mixdown multiple tracks using OfflineAudioContext
        const sampleRate = 44100;
        const decodedBuffers: { buffer: AudioBuffer; volume: number }[] = [];
        for (const t of audioTracks) {
          const arrayBuf = await t.audioBlob!.arrayBuffer();
          const tempCtx = new AudioContext({ sampleRate });
          const decoded = await tempCtx.decodeAudioData(arrayBuf);
          decodedBuffers.push({ buffer: decoded, volume: t.volume / 100 });
          await tempCtx.close();
        }
        const maxDuration = Math.max(...decodedBuffers.map(d => d.buffer.duration));
        const totalFrames = Math.ceil(maxDuration * sampleRate);
        const channels = Math.max(...decodedBuffers.map(d => d.buffer.numberOfChannels));
        const offline = new OfflineAudioContext(channels, totalFrames, sampleRate);
        for (const { buffer, volume } of decodedBuffers) {
          const source = offline.createBufferSource();
          source.buffer = buffer;
          const gain = offline.createGain();
          gain.gain.value = volume;
          source.connect(gain).connect(offline.destination);
          source.start(0);
        }
        const rendered = await offline.startRendering();

        // Encode rendered buffer to WAV blob
        const numCh = rendered.numberOfChannels;
        const length = rendered.length;
        const bufferSize = 44 + length * numCh * 2;
        const wavBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(wavBuffer);
        const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeStr(0, "RIFF");
        view.setUint32(4, bufferSize - 8, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numCh, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numCh * 2, true);
        view.setUint16(32, numCh * 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, "data");
        view.setUint32(40, length * numCh * 2, true);
        let offset = 44;
        for (let i = 0; i < length; i++) {
          for (let ch = 0; ch < numCh; ch++) {
            const sample = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
          }
        }
        const mixBlob = new Blob([wavBuffer], { type: "audio/wav" });
        const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const meta = await idbSaveRecording(id, `Mix (${audioTracks.length} tracks)`, mixBlob, maxDuration, "wav");
        setSavedRecordings((prev) => [meta, ...prev.filter((r) => r.id !== id)]);
      }
    } catch (err) {
      alert("Save failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setSavingToLibrary(false);
  }, [tracks]);

  // ── Load saved recordings on mount ──
  useEffect(() => {
    idbLoadRecordings().then(setSavedRecordings).catch(() => {});
  }, []);

  // ── Recordings panel helpers ──
  const previewRecording = useCallback(async (id: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
      previewAudioRef.current = null;
    }
    if (previewingRecId === id) { setPreviewingRecId(null); return; }
    const blob = await idbGetBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { setPreviewingRecId(null); URL.revokeObjectURL(url); };
    audio.play();
    previewAudioRef.current = audio;
    setPreviewingRecId(id);
  }, [previewingRecId]);

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

  // ── Enumerate input devices ──
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setInputDevices(inputs);
      if (inputs.length > 0 && !selectedInputDevice) setSelectedInputDevice(inputs[0].deviceId);
    }).catch(() => {});
  }, [selectedInputDevice]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      Object.values(wsRef.current).forEach((ws) => { try { ws.destroy(); } catch { /* ok */ } });
      Object.values(toneNodesRef.current).forEach((nodes) => {
        try { nodes.player.stop(); } catch { /* ok */ }
        try { nodes.player.dispose(); } catch { /* ok */ }
        try { nodes.gain.dispose(); } catch { /* ok */ }
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
      if (drumTimerRef.current !== null) clearTimeout(drumTimerRef.current);
      if (drumAudioCtxRef.current) { try { drumAudioCtxRef.current.close(); } catch { /* ok */ } }
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
        case "enter": e.preventDefault(); rewindToStart(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playing, stopAll, playAll, isRec, stopRec, startRec, setupMetronome, rewindToStart]);

  // Suppress unused variable warnings for Suno state used in JSX
  void sunoLibStats;
  void sunoDailyUsage;

  // ── Bottom dock panel state ──
  const [dockPanel, setDockPanel] = useState<"drums" | "looper" | "suno" | "mixer" | "recordings" | null>(null);
  const activeDrumTrack = useMemo(() => tracks.find(t => t.type === "drum" && t.id === expandedDrumTrackId), [tracks, expandedDrumTrackId]);

  // Auto-open drum dock when a drum track grid is toggled
  const handleDrumGridToggle = useCallback((trackId: number) => {
    if (expandedDrumTrackId === trackId) {
      setExpandedDrumTrackId(null);
      if (dockPanel === "drums") setDockPanel(null);
    } else {
      setExpandedDrumTrackId(trackId);
      setDockPanel("drums");
    }
  }, [expandedDrumTrackId, dockPanel]);

  // ═══════════════════ RENDER ═══════════════════
  return (
    <div className="flex flex-col overflow-hidden select-none" style={{ background: "#0a0a0a", fontFamily: "'Inter', system-ui, sans-serif", height: "calc(100vh - 90px)" }} dir="ltr">

      {/* ═══════════ TOP BAR: Transport + Toolbar (DAW style) ═══════════ */}
      <div className="flex items-center h-14 px-2 sm:px-4 gap-1 sm:gap-2 border-b flex-shrink-0" style={{ background: "linear-gradient(180deg, #151515 0%, #111111 100%)", borderColor: "#1e1e1e" }}>

        {/* LEFT: BPM + Metronome + Mic */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
            <input type="number" min={40} max={300} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-11 h-6 bg-transparent text-[#D4A843] text-xs text-center font-mono focus:outline-none" />
            <span className="text-[8px] text-[#444] font-medium tracking-wider">BPM</span>
          </div>

          <button onClick={async () => { await setupMetronome(); setMetronomeOn(!metronomeOn); }}
            title="Metronome (M)"
            className={`w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer ${metronomeOn ? "text-[#D4A843]" : "text-[#555] hover:text-[#888]"}`}
            style={{ background: metronomeOn ? "#2a2418" : "#0e0e0e", border: metronomeOn ? "1px solid #D4A84355" : "1px solid #1e1e1e" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L8 22h8L12 2z"/><path d="M12 8l6-3"/></svg>
          </button>

          <div className="hidden sm:flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/>
            </svg>
            <select value={selectedInputDevice}
              onChange={(e) => setSelectedInputDevice(e.target.value)}
              className="bg-[#0e0e0e] border border-[#1e1e1e] rounded px-1.5 py-0.5 text-[9px] text-[#666] outline-none focus:border-[#D4A843] cursor-pointer max-w-[120px] truncate">
              {inputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>
              ))}
              {inputDevices.length === 0 && <option value="">No devices</option>}
            </select>
          </div>
        </div>

        {/* CENTER: Transport controls */}
        <div className="flex-1 flex items-center justify-center gap-1.5">
          <button onClick={rewindToStart} title="Rewind (Enter)"
            className="w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer group"
            style={{ background: "#1a1a1a", border: "1px solid #252525" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#777] group-hover:text-[#ccc] transition-colors">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          {!playing ? (
            <button onClick={playAll} title="Play (Space)" disabled={tracks.length === 0}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer group disabled:opacity-30"
              style={{ background: "linear-gradient(180deg, #1a3a1a 0%, #143014 100%)", border: "1px solid #33aa3355", boxShadow: "0 2px 8px rgba(34,197,94,0.1)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-[#4ade80] group-hover:text-white transition-colors">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          ) : (
            <button onClick={stopAll} title="Pause (Space)"
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer"
              style={{ background: "linear-gradient(180deg, #1a3a1a 0%, #143014 100%)", border: "1px solid #22c55e", boxShadow: "0 0 12px rgba(34,197,94,0.25)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
              </svg>
            </button>
          )}

          <button onClick={stopAll} title="Stop"
            className="w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer group"
            style={{ background: "#1a1a1a", border: "1px solid #252525" }}>
            <div className="w-3 h-3 rounded-[2px] bg-[#777] group-hover:bg-[#ccc] transition-colors" />
          </button>

          {/* Record */}
          {!isRec ? (
            <button onClick={startRec} title="Record (R)"
              className="w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer group"
              style={{ background: "#1e1215", border: "1px solid #C41E3A44" }}>
              <div className="w-3.5 h-3.5 rounded-full group-hover:scale-110 transition-transform" style={{ background: "radial-gradient(circle at 40% 35%, #ff4466, #C41E3A)" }} />
            </button>
          ) : (
            <button onClick={stopRec} title="Stop Recording"
              className="w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer"
              style={{ background: "#C41E3A", border: "1px solid #ee3355", animation: "pulse 1.5s ease-in-out infinite" }}>
              <div className="w-3 h-3 rounded-sm bg-white" />
            </button>
          )}

          {/* Loop */}
          <button onClick={() => setLooping(!looping)} title="Loop (C)"
            className={`w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer ${looping ? "text-[#D4A843]" : "text-[#555] hover:text-[#888]"}`}
            style={{ background: looping ? "#2a2418" : "#1a1a1a", border: looping ? "1px solid #D4A84355" : "1px solid #252525" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-[#1e1e1e] mx-1" />

          {/* Time display */}
          <div className="px-3 py-1 rounded font-mono text-sm flex items-center min-w-[120px] justify-center relative overflow-hidden"
            style={{ background: "#050505", border: "1px solid #1a1a1a", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)" }}>
            <span className="text-[#D4A84322] absolute tracking-[2px]" style={{ fontFamily: "'Courier New', monospace", fontSize: "15px" }}>88:88.8</span>
            <span className="text-[#D4A843] relative tracking-[2px]" style={{ fontFamily: "'Courier New', monospace", fontSize: "15px", textShadow: "0 0 8px rgba(212,168,67,0.4)" }}>{fmtTime(currentTime)}</span>
          </div>
          <span className="text-[10px] text-[#333] font-mono">/</span>
          <span className="text-[10px] text-[#444] font-mono">{fmtTime(duration)}</span>

          {/* Recording indicator */}
          {isRec && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
              <span className="font-mono text-[11px] text-[#C41E3A]">{fmtTime(recTime)}</span>
              <div className="w-14 h-1.5 bg-[#0a0a0a] rounded overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                <div className="h-full transition-all duration-75 rounded" style={{
                  width: `${Math.min(100, recLevel * 100)}%`,
                  background: recLevel > 0.8 ? "linear-gradient(90deg, #22c55e, #ef4444)" : "linear-gradient(90deg, #22c55e, #D4A843)",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Master volume + Save + Track count */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-[#333] font-mono hidden sm:inline">{tracks.length} trk</span>
          {looping && <span className="text-[7px] text-[#D4A843] bg-[#D4A84315] px-1 py-0.5 rounded font-bold tracking-wider">LOOP</span>}

          <div className="hidden sm:flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="flex-shrink-0">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/>
            </svg>
            <input type="range" min={0} max={100} value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="w-16 accent-[#D4A843] h-1 cursor-pointer" />
            <span className="text-[8px] text-[#444] font-mono w-6">{masterVol}%</span>
          </div>

          <button onClick={saveToRecordings} disabled={tracks.length === 0 || savingToLibrary}
            className="text-[9px] font-semibold px-2.5 py-1.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: tracks.length > 0 ? "linear-gradient(180deg, #D4A843 0%, #B8922E 100%)" : "#1a1a1a",
              color: tracks.length > 0 ? "#111" : "#555",
              border: tracks.length > 0 ? "none" : "1px solid #252525",
            }}>
            {savingToLibrary ? "..." : "Save"}
          </button>
        </div>
      </div>

      {/* ═══════════ CENTER: TRACK AREA (full width timeline) ═══════════ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden"
        onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>

        {/* Track list */}
        <div className="min-h-0">
          {tracks.map((tr) => (
            <div key={tr.id} className="flex border-b" style={{ borderColor: "#1a1a1a" }}>

              {/* ─── Track Header (channel strip) ─── */}
              <div className="w-[180px] sm:w-[220px] flex-shrink-0 flex flex-col justify-center px-3 py-2 gap-1.5"
                style={{ background: "#0e0e0e", borderRight: `2px solid ${tr.color}44` }}>

                {/* Track name + type icon */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tr.color }} />
                  <span className="text-[9px] text-[#444] flex-shrink-0">
                    {tr.type === "drum" ? "\uD83E\uDD41" : tr.type === "suno" ? "\uD83C\uDFB5" : tr.type === "recording" ? "\uD83C\uDF99" : "\uD83D\uDCC1"}
                  </span>
                  {editingTrackName === tr.id ? (
                    <input autoFocus defaultValue={tr.name}
                      onBlur={(e) => { renameTrack(tr.id, e.target.value || tr.name); setEditingTrackName(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { renameTrack(tr.id, (e.target as HTMLInputElement).value || tr.name); setEditingTrackName(null); } }}
                      className="flex-1 bg-[#0a0a0a] border border-[#D4A843] rounded px-1.5 py-0.5 text-[10px] text-[#ccc] outline-none min-w-0" />
                  ) : (
                    <span className="flex-1 text-[11px] text-[#ccc] font-medium truncate min-w-0 cursor-pointer hover:text-[#D4A843] transition-colors"
                      onDoubleClick={() => setEditingTrackName(tr.id)}>
                      {tr.name}
                    </span>
                  )}
                </div>

                {/* Volume fader */}
                <div className="flex items-center gap-1">
                  <span className="text-[7px] text-[#444] w-5 font-mono">VOL</span>
                  <input type="range" min={0} max={100} value={tr.volume}
                    onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
                    className="flex-1 h-[2px] cursor-pointer" style={{ accentColor: tr.color }} />
                  <span className="text-[8px] text-[#555] font-mono w-7 text-right">{tr.volume}%</span>
                </div>

                {/* Pan placeholder + S/M buttons + delete */}
                <div className="flex items-center gap-1">
                  <span className="text-[7px] text-[#444] w-5 font-mono">PAN</span>
                  <div className="flex-1 h-[2px] rounded-full" style={{ background: "#1e1e1e" }}>
                    <div className="w-1/2 h-full rounded-full" style={{ background: "#333" }} />
                  </div>

                  {/* Solo (S) button - amber when active (placeholder, toggles mute on others) */}
                  <button onClick={() => {
                    // Solo: mute all other tracks
                    setTracks(prev => {
                      const allOthersMuted = prev.filter(t => t.id !== tr.id).every(t => t.muted);
                      if (allOthersMuted) {
                        return prev.map(t => ({ ...t, muted: false }));
                      }
                      return prev.map(t => t.id === tr.id ? { ...t, muted: false } : { ...t, muted: true });
                    });
                  }}
                    className={`text-[8px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${
                      !tr.muted && tracks.filter(t => t.id !== tr.id).every(t => t.muted) && tracks.length > 1
                        ? "text-[#111] border-none" : "border border-[#2a2a2a] text-[#555] hover:border-[#D4A843] hover:text-[#D4A843]"
                    }`}
                    style={{
                      background: !tr.muted && tracks.filter(t => t.id !== tr.id).every(t => t.muted) && tracks.length > 1
                        ? "#D4A843" : "transparent"
                    }}>
                    S
                  </button>

                  {/* Mute (M) button - red when active */}
                  <button onClick={() => toggleMute(tr.id)}
                    className={`text-[8px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${tr.muted ? "text-white border-none" : "border border-[#2a2a2a] text-[#555] hover:border-[#ef4444] hover:text-[#ef4444]"}`}
                    style={{ background: tr.muted ? "#ef4444" : "transparent" }}>
                    M
                  </button>

                  {/* Drum grid toggle */}
                  {tr.type === "drum" && (
                    <button onClick={() => handleDrumGridToggle(tr.id)}
                      className={`text-[7px] px-1.5 h-5 rounded cursor-pointer transition-all ${expandedDrumTrackId === tr.id && dockPanel === "drums" ? "bg-[#D4A84330] text-[#D4A843] border border-[#D4A84340]" : "border border-[#2a2a2a] text-[#555] hover:border-[#444]"}`}>
                      GRID
                    </button>
                  )}

                  {/* Delete */}
                  <button onClick={() => deleteTrack(tr.id)}
                    className="w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#ef4444] hover:bg-[#ef444410] transition-all cursor-pointer">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* ─── Waveform / Pattern area (fills remaining width) ─── */}
              <div className="flex-1 min-w-0" style={{ background: "#0c0c0c" }}>
                {tr.type !== "drum" ? (
                  <div ref={(el) => { if (el) trackContainersRef.current[tr.id] = el; }}
                    className="h-[90px]" style={{ opacity: tr.muted ? 0.3 : 1 }} />
                ) : (
                  <div className="h-[90px] flex items-center px-3" style={{ opacity: tr.muted ? 0.3 : 1 }}>
                    {/* Mini pattern preview for drum tracks */}
                    {tr.drumPattern && (
                      <div className="flex gap-[1px]">
                        {Array.from({ length: DRUM_STEPS }, (_, stepIdx) => {
                          const activeCount = tr.drumPattern!.reduce((cnt, row) => cnt + (row[stepIdx] ? 1 : 0), 0);
                          return (
                            <div key={stepIdx} className="flex flex-col gap-[1px]"
                              style={{ marginRight: stepIdx % 4 === 3 && stepIdx < DRUM_STEPS - 1 ? "4px" : "0" }}>
                              {Array.from({ length: 4 }, (_, rowGroup) => (
                                <div key={rowGroup}
                                  className="w-[6px] h-[6px] rounded-[1px]"
                                  style={{
                                    background: activeCount > rowGroup
                                      ? drumStep === stepIdx ? "#D4A843" : `${tr.color}99`
                                      : drumStep === stepIdx ? "#222" : "#181818",
                                  }} />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={() => handleDrumGridToggle(tr.id)}
                      className="ml-auto text-[9px] text-[#555] hover:text-[#D4A843] cursor-pointer transition-colors">
                      {expandedDrumTrackId === tr.id && dockPanel === "drums" ? "Close Grid" : "Open Grid"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ─── EMPTY STATE / ADD TRACK ─── */}
          {tracks.length === 0 && !isRec ? (
            <div className="flex items-center justify-center py-20" style={{ background: "#0a0a0a" }}>
              <div className="border-2 border-dashed rounded-2xl px-16 py-12 text-center" style={{ borderColor: "#222", maxWidth: "420px" }}>
                <div className="text-[48px] leading-none mb-4 opacity-15" style={{ color: "#555" }}>{"\u266A"}</div>
                <div className="text-[#555] text-[14px] font-medium mb-2">Drop a loop or audio file</div>
                <div className="text-[#333] text-[11px]">or use the buttons below to get started</div>
              </div>
            </div>
          ) : null}

          {/* Add track bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 relative" style={{ background: "#0a0a0a", borderTop: tracks.length > 0 ? "1px solid #1a1a1a" : "none" }}>
            <button onClick={() => setShowAddTrackMenu(!showAddTrackMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] text-[#666] hover:text-[#D4A843] transition-colors cursor-pointer"
              style={{ background: "#111", border: "1px solid #1e1e1e" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Track
            </button>
            <button onClick={startRec}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[#555] hover:text-[#C41E3A] transition-colors cursor-pointer border border-[#1a1a1a] hover:border-[#C41E3A33]">
              {"\uD83C\uDF99"} Record
            </button>
            <button onClick={addDrumTrack}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[#555] hover:text-[#D4A843] transition-colors cursor-pointer border border-[#1a1a1a] hover:border-[#D4A84333]">
              {"\uD83E\uDD41"} Drums
            </button>
            <button onClick={() => { setDockPanel(dockPanel === "suno" ? null : "suno"); setShowSunoPanel(dockPanel !== "suno"); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[#555] hover:text-[#D4A843] transition-colors cursor-pointer border border-[#1a1a1a] hover:border-[#D4A84333]">
              {"\uD83C\uDFB5"} AI Backing
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[#555] hover:text-[#888] transition-colors cursor-pointer border border-[#1a1a1a] hover:border-[#33333366]">
              {"\uD83D\uDCC1"} Import
            </button>

            {showAddTrackMenu && (
              <div className="absolute bottom-full left-0 mb-1 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 min-w-[200px]"
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { startRec(); setShowAddTrackMenu(false); }}
                  className="w-full text-left text-[11px] text-[#ccc] hover:bg-[#222] px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3">
                  <span className="text-[14px]">{"\uD83C\uDF99"}</span>
                  <div><div className="font-medium">Record</div><div className="text-[9px] text-[#555]">Mic / Audio Interface</div></div>
                </button>
                <button onClick={() => { fileRef.current?.click(); setShowAddTrackMenu(false); }}
                  className="w-full text-left text-[11px] text-[#ccc] hover:bg-[#222] px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3">
                  <span className="text-[14px]">{"\uD83D\uDCC1"}</span>
                  <div><div className="font-medium">Import File</div><div className="text-[9px] text-[#555]">WAV, MP3, OGG, FLAC</div></div>
                </button>
                <div className="border-t border-[#222] my-0.5" />
                <button onClick={() => { addDrumTrack(); setShowAddTrackMenu(false); }}
                  className="w-full text-left text-[11px] text-[#ccc] hover:bg-[#222] px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3">
                  <span className="text-[14px]">{"\uD83E\uDD41"}</span>
                  <div><div className="font-medium">Drum Machine</div><div className="text-[9px] text-[#555]">Step sequencer</div></div>
                </button>
                <button onClick={() => { setDockPanel("suno"); setShowSunoPanel(true); setShowAddTrackMenu(false); }}
                  className="w-full text-left text-[11px] text-[#ccc] hover:bg-[#222] px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3">
                  <span className="text-[14px]">{"\uD83C\uDFB5"}</span>
                  <div><div className="font-medium">AI Backing Track</div><div className="text-[9px] text-[#555]">Generate with Suno AI</div></div>
                </button>
                <button onClick={() => { setDockPanel("looper"); setShowLooper(true); setShowAddTrackMenu(false); }}
                  className="w-full text-left text-[11px] text-[#ccc] hover:bg-[#222] px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3">
                  <span className="text-[14px]">{"\uD83D\uDD01"}</span>
                  <div><div className="font-medium">Looper</div><div className="text-[9px] text-[#555]">Record & overdub</div></div>
                </button>
              </div>
            )}

            <input ref={fileRef} type="file" accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg,audio/flac,audio/*" className="hidden" multiple
              onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach((f) => importFile(f)); }} />
          </div>
        </div>
      </div>

      {/* ═══════════ BOTTOM DOCK: Tab-based panels ═══════════ */}
      <div className="flex-shrink-0" style={{ borderTop: "1px solid #1e1e1e" }}>

        {/* Dock tabs */}
        <div className="flex items-center h-8 px-1 gap-0.5" style={{ background: "#0e0e0e" }}>
          {([
            { key: "drums" as const, label: "Drum Machine", icon: "\uD83E\uDD41" },
            { key: "looper" as const, label: "Looper", icon: "\uD83D\uDD01" },
            { key: "suno" as const, label: "AI Backing", icon: "\uD83C\uDFB5" },
            { key: "mixer" as const, label: "Mixer", icon: "\uD83C\uDFA8" },
            { key: "recordings" as const, label: "Recordings", icon: "\uD83D\uDCBE" },
          ]).map((tab) => (
            <button key={tab.key}
              onClick={() => {
                const newPanel = dockPanel === tab.key ? null : tab.key;
                setDockPanel(newPanel);
                if (tab.key === "looper") setShowLooper(newPanel === "looper");
                if (tab.key === "suno") setShowSunoPanel(newPanel === "suno");
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-t text-[9px] font-medium cursor-pointer transition-all ${dockPanel === tab.key ? "text-[#ccc]" : "text-[#555] hover:text-[#888]"}`}
              style={{
                background: dockPanel === tab.key ? "#111" : "transparent",
                borderTop: dockPanel === tab.key ? "2px solid #D4A843" : "2px solid transparent",
              }}>
              <span className="text-[16px] sm:text-[13px]">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-[8px]">{tab.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {/* Dock panel content */}
        {dockPanel && (
          <div className="overflow-y-auto" style={{ background: "#111", height: "300px", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>

            {/* ─── DRUM MACHINE panel ─── */}
            {dockPanel === "drums" && (
              <div className="p-3">
                {activeDrumTrack && activeDrumTrack.drumPattern ? (
                  <div className="overflow-x-auto">
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => {
                          if (drumPlaying) stopDrumPlayback();
                          else if (activeDrumTrack.drumPattern) startDrumPlayback(activeDrumTrack.drumPattern, activeDrumTrack.id);
                        }}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${drumPlaying ? "bg-[#ef4444] text-white" : "bg-[#D4A843] text-[#111]"}`}>
                        {drumPlaying ? "Stop" : "Play Pattern"}
                      </button>
                      <span className="text-[10px] text-[#555] font-mono">{bpm} BPM</span>
                      <button onClick={() => {
                        setTracks((prev) => prev.map((t) => t.id === activeDrumTrack.id ? { ...t, drumPattern: createEmptyDrumPattern() } : t));
                      }} className="text-[10px] text-[#555] hover:text-[#ef4444] cursor-pointer transition-colors px-2 py-1 rounded border border-[#1e1e1e]">Clear</button>
                      <select title="Drum preset"
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          if (idx >= 0 && idx < DRUM_PRESETS.length) {
                            setTracks((prev) => prev.map((t) => t.id === activeDrumTrack.id ? { ...t, drumPattern: DRUM_PRESETS[idx].pattern.map(r => [...r]) } : t));
                          }
                          e.target.value = "";
                        }}
                        defaultValue=""
                        className="bg-[#1a1a1a] text-[10px] text-[#888] border border-[#2a2a2a] rounded px-2 py-1 cursor-pointer">
                        <option value="" disabled>Presets...</option>
                        {DRUM_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
                      </select>
                      <span className="text-[9px] text-[#333] ml-auto">{activeDrumTrack.name}</span>
                    </div>

                    {/* Step grid - bigger cells (32px) with beat grouping */}
                    <div className="inline-block" style={{ minWidth: "fit-content" }}>
                      <div className="flex items-center mb-1" style={{ paddingLeft: 80 }}>
                        {Array.from({ length: DRUM_STEPS }, (_, i) => (
                          <div key={i}
                            className={`flex items-center justify-center text-[8px] font-mono ${drumStep === i ? "text-[#D4A843] font-bold" : i % 4 === 0 ? "text-[#666]" : "text-[#333]"}`}
                            style={{ width: 32, marginRight: i % 4 === 3 && i < DRUM_STEPS - 1 ? 6 : 0 }}>
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      {DRUM_INSTRUMENTS.map((instr, instrIdx) => (
                        <div key={instr.name} className="flex items-center mb-[2px]">
                          <div className="w-[80px] flex-shrink-0 text-[10px] text-[#888] truncate pr-2 text-right font-medium">{instr.name}</div>
                          {activeDrumTrack.drumPattern![instrIdx].map((on, stepIdx) => (
                            <button key={stepIdx}
                              onClick={() => toggleDrumCell(activeDrumTrack.id, instrIdx, stepIdx)}
                              style={{
                                width: 32,
                                height: 32,
                                marginRight: stepIdx % 4 === 3 && stepIdx < DRUM_STEPS - 1 ? 6 : 0,
                                borderRadius: 3,
                                border: on ? "1px solid #D4A84366" : stepIdx % 4 === 0 ? "1px solid #2a2a2a" : "1px solid #1e1e1e",
                                background: on
                                  ? drumStep === stepIdx ? "#D4A843" : "#D4A84399"
                                  : drumStep === stepIdx ? "#252525" : stepIdx % 4 === 0 ? "#1a1a1a" : "#141414",
                                cursor: "pointer",
                                transition: "all 0.1s",
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-[#444] text-[11px]">
                    No drum track selected. Add a drum track and click GRID to edit.
                  </div>
                )}
              </div>
            )}

            {/* ─── LOOPER panel ─── */}
            {dockPanel === "looper" && (
              <div className="p-3">
                <LooperBox />
              </div>
            )}

            {/* ─── AI BACKING (Suno) panel ─── */}
            {dockPanel === "suno" && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span className="text-[11px] text-[#ccc] font-medium">Suno AI Backing Track</span>
                  </div>
                  {sunoCredits !== null && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${sunoCredits <= 10 ? "text-[#ef4444] bg-[#ef444415]" : "text-[#D4A843] bg-[#D4A84315]"}`}>
                      {sunoCreditsLoading ? "..." : `${sunoCredits} credits`}
                    </span>
                  )}
                </div>

                {/* Suno tabs */}
                <div className="flex mb-3 gap-0.5" style={{ borderBottom: "1px solid #1e1e1e" }}>
                  {(["generate", "library", "credits"] as const).map((tab) => (
                    <button key={tab} onClick={() => setSunoTab(tab)}
                      className="text-[10px] py-1.5 px-3 font-medium transition-all cursor-pointer"
                      style={{ color: sunoTab === tab ? "#D4A843" : "#555", borderBottom: sunoTab === tab ? "2px solid #D4A843" : "2px solid transparent" }}>
                      {tab === "generate" ? "Generate" : tab === "library" ? "Library" : "Credits"}
                    </button>
                  ))}
                </div>

                {sunoTab === "generate" && (
                  <div className="space-y-2 max-w-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#555]">Prompt mode</span>
                      <button onClick={() => { setSunoCustomPrompt(!sunoCustomPrompt); setSunoGeneratedTracks([]); }}
                        className="text-[9px] px-2 py-0.5 rounded cursor-pointer transition-all"
                        style={{ background: sunoCustomPrompt ? "#D4A84320" : "#1a1a1a", color: sunoCustomPrompt ? "#D4A843" : "#666", border: `1px solid ${sunoCustomPrompt ? "#D4A84340" : "#252525"}` }}>
                        {sunoCustomPrompt ? "Custom" : "Builder"}
                      </button>
                    </div>
                    {!sunoCustomPrompt ? (
                      <>
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <span className="text-[8px] text-[#555] block mb-0.5">Key</span>
                            <select value={sunoScale} onChange={(e) => setSunoScale(e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1 text-[10px] text-[#aaa] outline-none focus:border-[#D4A843] cursor-pointer">
                              {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </label>
                          <label className="flex-1">
                            <span className="text-[8px] text-[#555] block mb-0.5">Mode</span>
                            <select value={sunoMode} onChange={(e) => setSunoMode(e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1 text-[10px] text-[#aaa] outline-none focus:border-[#D4A843] cursor-pointer">
                              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <span className="text-[8px] text-[#555] block mb-0.5">Style</span>
                            <select value={sunoStyle} onChange={(e) => setSunoStyle(e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1 text-[10px] text-[#aaa] outline-none focus:border-[#D4A843] cursor-pointer">
                              {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </label>
                          <label className="w-24">
                            <span className="text-[8px] text-[#555] block mb-0.5">BPM</span>
                            <input type="number" value={sunoBpm} min={40} max={300}
                              onChange={(e) => setSunoBpm(Math.min(300, Math.max(40, Number(e.target.value))))}
                              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1 text-[10px] text-[#D4A843] outline-none focus:border-[#D4A843] font-mono" />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span className="text-[8px] text-[#555] block mb-0.5">Custom Prompt</span>
                        <textarea value={sunoPromptText}
                          onChange={(e) => setSunoPromptText(e.target.value.slice(0, 200))}
                          placeholder="e.g. heavy metal, E minor, 140 BPM..."
                          rows={3}
                          className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1.5 text-[10px] text-[#aaa] outline-none focus:border-[#D4A843] resize-none placeholder:text-[#333]" />
                        <div className="text-[8px] text-right mt-0.5" style={{ color: sunoPromptText.length > 180 ? "#ef4444" : "#444" }}>{sunoPromptText.length}/200</div>
                      </div>
                    )}
                    <div className="rounded p-2" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                      <span className="text-[8px] text-[#444] block mb-1">Preview</span>
                      <div className="text-[9px] text-[#777] font-mono leading-relaxed">{sunoStylePreview || <span className="text-[#333] italic">Enter a prompt...</span>}</div>
                    </div>
                    {!sunoConfirm ? (
                      <button onClick={() => setSunoConfirm(true)} disabled={sunoLoading || (sunoCustomPrompt && !sunoPromptText.trim())}
                        className="w-full text-[10px] py-2 rounded-md text-white hover:brightness-110 disabled:opacity-40 cursor-pointer transition-all font-medium"
                        style={{ background: "linear-gradient(135deg, #D4A843, #B8922E)" }}>
                        {sunoLoading ? "Generating..." : "Generate Backing Track"}
                      </button>
                    ) : (
                      <div className="rounded p-2.5 space-y-2" style={{ background: "#0a0a0a", border: "1px solid #D4A84320" }}>
                        <span className="text-[10px] text-[#aaa]">This will use <strong className="text-[#D4A843]">~10 credits</strong></span>
                        <div className="flex gap-1.5">
                          <button onClick={generateSuno} disabled={sunoLoading}
                            className="flex-1 text-[10px] py-1.5 rounded text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all font-medium bg-[#D4A843]">
                            {sunoLoading ? "Generating..." : "Confirm"}
                          </button>
                          <button onClick={() => setSunoConfirm(false)}
                            className="flex-1 text-[10px] py-1.5 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#222] cursor-pointer transition-all">Cancel</button>
                        </div>
                      </div>
                    )}
                    {sunoError && <div className="text-[10px] text-[#ef4444] bg-[#ef444410] rounded p-2">{sunoError}</div>}
                    {sunoGeneratedTracks.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-[#555] block">Generated Tracks</span>
                        {sunoGeneratedTracks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 rounded p-2" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                            <button onClick={() => sunoPlayTrack(t.audioUrl, t.id)}
                              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                              style={{ background: sunoPlayingId === t.id ? "#D4A843" : "#1a1a1a", border: `1px solid ${sunoPlayingId === t.id ? "#D4A843" : "#2a2a2a"}` }}>
                              {sunoPlayingId === t.id ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="#aaa"><polygon points="5,3 19,12 5,21"/></svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-[#ccc] truncate">{t.title}</div>
                              {t.duration > 0 && <div className="text-[8px] text-[#444] font-mono">{Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, "0")}</div>}
                            </div>
                            <button onClick={() => sunoAddToDaw(t.title, t.audioUrl)}
                              className="text-[9px] px-2 py-1 rounded cursor-pointer transition-all hover:brightness-125"
                              style={{ background: "#D4A84320", color: "#D4A843", border: "1px solid #D4A84330" }}>
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sunoTab === "library" && (
                  <div className="space-y-2">
                    <input value={sunoLibSearch} onChange={(e) => setSunoLibSearch(e.target.value)}
                      placeholder="Search tracks..."
                      className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1.5 text-[10px] text-[#aaa] outline-none focus:border-[#D4A843] placeholder:text-[#333] max-w-md" />
                    <div className="space-y-1 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                      {(() => {
                        const filtered = sunoLibrary.filter((t) => !sunoLibSearch || t.title.toLowerCase().includes(sunoLibSearch.toLowerCase()));
                        const favs = filtered.filter((t) => t.favorite);
                        const rest = filtered.filter((t) => !t.favorite);
                        const sorted = [...favs, ...rest];
                        if (sorted.length === 0) return <div className="text-center py-6 text-[10px] text-[#444]">No tracks yet</div>;
                        return sorted.map((t) => (
                          <div key={t.id} className="rounded p-2 group hover:bg-[#1a1a1a] transition-colors" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                            <div className="flex items-center gap-2">
                              <button onClick={() => sunoPlayTrack(t.audioUrl, t.id)}
                                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                                style={{ background: sunoPlayingId === t.id ? "#D4A843" : "#1a1a1a", border: `1px solid ${sunoPlayingId === t.id ? "#D4A843" : "#2a2a2a"}` }}>
                                {sunoPlayingId === t.id ? (
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                ) : (
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#666"><polygon points="5,3 19,12 5,21"/></svg>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-[#ccc] truncate">{t.title}</div>
                                <div className="text-[8px] text-[#444] font-mono">
                                  {t.params && `${t.params.scale} ${t.params.mode}`} {t.params?.bpm && `${t.params.bpm}bpm`}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => sunoToggleFavorite(t.id, t.favorite)} className="w-5 h-5 flex items-center justify-center rounded cursor-pointer hover:bg-[#222]">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill={t.favorite ? "#D4A843" : "none"} stroke={t.favorite ? "#D4A843" : "#555"} strokeWidth="2">
                                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                                  </svg>
                                </button>
                                <button onClick={() => sunoAddToDaw(t.title, t.audioUrl)} className="w-5 h-5 flex items-center justify-center rounded cursor-pointer hover:bg-[#222]">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                </button>
                                <button onClick={() => sunoDeleteTrack(t.id)} className="w-5 h-5 flex items-center justify-center rounded cursor-pointer hover:bg-[#ef444420]">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,01-2,2H7a2,2,0,01-2-2V6m3,0V4a2,2,0,012-2h4a2,2,0,012,2v2"/></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {sunoTab === "credits" && (
                  <div className="space-y-3 text-center py-4">
                    <div className="text-[28px] font-bold text-[#D4A843]">{sunoCreditsLoading ? "..." : (sunoCredits ?? "--")}</div>
                    <div className="text-[10px] text-[#555]">credits remaining</div>
                    <button onClick={fetchSunoCredits} disabled={sunoCreditsLoading}
                      className="text-[9px] py-1.5 px-4 rounded cursor-pointer transition-all disabled:opacity-50"
                      style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222" }}>
                      {sunoCreditsLoading ? "Refreshing..." : "Refresh Credits"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── MIXER panel ─── */}
            {dockPanel === "mixer" && (
              <div className="p-3">
                {tracks.length === 0 ? (
                  <div className="text-center py-10 text-[#444] text-[11px]">No tracks to mix. Add some tracks first.</div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                    {tracks.map((tr) => (
                      <div key={tr.id} className="flex flex-col items-center gap-2 px-3 py-2 rounded-lg min-w-[70px]"
                        style={{ background: "#0e0e0e", border: `1px solid ${tr.color}33` }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: tr.color }} />
                        <span className="text-[8px] text-[#888] truncate max-w-[60px] text-center">{tr.name}</span>
                        {/* Vertical fader representation */}
                        <div className="relative w-3 h-32 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
                          <div className="absolute bottom-0 w-full rounded-full transition-all" style={{ height: `${tr.volume}%`, background: `${tr.color}88` }} />
                        </div>
                        <input type="range" min={0} max={100} value={tr.volume}
                          onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
                          className="w-20 h-[2px] cursor-pointer -rotate-0" style={{ accentColor: tr.color }} />
                        <span className="text-[8px] text-[#555] font-mono">{tr.volume}%</span>
                        <div className="flex gap-1">
                          <button onClick={() => {
                            setTracks(prev => {
                              const allOthersMuted = prev.filter(t => t.id !== tr.id).every(t => t.muted);
                              if (allOthersMuted) return prev.map(t => ({ ...t, muted: false }));
                              return prev.map(t => t.id === tr.id ? { ...t, muted: false } : { ...t, muted: true });
                            });
                          }}
                            className={`text-[7px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${
                              !tr.muted && tracks.filter(t => t.id !== tr.id).every(t => t.muted) && tracks.length > 1
                                ? "text-[#111]" : "border border-[#2a2a2a] text-[#555] hover:border-[#D4A843] hover:text-[#D4A843]"
                            }`}
                            style={{ background: !tr.muted && tracks.filter(t => t.id !== tr.id).every(t => t.muted) && tracks.length > 1 ? "#D4A843" : "transparent" }}>
                            S
                          </button>
                          <button onClick={() => toggleMute(tr.id)}
                            className={`text-[7px] font-bold w-5 h-5 rounded cursor-pointer flex items-center justify-center transition-all ${tr.muted ? "text-white" : "border border-[#2a2a2a] text-[#555] hover:border-[#ef4444] hover:text-[#ef4444]"}`}
                            style={{ background: tr.muted ? "#ef4444" : "transparent" }}>
                            M
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Master channel */}
                    <div className="flex flex-col items-center gap-2 px-3 py-2 rounded-lg min-w-[70px]"
                      style={{ background: "#0e0e0e", border: "1px solid #D4A84333" }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: "#D4A843" }} />
                      <span className="text-[8px] text-[#D4A843] font-medium">Master</span>
                      <div className="relative w-3 h-32 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
                        <div className="absolute bottom-0 w-full rounded-full transition-all" style={{ height: `${masterVol}%`, background: "#D4A84388" }} />
                      </div>
                      <input type="range" min={0} max={100} value={masterVol}
                        onChange={(e) => setMasterVol(Number(e.target.value))}
                        className="w-20 h-[2px] cursor-pointer accent-[#D4A843]" />
                      <span className="text-[8px] text-[#555] font-mono">{masterVol}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── RECORDINGS panel ─── */}
            {dockPanel === "recordings" && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-[#888] font-medium">My Recordings {savedRecordings.length > 0 && `(${savedRecordings.length})`}</span>
                  <input value={recSearchQuery} onChange={(e) => setRecSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1 text-[9px] text-[#aaa] outline-none focus:border-[#D4A84333] w-40 placeholder:text-[#333]" />
                </div>

                {filteredRecordings.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-[10px] text-[#444]">No saved recordings</div>
                    <div className="text-[8px] text-[#333] mt-1">Record and save to build your library</div>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1a1a1a] max-h-[230px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                    {filteredRecordings.map((rec) => {
                      const isPreviewing = previewingRecId === rec.id;
                      const isEditing = editingRecId === rec.id;
                      const date = new Date(rec.date);
                      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const durMin = Math.floor(rec.duration / 60);
                      const durSec = Math.floor(rec.duration % 60);
                      const durStr = `${durMin}:${String(durSec).padStart(2, "0")}`;
                      return (
                        <div key={rec.id} className="flex items-center gap-2 px-2 py-2 hover:bg-[#1a1a1a] transition-colors group">
                          <button onClick={() => previewRecording(rec.id)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all ${isPreviewing ? "bg-[#D4A843] text-white" : "bg-[#1a1a1a] text-[#666] border border-[#2a2a2a] hover:border-[#444]"}`}>
                            {isPreviewing ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <input autoFocus defaultValue={rec.name}
                                onBlur={(e) => renameRecordingItem(rec.id, e.target.value || rec.name)}
                                onKeyDown={(e) => { if (e.key === "Enter") renameRecordingItem(rec.id, (e.target as HTMLInputElement).value || rec.name); if (e.key === "Escape") setEditingRecId(null); }}
                                className="w-full bg-[#0a0a0a] border border-[#D4A843] rounded px-1 py-0 text-[10px] text-[#ccc] outline-none" />
                            ) : (
                              <div className="text-[10px] text-[#ccc] font-medium truncate cursor-pointer" onDoubleClick={() => setEditingRecId(rec.id)}>{rec.name}</div>
                            )}
                            <div className="text-[8px] text-[#555] flex items-center gap-1.5">
                              <span>{durStr}</span><span>{"\u00B7"}</span><span>{dateStr}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => importRecordingToProject(rec)} title="Add to project"
                              className="w-6 h-6 rounded flex items-center justify-center text-[#555] hover:text-[#22c55e] transition-colors cursor-pointer">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                            <button onClick={() => removeRecording(rec.id)} title="Delete"
                              className="w-6 h-6 rounded flex items-center justify-center text-[#444] hover:text-[#ef4444] transition-colors cursor-pointer">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
