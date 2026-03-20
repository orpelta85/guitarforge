"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Music Theory Data ──

const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteIndex(name: string): number {
  const n = name.replace("m", "").replace("7", "").trim();
  let idx = NOTE_NAMES.indexOf(n);
  if (idx === -1) idx = FLAT_NAMES.indexOf(n);
  return idx === -1 ? 0 : idx;
}

function noteName(idx: number, preferFlat = false): string {
  const i = ((idx % 12) + 12) % 12;
  return preferFlat ? FLAT_NAMES[i] : NOTE_NAMES[i];
}

// Intervals from root for each scale degree in major scale: W W H W W W H
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
// Natural minor intervals
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

interface ChordDef {
  root: string;
  quality: string;
  numeral: string;
  display: string;
}

interface JamProgression {
  name: string;
  genre: string;
  numerals: string[];
  // Degree offsets from key root and qualities
  degrees: { semitones: number; quality: string; numeral: string }[];
}

const PROGRESSIONS: JamProgression[] = [
  {
    name: "12-Bar Blues", genre: "Blues",
    numerals: ["I", "I", "IV", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"],
    degrees: [
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 7, quality: "7", numeral: "V7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 7, quality: "7", numeral: "V7" },
    ],
  },
  {
    name: "Blues Shuffle", genre: "Blues",
    numerals: ["I", "IV", "I", "V"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 5, quality: "", numeral: "IV" },
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 7, quality: "", numeral: "V" },
    ],
  },
  {
    name: "Classic Rock", genre: "Rock",
    numerals: ["I", "bVII", "IV", "I"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 10, quality: "", numeral: "bVII" },
      { semitones: 5, quality: "", numeral: "IV" },
      { semitones: 0, quality: "", numeral: "I" },
    ],
  },
  {
    name: "Power Ballad", genre: "Rock",
    numerals: ["I", "V", "vi", "IV"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 7, quality: "", numeral: "V" },
      { semitones: 9, quality: "m", numeral: "vi" },
      { semitones: 5, quality: "", numeral: "IV" },
    ],
  },
  {
    name: "Jazz ii-V-I", genre: "Jazz",
    numerals: ["ii", "V", "I", "vi"],
    degrees: [
      { semitones: 2, quality: "m7", numeral: "ii" },
      { semitones: 7, quality: "7", numeral: "V7" },
      { semitones: 0, quality: "maj7", numeral: "Imaj7" },
      { semitones: 9, quality: "m7", numeral: "vi" },
    ],
  },
  {
    name: "Jazz Turnaround", genre: "Jazz",
    numerals: ["I", "vi", "ii", "V"],
    degrees: [
      { semitones: 0, quality: "maj7", numeral: "Imaj7" },
      { semitones: 9, quality: "m7", numeral: "vi" },
      { semitones: 2, quality: "m7", numeral: "ii" },
      { semitones: 7, quality: "7", numeral: "V7" },
    ],
  },
  {
    name: "Metal Power", genre: "Metal",
    numerals: ["i", "bVI", "bVII", "i"],
    degrees: [
      { semitones: 0, quality: "m", numeral: "i" },
      { semitones: 8, quality: "", numeral: "bVI" },
      { semitones: 10, quality: "", numeral: "bVII" },
      { semitones: 0, quality: "m", numeral: "i" },
    ],
  },
  {
    name: "Thrash Riff", genre: "Metal",
    numerals: ["i", "bII", "i", "bVII"],
    degrees: [
      { semitones: 0, quality: "5", numeral: "i" },
      { semitones: 1, quality: "5", numeral: "bII" },
      { semitones: 0, quality: "5", numeral: "i" },
      { semitones: 10, quality: "5", numeral: "bVII" },
    ],
  },
  {
    name: "Doom Metal", genre: "Metal",
    numerals: ["i", "iv", "bVI", "V"],
    degrees: [
      { semitones: 0, quality: "m", numeral: "i" },
      { semitones: 5, quality: "m", numeral: "iv" },
      { semitones: 8, quality: "", numeral: "bVI" },
      { semitones: 7, quality: "", numeral: "V" },
    ],
  },
  {
    name: "Funk Groove", genre: "Funk",
    numerals: ["I7", "IV7", "I7", "V7"],
    degrees: [
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 5, quality: "7", numeral: "IV7" },
      { semitones: 0, quality: "7", numeral: "I7" },
      { semitones: 7, quality: "7", numeral: "V7" },
    ],
  },
  {
    name: "Funk Vamp", genre: "Funk",
    numerals: ["I9", "IV9"],
    degrees: [
      { semitones: 0, quality: "9", numeral: "I9" },
      { semitones: 5, quality: "9", numeral: "IV9" },
    ],
  },
  {
    name: "Pop Punk", genre: "Punk",
    numerals: ["I", "V", "vi", "IV"],
    degrees: [
      { semitones: 0, quality: "", numeral: "I" },
      { semitones: 7, quality: "", numeral: "V" },
      { semitones: 9, quality: "m", numeral: "vi" },
      { semitones: 5, quality: "", numeral: "IV" },
    ],
  },
  {
    name: "Minor Ballad", genre: "Ballad",
    numerals: ["i", "bVI", "bIII", "bVII"],
    degrees: [
      { semitones: 0, quality: "m", numeral: "i" },
      { semitones: 8, quality: "", numeral: "bVI" },
      { semitones: 3, quality: "", numeral: "bIII" },
      { semitones: 10, quality: "", numeral: "bVII" },
    ],
  },
  {
    name: "Neo-Soul", genre: "R&B",
    numerals: ["Imaj7", "iii", "vi", "IV"],
    degrees: [
      { semitones: 0, quality: "maj7", numeral: "Imaj7" },
      { semitones: 4, quality: "m", numeral: "iii" },
      { semitones: 9, quality: "m7", numeral: "vi" },
      { semitones: 5, quality: "maj7", numeral: "IVmaj7" },
    ],
  },
];

