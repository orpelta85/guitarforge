"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { loadMetronomeVolume, saveMetronomeVolume, clickGain } from "@/lib/metronomeAudio";
import { buildMetronomeClicks, type MetronomeClickBuffers } from "@/lib/metronomeSynth";

/* ───── types ───── */
interface Props {
  startBpm?: number;
  standalone?: boolean;
}

type Subdivision = 1 | 2 | 3 | 4; // quarter, eighth, triplet, sixteenth
type TimeSig = "4/4" | "3/4" | "6/8" | "7/8" | "5/4";

const TIME_SIG_BEATS: Record<TimeSig, number> = {
  "4/4": 4,
  "3/4": 3,
  "6/8": 6,
  "7/8": 7,
  "5/4": 5,
};

const SUBDIVISION_LABELS: Record<Subdivision, string> = {
  1: "♩",
  2: "♪♪",
  3: "𝅘𝅥𝅮³",
  4: "♬",
};

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

/* ───── stepper helper ───── */
function Stepper({
  value,
  min,
  max,
  step = 1,
  label,
  disabled,
  onChange,
  amber,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  amber?: boolean;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const opacity = disabled ? "opacity-30 pointer-events-none" : "";

  // Local draft lets the user type freely (including partial values like "1" en route to "150")
  // without being clamped on every keystroke. Commits on blur or Enter.
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const v = parseInt(draft, 10);
    if (isNaN(v)) { setDraft(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, v));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className={`flex flex-col items-center gap-1 ${opacity}`}>
      <span className="font-label text-[9px] text-[#888] uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center rounded-md overflow-hidden border border-[#2a2a2a]">
        <button
          type="button"
          onClick={dec}
          disabled={disabled}
          className="w-7 h-8 flex items-center justify-center text-[#888] hover:text-[#D4A843] hover:bg-[#1a1a1a] bg-[#111] transition-colors text-sm select-none"
        >
          -
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.currentTarget.blur(); }
            else if (e.key === "Escape") { setDraft(String(value)); e.currentTarget.blur(); }
          }}
          className={`h-8 w-[48px] text-center bg-[#0d0d0d] px-1 border-x border-[#2a2a2a] text-xs font-mono font-semibold outline-none focus:ring-1 focus:ring-[#D4A843] ${
            amber ? "text-[#D4A843]" : "text-[#ccc]"
          }`}
        />
        <button
          type="button"
          onClick={inc}
          disabled={disabled}
          className="w-7 h-8 flex items-center justify-center text-[#888] hover:text-[#D4A843] hover:bg-[#1a1a1a] bg-[#111] transition-colors text-sm select-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ───── component ───── */
