"use client";
import React, { useMemo } from "react";

// Note names — sharps preferred (C C# D D# E F F# G G# A A# B)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Standard tuning open string MIDI: E4=64 (high), B3=59, G3=55, D3=50, A2=45, E2=40 (low)
// Top of display = high E (mirrors how a guitarist looking down at the neck sees it)
const TUNING_MIDI = [64, 59, 55, 50, 45, 40];
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];

// Standard fret marker positions (single dot, double dot at 12)
const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOT_FRETS = [12, 24];

interface JamFretboardProps {
  scaleNotes: string[];        // e.g. ["A", "C", "D", "E", "G"]
  rootNote: string;            // e.g. "A" — bigger highlight
  chordRoot?: string;          // current chord root (often == rootNote unless modal)
  chordQuality?: string;       // "m", "", "7", "maj7", "m7", "m7b5", "dim", etc.
  frets?: number;              // default 15
  preferFlats?: boolean;
}

// Map any common note label (b/#) → canonical sharp index 0-11
function noteToIndex(n: string): number {
  if (!n) return -1;
  const trimmed = n.trim();
  // Try sharp form first
  let i = NOTE_NAMES.indexOf(trimmed);
  if (i >= 0) return i;
  // Try flat form
  i = FLAT_NAMES.indexOf(trimmed);
  if (i >= 0) return i;
  // Fallback: parse manually (e.g. "Eb" not in list above, "F#" alt form)
  const letterMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const letter = trimmed[0]?.toUpperCase();
  const accidental = trimmed[1];
  const base = letterMap[letter];
  if (base === undefined) return -1;
  if (accidental === "#") return (base + 1) % 12;
  if (accidental === "b") return (base + 11) % 12;
  return base;
}

// Compute chord tones (root, third, fifth, optionally seventh) as note indices 0-11
function getChordToneIndices(rootIdx: number, quality: string): Set<number> {
  if (rootIdx < 0) return new Set();
  const isMinor = quality.includes("m") && !quality.includes("maj");
  const isDim = quality.includes("dim") || quality.includes("m7b5");
  const isAug = quality.includes("aug") || quality.includes("+");
  const thirdInterval = isMinor || isDim ? 3 : 4;
  const fifthInterval = isDim ? 6 : isAug ? 8 : 7;
  const tones = new Set<number>([
    rootIdx,
    (rootIdx + thirdInterval) % 12,
    (rootIdx + fifthInterval) % 12,
  ]);
  if (quality.includes("7")) {
    const seventhInterval = quality.includes("maj7") || quality.includes("M7") ? 11 : 10;
    tones.add((rootIdx + seventhInterval) % 12);
  }
  return tones;
}