const GENRES = [...new Set(PROGRESSIONS.map(p => p.genre))];

function buildChords(prog: JamProgression, key: string): ChordDef[] {
  const root = noteIndex(key);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(key);
  return prog.degrees.map(d => {
    const chordRoot = noteName(root + d.semitones, useFlats);
    return {
      root: chordRoot,
      quality: d.quality,
      numeral: d.numeral,
      display: chordRoot + d.quality,
    };
  });
}

// Scale notes for a given key (natural minor if key ends with 'm', else major)
function getScaleNotes(key: string): { name: string; notes: string[] } {
  const isMinor = key.endsWith("m");
  const rootName = key.replace("m", "");
  const root = noteIndex(rootName);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(rootName);
  const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const notes = intervals.map(i => noteName(root + i, useFlats));
  return {
    name: isMinor ? `${rootName} Natural Minor` : `${rootName} Major`,
    notes,
  };
}

// Pentatonic scale (minor penta for minor keys, major penta for major)
function getPentatonicNotes(key: string): { name: string; notes: string[] } {
  const isMinor = key.endsWith("m");
  const rootName = key.replace("m", "");
  const root = noteIndex(rootName);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(rootName);
  const intervals = isMinor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const notes = intervals.map(i => noteName(root + i, useFlats));
  return {
    name: isMinor ? `${rootName} Minor Pentatonic` : `${rootName} Major Pentatonic`,
    notes,
  };
}

// Blues scale
function getBluesNotes(key: string): { name: string; notes: string[] } {
  const isMinor = key.endsWith("m");
  const rootName = key.replace("m", "");
  const root = noteIndex(rootName);
  const useFlats = ["F", "Bb", "Eb", "Ab", "Db"].includes(rootName);
  const intervals = isMinor ? [0, 3, 5, 6, 7, 10] : [0, 2, 3, 4, 7, 9];
  const notes = intervals.map(i => noteName(root + i, useFlats));
  return {
    name: isMinor ? `${rootName} Minor Blues` : `${rootName} Major Blues`,
    notes,
  };
}

// ── Settings Persistence ──

interface JamSettings {
  key: string;
  genre: string;
  progressionIndex: number;
  bpm: number;
  barsPerChord: number;
  loop: boolean;
  randomMode: boolean;
  metronomeVol: number;
  bassVol: number;
  drumVol: number;
  bassEnabled: boolean;
  drumEnabled: boolean;
  scaleType: "natural" | "pentatonic" | "blues";
}

const DEFAULT_SETTINGS: JamSettings = {
  key: "Am",
  genre: "Blues",
  progressionIndex: 0,
  bpm: 100,
  barsPerChord: 2,
  loop: true,
  randomMode: false,
  metronomeVol: 0.6,
  bassVol: 0.4,
  drumVol: 0.3,
  bassEnabled: false,
  drumEnabled: false,
  scaleType: "pentatonic",
};

