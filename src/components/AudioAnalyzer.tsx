"use client";
import { useState, useCallback } from "react";

// ── Pitch Detection (autocorrelation — same algorithm as Chromatic Tuner) ──

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thres) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }

  const trimmed = buf.slice(r1, r2);
  SIZE = trimmed.length;
  if (SIZE < 2) return -1;
  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let sum = 0;
    for (let j = 0; j < SIZE - i; j++) sum += trimmed[j] * trimmed[j + i];
    c[i] = sum;
  }

  let d = 0;
  while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  if (d >= SIZE - 1) return -1;

  let maxVal = -1, maxPos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0 || maxPos >= SIZE - 1) return -1;

  let T0 = maxPos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

function freqToNote(freq: number): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log2(freq / 440));
  const noteIdx = Math.round(noteNum) + 69;
  const cents = Math.round((noteNum - Math.round(noteNum)) * 100);
  const note = NOTE_NAMES[((noteIdx % 12) + 12) % 12];
  const octave = Math.floor(noteIdx / 12) - 1;
  return { note, octave, cents };
}

// ── Types ──

interface NoteEvent {
  time: number;
  note: string;
  octave: number;
  freq: number;
  cents: number;
}

interface AnalysisResult {
  notes: NoteEvent[];
  uniqueNotes: string[];
  pitchAccuracy: number;
  timingAccuracy: number;
  overallGrade: string;
  overallScore: number;
  expectedNotes: string[];
  matchedNotes: string[];
  missedNotes: string[];
  extraNotes: string[];
  tip: string;
  duration: number;
}

function computeGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function generateTip(result: { pitchAccuracy: number; timingAccuracy: number; missedNotes: string[]; extraNotes: string[] }): string {
  const tips: string[] = [];
  if (result.pitchAccuracy < 60) {
    tips.push("Focus on hitting each note cleanly. Try playing slower and use a tuner to check your intonation.");
  } else if (result.pitchAccuracy < 80) {
    tips.push("Good pitch overall. A few notes are slightly off — try bending into the correct pitch more deliberately.");
  }
  if (result.timingAccuracy < 60) {
    tips.push("Your timing drifts between notes. Practice with a metronome at a slower BPM and gradually increase.");
  } else if (result.timingAccuracy < 80) {
    tips.push("Timing is decent but could be tighter. Try subdividing beats mentally as you play.");
  }
  if (result.missedNotes.length > 0) {
    tips.push(`You missed: ${result.missedNotes.join(", ")}. Practice those positions individually.`);
  }
  if (result.extraNotes.length > 0 && result.extraNotes.length > 2) {
    tips.push("Some extra notes crept in — focus on muting strings you're not playing.");
  }
  if (tips.length === 0) {
    tips.push("Excellent performance! Try increasing the BPM or adding variations to challenge yourself.");
  }
  return tips.join(" ");
}

// ── Analysis Engine ──

