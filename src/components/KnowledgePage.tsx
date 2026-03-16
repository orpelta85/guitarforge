"use client";
import { useState, useRef, useEffect } from "react";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALE_F: Record<string, { formula: number[]; desc: string }> = {
  "Major (Ionian)": { formula: [0,2,4,5,7,9,11], desc: "Bright, happy" },
  "Natural Minor (Aeolian)": { formula: [0,2,3,5,7,8,10], desc: "Sad, dark" },
  "Dorian": { formula: [0,2,3,5,7,9,10], desc: "Jazzy minor, bright 6th" },
  "Phrygian": { formula: [0,1,3,5,7,8,10], desc: "Dark, Spanish — b2" },
  "Lydian": { formula: [0,2,4,6,7,9,11], desc: "Dreamy — #4" },
  "Mixolydian": { formula: [0,2,4,5,7,9,10], desc: "Bluesy — b7" },
  "Harmonic Minor": { formula: [0,2,3,5,7,8,11], desc: "Classical, exotic" },
  "Minor Pentatonic": { formula: [0,3,5,7,10], desc: "The guitar scale" },
  "Major Pentatonic": { formula: [0,2,4,7,9], desc: "Country, happy" },
  "Blues": { formula: [0,3,5,6,7,10], desc: "Pentatonic + blue note" },
};
const CHORD_SUFFIXES = [
  { name: "major", label: "Major" },{ name: "minor", label: "Minor" },
  { name: "7", label: "7" },{ name: "maj7", label: "Maj7" },{ name: "m7", label: "m7" },
  { name: "dim", label: "Dim" },{ name: "aug", label: "Aug" },
  { name: "sus2", label: "Sus2" },{ name: "sus4", label: "Sus4" },
  { name: "9", label: "9" },{ name: "add9", label: "Add9" },{ name: "6", label: "6" },
  { name: "dim7", label: "Dim7" },{ name: "m7b5", label: "m7b5" },
];
const TUNING = [40,45,50,55,59,64]; const STR = ["E","A","D","G","B","e"];
const FRETS = 15; const FRET_MARKERS = [3,5,7,9,12,15];
const IV_NAMES = ["R","b2","2","b3","3","4","b5","5","b6","6","b7","7"];

type Tab = "scales"|"chords"|"fretboard"|"progressions"|"theory";

function mf(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }

interface ChordPosition { frets: string; fingers: string; barres?: number; capo?: boolean; }
interface ChordData { key: string; suffix: string; positions: ChordPosition[]; }