export function JamFretboard({
  scaleNotes,
  rootNote,
  chordRoot,
  chordQuality = "",
  frets = 15,
  preferFlats = false,
}: JamFretboardProps) {
  const labels = preferFlats ? FLAT_NAMES : NOTE_NAMES;

  const scaleIndices = useMemo(() => {
    const set = new Set<number>();
    scaleNotes.forEach(n => {
      const i = noteToIndex(n);
      if (i >= 0) set.add(i);
    });
    return set;
  }, [scaleNotes]);

  const rootIdx = useMemo(() => noteToIndex(rootNote), [rootNote]);
  const chordRootIdx = useMemo(
    () => noteToIndex(chordRoot ?? rootNote),
    [chordRoot, rootNote],
  );
  const chordToneSet = useMemo(
    () => getChordToneIndices(chordRootIdx, chordQuality),
    [chordRootIdx, chordQuality],
  );

  // Geometry — open column + N fret cells. Open column slightly narrower visually via spacing.
  const fretWidth = 44;       // px per fret
  const openWidth = 36;       // px for open column
  const stringSpacing = 22;   // px between strings
  const topPad = 28;          // top padding (for fret numbers)
  const bottomPad = 28;       // bottom padding (for inlay number labels)
  const leftPad = 12;
  const rightPad = 12;
  const stringCount = 6;
  const fretboardHeight = (stringCount - 1) * stringSpacing;
  const innerWidth = openWidth + frets * fretWidth;
  const totalWidth = leftPad + innerWidth + rightPad;
  const totalHeight = topPad + fretboardHeight + bottomPad;

  // Returns x position (center) of the dot for a given fret index (0 = open string)
  function fretCenterX(fret: number): number {
    if (fret === 0) return leftPad + openWidth / 2;
    return leftPad + openWidth + (fret - 0.5) * fretWidth;
  }
  function fretLineX(fret: number): number {
    // x of fret wire AFTER a given fret (right boundary of fret cell)
    if (fret === 0) return leftPad + openWidth;
    return leftPad + openWidth + fret * fretWidth;
  }
  function stringY(stringIdx: number): number {
    return topPad + stringIdx * stringSpacing;
  }

  return (
    <div className="w-full overflow-x-auto fretboard-scroll">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="block"
        style={{
          minWidth: `${Math.min(totalWidth, 720)}px`,
          width: "100%",
          height: "auto",
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Fretboard background — subtle gradient for wood-grain feel */}
        <defs>
          <linearGradient id="fb-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1410" />
            <stop offset="50%" stopColor="#13100c" />
            <stop offset="100%" stopColor="#0e0b08" />
          </linearGradient>
          <linearGradient id="fb-nut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8e4dc" />
            <stop offset="100%" stopColor="#9a9590" />
          </linearGradient>
        </defs>

        {/* Fretboard surface */}
        <rect
          x={leftPad + openWidth}
          y={topPad - 4}
          width={frets * fretWidth}
          height={fretboardHeight + 8}
          fill="url(#fb-wood)"
          rx={2}
        />

        {/* Inlay dots (behind strings) */}
        {Array.from({ length: frets }, (_, idx) => {
          const f = idx + 1;
          const cx = fretCenterX(f);
          const cy = topPad + fretboardHeight / 2;
          if (DOUBLE_DOT_FRETS.includes(f)) {
            return (
              <g key={`inlay-${f}`}>
                <circle cx={cx} cy={cy - stringSpacing * 0.9} r={4} fill="#3a342c" />
                <circle cx={cx} cy={cy + stringSpacing * 0.9} r={4} fill="#3a342c" />
              </g>
            );
          }
          if (SINGLE_DOT_FRETS.includes(f)) {
            return <circle key={`inlay-${f}`} cx={cx} cy={cy} r={4.5} fill="#3a342c" />;
          }
          return null;
        })}

        {/* Nut (fat line at fret 0) */}
        <rect
          x={leftPad + openWidth - 3}
          y={topPad - 4}
          width={5}
          height={fretboardHeight + 8}
          fill="url(#fb-nut)"
          rx={1}
        />

        {/* Fret wires */}
        {Array.from({ length: frets }, (_, idx) => {
          const f = idx + 1;
          const x = fretLineX(f);
          return (
            <line
              key={`fw-${f}`}
              x1={x}
              y1={topPad - 4}
              x2={x}
              y2={topPad + fretboardHeight + 4}
              stroke="#5a5048"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Strings (horizontal lines) — varying thickness top (thin) → bottom (thick) */}
        {Array.from({ length: stringCount }, (_, sIdx) => {
          const y = stringY(sIdx);
          // sIdx=0 is high e (thinnest), sIdx=5 is low E (thickest)
          const thickness = 1 + sIdx * 0.35;
          return (
            <line
              key={`str-${sIdx}`}
              x1={leftPad + 4}
              y1={y}
              x2={leftPad + innerWidth - 4}
              y2={y}
              stroke="#a8a29a"
              strokeWidth={thickness}
              opacity={0.85}
            />
          );
        })}

        {/* Fret number labels above the board (1, 3, 5, 7, 9, 12, 15) */}
        {Array.from({ length: frets }, (_, idx) => {
          const f = idx + 1;
          const showNum =
            DOUBLE_DOT_FRETS.includes(f) || SINGLE_DOT_FRETS.includes(f) || f === 1;
          if (!showNum) return null;
          return (
            <text
              key={`fn-${f}`}
              x={fretCenterX(f)}
              y={topPad - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#6b6560"
              fontFamily="ui-monospace, monospace"
            >
              {f}
            </text>
          );
        })}

        {/* String letter labels (left side, before nut) */}
        {STRING_LABELS.map((lbl, sIdx) => (
          <text
            key={`sl-${sIdx}`}
            x={leftPad + openWidth / 2}
            y={stringY(sIdx) + 3}
            textAnchor="middle"
            fontSize={9}
            fill="#6b6560"
            fontFamily="ui-monospace, monospace"
          >
            {lbl}
          </text>
        ))}

        {/* Note dots — iterate every string & fret (incl. open) */}
        {Array.from({ length: stringCount }, (_, sIdx) => {
          const openMidi = TUNING_MIDI[sIdx];
          return Array.from({ length: frets + 1 }, (_, f) => {
            const noteIdx = (openMidi + f) % 12;
            const inScale = scaleIndices.has(noteIdx);
            if (!inScale) return null;

            const isRoot = noteIdx === rootIdx;
            const isChordTone = chordToneSet.has(noteIdx);
            const isChordRoot = noteIdx === chordRootIdx;

            // Layered priority: chord root > root of scale > chord tone > scale note
            let radius = 8;
            let fill = "rgba(255,255,255,0.10)";
            let stroke = "rgba(255,255,255,0.22)";
            let textColor = "#9a9590";
            let textWeight = 500;
            let dropShadow = "";

            if (isRoot) {
              // Scale root — gold filled circle
              radius = 10;
              fill = "#D4A843";
              stroke = "#f5c965";
              textColor = "#1a1410";
              textWeight = 700;
              dropShadow = "drop-shadow(0 0 4px rgba(212,168,67,0.5))";
            } else if (isChordRoot) {
              // Current chord root (different from key root) — orange highlight
              radius = 10;
              fill = "#e08a3f";
              stroke = "#f5b270";
              textColor = "#1a1410";
              textWeight = 700;
              dropShadow = "drop-shadow(0 0 4px rgba(224,138,63,0.5))";
            } else if (isChordTone) {
              // 3rd / 5th / 7th of current chord — amber outlined
              radius = 9;
              fill = "rgba(212,168,67,0.18)";
              stroke = "rgba(212,168,67,0.65)";
              textColor = "#D4A843";
              textWeight = 600;
            }

            const cx = fretCenterX(f);
            const cy = stringY(sIdx);

            return (
              <g key={`n-${sIdx}-${f}`} style={{ filter: dropShadow || undefined }}>
                <circle cx={cx} cy={cy} r={radius} fill={fill} stroke={stroke} strokeWidth={1.25} />
                <text
                  x={cx}
                  y={cy + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fill={textColor}
                  fontWeight={textWeight}
                  fontFamily="ui-monospace, monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {labels[noteIdx]}
                </text>
              </g>
            );
          });
        })}
      </svg>

      <style jsx>{`
        .fretboard-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(212, 168, 67, 0.3) transparent;
        }
        .fretboard-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .fretboard-scroll::-webkit-scrollbar-thumb {
          background: rgba(212, 168, 67, 0.3);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

export default JamFretboard;
