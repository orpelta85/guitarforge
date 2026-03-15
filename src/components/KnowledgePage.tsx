"use client";
import { useState, useRef, useEffect } from "react";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALE_F: Record<string, number[]> = {
  "Major (Ionian)": [0,2,4,5,7,9,11], "Natural Minor (Aeolian)": [0,2,3,5,7,8,10],
  "Dorian": [0,2,3,5,7,9,10], "Phrygian": [0,1,3,5,7,8,10], "Lydian": [0,2,4,6,7,9,11],
  "Mixolydian": [0,2,4,5,7,9,10], "Locrian": [0,1,3,5,6,8,10],
  "Harmonic Minor": [0,2,3,5,7,8,11], "Phrygian Dominant": [0,1,4,5,7,8,10],
  "Minor Pentatonic": [0,3,5,7,10], "Major Pentatonic": [0,2,4,7,9],
  "Blues Scale": [0,3,5,6,7,10], "Whole Tone": [0,2,4,6,8,10],
};
const CHORD_SUFFIXES = ["major","minor","dim","aug","7","maj7","m7","sus2","sus4","dim7","m7b5","add9","6","m6","9","m9"];
const TUNING = [40,45,50,55,59,64];
const STR = ["E","A","D","G","B","e"];
const FRETS = 15;

type Tab = "scales"|"chords"|"fretboard"|"theory"|"progressions";