/* ── Shared Fretboard Component ── */
function Fretboard({ highlightNotes, rootNote, showIntervals, onClick, maxFret = FRETS }: {
  highlightNotes: string[]; rootNote: string; showIntervals?: boolean;
  onClick?: (str: number, fret: number) => void; maxFret?: number;
}) {
  const ri = NOTES.indexOf(rootNote);
  const ctxRef = useRef<AudioContext | null>(null);
  function play(midi: number) {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const c = ctxRef.current, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = mf(midi);
    g.gain.setValueAtTime(0.2, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    o.start(c.currentTime); o.stop(c.currentTime + 0.6);
  }

  return (
    <div className="overflow-x-auto" dir="ltr">
      <div style={{ minWidth: Math.max(500, maxFret * 42) }}>
        {/* Fret numbers */}
        <div className="flex mb-0.5">
          <div className="w-8 flex-shrink-0" />
          {Array.from({ length: maxFret + 1 }, (_, f) => (
            <div key={f} className={`flex-1 text-center font-readout text-[9px] ${FRET_MARKERS.includes(f) ? "text-[#D4A843]" : "text-[#333]"}`}>
              {f}
            </div>
          ))}
        </div>
        {/* Strings */}
        {[...Array(6)].map((_, si) => {
          const s = 5 - si;
          return (
            <div key={s} className="flex items-center" style={{ height: 28 }}>
              <div className="w-8 flex-shrink-0 font-readout text-[10px] text-[#555] text-center">{STR[s]}</div>
              {Array.from({ length: maxFret + 1 }, (_, f) => {
                const n = NOTES[(TUNING[s] + f) % 12];
                const inSet = highlightNotes.includes(n);
                const isR = n === rootNote;
                const semi = ((TUNING[s] + f) - (ri % 12) + 120) % 12;
                const isNut = f === 0;
                return (
                  <div key={f}
                    onClick={() => { if (onClick) onClick(s, f); else if (inSet) play(TUNING[s] + f); }}
                    className={`flex-1 flex items-center justify-center ${inSet || onClick ? "cursor-pointer" : ""} ${inSet ? "hover:scale-110" : ""} transition-all`}
                    style={{
                      height: 28,
                      borderRight: f > 0 ? "1px solid #1a1a1a" : "none",
                      borderLeft: isNut ? "3px solid #D4A843" : "none",
                      borderBottom: si < 5 ? `1px solid ${si < 3 ? "#333" : "#444"}` : "1px solid #555",
                      background: isNut ? "#0d0d0d" : "transparent",
                    }}>
                    {inSet && (
                      <div className="rounded-full flex items-center justify-center text-[7px] font-bold"
                        style={{ width: 20, height: 20, background: isR ? "#D4A843" : "#2a2a2a", color: isR ? "#0A0A0A" : "#ddd", border: isR ? "none" : "1px solid #444" }}>
                        {showIntervals ? IV_NAMES[semi] : n}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* Fret markers */}
        <div className="flex mt-0.5">
          <div className="w-8 flex-shrink-0" />
          {Array.from({ length: maxFret + 1 }, (_, f) => (
            <div key={f} className="flex-1 flex justify-center">
              {FRET_MARKERS.includes(f) && (
                <div className="flex gap-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${f === 12 ? "bg-[#D4A843]/50" : "bg-[#333]"}`} />
                  {f === 12 && <div className="w-1.5 h-1.5 rounded-full bg-[#D4A843]/50" />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Chord Diagram SVG ── */
function ChordDiagram({ pos, idx, onPlay }: { pos: ChordPosition; idx: number; onPlay: () => void }) {
  const frets = pos.frets.split("").map(f => f === "x" ? -1 : parseInt(f, 16));
  const fingers = pos.fingers.split("").map(f => parseInt(f));
  const playable = frets.filter(f => f > 0);
  const minF = playable.length ? Math.min(...playable) : 1;
  const maxF = playable.length ? Math.max(...playable) : 1;
  const base = maxF <= 5 ? 1 : minF;

  return (
    <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 text-center cursor-pointer hover:border-[#333] transition-all"
      onClick={onPlay} dir="ltr">
      <div className="font-readout text-[9px] text-[#555] mb-1">
        {base > 1 ? `Fret ${base}` : "Open"}
      </div>
      <svg viewBox="0 0 110 130" className="w-24 h-28 mx-auto">
        {base === 1 && <rect x="18" y="10" width="74" height="3" fill="#D4A843" rx="1" />}
        {base > 1 && <text x="8" y="26" fill="#D4A843" fontSize="10" fontFamily="monospace">{base}</text>}
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1="18" y1={12 + i * 22} x2="92" y2={12 + i * 22} stroke="#2a2a2a" strokeWidth="1" />)}
        {[0,1,2,3,4,5].map(s => <line key={s} x1={18 + s * 14.8} y1="12" x2={18 + s * 14.8} y2={12 + 5 * 22} stroke={s < 3 ? "#666" : "#888"} strokeWidth={2.5 - s * 0.3} />)}
        {pos.barres && (() => {
          const bf = (typeof pos.barres === "number" ? pos.barres : 0) - base + 1;
          if (bf < 1 || bf > 5) return null;
          const first = frets.indexOf(pos.barres as number), last = frets.lastIndexOf(pos.barres as number);
          if (first < 0 || first === last) return null;
          return <rect x={18 + first * 14.8 - 6} y={bf * 22 - 3} width={(last - first) * 14.8 + 12} height="8" rx="4" fill="#D4A843" opacity="0.5" />;
        })()}
        {frets.map((f, s) => {
          if (f === -1) return <text key={s} x={18 + s * 14.8} y="7" textAnchor="middle" fill="#C41E3A" fontSize="10">x</text>;
          if (f === 0) return <circle key={s} cx={18 + s * 14.8} cy="7" r="3.5" fill="none" stroke="#888" strokeWidth="1.5" />;
          const df = f - base + 1;
          if (df < 1 || df > 5) return null;
          return (
            <g key={s}>
              <circle cx={18 + s * 14.8} cy={df * 22 + 1} r="6" fill={fingers[s] === 1 ? "#D4A843" : "#ddd"} />
              {fingers[s] > 0 && <text x={18 + s * 14.8} y={df * 22 + 4.5} textAnchor="middle" fill="#0A0A0A" fontSize="8" fontWeight="bold">{fingers[s]}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("scales");
  const [root, setRoot] = useState("A");
  const [selScale, setSelScale] = useState("Minor Pentatonic");
  const [selChord, setSelChord] = useState("minor");
  const [chordData, setChordData] = useState<ChordData | null>(null);
  const [chordLoading, setChordLoading] = useState(false);
  const [showIv, setShowIv] = useState(false);
  const [fbMode, setFbMode] = useState<"notes"|"scale"|"chord">("notes");
  const [fbScale, setFbScale] = useState("Minor Pentatonic");
  const [progChords, setProgChords] = useState<string[]>(["Am","F","C","G"]);
  const [newChord, setNewChord] = useState("");
  const [progPlaying, setProgPlaying] = useState(false);
  const [progLoop, setProgLoop] = useState(false);
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx() { if (!ctxRef.current) ctxRef.current = new AudioContext(); return ctxRef.current; }
  function playNote(midi: number, delay = 0) {
    const c = getCtx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = mf(midi);
    g.gain.setValueAtTime(0.2, c.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.5);
    o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.6);
  }

  useEffect(() => {
    if (tab !== "chords") return;
    setChordLoading(true);
    fetch(`/api/chords?key=${encodeURIComponent(root)}&suffix=${encodeURIComponent(selChord)}`)
      .then(r => r.ok ? r.json() : null).then(d => setChordData(d)).catch(() => setChordData(null))
      .finally(() => setChordLoading(false));
  }, [root, selChord, tab]);

  const ri = NOTES.indexOf(root);
  const scInfo = SCALE_F[selScale] || { formula: [], desc: "" };
  const scNotes = scInfo.formula.map(s => NOTES[(ri + s) % 12]);
  const fbScInfo = SCALE_F[fbScale] || { formula: [], desc: "" };
  const fbScNotes = fbScInfo.formula.map(s => NOTES[(ri + s) % 12]);

  // Play chord by name (simple version)
  function playChordByName(name: string, delay = 0) {
    const r = name.replace(/[m7b5#addimaugsuj9]+.*$/, "");
    const rIdx = NOTES.indexOf(r);
    if (rIdx < 0) return;
    const isMinor = name.includes("m") && !name.includes("maj");
    const third = isMinor ? 3 : 4;
    [0, third, 7].forEach(s => playNote(48 + rIdx + s, delay));
  }

  function playProgression() {
    if (progPlaying) { if (progRef.current) clearInterval(progRef.current); setProgPlaying(false); return; }
    setProgPlaying(true);
    let i = 0;
    const play = () => { if (i < progChords.length) { playChordByName(progChords[i]); i++; } else if (progLoop) { i = 0; playChordByName(progChords[0]); i = 1; } else { if (progRef.current) clearInterval(progRef.current); setProgPlaying(false); } };
    play();
    progRef.current = setInterval(play, 1200);
  }

  useEffect(() => () => { if (progRef.current) clearInterval(progRef.current); }, []);

  // Circle of fifths data
  const FIFTH_ORDER = [0,7,2,9,4,11,6,1,8,3,10,5];
  const MAJOR_KEYS = ["C","G","D","A","E","B","F#/Gb","Db","Ab","Eb","Bb","F"];
  const MINOR_KEYS = ["Am","Em","Bm","F#m","C#m","G#m","Ebm","Bbm","Fm","Cm","Gm","Dm"];

  return (
    <div>
      <div className="panel p-5 mb-3">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Theory &amp; Reference</div>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {(["scales","chords","fretboard","progressions","theory"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${tab === t ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{t}</button>
        ))}
      </div>

      {/* Root */}
      <div className="panel p-3 mb-3">
        <div className="font-label text-[9px] text-[#555] mb-1.5">Root Note</div>
        <div className="flex gap-1 flex-wrap">
          {NOTES.map(n => (
            <button key={n} onClick={() => setRoot(n)}
              className={`font-readout text-[11px] w-9 h-8 rounded-sm cursor-pointer border flex items-center justify-center transition-all ${root === n ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#222] text-[#888]"}`}>{n}</button>
          ))}
        </div>
      </div>

      {/* ══ SCALES ══ */}
      {tab === "scales" && (<div>
        <div className="panel p-3 mb-3">
          <div className="flex gap-1 flex-wrap">
            {Object.keys(SCALE_F).map(s => (
              <button key={s} onClick={() => setSelScale(s)}
                className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${selScale === s ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#1a1a1a] text-[#555]"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="panel p-5 mb-3">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-heading text-lg font-bold text-[#D4A843]">{root} {selScale}</div>
              <div className="text-[11px] text-[#666] italic">{scInfo.desc}</div>
              <div className="font-readout text-sm text-[#aaa] mt-1">{scNotes.join(" — ")}</div>
            </div>
            <button onClick={() => scInfo.formula.forEach((s, i) => playNote(57 + ri + s, i * 0.18))} className="btn-gold">Play</button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer mb-3" onClick={() => setShowIv(!showIv)}>
            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${showIv ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{showIv ? "✓" : ""}</div>
            <span className="font-label text-[10px] text-[#666]">Show intervals</span>
          </label>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {scInfo.formula.map((s, i) => (
              <div key={i} className="text-center cursor-pointer hover:scale-105 transition-all" onClick={() => playNote(57 + ri + s)}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: s === 0 ? "#D4A843" : "#1a1a1a", color: s === 0 ? "#0A0A0A" : "#ccc", border: `1px solid ${s === 0 ? "#D4A843" : "#333"}` }}>
                  {scNotes[i]}
                </div>
                <div className="font-readout text-[8px] text-[#555] mt-0.5">{IV_NAMES[s]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <Fretboard highlightNotes={scNotes} rootNote={root} showIntervals={showIv} />
        </div>
      </div>)}

      {/* ══ CHORDS ══ */}
      {tab === "chords" && (<div>
        <div className="panel p-3 mb-3">
          <div className="flex gap-1 flex-wrap">
            {CHORD_SUFFIXES.map(({ name, label }) => (
              <button key={name} onClick={() => setSelChord(name)}
                className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${selChord === name ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/8" : "border-[#1a1a1a] text-[#555]"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <div className="font-heading text-lg font-bold text-[#D4A843] mb-1">{root}{selChord === "major" ? "" : " " + selChord}</div>
          {chordLoading && <div className="font-label text-[10px] text-[#444] py-4">Loading...</div>}
          {chordData?.positions && (
            <div>
              <div className="font-label text-[9px] text-[#555] mb-2 mt-2">{chordData.positions.length} voicings — click to hear</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {chordData.positions.map((pos, i) => (
                  <ChordDiagram key={i} pos={pos} idx={i} onPlay={() => {
                    const frets = pos.frets.split("").map(f => f === "x" ? -1 : parseInt(f, 16));
                    frets.forEach((f, s) => { if (f >= 0) playNote(TUNING[s] + f); });
                  }} />
                ))}
              </div>
            </div>
          )}
          {!chordLoading && !chordData && <div className="text-[11px] text-[#444] py-4">No data for this chord</div>}
        </div>
      </div>)}

      {/* ══ FRETBOARD ══ */}
      {tab === "fretboard" && (<div>
        <div className="panel p-3 mb-3">
          <div className="font-label text-[9px] text-[#555] mb-1.5">Display Mode</div>
          <div className="flex gap-1 mb-2">
            {(["notes","scale","chord"] as const).map(m => (
              <button key={m} onClick={() => setFbMode(m)}
                className={`font-label text-[10px] px-3 py-1 rounded-sm cursor-pointer border ${fbMode === m ? "border-[#D4A843] text-[#D4A843]" : "border-[#222] text-[#555]"}`}>{m}</button>
            ))}
          </div>
          {fbMode === "scale" && (
            <div className="flex gap-1 flex-wrap">
              {Object.keys(SCALE_F).map(s => (
                <button key={s} onClick={() => setFbScale(s)}
                  className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${fbScale === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#1a1a1a] text-[#444]"}`}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="panel p-4">
          <div className="font-label text-[9px] text-[#555] mb-2">
            {fbMode === "notes" ? `All notes — ${root} highlighted — click to hear` :
             fbMode === "scale" ? `${root} ${fbScale} — click to hear` :
             `${root} chord tones`}
          </div>
          <Fretboard
            highlightNotes={fbMode === "notes" ? NOTES : fbMode === "scale" ? fbScNotes : [root, NOTES[(ri + 4) % 12], NOTES[(ri + 7) % 12]]}
            rootNote={root}
            showIntervals={fbMode !== "notes"}
          />
        </div>
      </div>)}

      {/* ══ PROGRESSIONS ══ */}
      {tab === "progressions" && (<div>
        <div className="panel p-5 mb-3">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Chord Progression Builder</div>
          <div className="flex gap-2 flex-wrap mb-3">
            {progChords.map((ch, i) => (
              <div key={i} className="bg-[#0A0A0A] border border-[#222] rounded-sm px-3 py-2 cursor-pointer hover:border-[#444] transition-all"
                onClick={() => playChordByName(ch)}>
                <span className="font-heading text-base text-[#D4A843]">{ch}</span>
                <button onClick={(e) => { e.stopPropagation(); setProgChords(p => p.filter((_, j) => j !== i)); }}
                  className="text-[#C41E3A] text-[10px] ml-2 cursor-pointer">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mb-3">
            <input value={newChord} onChange={e => setNewChord(e.target.value)} placeholder="e.g. Am, F, G7"
              onKeyDown={e => { if (e.key === "Enter" && newChord.trim()) { setProgChords(p => [...p, newChord.trim()]); setNewChord(""); } }}
              className="input !w-40 !text-xs" />
            <button onClick={() => { if (newChord.trim()) { setProgChords(p => [...p, newChord.trim()]); setNewChord(""); } }} className="btn-gold !text-[10px]">Add</button>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={playProgression} className={progPlaying ? "btn-danger" : "btn-gold"}>
              {progPlaying ? "Stop" : "Play Progression"}
            </button>
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setProgLoop(!progLoop)}>
              <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${progLoop ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#444]"}`}>{progLoop ? "✓" : ""}</div>
              <span className="font-label text-[10px] text-[#666]">Loop</span>
            </label>
          </div>
        </div>

        <div className="panel p-5">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Presets — click to load</div>
          {[
            { g: "Metal", n: "i–bVI–bVII–i", ch: ["Am","F","G","Am"] },
            { g: "Blues 12-Bar", n: "I7–IV7–V7–I7", ch: ["A7","D7","E7","A7"] },
            { g: "Classic Rock", n: "I–IV–V–I", ch: ["A","D","E","A"] },
            { g: "Doom", n: "i–bII–i", ch: ["Am","Bb","Am"] },
            { g: "Pop-Punk", n: "I–V–vi–IV", ch: ["C","G","Am","F"] },
            { g: "Jazz", n: "ii–V–I", ch: ["Bm7","E7","Amaj7"] },
            { g: "Grunge", n: "i–iv–i–v", ch: ["Em","Am","Em","Bm"] },
            { g: "Ballad", n: "I–vi–IV–V", ch: ["C","Am","F","G"] },
          ].map(p => (
            <div key={p.g} className="flex items-center gap-3 py-2.5 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#0d0d0d] rounded-sm px-2 -mx-2 transition-all"
              onClick={() => setProgChords(p.ch)}>
              <span className="font-label text-[11px] text-[#D4A843] w-24">{p.g}</span>
              <span className="font-readout text-xs text-[#aaa] flex-1">{p.n}</span>
              <div className="flex gap-1">{p.ch.map((c, i) => <span key={i} className="font-readout text-[10px] text-[#888] px-1.5 py-0.5 border border-[#222] rounded-sm">{c}</span>)}</div>
            </div>
          ))}
        </div>
      </div>)}

      {/* ══ THEORY ══ */}
      {tab === "theory" && (<div>
        {/* Full Circle of Fifths */}
        <div className="panel p-5 mb-3">
          <div className="font-label text-[11px] text-[#D4A843] mb-4">Circle of Fifths</div>
          <div className="flex justify-center">
            <svg viewBox="0 0 340 340" className="w-72 h-72">
              {/* Outer ring — Major keys */}
              {MAJOR_KEYS.map((k, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = 170 + 130 * Math.cos(angle), y = 170 + 130 * Math.sin(angle);
                const noteClean = k.split("/")[0];
                const sel = noteClean === root || k.includes(root);
                return (
                  <g key={i} onClick={() => setRoot(NOTES[FIFTH_ORDER[i]])} className="cursor-pointer">
                    <circle cx={x} cy={y} r={sel ? 22 : 18} fill={sel ? "#D4A843" : "#1a1a1a"} stroke={sel ? "#DFBD69" : "#333"} strokeWidth="1.5" />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={sel ? "#0A0A0A" : "#ccc"} fontSize={sel ? "11" : "10"} fontWeight="bold" fontFamily="monospace">{k}</text>
                  </g>
                );
              })}
              {/* Inner ring — Minor keys */}
              {MINOR_KEYS.map((k, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = 170 + 82 * Math.cos(angle), y = 170 + 82 * Math.sin(angle);
                const noteClean = k.replace("m", "");
                const sel = noteClean === root;
                return (
                  <g key={i} onClick={() => setRoot(NOTES[FIFTH_ORDER[i]])} className="cursor-pointer">
                    <circle cx={x} cy={y} r={sel ? 18 : 14} fill={sel ? "#6366f1" : "#111"} stroke={sel ? "#818cf8" : "#222"} strokeWidth="1" />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={sel ? "#fff" : "#888"} fontSize={sel ? "9" : "8"} fontWeight="bold" fontFamily="monospace">{k}</text>
                  </g>
                );
              })}
              <text x="170" y="168" textAnchor="middle" fill="#333" fontSize="8" fontFamily="monospace">Major</text>
              <text x="170" y="180" textAnchor="middle" fill="#333" fontSize="8" fontFamily="monospace">Minor</text>
            </svg>
          </div>
        </div>

        {/* Intervals */}
        <div className="panel p-5">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Intervals from {root} — click to hear</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {[
              { n: "m2", st: 1, f: "Tense" },{ n: "M2", st: 2, f: "Whole step" },
              { n: "m3", st: 3, f: "Minor" },{ n: "M3", st: 4, f: "Major" },
              { n: "P4", st: 5, f: "Open" },{ n: "TT", st: 6, f: "Devil's interval" },
              { n: "P5", st: 7, f: "Power chord" },{ n: "m6", st: 8, f: "Bittersweet" },
              { n: "M6", st: 9, f: "Sweet" },{ n: "m7", st: 10, f: "Bluesy" },
              { n: "M7", st: 11, f: "Dreamy" },{ n: "P8", st: 12, f: "Octave" },
            ].map(i => (
              <div key={i.n} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-2.5 cursor-pointer hover:border-[#333] transition-all"
                onClick={() => { playNote(57 + ri); playNote(57 + ri + i.st, 0.5); }}>
                <div className="flex justify-between items-center">
                  <span className="font-readout font-bold text-[#D4A843]">{i.n}</span>
                  <span className="font-readout text-[10px] text-[#888]">{root} → {NOTES[(ri + i.st) % 12]}</span>
                </div>
                <div className="text-[9px] text-[#444] italic">{i.f}</div>
              </div>
            ))}
          </div>
        </div>
      </div>)}
    </div>
  );
}