function loadSettings(): JamSettings {
  try {
    const raw = localStorage.getItem("gf-jam-settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: JamSettings) {
  try { localStorage.setItem("gf-jam-settings", JSON.stringify(s)); } catch {}
}

// ── Component ──

export default function JamModePage() {
  const [settings, setSettings] = useState<JamSettings>(DEFAULT_SETTINGS);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentChordIdx, setCurrentChordIdx] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [chordFlash, setChordFlash] = useState(false);
  const [toneLoaded, setToneLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(true);

  // Tone.js refs
  const toneRef = useRef<typeof import("tone") | null>(null);
  const metronomeSynthRef = useRef<InstanceType<typeof import("tone").MembraneSynth> | null>(null);
  const bassSynthRef = useRef<InstanceType<typeof import("tone").Synth> | null>(null);
  const hihatSynthRef = useRef<InstanceType<typeof import("tone").NoiseSynth> | null>(null);
  const kickSynthRef = useRef<InstanceType<typeof import("tone").MembraneSynth> | null>(null);
  const loopRef = useRef<InstanceType<typeof import("tone").Loop> | null>(null);
  const beatCountRef = useRef(0);
  const chordIdxRef = useRef(0);
  const settingsRef = useRef(settings);
  const chordsRef = useRef<ChordDef[]>([]);
  const playingRef = useRef(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Keep refs in sync
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Save settings when they change (debounced)
  useEffect(() => {
    const t = setTimeout(() => saveSettings(settings), 300);
    return () => clearTimeout(t);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof JamSettings>(key: K, val: JamSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, []);

  // Derived data
  const filteredProgressions = PROGRESSIONS.filter(p => p.genre === settings.genre);
  const currentProgression = filteredProgressions[settings.progressionIndex] || filteredProgressions[0];
  const chords = currentProgression ? buildChords(currentProgression, settings.key) : [];
  chordsRef.current = chords;

  const scaleInfo = settings.scaleType === "pentatonic"
    ? getPentatonicNotes(settings.key)
    : settings.scaleType === "blues"
      ? getBluesNotes(settings.key)
      : getScaleNotes(settings.key);

  // Ensure progression index is valid when genre changes
  useEffect(() => {
    const filtered = PROGRESSIONS.filter(p => p.genre === settings.genre);
    if (settings.progressionIndex >= filtered.length) {
      updateSetting("progressionIndex", 0);
    }
  }, [settings.genre, settings.progressionIndex, updateSetting]);

  // ── Tone.js initialization ──

  const initTone = useCallback(async () => {
    if (toneRef.current) return;
    const Tone = await import("tone");
    toneRef.current = Tone;

    await Tone.start();
    Tone.getTransport().bpm.value = settingsRef.current.bpm;

    // Metronome click
    metronomeSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }).toDestination();
    metronomeSynthRef.current.volume.value = volToDb(settingsRef.current.metronomeVol);

    // Bass synth
    bassSynthRef.current = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
    }).toDestination();
    bassSynthRef.current.volume.value = volToDb(settingsRef.current.bassVol);

    // Hihat (noise synth)
    hihatSynthRef.current = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).toDestination();
    hihatSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol) - 6;

    // Kick
    kickSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).toDestination();
    kickSynthRef.current.volume.value = volToDb(settingsRef.current.drumVol);

    setToneLoaded(true);
  }, []);

  function volToDb(vol: number): number {
    if (vol <= 0) return -Infinity;
    return 20 * Math.log10(vol);
  }

  // Update volumes when settings change
  useEffect(() => {
    if (metronomeSynthRef.current) metronomeSynthRef.current.volume.value = volToDb(settings.metronomeVol);
    if (bassSynthRef.current) bassSynthRef.current.volume.value = volToDb(settings.bassVol);
    if (hihatSynthRef.current) hihatSynthRef.current.volume.value = volToDb(settings.drumVol) - 6;
    if (kickSynthRef.current) kickSynthRef.current.volume.value = volToDb(settings.drumVol);
  }, [settings.metronomeVol, settings.bassVol, settings.drumVol]);

  // Update BPM live
  useEffect(() => {
    if (toneRef.current) {
      toneRef.current.getTransport().bpm.value = settings.bpm;
    }
  }, [settings.bpm]);

  // ── Transport controls ──

  const handlePlay = useCallback(async () => {
    await initTone();
    const Tone = toneRef.current!;

    if (paused) {
      Tone.getTransport().start();
      setPaused(false);
      setPlaying(true);
      return;
    }

    // Reset state
    beatCountRef.current = 0;
    chordIdxRef.current = 0;
    setCurrentChordIdx(0);
    setCurrentBeat(0);

    Tone.getTransport().bpm.value = settings.bpm;
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;

    // Dispose old loop
    if (loopRef.current) {
      loopRef.current.dispose();
    }

    const beatsPerChord = settingsRef.current.barsPerChord * 4;
    const totalBeats = chordsRef.current.length * beatsPerChord;

    loopRef.current = new Tone.Loop((time) => {
      const s = settingsRef.current;
      const cds = chordsRef.current;
      if (!cds.length) return;

      const bpc = s.barsPerChord * 4;
      const total = cds.length * bpc;
      const globalBeat = beatCountRef.current;
      const beatInChord = globalBeat % bpc;
      const chIdx = Math.floor(globalBeat / bpc) % cds.length;

      // Metronome
      if (metronomeSynthRef.current && s.metronomeVol > 0) {
        const pitch = beatInChord === 0 ? "C5" : "C4";
        metronomeSynthRef.current.triggerAttackRelease(pitch, "16n", time);
      }

      // Bass on beat 1 of each chord
      if (bassSynthRef.current && s.bassEnabled && s.bassVol > 0 && beatInChord === 0) {
        const rootNote = cds[chIdx].root + "2";
        bassSynthRef.current.triggerAttackRelease(rootNote, "2n", time);
      }

      // Drums
      if (s.drumEnabled && s.drumVol > 0) {
        // Kick on 1 and 3
        if (beatInChord % 2 === 0 && kickSynthRef.current) {
          kickSynthRef.current.triggerAttackRelease("C1", "8n", time);
        }
        // Hihat on every beat
        if (hihatSynthRef.current) {
          hihatSynthRef.current.triggerAttackRelease("16n", time);
        }
      }

      // Update UI state
      setCurrentBeat(beatInChord);
      if (chIdx !== chordIdxRef.current) {
        chordIdxRef.current = chIdx;
        setCurrentChordIdx(chIdx);
        setChordFlash(true);
        setTimeout(() => setChordFlash(false), 200);
      }

      beatCountRef.current++;

      // End of progression
      if (beatCountRef.current >= total) {
        if (s.loop) {
          beatCountRef.current = 0;
          chordIdxRef.current = 0;
          // Random mode: pick a new random progression in same genre
          if (s.randomMode) {
            const filtered = PROGRESSIONS.filter(p => p.genre === s.genre);
            if (filtered.length > 1) {
              let newIdx: number;
              do { newIdx = Math.floor(Math.random() * filtered.length); } while (newIdx === s.progressionIndex && filtered.length > 1);
              setSettings(prev => ({ ...prev, progressionIndex: newIdx }));
            }
          }
        } else {
          // Stop
          Tone.getTransport().stop();
          setPlaying(false);
          setPaused(false);
          setCurrentBeat(0);
          setCurrentChordIdx(0);
          beatCountRef.current = 0;
          chordIdxRef.current = 0;
        }
      }
    }, "4n");

    loopRef.current.start(0);
    Tone.getTransport().start();
    setPlaying(true);
    setPaused(false);
  }, [paused, settings.bpm, initTone]);

  const handlePause = useCallback(() => {
    if (toneRef.current && playing) {
      toneRef.current.getTransport().pause();
      setPaused(true);
      setPlaying(false);
    }
  }, [playing]);

  const handleStop = useCallback(() => {
    if (toneRef.current) {
      toneRef.current.getTransport().stop();
      if (loopRef.current) {
        loopRef.current.dispose();
        loopRef.current = null;
      }
    }
    setPlaying(false);
    setPaused(false);
    setCurrentBeat(0);
    setCurrentChordIdx(0);
    beatCountRef.current = 0;
    chordIdxRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toneRef.current) {
        toneRef.current.getTransport().stop();
        toneRef.current.getTransport().cancel();
      }
      if (loopRef.current) loopRef.current.dispose();
      metronomeSynthRef.current?.dispose();
      bassSynthRef.current?.dispose();
      hihatSynthRef.current?.dispose();
      kickSynthRef.current?.dispose();
    };
  }, []);

  // ── Progress calculation ──
  const beatsPerChord = settings.barsPerChord * 4;
  const totalBeats = chords.length * beatsPerChord;
  const globalBeat = currentChordIdx * beatsPerChord + currentBeat;
  const progressPct = totalBeats > 0 ? (globalBeat / totalBeats) * 100 : 0;

  const currentChord = chords[currentChordIdx] || { display: "-", root: "A", quality: "", numeral: "" };
  const nextChordIdx = (currentChordIdx + 1) % chords.length;
  const nextChord = chords[nextChordIdx] || { display: "-", root: "A", quality: "", numeral: "" };

  return (
    <div className="max-w-[960px] lg:max-w-[1100px] xl:max-w-[1280px] mx-auto px-2 sm:px-5 py-3 sm:py-5 pb-16 sm:pb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#e8e4dc] font-heading">Jam Mode</h1>
          <p className="text-[11px] sm:text-xs text-[#6b6560] mt-0.5">Play along to chord progressions with real-time cues</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-[11px] px-3 py-1.5 rounded font-label transition-colors"
          style={{
            background: showSettings ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.05)",
            color: showSettings ? "#D4A843" : "#9a9590",
            border: `1px solid ${showSettings ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {showSettings ? "Hide Settings" : "Settings"}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Key */}
            <div>
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Key</label>
              <select
                value={settings.key}
                onChange={e => updateSetting("key", e.target.value)}
                className="w-full rounded px-2 py-1.5 text-xs text-[#e8e4dc] font-label"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {KEYS.map(k => (
                  <optgroup key={k} label={k}>
                    <option value={k}>{k} Major</option>
                    <option value={k + "m"}>{k}m</option>
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Genre */}
            <div>
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Genre</label>
              <select
                value={settings.genre}
                onChange={e => { updateSetting("genre", e.target.value); updateSetting("progressionIndex", 0); }}
                className="w-full rounded px-2 py-1.5 text-xs text-[#e8e4dc] font-label"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Progression */}
            <div>
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Progression</label>
              <select
                value={settings.progressionIndex}
                onChange={e => updateSetting("progressionIndex", Number(e.target.value))}
                className="w-full rounded px-2 py-1.5 text-xs text-[#e8e4dc] font-label"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {filteredProgressions.map((p, i) => (
                  <option key={i} value={i}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Bars per chord */}
            <div>
              <label className="block text-[10px] text-[#6b6560] font-label mb-1 uppercase tracking-wider">Bars / Chord</label>
              <div className="flex gap-1">
                {[1, 2, 4].map(b => (
                  <button
                    key={b}
                    onClick={() => updateSetting("barsPerChord", b)}
                    className="flex-1 rounded px-2 py-1.5 text-xs font-label transition-colors"
                    style={{
                      background: settings.barsPerChord === b ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.06)",
                      color: settings.barsPerChord === b ? "#D4A843" : "#9a9590",
                      border: `1px solid ${settings.barsPerChord === b ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* BPM Slider */}
          <div className="mt-3 sm:mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">Tempo</label>
              <span className="text-xs text-[#D4A843] font-mono font-bold">{settings.bpm} BPM</span>
            </div>
            <input
              type="range"
              min={40}
              max={220}
              value={settings.bpm}
              onChange={e => updateSetting("bpm", Number(e.target.value))}
              className="w-full accent-[#D4A843] h-1.5"
            />
            <div className="flex justify-between text-[9px] text-[#555] font-mono mt-0.5">
              <span>40</span>
              <span>220</span>
            </div>
          </div>

          {/* Audio controls row */}
          <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Metronome volume */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">Click</label>
                <span className="text-[10px] text-[#9a9590] font-mono">{Math.round(settings.metronomeVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.metronomeVol * 100)}
                onChange={e => updateSetting("metronomeVol", Number(e.target.value) / 100)}
                className="w-full accent-[#D4A843] h-1"
              />
            </div>

            {/* Bass */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">Bass</label>
                  <button
                    onClick={() => updateSetting("bassEnabled", !settings.bassEnabled)}
                    className="text-[9px] px-1.5 py-0.5 rounded font-label transition-colors"
                    style={{
                      background: settings.bassEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: settings.bassEnabled ? "#22c55e" : "#555",
                      border: `1px solid ${settings.bassEnabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {settings.bassEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <span className="text-[10px] text-[#9a9590] font-mono">{Math.round(settings.bassVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.bassVol * 100)}
                onChange={e => updateSetting("bassVol", Number(e.target.value) / 100)}
                className="w-full accent-[#22c55e] h-1"
                disabled={!settings.bassEnabled}
              />
            </div>

            {/* Drums */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">Drums</label>
                  <button
                    onClick={() => updateSetting("drumEnabled", !settings.drumEnabled)}
                    className="text-[9px] px-1.5 py-0.5 rounded font-label transition-colors"
                    style={{
                      background: settings.drumEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: settings.drumEnabled ? "#22c55e" : "#555",
                      border: `1px solid ${settings.drumEnabled ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {settings.drumEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <span className="text-[10px] text-[#9a9590] font-mono">{Math.round(settings.drumVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.drumVol * 100)}
                onChange={e => updateSetting("drumVol", Number(e.target.value) / 100)}
                className="w-full accent-[#22c55e] h-1"
                disabled={!settings.drumEnabled}
              />
            </div>
          </div>

          {/* Toggles row */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => updateSetting("loop", !settings.loop)}
              className="text-[10px] px-3 py-1 rounded font-label transition-colors"
              style={{
                background: settings.loop ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.05)",
                color: settings.loop ? "#D4A843" : "#6b6560",
                border: `1px solid ${settings.loop ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              Loop {settings.loop ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => updateSetting("randomMode", !settings.randomMode)}
              className="text-[10px] px-3 py-1 rounded font-label transition-colors"
              style={{
                background: settings.randomMode ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
                color: settings.randomMode ? "#a78bfa" : "#6b6560",
                border: `1px solid ${settings.randomMode ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              Random {settings.randomMode ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      )}

      {/* ── Main Display ── */}
      <div className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Progress bar */}
        <div className="h-1.5 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #D4A843, #b8902e)",
            }}
          />
        </div>

        {/* Chord progression strip */}
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide" style={{ background: "rgba(255,255,255,0.02)" }}>
          {chords.map((c, i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded px-2 py-1 text-[10px] sm:text-[11px] font-mono transition-all duration-150"
              style={{
                background: i === currentChordIdx
                  ? "rgba(212,168,67,0.2)"
                  : i < currentChordIdx && playing
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.04)",
                color: i === currentChordIdx ? "#D4A843" : "#6b6560",
                border: `1px solid ${i === currentChordIdx ? "rgba(212,168,67,0.4)" : "transparent"}`,
                transform: i === currentChordIdx ? "scale(1.05)" : "scale(1)",
              }}
            >
              <span className="block text-[8px] opacity-50">{c.numeral}</span>
              {c.display}
            </div>
          ))}
        </div>

        {/* Big chord display */}
        <div className="relative flex flex-col items-center justify-center py-8 sm:py-14 px-4">
          {/* Current chord numeral */}
          <div className="text-[11px] sm:text-sm text-[#6b6560] font-mono mb-2 tracking-wider">
            {currentChord.numeral}
          </div>

          {/* Current chord name */}
          <div
            className="transition-all duration-150"
            style={{
              fontSize: "clamp(3rem, 12vw, 7rem)",
              fontFamily: "'Oswald', system-ui, sans-serif",
              fontWeight: 700,
              color: chordFlash ? "#fff" : "#D4A843",
              textShadow: chordFlash
                ? "0 0 40px rgba(212,168,67,0.8), 0 0 80px rgba(212,168,67,0.4)"
                : "0 0 20px rgba(212,168,67,0.3)",
              transform: chordFlash ? "scale(1.05)" : "scale(1)",
              lineHeight: 1,
            }}
          >
            {currentChord.display}
          </div>

          {/* Next chord preview */}
          <div className="mt-4 flex items-center gap-2 text-[#555]">
            <span className="text-[10px] font-label uppercase tracking-wider">Next</span>
            <span className="text-lg sm:text-xl font-bold text-[#7a7570]" style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}>
              {nextChord.display}
            </span>
          </div>

          {/* Beat indicators */}
          <div className="mt-6 flex items-center gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-100"
                style={{
                  width: i === 0 ? 16 : 12,
                  height: i === 0 ? 16 : 12,
                  borderRadius: "50%",
                  background: (currentBeat % 4) === i && (playing || paused)
                    ? i === 0
                      ? "#D4A843"
                      : "rgba(212,168,67,0.6)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: (currentBeat % 4) === i && (playing || paused)
                    ? `0 0 12px ${i === 0 ? "rgba(212,168,67,0.6)" : "rgba(212,168,67,0.3)"}`
                    : "none",
                  border: i === 0 ? "2px solid rgba(212,168,67,0.3)" : "1px solid rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>

          {/* Bar indicator */}
          <div className="mt-2 text-[10px] text-[#555] font-mono">
            Bar {Math.floor(currentBeat / 4) + 1} of {settings.barsPerChord}
            {" | "}
            Chord {currentChordIdx + 1} of {chords.length}
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-3 px-4 py-4" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            onClick={handleStop}
            disabled={!playing && !paused}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all"
            style={{
              background: playing || paused ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${playing || paused ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: playing || paused ? "#ef4444" : "#555",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>

          <button
            onClick={playing ? handlePause : handlePlay}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all"
            style={{
              background: playing
                ? "rgba(212,168,67,0.2)"
                : "linear-gradient(135deg, #D4A843, #b8902e)",
              border: playing
                ? "2px solid rgba(212,168,67,0.4)"
                : "2px solid rgba(212,168,67,0.6)",
              color: playing ? "#D4A843" : "#121214",
              boxShadow: !playing ? "0 4px 20px rgba(212,168,67,0.3)" : "none",
            }}
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="5" y="4" width="3.5" height="12" rx="1" />
                <rect x="11.5" y="4" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 4l10 6-10 6V4z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Scale Guide ── */}
      <div className="mt-4 sm:mt-6 rounded-lg p-3 sm:p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#e8e4dc] font-heading">Scale Guide</h2>
          <div className="flex gap-1">
            {(["natural", "pentatonic", "blues"] as const).map(t => (
              <button
                key={t}
                onClick={() => updateSetting("scaleType", t)}
                className="text-[10px] px-2 py-1 rounded font-label capitalize transition-colors"
                style={{
                  background: settings.scaleType === t ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.05)",
                  color: settings.scaleType === t ? "#D4A843" : "#6b6560",
                  border: `1px solid ${settings.scaleType === t ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-[#9a9590] font-label mb-2">{scaleInfo.name}</div>

        <div className="flex flex-wrap gap-1.5">
          {scaleInfo.notes.map((n, i) => (
            <div
              key={i}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded flex items-center justify-center text-xs sm:text-sm font-mono font-bold transition-colors"
              style={{
                background: n === currentChord.root
                  ? "rgba(212,168,67,0.25)"
                  : "rgba(255,255,255,0.06)",
                color: n === currentChord.root ? "#D4A843" : "#9a9590",
                border: `1px solid ${n === currentChord.root ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Current chord tones highlight */}
        <div className="mt-3 text-[10px] text-[#6b6560] font-label">
          <span className="uppercase tracking-wider">Root note: </span>
          <span className="text-[#D4A843] font-mono font-bold">{currentChord.root}</span>
          {currentChord.quality && (
            <>
              <span className="mx-2 text-[#333]">|</span>
              <span className="uppercase tracking-wider">Quality: </span>
              <span className="text-[#9a9590] font-mono">{currentChord.quality || "major"}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Progression Info ── */}
      {currentProgression && (
        <div className="mt-4 sm:mt-6 rounded-lg p-3 sm:p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-sm font-bold text-[#e8e4dc] font-heading mb-2">Progression Details</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
            <div>
              <span className="text-[#6b6560] font-label">Name: </span>
              <span className="text-[#9a9590]">{currentProgression.name}</span>
            </div>
            <div>
              <span className="text-[#6b6560] font-label">Genre: </span>
              <span className="text-[#9a9590]">{currentProgression.genre}</span>
            </div>
            <div>
              <span className="text-[#6b6560] font-label">Chords: </span>
              <span className="text-[#D4A843] font-mono">{chords.map(c => c.display).join(" - ")}</span>
            </div>
            <div>
              <span className="text-[#6b6560] font-label">Numerals: </span>
              <span className="text-[#9a9590] font-mono">{currentProgression.degrees.map(d => d.numeral).join(" - ")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
