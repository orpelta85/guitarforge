"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const GUITAR_STRINGS = [
  { note: "E4", freq: 329.63, label: "1st (E4)" },
  { note: "B3", freq: 246.94, label: "2nd (B3)" },
  { note: "G3", freq: 196.00, label: "3rd (G3)" },
  { note: "D3", freq: 146.83, label: "4th (D3)" },
  { note: "A2", freq: 110.00, label: "5th (A2)" },
  { note: "E2", freq: 82.41, label: "6th (E2)" },
];

function freqToNote(freq: number): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log2(freq / 440));
  const roundedNote = Math.round(noteNum);
  const cents = Math.round((noteNum - roundedNote) * 100);
  const noteIdx = ((roundedNote % 12) + 12) % 12;
  const octave = Math.floor((roundedNote + 9) / 12) + 4;
  return { note: NOTE_NAMES[noteIdx], octave, cents };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoCorrelate(inputBuf: any, sampleRate: number): number {
  let SIZE = inputBuf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += inputBuf[i] * inputBuf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(inputBuf[i]) < thres) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(inputBuf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }

  const trimmed = Array.prototype.slice.call(inputBuf, r1, r2) as number[];
  const buf = new Float32Array(trimmed);
  SIZE = buf.length;

  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let val = 0;
    for (let j = 0; j < SIZE - i; j++) val += buf[j] * buf[j + i];
    c[i] = val;
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

interface ChromaticTunerProps {
  onClose?: () => void;
  compact?: boolean;
}

export default function ChromaticTuner({ onClose, compact = false }: ChromaticTunerProps) {
  const [tunerNote, setTunerNote] = useState("");
  const [tunerOctave, setTunerOctave] = useState(0);
  const [tunerCents, setTunerCents] = useState(0);
  const [tunerFreq, setTunerFreq] = useState(0);
  const [tunerActive, setTunerActive] = useState(false);
  const tunerCtxRef = useRef<AudioContext | null>(null);
  const tunerStreamRef = useRef<MediaStream | null>(null);
  const tunerAnimRef = useRef<number>(0);
  const tunerAnalyserRef = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tunerBufRef = useRef<any>(null);

  const startTuner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      tunerCtxRef.current = ctx;
      tunerStreamRef.current = stream;
      tunerAnalyserRef.current = analyser;
      tunerBufRef.current = buf;
      setTunerActive(true);

      const detect = () => {
        if (!tunerAnalyserRef.current || !tunerBufRef.current) return;
        tunerAnalyserRef.current.getFloatTimeDomainData(tunerBufRef.current);
        const freq = autoCorrelate(tunerBufRef.current, ctx.sampleRate);
        if (freq > 0 && freq < 2000) {
          const { note, octave, cents } = freqToNote(freq);
          setTunerNote(note);
          setTunerOctave(octave);
          setTunerCents(cents);
          setTunerFreq(Math.round(freq * 10) / 10);
        }
        tunerAnimRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch {
      // Microphone access denied
    }
  }, []);

  const stopTuner = useCallback(() => {
    if (tunerAnimRef.current) cancelAnimationFrame(tunerAnimRef.current);
    if (tunerStreamRef.current) tunerStreamRef.current.getTracks().forEach(t => t.stop());
    if (tunerCtxRef.current) tunerCtxRef.current.close();
    tunerCtxRef.current = null;
    tunerStreamRef.current = null;
    tunerAnalyserRef.current = null;
    tunerBufRef.current = null;
    setTunerActive(false);
    setTunerNote("");
    setTunerCents(0);
    setTunerFreq(0);
  }, []);

  useEffect(() => {
    startTuner();
    return () => { stopTuner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closestString = tunerNote
    ? GUITAR_STRINGS.reduce((best, gs) => {
        const diff = Math.abs(gs.freq - tunerFreq);
        return diff < Math.abs(best.freq - tunerFreq) ? gs : best;
      }, GUITAR_STRINGS[0])
    : null;

  const absCents = Math.abs(tunerCents);
  const tuneClass = absCents <= 5 ? "tuner-in-tune" : absCents <= 15 ? "tuner-close" : "tuner-off";
  const needleLeft = tunerNote ? 50 + (tunerCents / 50) * 50 : 50;

  return (
    <div className={`panel ${compact ? "p-3" : "p-4"} mb-4`} style={{ borderColor: "#818cf8" + "30" }}>
      <div className="font-label text-[10px] text-[#818cf8] mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`led ${tunerActive ? "led-green" : "led-off"}`} />
          Chromatic Tuner
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="font-label text-[10px] text-[#555] hover:text-[#aaa] cursor-pointer">Close</button>
        )}
      </div>

      <div className="text-center py-4">
        {tunerNote ? (
          <>
            <div className="font-heading text-5xl font-bold text-white mb-1">{tunerNote}{tunerOctave}</div>
            <div className="font-readout text-[12px] text-[#666] mb-4">{tunerFreq} Hz</div>

            <div className="tuner-meter mx-auto max-w-[320px] mb-2">
              <div className="tuner-meter-center" />
              <div className={`tuner-needle ${tuneClass}`} style={{ left: `calc(${needleLeft}% - 2px)` }} />
            </div>
            <div className="flex justify-between max-w-[320px] mx-auto font-readout text-[9px] text-[#444]">
              <span>-50</span>
              <span className={`font-readout text-[11px] font-bold ${absCents < 5 ? "text-[#33CC33]" : absCents < 15 ? "text-[#D4A843]" : "text-[#C41E3A]"}`}>
                {tunerCents > 0 ? "+" : ""}{tunerCents} cents
              </span>
              <span>+50</span>
            </div>

            {absCents < 5 && (
              <div className="font-label text-[11px] text-[#33CC33] mt-3">In Tune</div>
            )}
          </>
        ) : (
          <div className="py-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
            <div className="font-readout text-[12px] text-[#555]">Play a note to detect pitch...</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1 mt-2">
        {GUITAR_STRINGS.map((gs) => {
          const isClosest = closestString?.note === gs.note && tunerNote !== "";
          return (
            <div key={gs.note} className={`text-center p-2 rounded-lg border transition-all ${isClosest ? "border-[#818cf8]/60 bg-[#818cf8]/10" : "border-[#1a1a1a]"}`}>
              <div className={`font-heading text-[13px] font-bold ${isClosest ? "text-[#818cf8]" : "text-[#666]"}`}>{gs.note}</div>
              <div className="font-readout text-[8px] text-[#444]">{Math.round(gs.freq)} Hz</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