export default function MetronomeBox({ startBpm: propBpm, standalone }: Props) {
  /* audio context — created once on first play */
  const ctxRef = useRef<AudioContext | null>(null);
  const clickBuffersRef = useRef<MetronomeClickBuffers | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentSubRef = useRef(0); // which subdivision tick within the beat
  const currentBeatRef = useRef(0); // which beat within the measure
  const isPlayingRef = useRef(false);

  /* progressive mode refs for scheduler access */
  const bpmRef = useRef(80);
  const nextIncTimeRef = useRef(0); // AudioContext time for next BPM increment

  /* state */
  const [on, setOn] = useState(false);
  const [bpm, setBpmState] = useState(propBpm ?? 60);
  const [targetBpm, setTargetBpm] = useState(120);
  const [incAmt, setIncAmt] = useState(5);
  const [incSec, setIncSec] = useState(30);
  const [prog, setProg] = useState(true);
  const [showBpm, setShowBpm] = useState(propBpm ?? 60);

  const [timeSig, setTimeSig] = useState<TimeSig>("4/4");
  const [subdivision, setSubdivision] = useState<Subdivision>(1);
  const [countIn, setCountIn] = useState(false);
  const [beat, setBeat] = useState(-1); // -1 = off
  const [visualSub, setVisualSub] = useState(0);
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(1);
  useEffect(() => { setVolume(loadMetronomeVolume()); }, []);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  /* tap tempo */
  const tapTimesRef = useRef<number[]>([]);

  const beatsInMeasure = TIME_SIG_BEATS[timeSig];

  /* keep bpmRef in sync */
  useEffect(() => {
    bpmRef.current = showBpm;
  }, [showBpm]);

  /* ───── audio helpers ───── */
  function getOrCreateCtx(): AudioContext {
    if (!ctxRef.current) {
      // 44.1kHz + interactive hint for low-latency metronome scheduling
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctx({ sampleRate: 44100, latencyHint: "interactive" });
    }
    // Pre-build click buffers once per context so ticks don't allocate.
    if (!clickBuffersRef.current) {
      clickBuffersRef.current = buildMetronomeClicks(ctxRef.current);
    }
    return ctxRef.current;
  }

  /** Schedule a single click on the audio timeline (FM cowbell/woodblock — §5) */
  const scheduleClick = useCallback(
    (time: number, accent: boolean, subTick: boolean) => {
      const ctx = ctxRef.current;
      const buffers = clickBuffersRef.current;
      if (!ctx || !buffers) return;

      const source = ctx.createBufferSource();
      source.buffer = accent
        ? buffers.accent
        : subTick
          ? buffers.subdivision
          : buffers.normal;

      const gain = ctx.createGain();
      const userVol = volumeRef.current;
      const kind: "accent" | "normal" | "sub" = accent
        ? "accent"
        : subTick
          ? "sub"
          : "normal";
      // Envelope is baked into the buffer; clickGain() scales to user volume
      // with the same historical curve so overall loudness stays the same.
      gain.gain.setValueAtTime(clickGain(kind, userVol), time);

      source.connect(gain).connect(ctx.destination);
      source.start(time);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    },
    []
  );

  /* ───── look-ahead scheduler ───── */
  const scheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !isPlayingRef.current) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      /* progressive: bump BPM at boundary */
      if (
        nextIncTimeRef.current > 0 &&
        nextNoteTimeRef.current >= nextIncTimeRef.current
      ) {
        const next = Math.min(bpmRef.current + incAmt, targetBpm);
        bpmRef.current = next;
        setShowBpm(next);
        if (next < targetBpm) {
          nextIncTimeRef.current = nextNoteTimeRef.current + incSec;
        } else {
          nextIncTimeRef.current = 0; // done
        }
      }

      const curBeat = currentBeatRef.current;
      const curSub = currentSubRef.current;
      const isDownbeat = curBeat === 0 && curSub === 0;
      const isBeatHead = curSub === 0;

      scheduleClick(nextNoteTimeRef.current, isDownbeat, !isBeatHead);

      /* visual update — we use setTimeout to fire close to the actual audio time */
      const delay = Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000);
      const beatSnap = curBeat;
      const subSnap = curSub;
      setTimeout(() => {
        setBeat(beatSnap);
        setVisualSub(subSnap);
      }, delay);

      /* advance subdivision */
      const secsPerBeat = 60 / bpmRef.current;
      const secsPerSub = secsPerBeat / subdivision;
      nextNoteTimeRef.current += secsPerSub;

      currentSubRef.current++;
      if (currentSubRef.current >= subdivision) {
        currentSubRef.current = 0;
        currentBeatRef.current =
          (currentBeatRef.current + 1) % beatsInMeasure;
      }
    }

    schedulerRef.current = setTimeout(scheduler, LOOKAHEAD_MS);
  }, [subdivision, beatsInMeasure, incAmt, incSec, targetBpm, scheduleClick]);

  /* ───── start / stop ───── */
  const doStart = useCallback(async () => {
    const ctx = getOrCreateCtx();
    if (ctx.state === "suspended") await ctx.resume();

    const effectiveBpm = bpm;
    bpmRef.current = effectiveBpm;
    setShowBpm(effectiveBpm);
    currentBeatRef.current = 0;
    currentSubRef.current = 0;
    isPlayingRef.current = true;

    /* progressive increment scheduling */
    if (prog && targetBpm > effectiveBpm) {
      nextIncTimeRef.current = ctx.currentTime + incSec;
    } else {
      nextIncTimeRef.current = 0;
    }

    if (countIn) {
      /* schedule count-in beats (4 beats at current tempo) */
      const secsPerBeat = 60 / effectiveBpm;
      for (let i = 0; i < 4; i++) {
        scheduleClick(ctx.currentTime + i * secsPerBeat, i === 0, false);
        const d = i * secsPerBeat * 1000;
        const snap = i;
        setTimeout(() => {
          setBeat(snap);
          setVisualSub(0);
        }, d);
      }
      nextNoteTimeRef.current = ctx.currentTime + 4 * secsPerBeat;
    } else {
      nextNoteTimeRef.current = ctx.currentTime;
    }

    setOn(true);
    scheduler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, prog, targetBpm, incSec, countIn, scheduler, scheduleClick]);

  const doStop = useCallback(() => {
    isPlayingRef.current = false;
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    setOn(false);
    setBeat(-1);
    setVisualSub(0);
  }, []);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close().catch(() => {});
      }
      ctxRef.current = null;
      clickBuffersRef.current = null;
    };
  }, []);

  /* ───── tap tempo ───── */
  const handleTap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    // discard taps older than 2s
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current.push(now);

    if (tapTimesRef.current.length >= 3) {
      const t = tapTimesRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < t.length; i++) {
        intervals.push(t[i] - t[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const detected = Math.round(60000 / avg);
      const clamped = Math.max(30, Math.min(300, detected));
      setBpmState(clamped);
      setShowBpm(clamped);
    }
    // keep last 8 taps max
    if (tapTimesRef.current.length > 8) {
      tapTimesRef.current = tapTimesRef.current.slice(-8);
    }
  }, []);

  /* ───── derived ───── */
  const pct =
    prog && targetBpm > bpm
      ? Math.round(((showBpm - bpm) / (targetBpm - bpm)) * 100)
      : 0;

  /* ───── render ───── */
  return (
    <div className={`panel p-4 ${standalone ? "" : "mb-3"}`}>
      {/* header */}
      <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
        <div className={`led ${on ? "led-gold" : "led-off"}`} />
        Metronome {prog ? "· Progressive" : ""}
      </div>

      {/* BPM display + beat indicators */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <span
          className={`font-readout text-3xl font-bold ${
            on ? "text-[#D4A843]" : "text-[#ccc]"
          }`}
        >
          {on ? showBpm : bpm}
        </span>
        <span className="font-label text-[9px] text-[#888]">BPM</span>

        {/* visual beat indicators */}
        {on && beat >= 0 && (
          <div className="flex gap-1.5 ml-2">
            {Array.from({ length: beatsInMeasure }).map((_, b) => (
              <div
                key={b}
                className={`led ${
                  beat === b
                    ? b === 0
                      ? "led-gold"
                      : "led-on"
                    : "led-off"
                }`}
                style={{
                  width: b === 0 ? 10 : 8,
                  height: b === 0 ? 10 : 8,
                }}
              />
            ))}
          </div>
        )}

        {/* subdivision dots within current beat */}
        {on && beat >= 0 && subdivision > 1 && (
          <div className="flex gap-0.5 ml-1">
            {Array.from({ length: subdivision }).map((_, s) => (
              <div
                key={s}
                className={`rounded-full ${
                  visualSub === s ? "bg-[#D4A843]" : "bg-[#333]"
                }`}
                style={{ width: 4, height: 4 }}
              />
            ))}
          </div>
        )}

        {/* progressive bar */}
        {on && prog && targetBpm > bpm && (
          <div className="flex-1 min-w-[60px]">
            <div className="vu !h-[3px]">
              <div className="vu-fill" style={{ width: pct + "%" }} />
            </div>
          </div>
        )}
      </div>

      {/* settings — always visible */}
      <div className="mb-3 space-y-3">
        {/* time signature + subdivision */}
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="font-label text-[9px] text-[#888] uppercase tracking-wider">
              Time Sig
            </span>
            <div className="flex rounded-md overflow-hidden border border-[#2a2a2a]">
              {(Object.keys(TIME_SIG_BEATS) as TimeSig[]).map((ts) => (
                <button
                  key={ts}
                  onClick={() => setTimeSig(ts)}
                  className={`px-2 py-1.5 text-[10px] font-mono transition-colors ${
                    timeSig === ts
                      ? "bg-[#D4A843] text-[#0a0a0a] font-semibold"
                      : "bg-[#111] text-[#888] hover:text-[#D4A843] hover:bg-[#1a1a1a]"
                  } ${ts !== "4/4" ? "border-l border-[#2a2a2a]" : ""}`}
                >
                  {ts}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-label text-[9px] text-[#888] uppercase tracking-wider">
              Subdivision
            </span>
            <div className="flex rounded-md overflow-hidden border border-[#2a2a2a]">
              {([1, 2, 3, 4] as Subdivision[]).map((s, i) => (
                <button
                  key={s}
                  onClick={() => setSubdivision(s)}
                  className={`px-2.5 py-1.5 text-[11px] transition-colors ${
                    subdivision === s
                      ? "bg-[#D4A843] text-[#0a0a0a] font-semibold"
                      : "bg-[#111] text-[#888] hover:text-[#D4A843] hover:bg-[#1a1a1a]"
                  } ${i > 0 ? "border-l border-[#2a2a2a]" : ""}`}
                >
                  {SUBDIVISION_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* progressive + count-in toggles */}
        <div className="flex gap-4">
          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setProg(!prog)}
          >
            <div
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${
                prog
                  ? "border-[#D4A843] bg-[#D4A843] text-[#121214]"
                  : "border-[#444] bg-transparent"
              }`}
            >
              {prog ? "✓" : ""}
            </div>
            <span className="font-label text-[10px] text-[#888]">
              Progressive
            </span>
          </label>

          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCountIn(!countIn)}
          >
            <div
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${
                countIn
                  ? "border-[#D4A843] bg-[#D4A843] text-[#121214]"
                  : "border-[#444] bg-transparent"
              }`}
            >
              {countIn ? "✓" : ""}
            </div>
            <span className="font-label text-[10px] text-[#888]">
              Count In
            </span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <span className="font-label text-[9px] text-[#888] uppercase tracking-wider">Vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                saveMetronomeVolume(v);
              }}
              className="w-[70px] accent-[#D4A843]"
              title={`Metronome volume ${Math.round(volume * 100)}%`}
            />
            <span className="font-mono text-[9px] text-[#888] w-[26px] text-right">{Math.round(volume * 100)}</span>
          </div>
        </div>

        {/* BPM stepper inputs — all custom, no native number inputs */}
        <div className="grid grid-cols-4 gap-2 items-end">
          <Stepper
            value={bpm}
            min={30}
            max={300}
            step={1}
            label="Start"
            onChange={setBpmState}
            amber
          />
          <Stepper
            value={targetBpm}
            min={30}
            max={300}
            step={1}
            label="Target"
            disabled={!prog}
            onChange={setTargetBpm}
          />
          <Stepper
            value={incAmt}
            min={1}
            max={20}
            step={1}
            label="+BPM"
            disabled={!prog}
            onChange={setIncAmt}
          />
          <Stepper
            value={incSec}
            min={5}
            max={120}
            step={5}
            label="Every (s)"
            disabled={!prog}
            onChange={setIncSec}
          />
        </div>

        {/* tap tempo */}
        <button
          onClick={handleTap}
          className="btn-ghost w-full !py-2 justify-center text-[11px]"
        >
          Tap Tempo
        </button>
      </div>

      {/* play / stop button */}
      {!on ? (
        <button
          onClick={doStart}
          className="btn-gold w-full !py-2.5 justify-center"
        >
          {prog ? bpm + " → " + targetBpm + " BPM" : bpm + " BPM"}
          {countIn ? " (Count In)" : ""}
        </button>
      ) : (
        <button
          onClick={doStop}
          className="btn-danger w-full !py-2.5 justify-center"
        >
          Stop
        </button>
      )}
    </div>
  );
}