function mf(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

interface ChordPosition { frets: string; fingers: string; barres?: number; capo?: boolean; }
interface ChordData { key: string; suffix: string; positions: ChordPosition[]; }

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("scales");
  const [root, setRoot] = useState("A");
  const [selScale, setSelScale] = useState("Minor Pentatonic");
  const [selChordSuffix, setSelChordSuffix] = useState("minor");
  const [chordData, setChordData] = useState<ChordData | null>(null);
  const [chordLoading, setChordLoading] = useState(false);
  const [progKey, setProgKey] = useState("Am");
  const [progChords, setProgChords] = useState<string[]>(["Am", "F", "C", "G"]);
  const [newChord, setNewChord] = useState("");
  const ctxRef = useRef<AudioContext | null>(null);

  function play(midis: number[], stagger = 0.15) {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const c = ctxRef.current;
    midis.forEach((m, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = mf(m);
      const t = c.currentTime + i * stagger;
      g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.start(t); o.stop(t + 0.7);
    });
  }

  // Fetch chord data from API
  useEffect(() => {
    async function load() {
      setChordLoading(true);
      try {
        const res = await fetch(`/api/chords?key=${encodeURIComponent(root)}&suffix=${encodeURIComponent(selChordSuffix)}`);
        if (res.ok) { const d = await res.json(); setChordData(d); }
        else setChordData(null);
      } catch { setChordData(null); }
      setChordLoading(false);
    }
    if (tab === "chords") load();
  }, [root, selChordSuffix, tab]);

  const ri = NOTES.indexOf(root);
  const scNotes = (SCALE_F[selScale] || []).map(s => NOTES[(ri + s) % 12]);
  const scIv = SCALE_F[selScale] || [];
  const noteAt = (si: number, f: number) => NOTES[(TUNING[si] + f) % 12];
  const inScale = (n: string) => scNotes.includes(n);
  const isRoot = (n: string) => n === root;

  // Chord diagram renderer
  function renderChordDiagram(pos: ChordPosition, idx: number) {
    const frets = pos.frets.split("").map(f => f === "x" ? -1 : parseInt(f, 16));
    const fingers = pos.fingers.split("").map(f => parseInt(f));
    const minFret = Math.min(...frets.filter(f => f > 0));
    const baseFret = pos.capo ? (pos.barres || minFret) : (minFret > 4 ? minFret : 1);
    const displayFrets = 5;

    return (
      <div key={idx} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 text-center" dir="ltr">
        <div className="font-readout text-[9px] text-[#555] mb-1">{baseFret > 1 ? `Fret ${baseFret}` : "Open"}</div>
        <svg viewBox="0 0 100 120" className="w-20 h-24 mx-auto">
          {/* Nut or fret marker */}
          {baseFret === 1 && <rect x="15" y="8" width="70" height="3" fill="#D4A843" />}
          {baseFret > 1 && <text x="10" y="22" fill="#888" fontSize="10" fontFamily="monospace">{baseFret}</text>}
          {/* Fret lines */}
          {Array.from({length: displayFrets + 1}, (_, i) => (
            <line key={i} x1="15" y1={10 + i * 20} x2="85" y2={10 + i * 20} stroke="#333" strokeWidth="1" />
          ))}
          {/* String lines */}
          {[0,1,2,3,4,5].map(s => (
            <line key={s} x1={15 + s * 14} y1="10" x2={15 + s * 14} y2={10 + displayFrets * 20} stroke="#555" strokeWidth={s < 3 ? 1.5 : 1} />
          ))}
          {/* Barre */}
          {pos.barres && (() => {
            const barreFret = (typeof pos.barres === "number" ? pos.barres : 0) - baseFret + 1;
            if (barreFret >= 1 && barreFret <= displayFrets) {
              const firstStr = frets.findIndex(f => f === pos.barres);
              const lastStr = frets.length - 1 - [...frets].reverse().findIndex(f => f === pos.barres);
              if (firstStr >= 0) {
                return <rect x={15 + firstStr * 14 - 5} y={barreFret * 20 - 2} width={(lastStr - firstStr) * 14 + 10} height="8" rx="4" fill="#D4A843" opacity="0.6" />;
              }
            }
            return null;
          })()}
          {/* Dots */}
          {frets.map((f, s) => {
            if (f === -1) return <text key={s} x={15 + s * 14} y="6" textAnchor="middle" fill="#C41E3A" fontSize="8">x</text>;
            if (f === 0) return <circle key={s} cx={15 + s * 14} cy="6" r="3" fill="none" stroke="#888" strokeWidth="1" />;
            const displayF = f - baseFret + 1;
            if (displayF < 1 || displayF > displayFrets) return null;
            const isRootDot = s === 0 || (fingers[s] === 1 && pos.capo);
            return (
              <g key={s}>
                <circle cx={15 + s * 14} cy={displayF * 20} r="5" fill={isRootDot ? "#D4A843" : "#ccc"} />
                {fingers[s] > 0 && <text x={15 + s * 14} y={displayF * 20 + 3} textAnchor="middle" fill="#0A0A0A" fontSize="7" fontWeight="bold">{fingers[s]}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="panel p-5 mb-3">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Theory &amp; Reference</div>
        <div className="font-label text-[10px] text-[#555] mt-1">Scales · Chords · Fretboard · Progressions</div>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {(["scales","chords","fretboard","progressions","theory"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer transition-all ${tab === t ? "bg-[#D4A843] text-[#0A0A0A]" : "text-[#555] border border-[#222]"}`}>{t}</button>
        ))}
      </div>

      {/* Root note */}
      <div className="panel p-3 mb-3">
        <div className="font-label text-[9px] text-[#555] mb-1.5">Root</div>
        <div className="flex gap-1 flex-wrap">
          {NOTES.map(n => (
            <button key={n} onClick={() => setRoot(n)}
              className={`font-label text-[10px] px-2.5 py-1 rounded-sm cursor-pointer border ${root === n ? "bg-[#D4A843] text-[#0A0A0A] border-[#D4A843]" : "border-[#222] text-[#666]"}`}>{n}</button>
          ))}
        </div>
      </div>

      {/* ── SCALES ── */}
      {tab === "scales" && (<div>
        <div className="panel p-3 mb-3">
          <div className="font-label text-[9px] text-[#555] mb-1.5">Scale</div>
          <div className="flex gap-1 flex-wrap">
            {Object.keys(SCALE_F).map(s => (
              <button key={s} onClick={() => setSelScale(s)}
                className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${selScale === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#1a1a1a] text-[#444]"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="panel p-5 mb-3">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="font-heading text-lg font-bold text-[#D4A843]">{root} {selScale}</div>
              <div className="font-readout text-sm text-[#666] mt-1">{scNotes.join(" — ")}</div>
            </div>
            <button onClick={() => play(scIv.map(s => 57 + ri + s), 0.18)} className="btn-gold">Play</button>
          </div>
          <div className="font-label text-[9px] text-[#555] mb-1.5">Formula</div>
          <div className="flex gap-1 flex-wrap mb-3">
            {scIv.map((s, i) => (
              <span key={i} className="px-2 py-1 rounded-sm text-xs font-readout border"
                style={{ borderColor: s === 0 ? "#D4A843" : "#222", color: s === 0 ? "#D4A843" : "#888", background: s === 0 ? "#D4A843" + "10" : "#0A0A0A" }}>
                {scNotes[i]}
              </span>
            ))}
          </div>
          {/* Characteristic note */}
          {selScale.includes("Dorian") && <div className="text-[11px] text-[#D4A843]/70 mb-2">Characteristic: Major 6th — bright minor sound</div>}
          {selScale.includes("Phrygian") && <div className="text-[11px] text-[#D4A843]/70 mb-2">Characteristic: b2 — dark, Spanish/flamenco sound</div>}
          {selScale.includes("Lydian") && <div className="text-[11px] text-[#D4A843]/70 mb-2">Characteristic: #4 — dreamy, floating sound</div>}
          {selScale.includes("Mixolydian") && <div className="text-[11px] text-[#D4A843]/70 mb-2">Characteristic: b7 — bluesy, dominant sound</div>}
          {selScale.includes("Blues") && <div className="text-[11px] text-[#D4A843]/70 mb-2">The b5 (blue note) — bend up to the 5th for authentic blues</div>}
        </div>
        {/* Fretboard */}
        <div className="panel p-4 overflow-x-auto" dir="ltr">
          <div className="min-w-[600px]">
            <div className="flex mb-1"><div className="w-7" />{Array.from({length: FRETS+1}, (_,f) => <div key={f} className="flex-1 text-center font-readout text-[8px] text-[#333]">{f}</div>)}</div>
            {[...Array(6)].map((_, si) => {
              const s = 5 - si;
              return (
                <div key={s} className="flex items-center h-6">
                  <div className="w-7 font-readout text-[9px] text-[#444] text-center">{STR[s]}</div>
                  {Array.from({length: FRETS+1}, (_,f) => {
                    const n = noteAt(s, f), ins = inScale(n), ir = isRoot(n);
                    return (
                      <div key={f} className="flex-1 flex items-center justify-center" style={{ borderRight: "1px solid #1a1a1a", borderBottom: si < 5 ? "1px solid #2a2a2a" : "1px solid #333" }}>
                        {ins && <div className="rounded-full flex items-center justify-center text-[7px] font-bold"
                          style={{ width: 18, height: 18, background: ir ? "#D4A843" : "#2a2a2a", color: ir ? "#0A0A0A" : "#ddd", border: ir ? "none" : "1px solid #444" }}>{n}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="flex mt-1"><div className="w-7" />{Array.from({length: FRETS+1}, (_,f) => <div key={f} className="flex-1 text-center">{[3,5,7,9,12,15].includes(f) && <div className={`w-1.5 h-1.5 rounded-full mx-auto ${f===12?"bg-[#D4A843]/40":"bg-[#333]"}`} />}</div>)}</div>
          </div>
        </div>
      </div>)}

      {/* ── CHORDS ── */}
      {tab === "chords" && (<div>
        <div className="panel p-3 mb-3">
          <div className="font-label text-[9px] text-[#555] mb-1.5">Type</div>
          <div className="flex gap-1 flex-wrap">
            {CHORD_SUFFIXES.map(s => (
              <button key={s} onClick={() => setSelChordSuffix(s)}
                className={`font-label text-[10px] px-2 py-1 rounded-sm cursor-pointer border ${selChordSuffix === s ? "border-[#D4A843] text-[#D4A843]" : "border-[#1a1a1a] text-[#444]"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="panel p-5 mb-3">
          <div className="font-heading text-lg font-bold text-[#D4A843] mb-1">
            {root}{selChordSuffix === "major" ? "" : selChordSuffix}
          </div>
          {chordLoading && <div className="font-label text-[10px] text-[#444]">Loading...</div>}
          {chordData && chordData.positions && (
            <div>
              <div className="font-label text-[9px] text-[#555] mb-2 mt-3">Voicings ({chordData.positions.length})</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {chordData.positions.map((pos, i) => renderChordDiagram(pos, i))}
              </div>
            </div>
          )}
          {!chordLoading && !chordData && (
            <div className="font-label text-[10px] text-[#444] mt-2">Chord data not available for this combination</div>
          )}
        </div>
      </div>)}

      {/* ── FRETBOARD ── */}
      {tab === "fretboard" && (
        <div className="panel p-4 overflow-x-auto" dir="ltr">
          <div className="font-label text-[9px] text-[#555] mb-3">{root} highlighted — click to hear</div>
          <div className="min-w-[600px]">
            <div className="flex mb-1"><div className="w-7" />{Array.from({length: FRETS+1}, (_,f) => <div key={f} className="flex-1 text-center font-readout text-[8px] text-[#333]">{f}</div>)}</div>
            {[...Array(6)].map((_, si) => {
              const s = 5 - si;
              return (
                <div key={s} className="flex items-center h-7">
                  <div className="w-7 font-readout text-[9px] text-[#444] text-center">{STR[s]}</div>
                  {Array.from({length: FRETS+1}, (_,f) => {
                    const n = noteAt(s, f), ir = isRoot(n), midi = TUNING[s] + f;
                    return (
                      <div key={f} onClick={() => { if (!ctxRef.current) ctxRef.current = new AudioContext(); play([midi], 0); }}
                        className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-all"
                        style={{ borderRight: "1px solid #1a1a1a", borderBottom: si < 5 ? "1px solid #2a2a2a" : "1px solid #333" }}>
                        <div className="rounded-full flex items-center justify-center text-[7px] font-bold"
                          style={{ width: 18, height: 18, background: ir ? "#D4A843" : "#111", color: ir ? "#0A0A0A" : "#555", border: `1px solid ${ir ? "#D4A843" : "#222"}` }}>{n}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="flex mt-1"><div className="w-7" />{Array.from({length: FRETS+1}, (_,f) => <div key={f} className="flex-1 text-center">{[3,5,7,9,12,15].includes(f) && <div className={`w-1.5 h-1.5 rounded-full mx-auto ${f===12?"bg-[#D4A843]/40":"bg-[#333]"}`} />}</div>)}</div>
          </div>
        </div>
      )}

      {/* ── PROGRESSIONS ── */}
      {tab === "progressions" && (<div>
        <div className="panel p-5 mb-3">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Chord Progression Builder</div>
          <div className="flex gap-2 flex-wrap mb-3">
            {progChords.map((ch, i) => (
              <div key={i} className="flex items-center gap-1 bg-[#0A0A0A] border border-[#222] rounded-sm px-3 py-2">
                <span className="font-heading text-base text-[#D4A843]">{ch}</span>
                <button onClick={() => setProgChords(p => p.filter((_, j) => j !== i))} className="text-[#C41E3A] text-[10px] ml-1 cursor-pointer">x</button>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <input value={newChord} onChange={e => setNewChord(e.target.value)} placeholder="Add chord..."
                onKeyDown={e => { if (e.key === "Enter" && newChord.trim()) { setProgChords(p => [...p, newChord.trim()]); setNewChord(""); } }}
                className="input !w-24 !text-xs !py-1.5" />
              <button onClick={() => { if (newChord.trim()) { setProgChords(p => [...p, newChord.trim()]); setNewChord(""); } }} className="btn-gold !text-[10px] !px-2">+</button>
            </div>
          </div>
          <button onClick={() => {
            progChords.forEach((_, i) => {
              setTimeout(() => play([57 + ri, 57 + ri + 4, 57 + ri + 7], 0), i * 800);
            });
          }} className="btn-gold !text-[10px]">Play Progression</button>
        </div>

        {/* Common progressions */}
        <div className="panel p-5">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Common Progressions</div>
          {[
            { genre: "Metal", num: "i – bVI – bVII – i", chords: ["Am","F","G","Am"], desc: "The metal power progression" },
            { genre: "Blues", num: "I7 – IV7 – V7", chords: ["A7","D7","E7"], desc: "12-bar blues foundation" },
            { genre: "Rock", num: "I – IV – V – I", chords: ["A","D","E","A"], desc: "Classic rock and roll" },
            { genre: "Doom", num: "i – bII – i", chords: ["Am","Bb","Am"], desc: "Dark, heavy, Sabbath-inspired" },
            { genre: "Pop-Punk", num: "I – V – vi – IV", chords: ["C","G","Am","F"], desc: "The hit-maker progression" },
            { genre: "Jazz", num: "ii – V – I", chords: ["Bm7","E7","Amaj7"], desc: "Jazz standard movement" },
            { genre: "Grunge", num: "i – iv – i – v", chords: ["Am","Dm","Am","Em"], desc: "Minor key intensity" },
            { genre: "Neo-Classical", num: "i – iv – V – i", chords: ["Am","Dm","E","Am"], desc: "Classical minor with dominant" },
          ].map(p => (
            <div key={p.genre} className="flex items-center gap-3 py-3 border-b border-[#111] last:border-0 cursor-pointer hover:bg-[#141414] transition-all"
              onClick={() => setProgChords(p.chords)}>
              <span className="font-label text-[11px] text-[#D4A843] w-24">{p.genre}</span>
              <div className="flex-1">
                <div className="font-readout text-xs text-[#aaa]">{p.num}</div>
                <div className="text-[10px] text-[#555]">{p.desc}</div>
              </div>
              <div className="flex gap-1">
                {p.chords.map((c, i) => <span key={i} className="font-readout text-[10px] text-[#888] px-1.5 py-0.5 border border-[#222] rounded-sm">{c}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>)}

      {/* ── THEORY ── */}
      {tab === "theory" && (<div>
        <div className="panel p-5 mb-3">
          <div className="font-label text-[11px] text-[#D4A843] mb-4">Circle of Fifths</div>
          <div className="flex justify-center">
            <svg viewBox="0 0 300 300" className="w-56 h-56">
              {NOTES.map((_, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = 150 + 115 * Math.cos(angle), y = 150 + 115 * Math.sin(angle);
                const order = [0,7,2,9,4,11,6,1,8,3,10,5];
                const n = NOTES[order[i]], sel = n === root;
                return (
                  <g key={i} onClick={() => setRoot(n)} className="cursor-pointer">
                    <circle cx={x} cy={y} r={sel ? 20 : 16} fill={sel ? "#D4A843" : "#1a1a1a"} stroke={sel ? "#DFBD69" : "#333"} strokeWidth="1" />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={sel ? "#0A0A0A" : "#aaa"} fontSize={sel ? "12" : "10"} fontWeight="bold" fontFamily="monospace">{n}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="panel p-5 mb-3">
          <div className="font-label text-[11px] text-[#D4A843] mb-3">Interval Reference</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {[["m2","1 semitone","Chromatic tension"],["M2","2 semitones","Whole step"],["m3","3 semitones","Minor, dark"],["M3","4 semitones","Major, bright"],
              ["P4","5 semitones","Open, strong"],["TT","6 semitones","Unstable, evil"],["P5","7 semitones","Power chord"],["m6","8 semitones","Bittersweet"],
              ["M6","9 semitones","Sweet, warm"],["m7","10 semitones","Bluesy, dominant"],["M7","11 semitones","Dreamy, jazz"],["P8","12 semitones","Octave"]
            ].map(([n,d,f]) => (
              <div key={n} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-2.5 cursor-pointer hover:border-[#333] transition-all"
                onClick={() => { if (!ctxRef.current) ctxRef.current = new AudioContext(); play([60, 60 + parseInt(d)], 0.5); }}>
                <div className="font-readout font-bold text-[#D4A843] text-sm">{n}</div>
                <div className="text-[10px] text-[#666]">{d}</div>
                <div className="text-[9px] text-[#444] italic">{f}</div>
              </div>
            ))}
          </div>
        </div>
      </div>)}
    </div>
  );
}