async function analyzeAudio(audioUrl: string, expectedNotes?: string[]): Promise<AnalysisResult> {
  const ctx = new AudioContext();
  try {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Split into windows of 8192 samples (~186ms at 44100Hz) for better low-frequency accuracy (B1 = 61.7Hz on 7-string)
    const windowSize = 8192;
    const hopSize = 2048; // 50% overlap
    const noteEvents: NoteEvent[] = [];

    for (let offset = 0; offset + windowSize <= channelData.length; offset += hopSize) {
      const window = channelData.slice(offset, offset + windowSize);
      const freq = autoCorrelate(window, sampleRate);

      if (freq > 50 && freq < 1500) {
        const { note, octave, cents } = freqToNote(freq);
        const time = offset / sampleRate;
        noteEvents.push({ time, note, octave, freq, cents });
      }
    }

    // Deduplicate consecutive same-note events
    const deduped: NoteEvent[] = [];
    for (const ev of noteEvents) {
      const fullNote = ev.note + ev.octave;
      const last = deduped[deduped.length - 1];
      if (!last || (last.note + last.octave) !== fullNote) {
        deduped.push(ev);
      }
    }

    const detectedNoteNames = deduped.map(e => e.note + e.octave);
    const uniqueDetected = [...new Set(detectedNoteNames)];

    // Pitch accuracy: percentage of detected notes that are "in tune" (within 15 cents)
    const inTuneCount = noteEvents.filter(e => Math.abs(e.cents) <= 15).length;
    const pitchAccuracy = noteEvents.length > 0 ? Math.round((inTuneCount / noteEvents.length) * 100) : 0;

    // Timing accuracy: measure regularity of note intervals
    let timingAccuracy = 75; // default if we can't compute
    if (deduped.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < deduped.length; i++) {
        intervals.push(deduped[i].time - deduped[i - 1].time);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval > 0.01) {
        const deviations = intervals.map(iv => Math.abs(iv - avgInterval) / avgInterval);
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        // Convert deviation to a 0-100 score (0% deviation = 100 score)
        timingAccuracy = Math.max(0, Math.min(100, Math.round((1 - avgDeviation) * 100)));
      }
    }

    // Compare against expected notes if provided
    const expected = expectedNotes || [];
    // Normalize expected: strip octave if not present, and find matches
    const normalizedExpected = expected.map(n => n.trim());
    const normalizedDetected = uniqueDetected;

    // Match: check if detected notes contain the expected ones (note name only, ignore octave for matching)
    const expectedNoteNamesOnly = normalizedExpected.map(n => n.replace(/\d+$/, ""));
    const detectedNoteNamesOnly = [...new Set(deduped.map(e => e.note))];

    let matchedNotes: string[] = [];
    let missedNotes: string[] = [];
    let extraNotes: string[] = [];

    if (normalizedExpected.length > 0) {
      matchedNotes = normalizedExpected.filter(n => {
        const nameOnly = n.replace(/\d+$/, "");
        return detectedNoteNamesOnly.includes(nameOnly);
      });
      missedNotes = normalizedExpected.filter(n => {
        const nameOnly = n.replace(/\d+$/, "");
        return !detectedNoteNamesOnly.includes(nameOnly);
      });
      extraNotes = detectedNoteNamesOnly.filter(n => !expectedNoteNamesOnly.includes(n));
    }

    const noteMatchScore = normalizedExpected.length > 0
      ? Math.round((matchedNotes.length / normalizedExpected.length) * 100)
      : pitchAccuracy;

    const overallScore = normalizedExpected.length > 0
      ? Math.round(noteMatchScore * 0.4 + pitchAccuracy * 0.3 + timingAccuracy * 0.3)
      : Math.round(pitchAccuracy * 0.5 + timingAccuracy * 0.5);

    const result = {
      notes: deduped,
      uniqueNotes: uniqueDetected,
      pitchAccuracy,
      timingAccuracy,
      overallGrade: computeGrade(overallScore),
      overallScore,
      expectedNotes: normalizedExpected,
      matchedNotes,
      missedNotes,
      extraNotes,
      tip: "",
      duration,
    };

    result.tip = generateTip(result);
    return result;
  } finally {
    await ctx.close();
  }
}

// ── Component ──

interface AudioAnalyzerProps {
  audioUrl: string;
  exerciseName?: string;
  expectedNotes?: string[];
}

