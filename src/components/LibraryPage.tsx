"use client";
import { useState, useRef } from "react";
import type { Exercise, Song, DayExMap, BoolMap, ExEditMap, SongEntry } from "@/lib/types";
import { CATS, COL, STYLES, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { SONG_LIBRARY } from "@/lib/songs-data";
import LibraryEditor from "./LibraryEditor";
import { getAllLibraryTracks, deleteFromLibrary } from "@/lib/suno";
import type { LibraryTrack } from "@/lib/suno";
import type { View } from "./Navbar";

interface LibraryPageProps {
  week: number;
  doneMap: BoolMap;
  exEdits: ExEditMap;
  customSongs: SongEntry[];
  mySongs: number[];
  songLibSearch: string;
  songLibFilter: "all" | "Beginner" | "Intermediate" | "Advanced";
  songLibGenre: string;
  songLibLimit: number;
  showAddSong: boolean;
  newSongTitle: string;
  newSongArtist: string;
  libTab: "exercises" | "styles" | "mysongs" | "recordings" | "backing" | "songlib";
  libFilter: string;
  libSearch: string;
  libShowAll: boolean;
  libCollapsed: Record<string, boolean>;
  editingId: number | null;
  // Setters
  setView: (v: View) => void;
  setExEdits: React.Dispatch<React.SetStateAction<ExEditMap>>;
  setCustomSongs: React.Dispatch<React.SetStateAction<SongEntry[]>>;
  setMySongs: React.Dispatch<React.SetStateAction<number[]>>;
  setSongLibSearch: (s: string) => void;
  setSongLibFilter: (f: "all" | "Beginner" | "Intermediate" | "Advanced") => void;
  setSongLibGenre: (s: string) => void;
  setSongLibLimit: React.Dispatch<React.SetStateAction<number>>;
  setShowAddSong: (b: boolean) => void;
  setNewSongTitle: (s: string) => void;
  setNewSongArtist: (s: string) => void;
  setLibTab: (t: "exercises" | "styles" | "mysongs" | "recordings" | "backing" | "songlib") => void;
  setLibFilter: (s: string) => void;
  setLibSearch: (s: string) => void;
  setLibShowAll: (b: boolean) => void;
  setLibCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingId: (id: number | null) => void;
  setModal: (ex: Exercise | null) => void;
  setSongModal: (s: SongEntry | null) => void;
  // Functions
  getEditedEx: (ex: Exercise) => Exercise;
}

export default function LibraryPage(props: LibraryPageProps) {
  const {
    week, doneMap, exEdits, customSongs, mySongs,
    songLibSearch, songLibFilter, songLibGenre, songLibLimit, showAddSong,
    newSongTitle, newSongArtist, libTab, libFilter, libSearch, libShowAll,
    libCollapsed, editingId,
    setView, setExEdits, setCustomSongs, setMySongs,
    setSongLibSearch, setSongLibFilter, setSongLibGenre, setSongLibLimit,
    setShowAddSong, setNewSongTitle, setNewSongArtist, setLibTab, setLibFilter,
    setLibSearch, setLibShowAll, setLibCollapsed, setEditingId,
    setModal, setSongModal, getEditedEx,
  } = props;

  // Library-local state
  const [libRecordings, setLibRecordings] = useState<{ id: string; name: string; date: string; duration: number; format: string }[]>([]);
  const [libRecordingsLoaded, setLibRecordingsLoaded] = useState(false);
  const [libBackingTracks, setLibBackingTracks] = useState<LibraryTrack[]>([]);
  const [libBackingLoaded, setLibBackingLoaded] = useState(false);
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const [playingBackingId, setPlayingBackingId] = useState<string | null>(null);
  const libAudioRef = useRef<HTMLAudioElement | null>(null);

  return (
    <div className="animate-fade-in">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {([
          ["exercises", "Exercises", "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"],
          ["styles", "Styles", "M9 19V6l12-3v13"],
          ["mysongs", "My Songs", "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"],
          ["recordings", "Recordings", "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-1h8M12 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"],
          ["backing", "Backing Tracks", "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"],
          ["songlib", "Song Library", "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"],
        ] as const).map(([key, label, iconPath]) => (
          <button type="button" key={key} onClick={() => setLibTab(key as typeof libTab)}
            className={`font-label text-[11px] px-3 py-2 rounded-lg cursor-pointer border transition-all flex-shrink-0 flex items-center gap-1.5 ${libTab === key ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666] hover:border-[#555] hover:text-[#888]"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={iconPath} /></svg>
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Exercises */}
      {libTab === "exercises" && (<>
        <input type="text" placeholder="Search exercise..." className="input w-full mb-3"
          value={libSearch} onChange={e => setLibSearch(e.target.value)} />

        <div className="flex gap-1 flex-wrap mb-4">
          <button onClick={() => setLibFilter("All")} className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border ${libFilter === "All" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All ({EXERCISES.length})</button>
          {CATS.filter((c) => c !== "Songs").map((cat) => {
            const cnt = EXERCISES.filter((e) => e.c === cat).length, c = COL[cat];
            if (!cnt) return null;
            return <button key={cat} onClick={() => setLibFilter(cat)} className="font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all"
              style={libFilter === cat ? { background: c, borderColor: c, color: "#121214" } : { borderColor: c + "40", color: c + "99" }}>{cat} ({cnt})</button>;
          })}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setLibShowAll(!libShowAll)} className="btn-ghost !text-[10px]">
            {libShowAll ? "Group by Category" : "Show Flat List"}
          </button>
        </div>

        {(() => {
          const filtered = EXERCISES.filter((e) => {
            if (libFilter !== "All" && e.c !== libFilter) return false;
            if (libSearch.trim()) {
              const q = libSearch.trim().toLowerCase();
              return e.n.toLowerCase().includes(q) || e.d.toLowerCase().includes(q) || e.f.toLowerCase().includes(q);
            }
            return true;
          });
          const isSearching = libSearch.trim().length > 0;

          const renderExCard = (rawEx: Exercise) => {
            const ex = getEditedEx(rawEx), c = COL[ex.c], isEd = editingId === ex.id;
            const practiceCount = Object.keys(doneMap).filter(k => k.includes("-" + ex.id) && doneMap[k]).length;
            return (
              <div key={ex.id} className={`panel mb-1.5 overflow-hidden ${isEd ? "!border-[#D4A843]/30" : ""}`}>
                <div onClick={() => setEditingId(isEd ? null : ex.id)} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                  <div className="flex-1">
                    <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{ex.n}</div>
                    <div className="font-readout text-[10px] text-[#444]">{ex.f} · {ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                  </div>
                  {practiceCount > 0 && (
                    <span className="font-readout text-[9px] px-1.5 py-0.5 rounded-sm bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">{practiceCount}x</span>
                  )}
                  <span className="text-[10px] text-[#333]">{isEd ? "\u2212" : "+"}</span>
                </div>
                {isEd && <LibraryEditor ex={ex} exEdits={exEdits} setExEdits={setExEdits} />}
              </div>
            );
          };

          if (libShowAll) {
            return (<>
              {filtered.map(renderExCard)}
              <div className="font-readout text-[10px] text-[#444] text-center mt-2">{filtered.length} exercises</div>
            </>);
          }

          return (<>
            {Object.entries(CAT_GROUPS).map(([groupName, groupCats]) => {
              const groupExercises = filtered.filter(e => groupCats.includes(e.c));
              if (groupExercises.length === 0) return null;
              const isCollapsed = isSearching ? false : (libCollapsed[groupName] ?? true);
              return (
                <div key={groupName} className="mb-2">
                  <div
                    onClick={() => { if (!isSearching) setLibCollapsed(p => ({ ...p, [groupName]: !isCollapsed })); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer border border-[#1a1a1a] bg-[#141416] hover:border-[#D4A843]/20 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="font-heading text-sm font-semibold text-[#ccc] flex-1">{groupName}</span>
                    <span className="font-readout text-[10px] px-2 py-0.5 rounded-sm bg-[#1a1a1a] text-[#D4A843] border border-[#D4A843]/20">{groupExercises.length}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="mt-1">{groupExercises.map(renderExCard)}</div>
                  )}
                </div>
              );
            })}
          </>);
        })()}
      </>)}

      {/* Tab 2: Styles */}
      {libTab === "styles" && (() => {
        const STYLE_DATA: Record<string, { color: string; icon: string; techniques: string[]; scales: string[] }> = {
          "Metal": { color: "#ef4444", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Palm Muting", "Tremolo Picking", "Sweep Picking", "Gallop Rhythm"], scales: ["Aeolian", "Phrygian", "Harmonic Minor"] },
          "Hard Rock": { color: "#f97316", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Power Chords", "Bends", "Vibrato", "Hammer-ons"], scales: ["Pentatonic Minor", "Aeolian", "Mixolydian"] },
          "Classic Rock": { color: "#eab308", icon: "M9 19V6l12-3v13", techniques: ["Bends", "Double Stops", "Rhythm Guitar", "Riffs"], scales: ["Pentatonic Minor", "Pentatonic Major", "Dorian"] },
          "Blues": { color: "#3b82f6", icon: "M9 19V6l12-3v13", techniques: ["Bends", "Vibrato", "Slides", "Call & Response"], scales: ["Blues Scale", "Pentatonic Minor", "Mixolydian"] },
          "Jazz": { color: "#8b5cf6", icon: "M9 19V6l12-3v13", techniques: ["Chord Melody", "Arpeggios", "Walking Bass", "Comping"], scales: ["Dorian", "Mixolydian", "Lydian", "Altered"] },
          "Grunge": { color: "#6b7280", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Power Chords", "Drop D", "Dynamics", "Feedback"], scales: ["Pentatonic Minor", "Aeolian", "Phrygian"] },
          "Stoner Rock": { color: "#a3e635", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Heavy Riffs", "Down Tuning", "Fuzz Tone", "Slow Bends"], scales: ["Pentatonic Minor", "Blues Scale", "Dorian"] },
          "Punk Rock": { color: "#ec4899", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Power Chords", "Fast Strumming", "Palm Muting"], scales: ["Aeolian", "Pentatonic Minor"] },
          "Neo-Classical": { color: "#c084fc", icon: "M9 19V6l12-3v13", techniques: ["Sweep Picking", "Alternate Picking", "Arpeggios", "Sequences"], scales: ["Harmonic Minor", "Phrygian Dominant", "Diminished"] },
          "Funk": { color: "#14b8a6", icon: "M9 19V6l12-3v13", techniques: ["Muted Strumming", "Wah Pedal", "Octaves", "Slap"], scales: ["Mixolydian", "Dorian", "Pentatonic Minor"] },
          "Country": { color: "#fbbf24", icon: "M9 19V6l12-3v13", techniques: ["Chicken Picking", "Bends", "Pedal Steel Licks", "Hybrid Picking"], scales: ["Pentatonic Major", "Mixolydian", "Major"] },
          "Flamenco": { color: "#f43f5e", icon: "M9 19V6l12-3v13", techniques: ["Rasgueado", "Picado", "Tremolo", "Golpe"], scales: ["Phrygian", "Phrygian Dominant", "Harmonic Minor"] },
          "Acoustic": { color: "#22c55e", icon: "M9 19V6l12-3v13", techniques: ["Fingerpicking", "Strumming", "Harmonics", "Percussive"], scales: ["Major", "Pentatonic Major", "Aeolian"] },
          "Progressive Metal": { color: "#6366f1", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Odd Time Signatures", "Polyrhythms", "Tapping", "Sweep Picking"], scales: ["Lydian", "Phrygian", "Whole Tone", "Diminished"] },
          "Djent": { color: "#0ea5e9", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Palm Muting", "Polyrhythms", "Extended Range", "Staccato"], scales: ["Aeolian", "Phrygian", "Lydian"] },
          "Death Metal": { color: "#991b1b", icon: "M13 10V3L4 14h7v7l9-11h-7z", techniques: ["Tremolo Picking", "Blast Beats", "Dissonance", "Sweep Picking"], scales: ["Phrygian", "Locrian", "Chromatic", "Whole Tone"] },
          "Fusion": { color: "#d946ef", icon: "M9 19V6l12-3v13", techniques: ["Legato", "Tapping", "Hybrid Picking", "Chord Extensions"], scales: ["Lydian", "Dorian", "Altered", "Melodic Minor"] },
        };
        const [activeStyle, setActiveStyle] = useState<string | null>(null);
        const styleExercises = activeStyle ? EXERCISES.filter(e => e.styles?.includes(activeStyle)) : [];
        const allSongsForStyle = activeStyle ? [...SONG_LIBRARY, ...customSongs].filter(s => s.genre?.toLowerCase().includes(activeStyle.toLowerCase())) : [];

        return (
          <div>
            {!activeStyle ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STYLES.map((s) => {
                  const cnt = EXERCISES.filter((e) => e.styles?.includes(s)).length;
                  const sd = STYLE_DATA[s];
                  const songCnt = [...SONG_LIBRARY, ...customSongs].filter(se => se.genre?.toLowerCase().includes(s.toLowerCase())).length;
                  return (
                    <div key={s} onClick={() => setActiveStyle(s)}
                      className="panel p-4 text-center cursor-pointer hover:border-[#D4A843]/30 transition-all group">
                      <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: (sd?.color || "#D4A843") + "20", border: `1px solid ${sd?.color || "#D4A843"}40` }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sd?.color || "#D4A843"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={sd?.icon || "M9 19V6l12-3v13"} /></svg>
                      </div>
                      <div className="font-heading text-sm font-bold" style={{ color: sd?.color || "#D4A843" }}>{s}</div>
                      <div className="font-readout text-[10px] text-[#555] mt-1">{cnt} exercises</div>
                      {songCnt > 0 && <div className="font-readout text-[10px] text-[#444] mt-0.5">{songCnt} songs</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => setActiveStyle(null)} className="btn-ghost !text-[10px] mb-4 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                  All Styles
                </button>
                <div className="panel p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: (STYLE_DATA[activeStyle]?.color || "#D4A843") + "20", border: `1px solid ${STYLE_DATA[activeStyle]?.color || "#D4A843"}40` }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={STYLE_DATA[activeStyle]?.color || "#D4A843"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STYLE_DATA[activeStyle]?.icon || "M9 19V6l12-3v13"} /></svg>
                    </div>
                    <div>
                      <div className="font-heading text-lg font-bold" style={{ color: STYLE_DATA[activeStyle]?.color || "#D4A843" }}>{activeStyle}</div>
                      <div className="font-readout text-[10px] text-[#555]">{styleExercises.length} exercises · {allSongsForStyle.length} songs</div>
                    </div>
                  </div>
                  {STYLE_DATA[activeStyle]?.techniques.length > 0 && (
                    <div className="mb-3">
                      <div className="font-label text-[10px] text-[#666] mb-1.5">Key Techniques</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {STYLE_DATA[activeStyle].techniques.map(t => (
                          <span key={t} className="font-readout text-[10px] px-2 py-1 rounded-sm border border-[#333] text-[#888]">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {STYLE_DATA[activeStyle]?.scales.length > 0 && (
                    <div>
                      <div className="font-label text-[10px] text-[#666] mb-1.5">Recommended Scales</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {STYLE_DATA[activeStyle].scales.map(s => (
                          <span key={s} className="font-readout text-[10px] px-2 py-1 rounded-sm border border-[#D4A843]/20 text-[#D4A843]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {styleExercises.length > 0 && (
                  <div className="mb-4">
                    <div className="font-label text-[11px] text-[#666] mb-2">Exercises for {activeStyle}</div>
                    {styleExercises.map(ex => {
                      const c = COL[ex.c];
                      return (
                        <div key={ex.id} onClick={() => setModal(ex)} tabIndex={0} role="button" onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModal(ex); } }} className="panel p-3 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                          <div className="flex items-center gap-3">
                            <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                            <div className="flex-1">
                              <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{ex.n}</div>
                              <div className="font-readout text-[10px] text-[#444]">{ex.m}min {ex.b ? "\u00B7 " + ex.b : ""}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {allSongsForStyle.length > 0 && (
                  <div>
                    <div className="font-label text-[11px] text-[#666] mb-2">Songs ({allSongsForStyle.length})</div>
                    {allSongsForStyle.slice(0, 10).map(song => (
                      <div key={song.id} onClick={() => setSongModal(song)} className="panel p-3 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                        <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</div>
                        <div className="font-readout text-[10px] text-[#555]">{song.artist}</div>
                      </div>
                    ))}
                    {allSongsForStyle.length > 10 && (
                      <button type="button" onClick={() => { setLibTab("songlib"); setSongLibGenre(allSongsForStyle[0]?.genre || "all"); }} className="btn-ghost w-full mt-1 !text-[10px]">
                        View all {allSongsForStyle.length} songs
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 3: My Songs */}
      {libTab === "mysongs" && (() => {
        const allSongsLookup = [...SONG_LIBRARY, ...customSongs];
        const savedSongs = mySongs.map(id => allSongsLookup.find(s => s.id === id)).filter((s): s is SongEntry => !!s);
        return (
          <div>
            {savedSongs.length === 0 ? (
              <div className="panel p-8 sm:p-12 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                <div className="font-heading text-lg text-[#D4A843] mb-2">No Songs Saved</div>
                <div className="font-readout text-[11px] text-[#444] mb-4">Browse the Song Library and tap the heart to save songs here.</div>
                <button type="button" onClick={() => setLibTab("songlib")} className="btn-ghost">Browse Song Library</button>
              </div>
            ) : (
              <>
                <div className="font-readout text-[10px] text-[#555] mb-3">{savedSongs.length} saved songs</div>
                {savedSongs.map(song => {
                  const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                  return (
                    <div key={song.id} className="panel p-4 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0" onClick={() => setSongModal(song)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</span>
                            {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                          </div>
                          <div className="font-readout text-[11px] text-[#666] mt-1">{song.artist}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {song.genre && <span className="font-readout text-[9px] text-[#555]">{song.genre}</span>}
                            {song.key && <span className="font-readout text-[9px] text-[#555]">Key: {song.key}</span>}
                            {song.tempo && <span className="font-readout text-[9px] text-[#555]">{song.tempo} BPM</span>}
                          </div>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setMySongs(p => p.filter(id => id !== song.id)); }}
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors" title="Remove from My Songs">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 4: My Recordings */}
      {libTab === "recordings" && (() => {
        if (!libRecordingsLoaded) {
          try {
            const raw = localStorage.getItem("gf-recordings");
            if (raw) setLibRecordings(JSON.parse(raw));
          } catch {}
          setLibRecordingsLoaded(true);
        }
        const playRecording = async (id: string) => {
          if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); return; }
          try {
            const dbReq = indexedDB.open("gf-studio", 2);
            dbReq.onsuccess = () => {
              const db = dbReq.result;
              const tx = db.transaction("recordings", "readonly");
              const req = tx.objectStore("recordings").get(id);
              req.onsuccess = () => {
                const rec = req.result;
                if (rec?.blob) {
                  if (libAudioRef.current) { libAudioRef.current.pause(); URL.revokeObjectURL(libAudioRef.current.src); }
                  const url = URL.createObjectURL(rec.blob);
                  const audio = new Audio(url);
                  audio.onended = () => setPlayingRecId(null);
                  audio.play();
                  libAudioRef.current = audio;
                  setPlayingRecId(id);
                }
              };
            };
          } catch {}
        };
        const deleteRecording = async (id: string) => {
          try {
            const dbReq = indexedDB.open("gf-studio", 2);
            dbReq.onsuccess = () => {
              const db = dbReq.result;
              const tx = db.transaction("recordings", "readwrite");
              tx.objectStore("recordings").delete(id);
              tx.oncomplete = () => {
                const updated = libRecordings.filter(r => r.id !== id);
                setLibRecordings(updated);
                try { localStorage.setItem("gf-recordings", JSON.stringify(updated)); } catch {}
              };
            };
          } catch {}
          if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); }
        };
        return (
          <div>
            {libRecordings.length === 0 ? (
              <div className="panel p-8 sm:p-12 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                  <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-1h8M12 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"/>
                </svg>
                <div className="font-heading text-lg text-[#D4A843] mb-2">No Recordings</div>
                <div className="font-readout text-[11px] text-[#444] mb-4">Record yourself in any exercise or the Studio to see recordings here.</div>
                <button type="button" onClick={() => setView("studio")} className="btn-ghost">Open Studio</button>
              </div>
            ) : (
              <>
                <div className="font-readout text-[10px] text-[#555] mb-3">{libRecordings.length} recordings</div>
                {libRecordings.map(rec => (
                  <div key={rec.id} className="panel p-4 mb-1.5">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => playRecording(rec.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-all"
                        style={{ borderColor: playingRecId === rec.id ? "#D4A843" : "#333", background: playingRecId === rec.id ? "#D4A843" + "20" : "transparent" }}>
                        {playingRecId === rec.id ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{rec.name}</div>
                        <div className="font-readout text-[10px] text-[#444]">
                          {new Date(rec.date).toLocaleDateString()} · {Math.round(rec.duration)}s · {rec.format?.toUpperCase() || "WAV"}
                        </div>
                      </div>
                      <button type="button" onClick={() => deleteRecording(rec.id)}
                        className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Delete</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 5: Backing Tracks */}
      {libTab === "backing" && (() => {
        if (!libBackingLoaded) {
          setLibBackingLoaded(true);
          getAllLibraryTracks().then(tracks => setLibBackingTracks(tracks)).catch(() => {});
        }
        const playBacking = (track: LibraryTrack) => {
          if (playingBackingId === track.id) { libAudioRef.current?.pause(); setPlayingBackingId(null); return; }
          if (libAudioRef.current) { libAudioRef.current.pause(); URL.revokeObjectURL(libAudioRef.current.src); }
          const audio = new Audio(track.audioUrl);
          audio.onended = () => setPlayingBackingId(null);
          audio.play();
          libAudioRef.current = audio;
          setPlayingBackingId(track.id);
        };
        const deleteBacking = async (id: string) => {
          try { await deleteFromLibrary(id); setLibBackingTracks(p => p.filter(t => t.id !== id)); } catch {}
          if (playingBackingId === id) { libAudioRef.current?.pause(); setPlayingBackingId(null); }
        };
        return (
          <div>
            {libBackingTracks.length === 0 ? (
              <div className="panel p-8 sm:p-12 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                  <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
                </svg>
                <div className="font-heading text-lg text-[#D4A843] mb-2">No Backing Tracks</div>
                <div className="font-readout text-[11px] text-[#444] mb-4">Generate a backing track in any exercise or the Studio.</div>
                <button type="button" onClick={() => setView("studio")} className="btn-ghost">Open Studio</button>
              </div>
            ) : (
              <>
                <div className="font-readout text-[10px] text-[#555] mb-3">{libBackingTracks.length} backing tracks</div>
                {libBackingTracks.map(track => (
                  <div key={track.id} className="panel p-4 mb-1.5">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => playBacking(track)}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-all"
                        style={{ borderColor: playingBackingId === track.id ? "#D4A843" : "#333", background: playingBackingId === track.id ? "#D4A843" + "20" : "transparent" }}>
                        {playingBackingId === track.id ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{track.title}</div>
                        <div className="font-readout text-[10px] text-[#444]">
                          {track.params.style} · {track.params.scale} {track.params.mode} · {track.params.bpm} BPM
                        </div>
                        <div className="font-readout text-[9px] text-[#333] mt-0.5">
                          {new Date(track.createdAt).toLocaleDateString()} · {Math.round(track.duration)}s
                        </div>
                      </div>
                      {track.favorite && <span className="text-[#D4A843] text-xs flex-shrink-0">&#x2605;</span>}
                      <button type="button" onClick={() => deleteBacking(track.id)}
                        className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Delete</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 6: Song Library */}
      {libTab === "songlib" && (() => {
        const allSongs = [...SONG_LIBRARY, ...customSongs];
        const genres = [...new Set(allSongs.map(s => s.genre).filter((g): g is string => !!g))].sort();
        const genreFiltered = songLibGenre === "all" ? allSongs : allSongs.filter(s => s.genre === songLibGenre);
        const filtered = genreFiltered.filter(s => {
          if (songLibFilter !== "all" && s.difficulty !== songLibFilter) return false;
          if (songLibSearch.trim()) {
            const q = songLibSearch.trim().toLowerCase();
            return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.genre || "").toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q);
          }
          return true;
        });
        const diffCounts = { all: genreFiltered.length, Beginner: genreFiltered.filter(s => s.difficulty === "Beginner").length, Intermediate: genreFiltered.filter(s => s.difficulty === "Intermediate").length, Advanced: genreFiltered.filter(s => s.difficulty === "Advanced").length };
        return (
          <div>
            <div className="flex gap-1 flex-wrap mb-3 overflow-x-auto scrollbar-hide">
              <button onClick={() => { setSongLibGenre("all"); setSongLibLimit(20); }}
                className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === "all" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
                All ({allSongs.length})
              </button>
              {genres.map(g => {
                const cnt = allSongs.filter(s => s.genre === g).length;
                return (
                  <button key={g} onClick={() => { setSongLibGenre(g); setSongLibLimit(20); }}
                    className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === g ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
                    {g} ({cnt})
                  </button>
                );
              })}
            </div>
            <input type="text" placeholder="Search song, artist, genre..." className="input w-full mb-3"
              value={songLibSearch} onChange={e => { setSongLibSearch(e.target.value); setSongLibLimit(20); }} />
            <div className="flex gap-1 flex-wrap mb-4">
              {([["all", "All", "#D4A843"], ["Beginner", "Beginner", "#22c55e"], ["Intermediate", "Intermediate", "#D4A843"], ["Advanced", "Advanced", "#ef4444"]] as const).map(([key, label, color]) => (
                <button key={key} onClick={() => { setSongLibFilter(key as typeof songLibFilter); setSongLibLimit(20); }}
                  className="font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all"
                  style={songLibFilter === key ? { background: color, borderColor: color, color: "#121214" } : { borderColor: color + "40", color: color + "99" }}>
                  {label} ({diffCounts[key as keyof typeof diffCounts]})
                </button>
              ))}
            </div>
            <div className="mb-4">
              <button onClick={() => setShowAddSong(!showAddSong)} className="btn-ghost !text-[10px] mb-2">
                {showAddSong ? "Close" : "+ Add Song"}
              </button>
              {showAddSong && (
                <div className="panel p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <input placeholder="Song title..." value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} className="input min-w-0" />
                    <input placeholder="Artist..." value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} className="input min-w-0" />
                    <button onClick={() => {
                      if (!newSongTitle.trim() || !newSongArtist.trim()) return;
                      setCustomSongs(p => [...p, { id: Date.now(), title: newSongTitle.trim(), artist: newSongArtist.trim() }]);
                      setNewSongTitle(""); setNewSongArtist("");
                    }} className="btn-gold">Add</button>
                  </div>
                </div>
              )}
            </div>
            <div className="font-readout text-[10px] text-[#555] mb-2">
              Showing {Math.min(songLibLimit, filtered.length)} of {filtered.length} songs
            </div>
            {filtered.length === 0 && (
              <div className="panel p-8 text-center"><div className="font-label text-sm text-[#444]">No songs found</div></div>
            )}
            {(() => {
              const limited = filtered.slice(0, songLibLimit);
              return (<>
                {limited.map(song => {
                  const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
                  const isCustom = song.id >= 1000000000;
                  const isSaved = mySongs.includes(song.id);
                  return (
                    <div key={song.id} onClick={() => setSongModal(song)}
                      className="panel p-4 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</span>
                            {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                          </div>
                          <div className="font-readout text-[11px] text-[#666] mt-1">{song.artist}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {song.genre && <span className="font-readout text-[9px] text-[#555]">{song.genre}</span>}
                            {song.key && <span className="font-readout text-[9px] text-[#555]">Key: {song.key}</span>}
                            {song.tempo && <span className="font-readout text-[9px] text-[#555]">{song.tempo} BPM</span>}
                            {song.tuning && song.tuning !== "Standard" && <span className="font-readout text-[9px] text-[#555]">{song.tuning}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button" onClick={(e) => {
                            e.stopPropagation();
                            if (isSaved) setMySongs(p => p.filter(id => id !== song.id));
                            else setMySongs(p => [...p, song.id]);
                          }} className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors" title={isSaved ? "Remove from My Songs" : "Add to My Songs"}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? "#ef4444" : "none"} stroke={isSaved ? "#ef4444" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                            </svg>
                          </button>
                          {isCustom && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setCustomSongs(p => p.filter(s => s.id !== song.id)); }}
                              className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333]">Remove</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {songLibLimit < filtered.length && (
                  <button type="button" onClick={() => setSongLibLimit(p => p + 20)} className="btn-ghost w-full mt-2 !text-[11px]">
                    Load more ({filtered.length - songLibLimit} remaining)
                  </button>
                )}
              </>);
            })()}
          </div>
        );
      })()}
    </div>
  );
}
