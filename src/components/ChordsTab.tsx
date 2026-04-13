"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

interface Props {
  songId: number;
  title: string;
  artist: string;
}

const SHARP_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

const CHORD_REGEX = /\b([A-G](?:#|b)?)(m|maj|min|dim|aug|sus|add)?(\d+)?(?:\/([A-G](?:#|b)?))?\b/g;

function transposeNote(note: string, semitones: number): string {
  const normalized = FLAT_TO_SHARP[note] || note;
  const idx = SHARP_SCALE.indexOf(normalized);
  if (idx === -1) return note;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return SHARP_SCALE[newIdx];
}

function transposeChord(chord: string, semitones: number): string {
  return chord.replace(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/, (_m, root, rest, bass) => {
    const newRoot = transposeNote(root, semitones);
    const newBass = bass ? "/" + transposeNote(bass, semitones) : "";
    return newRoot + (rest || "") + newBass;
  });
}

function isChordOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return false;
  const noChords = trimmed.replace(CHORD_REGEX, "").replace(/\s+/g, "").replace(/[|x\-()]/g, "");
  return noChords.length === 0 && CHORD_REGEX.test(trimmed);
}

function transposeLine(line: string, semitones: number): string {
  if (semitones === 0) return line;
  if (!isChordOnlyLine(line)) return line;
  return line.replace(CHORD_REGEX, (match) => transposeChord(match, semitones));
}

function renderLine(line: string, key: number): React.ReactElement {
  const trimmed = line.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return <div key={key} className="text-[#3b82f6] font-semibold mt-3">{line}</div>;
  }
  if (isChordOnlyLine(line)) {
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(CHORD_REGEX.source, "g");
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) parts.push(line.slice(lastIdx, match.index));
      parts.push(<span key={`${key}-${match.index}`} className="text-[#f59e0b] font-semibold">{match[0]}</span>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    return <div key={key}>{parts}</div>;
  }
  return <div key={key} className="text-zinc-200">{line || "\u00A0"}</div>;
}

export default function ChordsTab({ songId, title, artist }: Props) {
  const cacheKey = `gf-chords-v2-${songId}`;
  const [sheet, setSheet] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [transpose, setTranspose] = useState(0);
  const [fontSize, setFontSize] = useState(14);

  useEffect(() => {
    try {
      localStorage.removeItem(`gf-chords-${songId}`);
    } catch {}
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const d = JSON.parse(cached);
        if (d.chord_sheet && d.chord_sheet.length > 500) {
          setSheet(d.chord_sheet);
          setSource(d.source || "cached");
          return;
        }
      }
    } catch {}
    void loadChords();
  }, [songId]);

  const loadChords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/chords/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, songId })
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Could not fetch chords");
        return;
      }
      setSheet(data.chord_sheet);
      setSource(data.source || "");
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ chord_sheet: data.chord_sheet, source: data.source, cached_at: Date.now() }));
      } catch {}
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, title, artist]);

  const transposedLines = useMemo(() => {
    if (!sheet) return [];
    return sheet.split("\n").map(line => transposeLine(line, transpose));
  }, [sheet, transpose]);

  const refresh = useCallback(() => {
    try { localStorage.removeItem(cacheKey); } catch {}
    setSheet("");
    void loadChords();
  }, [cacheKey, loadChords]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 bg-[var(--bg-recess)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center gap-3 flex-wrap z-10">
        <div className="flex items-center gap-1.5">
          <span className="font-label text-[11px] text-[var(--text-muted)]">Transpose</span>
          <button type="button" onClick={() => setTranspose(t => t - 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-[#1f1f1f] border border-[#2a2a2a] text-zinc-300 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors cursor-pointer">−</button>
          <span className="font-label text-[12px] text-[var(--gold)] font-semibold min-w-[28px] text-center">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button type="button" onClick={() => setTranspose(t => t + 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-[#1f1f1f] border border-[#2a2a2a] text-zinc-300 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors cursor-pointer">+</button>
          {transpose !== 0 && (
            <button type="button" onClick={() => setTranspose(0)}
              className="font-label text-[10px] text-zinc-500 hover:text-zinc-300 ml-1 cursor-pointer">Reset</button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-label text-[11px] text-[var(--text-muted)]">Size</span>
          <button type="button" onClick={() => setFontSize(s => Math.max(10, s - 1))}
            className="w-7 h-7 flex items-center justify-center rounded bg-[#1f1f1f] border border-[#2a2a2a] text-zinc-300 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors cursor-pointer">A-</button>
          <button type="button" onClick={() => setFontSize(s => Math.min(22, s + 1))}
            className="w-7 h-7 flex items-center justify-center rounded bg-[#1f1f1f] border border-[#2a2a2a] text-zinc-300 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors cursor-pointer">A+</button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {source && !loading && (
            <span className="font-label text-[10px] text-zinc-500">via {source}</span>
          )}
          <button type="button" onClick={refresh} disabled={loading}
            className="font-label text-[10px] text-zinc-400 hover:text-[var(--gold)] cursor-pointer disabled:opacity-50">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 bg-[#0a0a0a]">
        {loading && !sheet && (
          <div className="text-center py-12">
            <div className="font-label text-[12px] text-zinc-500 mb-2">Fetching chords for</div>
            <div className="text-zinc-300 text-sm font-semibold">{title}</div>
            <div className="text-zinc-500 text-xs">{artist}</div>
            <div className="mt-6 inline-block w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !sheet && (
          <div className="text-center py-12">
            <div className="text-red-400 text-sm mb-2">Could not load chords</div>
            <div className="font-label text-[11px] text-zinc-500 mb-4">{error}</div>
            <button type="button" onClick={refresh} className="btn-gold !text-[12px]">Try again</button>
          </div>
        )}

        {sheet && (
          <pre className="font-mono whitespace-pre leading-[1.9] text-zinc-200 m-0"
            style={{ fontSize: `${fontSize}px`, fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace' }}>
            {transposedLines.map((line, i) => renderLine(line, i))}
          </pre>
        )}
      </div>
    </div>
  );
}