export default function AudioAnalyzer({ audioUrl, exerciseName, expectedNotes }: AudioAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setAiTip(null);
    try {
      const r = await analyzeAudio(audioUrl, expectedNotes);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [audioUrl, expectedNotes]);

  const getAiTip = useCallback(async () => {
    if (!result) return;
    setAiLoading(true);
    try {
      const byok = (() => {
        try {
          const raw = localStorage.getItem("gf-byok");
          if (raw) {
            const s = JSON.parse(raw);
            if (s.apiKey && s.provider) return s;
          }
        } catch {}
        return null;
      })();

      const prompt = `Student played ${exerciseName || "a guitar exercise"}. ` +
        `Pitch accuracy: ${result.pitchAccuracy}%, Timing accuracy: ${result.timingAccuracy}%, Overall: ${result.overallGrade}. ` +
        `Notes detected: ${result.uniqueNotes.slice(0, 12).join(", ")}. ` +
        (result.expectedNotes.length > 0 ? `Expected: ${result.expectedNotes.join(", ")}. ` : "") +
        (result.missedNotes.length > 0 ? `Missed: ${result.missedNotes.join(", ")}. ` : "") +
        (result.timingAccuracy < 70 ? "Timing was uneven. " : "") +
        "Give a short, encouraging, specific tip (2-3 sentences max). Focus on what to practice next.";

      const reqBody: Record<string, unknown> = {
        message: prompt,
        context: "Audio analysis feedback request. Respond with a short, helpful guitar practice tip.",
        history: [],
      };
      if (byok) {
        reqBody.provider = byok.provider;
        reqBody.byokKey = byok.apiKey;
      }

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      if (res.ok) {
        const data = await res.json();
        setAiTip(data.reply || data.content || "Keep practicing!");
      } else {
        // Fall back to local tip
        setAiTip(null);
      }
    } catch {
      // Silently fail — local tip is already shown
    } finally {
      setAiLoading(false);
    }
  }, [result, exerciseName]);

  // Progress bar component
  const Bar = ({ value, color }: { value: number; color: string }) => (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 rounded-full" style={{ background: "#1a1a1a" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="font-readout text-[12px] w-10 text-right" style={{ color }}>{value}%</span>
    </div>
  );

  if (!result && !analyzing) {
    return (
      <button
        onClick={runAnalysis}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-label cursor-pointer transition-all hover:brightness-110"
        style={{ background: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.3)", color: "#D4A843" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h4l3-9 4 18 3-9h4"/>
        </svg>
        Analyze
      </button>
    );
  }

  if (analyzing) {
    return (
      <div className="panel p-4 mt-2" style={{ borderColor: "rgba(212,168,67,0.2)" }}>
        <div className="flex items-center gap-2">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/>
          </svg>
          <span className="font-label text-[11px] text-[#D4A843]">Analyzing recording...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel p-3 mt-2" style={{ borderColor: "rgba(196,30,58,0.3)" }}>
        <div className="font-label text-[10px] text-[#C41E3A]">{error}</div>
        <button onClick={runAnalysis} className="btn-ghost !text-[9px] mt-1">Retry</button>
      </div>
    );
  }

  if (!result) return null;

  const gradeColor = result.overallScore >= 80 ? "#22c55e" : result.overallScore >= 60 ? "#D4A843" : "#ef4444";

  return (
    <div className="panel p-4 mt-2" style={{ borderColor: "rgba(212,168,67,0.15)" }}>
      <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h4l3-9 4 18 3-9h4"/>
        </svg>
        ANALYSIS RESULTS
      </div>

      {/* Grade badge */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-label text-[10px] text-[#555] mb-1">Overall Grade</div>
          <div className="font-heading text-3xl font-bold" style={{ color: gradeColor }}>{result.overallGrade}</div>
        </div>
        <div className="text-right">
          <div className="font-readout text-[10px] text-[#555]">{result.notes.length} notes detected</div>
          <div className="font-readout text-[10px] text-[#555]">{result.duration.toFixed(1)}s duration</div>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-3">
          <span className="font-label text-[10px] text-[#888] w-24">Pitch Accuracy</span>
          <Bar value={result.pitchAccuracy} color={result.pitchAccuracy >= 80 ? "#22c55e" : result.pitchAccuracy >= 60 ? "#D4A843" : "#ef4444"} />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-label text-[10px] text-[#888] w-24">Timing</span>
          <Bar value={result.timingAccuracy} color={result.timingAccuracy >= 80 ? "#22c55e" : result.timingAccuracy >= 60 ? "#D4A843" : "#ef4444"} />
        </div>
      </div>

      {/* Notes detected */}
      <div className="mb-3">
        <div className="font-label text-[9px] text-[#555] mb-1">Notes detected</div>
        <div className="flex flex-wrap gap-1">
          {result.uniqueNotes.slice(0, 16).map((n, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-readout"
              style={{ background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)", color: "#D4A843" }}>
              {n}
            </span>
          ))}
          {result.uniqueNotes.length > 16 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-readout text-[#555]">
              +{result.uniqueNotes.length - 16} more
            </span>
          )}
        </div>
      </div>

      {/* Expected vs actual comparison */}
      {result.expectedNotes.length > 0 && (
        <div className="mb-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="mb-2">
            <div className="font-label text-[9px] text-[#555] mb-1">Expected</div>
            <div className="flex flex-wrap gap-1">
              {result.expectedNotes.map((n, i) => {
                const matched = result.matchedNotes.includes(n);
                return (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-readout"
                    style={{
                      background: matched ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${matched ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                      color: matched ? "#22c55e" : "#ef4444",
                    }}>
                    {n} {matched ? "\u2713" : "\u2717"}
                  </span>
                );
              })}
            </div>
          </div>
          {result.missedNotes.length > 0 && (
            <div className="font-label text-[10px] text-[#ef4444]">
              Missed: {result.missedNotes.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Tip */}
      <div className="p-3 rounded-lg mb-3" style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.12)" }}>
        <div className="font-label text-[10px] text-[#D4A843] mb-1 flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          {aiTip ? "AI Coach Tip" : "Tip"}
        </div>
        <div className="font-readout text-[11px] text-[#aaa] leading-relaxed">
          {aiTip || result.tip}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {!aiTip && !aiLoading && (
          <button onClick={getAiTip}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-label cursor-pointer transition-all hover:brightness-110"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#8b5cf6" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
              <path d="M10 21h4"/>
            </svg>
            Get AI Tip
          </button>
        )}
        {aiLoading && (
          <div className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-label text-[#8b5cf6]">
            <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/>
            </svg>
            Asking AI Coach...
          </div>
        )}
        <button onClick={runAnalysis}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-label cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>
          Re-analyze
        </button>
      </div>
    </div>
  );
}
