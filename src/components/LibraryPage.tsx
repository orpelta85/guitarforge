"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import type { Exercise, Song, DayExMap, BoolMap, ExEditMap, SongEntry } from "@/lib/types";
import { CATS, COL, STYLES, CAT_GROUPS } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises";
import { SONG_LIBRARY } from "@/lib/songs-data";
import LibraryEditor from "./LibraryEditor";
import { getAllLibraryTracks, deleteFromLibrary, getYtBackingTracks, deleteYtBackingTrack } from "@/lib/suno";
import type { LibraryTrack, YtBackingTrack } from "@/lib/suno";
import type { View } from "./Navbar";
import SongFilterBar, { useFilteredSongs } from "./SongFilterBar";
import type { SongSort, DifficultyFilter } from "./SongFilterBar";
import { getLibraryRecordings, deleteLibraryRecording } from "@/lib/recordingsLibrary";
import type { LibraryRecording } from "@/lib/recordingsLibrary";
import { openRecorderDB } from "@/lib/recorderIdb";
import AddSongModal from "./AddSongModal";

interface LibraryPageProps {
  week: number;
  doneMap: BoolMap;
  exEdits: ExEditMap;
  customSongs: SongEntry[];
  mySongs: number[];
  customExercises: Exercise[];
  setCustomExercises: React.Dispatch<React.SetStateAction<Exercise[]>>;
  songLibSearch: string;
  songLibFilter: DifficultyFilter;
  songLibGenre: string;
  songLibGenres: string[];
  songLibSort: SongSort;
  songLibHasGP: boolean;
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
  setSongLibFilter: (f: DifficultyFilter) => void;
  setSongLibGenre: (s: string) => void;
  setSongLibGenres: (g: string[]) => void;
  setSongLibSort: (s: SongSort) => void;
  setSongLibHasGP: (b: boolean) => void;
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

/* ── Recordings Tab Component (Practice + Studio sub-tabs) ── */
interface RecordingsTabProps {
  recSubTab: "practice" | "studio";
  setRecSubTab: (t: "practice" | "studio") => void;
  practiceRecordings: { id: string; exerciseName: string; date: string; url: string; blob: Blob }[];
  setPracticeRecordings: React.Dispatch<React.SetStateAction<{ id: string; exerciseName: string; date: string; url: string; blob: Blob }[]>>;
  practiceRecLoaded: boolean;
  setPracticeRecLoaded: (b: boolean) => void;
  idbRecordings: { key: string; label: string; date: string; url: string; blobKey: string }[];
  setIdbRecordings: React.Dispatch<React.SetStateAction<{ key: string; label: string; date: string; url: string; blobKey: string }[]>>;
  idbRecLoaded: boolean;
  setIdbRecLoaded: (b: boolean) => void;
  libRecordings: { id: string; name: string; date: string; duration: number; format: string }[];
  setLibRecordings: React.Dispatch<React.SetStateAction<{ id: string; name: string; date: string; duration: number; format: string }[]>>;
  libRecordingsLoaded: boolean;
  setLibRecordingsLoaded: (b: boolean) => void;
  playingRecId: string | null;
  setPlayingRecId: (id: string | null) => void;
  libAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  setView: (v: View) => void;
}

function RecordingsTab({
  recSubTab, setRecSubTab,
  practiceRecordings, setPracticeRecordings,
  practiceRecLoaded, setPracticeRecLoaded,
  idbRecordings, setIdbRecordings,
  idbRecLoaded, setIdbRecLoaded,
  libRecordings, setLibRecordings,
  libRecordingsLoaded, setLibRecordingsLoaded,
  playingRecId, setPlayingRecId,
  libAudioRef, setView,
}: RecordingsTabProps) {

  // Load practice recordings from both gf-recordings-library and gf-recorder IDBs
  useEffect(() => {
    if (practiceRecLoaded) return;
    setPracticeRecLoaded(true);

    // 1. Load from gf-recordings-library (saved from exercise modal)
    getLibraryRecordings().then(recs => {
      const mapped = recs.map(r => ({
        id: r.id,
        exerciseName: r.exerciseName,
        date: r.savedAt,
        url: URL.createObjectURL(r.blob),
        blob: r.blob,
      }));
      setPracticeRecordings(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...mapped.filter(m => !existingIds.has(m.id))];
      });
    }).catch(() => {});

    // 2. Load from gf-recorder IDB (all meta-* keys = practice/exercise recordings)
    openRecorderDB().then(db => {
      const tx = db.transaction("recordings", "readonly");
      const store = tx.objectStore("recordings");
      const allKeysReq = store.getAllKeys();
      allKeysReq.onsuccess = () => {
        const keys = allKeysReq.result as string[];
        const metaKeys = keys.filter(k => typeof k === "string" && k.startsWith("meta-"));
        const results: { key: string; label: string; date: string; url: string; blobKey: string }[] = [];

        if (metaKeys.length === 0) {
          setIdbRecordings([]);
          setIdbRecLoaded(true);
          return;
        }

        let loaded = 0;
        for (const metaKey of metaKeys) {
          const rawKey = metaKey.replace("meta-", "");
          const getReq = store.get(metaKey);
          getReq.onsuccess = () => {
            if (getReq.result) {
              try {
                const metaList: { dt: string; idx: number }[] = JSON.parse(getReq.result);
                for (const meta of metaList) {
                  const blobKey = `blob-${rawKey}-${meta.idx}`;
                  const blobReq = store.get(blobKey);
                  blobReq.onsuccess = () => {
                    if (blobReq.result instanceof Blob) {
                      // Try to create a human-readable label from the key
                      const label = rawKey.replace(/^ex-/, "Exercise ").replace(/^song-/, "Song ").replace(/-/g, " ");
                      results.push({
                        key: rawKey,
                        label,
                        date: meta.dt,
                        url: URL.createObjectURL(blobReq.result),
                        blobKey,
                      });
                    }
                  };
                }
              } catch { /* skip malformed meta */ }
            }
            loaded++;
            if (loaded === metaKeys.length) {
              // Small delay to let all blob reads finish
              setTimeout(() => {
                setIdbRecordings([...results]);
                setIdbRecLoaded(true);
              }, 100);
            }
          };
        }
      };
    }).catch(() => { setIdbRecLoaded(true); });
  }, [practiceRecLoaded, setPracticeRecLoaded, setPracticeRecordings, setIdbRecordings, setIdbRecLoaded]);

  // Load studio recordings from localStorage
  useEffect(() => {
    if (libRecordingsLoaded) return;
    setLibRecordingsLoaded(true);
    try {
      const raw = localStorage.getItem("gf-recordings");
      if (raw) setLibRecordings(JSON.parse(raw));
    } catch {}
  }, [libRecordingsLoaded, setLibRecordingsLoaded, setLibRecordings]);

  // Play/pause any recording by URL
  const playUrl = (id: string, url: string) => {
    if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); return; }
    if (libAudioRef.current) { libAudioRef.current.pause(); URL.revokeObjectURL(libAudioRef.current.src); }
    const audio = new Audio(url);
    audio.onended = () => setPlayingRecId(null);
    audio.play();
    libAudioRef.current = audio;
    setPlayingRecId(id);
  };

  // Play studio recording from IDB blob
  const playStudioRecording = (id: string) => {
    if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); return; }
    try {
      const dbReq = indexedDB.open("gf-studio", 1);
      dbReq.onupgradeneeded = () => {
        const db = dbReq.result;
        if (!db.objectStoreNames.contains("recordings")) db.createObjectStore("recordings", { keyPath: "id" });
      };
      dbReq.onsuccess = () => {
        const db = dbReq.result;
        if (!db.objectStoreNames.contains("recordings")) { return; }
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

  // Delete practice recording from gf-recordings-library
  const deletePracticeRec = async (id: string) => {
    try { await deleteLibraryRecording(id); } catch {}
    setPracticeRecordings(p => p.filter(r => r.id !== id));
    if (playingRecId === id) { libAudioRef.current?.pause(); setPlayingRecId(null); }
  };

  // Delete idb recorder recording
  const deleteIdbRec = async (blobKey: string, recId: string) => {
    try {
      const db = await openRecorderDB();
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").delete(blobKey);
      await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
    } catch {}
    setIdbRecordings(p => p.filter(r => !(r.blobKey === blobKey && (r.key + r.date) === recId)));
    if (playingRecId === recId) { libAudioRef.current?.pause(); setPlayingRecId(null); }
  };

  // Delete studio recording
  const deleteStudioRec = (id: string) => {
    try {
      const dbReq = indexedDB.open("gf-studio", 1);
      dbReq.onupgradeneeded = () => {
        const db = dbReq.result;
        if (!db.objectStoreNames.contains("recordings")) db.createObjectStore("recordings", { keyPath: "id" });
      };
      dbReq.onsuccess = () => {
        const db = dbReq.result;
        if (!db.objectStoreNames.contains("recordings")) return;
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

  // Combine practice recordings from both sources
  const allPractice = [
    ...practiceRecordings.map(r => ({ id: r.id, name: r.exerciseName, date: r.date, url: r.url, source: "library" as const, blobKey: "" })),
    ...idbRecordings.map(r => ({ id: r.key + r.date, name: r.label, date: r.date, url: r.url, source: "idb" as const, blobKey: r.blobKey })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const practiceCount = allPractice.length;
  const studioCount = libRecordings.length;

  const PlayButton = ({ id, onClick }: { id: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-all"
      style={{ borderColor: playingRecId === id ? "#D4A843" : "#333", background: playingRecId === id ? "#D4A843" + "20" : "transparent" }}>
      {playingRecId === id ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      )}
    </button>
  );

  return (
    <div>
      {/* Sub-tab selector */}
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setRecSubTab("practice")}
          className={`flex-1 font-label text-[11px] px-3 py-2.5 rounded-lg cursor-pointer border transition-all flex items-center justify-center gap-2 ${recSubTab === "practice" ? "bg-[#D4A843]/10 text-[#D4A843] border-[#D4A843]/40" : "border-[#222] text-[#555] hover:border-[#333] hover:text-[#777]"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19V6l12-3v13"/></svg>
          Practice{practiceCount > 0 ? ` (${practiceCount})` : ""}
        </button>
        <button type="button" onClick={() => setRecSubTab("studio")}
          className={`flex-1 font-label text-[11px] px-3 py-2.5 rounded-lg cursor-pointer border transition-all flex items-center justify-center gap-2 ${recSubTab === "studio" ? "bg-[#D4A843]/10 text-[#D4A843] border-[#D4A843]/40" : "border-[#222] text-[#555] hover:border-[#333] hover:text-[#777]"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          Studio{studioCount > 0 ? ` (${studioCount})` : ""}
        </button>
      </div>

      {/* Practice Recordings */}
      {recSubTab === "practice" && (
        <div>
          {allPractice.length === 0 ? (
            <div className="panel p-8 sm:p-12 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                <path d="M9 19V6l12-3v13"/>
              </svg>
              <div className="font-heading text-lg text-[#D4A843] mb-2">No Practice Recordings</div>
              <div className="font-readout text-[11px] text-[#444] mb-4">Record yourself during exercises or practice sessions to see them here.</div>
            </div>
          ) : (
            <>
              <div className="font-readout text-[10px] text-[#555] mb-3">{allPractice.length} practice recordings</div>
              {allPractice.map(rec => (
                <div key={rec.id} className="panel p-4 mb-1.5">
                  <div className="flex items-center gap-3">
                    <PlayButton id={rec.id} onClick={() => playUrl(rec.id, rec.url)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{rec.name}</div>
                      <div className="font-readout text-[10px] text-[#444]">
                        {(() => {
                          try { return new Date(rec.date).toLocaleDateString(); } catch { return rec.date; }
                        })()}
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                      if (rec.source === "library") deletePracticeRec(rec.id);
                      else deleteIdbRec(rec.blobKey, rec.id);
                    }} className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Studio Recordings */}
      {recSubTab === "studio" && (
        <div>
          {libRecordings.length === 0 ? (
            <div className="panel p-8 sm:p-12 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <div className="font-heading text-lg text-[#D4A843] mb-2">No Studio Recordings</div>
              <div className="font-readout text-[11px] text-[#444] mb-4">Record or export tracks in the Studio to see them here.</div>
              <button type="button" onClick={() => setView("studio")} className="btn-ghost">Open Studio</button>
            </div>
          ) : (
            <>
              <div className="font-readout text-[10px] text-[#555] mb-3">{libRecordings.length} studio recordings</div>
              {libRecordings.map(rec => (
                <div key={rec.id} className="panel p-4 mb-1.5">
                  <div className="flex items-center gap-3">
                    <PlayButton id={rec.id} onClick={() => playStudioRecording(rec.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{rec.name}</div>
                      <div className="font-readout text-[10px] text-[#444]">
                        {new Date(rec.date).toLocaleDateString()} · {Math.round(rec.duration)}s · {rec.format?.toUpperCase() || "WAV"}
                      </div>
                    </div>
                    <button type="button" onClick={() => deleteStudioRec(rec.id)}
                      className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0">Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LibraryPage(props: LibraryPageProps) {
  const {
    week, doneMap, exEdits, customSongs, mySongs, customExercises, setCustomExercises,
    songLibSearch, songLibFilter, songLibGenre, songLibGenres, songLibSort, songLibHasGP,
    songLibLimit, showAddSong,
    newSongTitle, newSongArtist, libTab, libFilter, libSearch, libShowAll,
    libCollapsed, editingId,
    setView, setExEdits, setCustomSongs, setMySongs,
    setSongLibSearch, setSongLibFilter, setSongLibGenre, setSongLibGenres,
    setSongLibSort, setSongLibHasGP, setSongLibLimit,
    setShowAddSong, setNewSongTitle, setNewSongArtist, setLibTab, setLibFilter,
    setLibSearch, setLibShowAll, setLibCollapsed, setEditingId,
    setModal, setSongModal, getEditedEx,
  } = props;

  // Apply stored song edits
  const songEditsRef = useRef<Record<number, Partial<SongEntry>>>({});
  useEffect(() => {
    try { const raw = localStorage.getItem("gf-song-edits"); if (raw) songEditsRef.current = JSON.parse(raw); } catch {}
  }, []);
  const applySongEdits = (s: SongEntry): SongEntry => {
    if (s.id >= 1000000000) return s;
    const edits = songEditsRef.current[s.id];
    return edits ? { ...s, ...edits } : s;
  };

  // Song library filtering (must be at top level since useFilteredSongs is a hook)
  const songLibAllSongs = useMemo(() => [...SONG_LIBRARY, ...customSongs].map(applySongEdits), [customSongs]);
  const songLibFiltered = useFilteredSongs(songLibAllSongs, songLibSearch, songLibFilter, songLibGenres, songLibSort, songLibHasGP);

  // Library-local state
  const [libRecordings, setLibRecordings] = useState<{ id: string; name: string; date: string; duration: number; format: string }[]>([]);
  const [libRecordingsLoaded, setLibRecordingsLoaded] = useState(false);
  const [libBackingTracks, setLibBackingTracks] = useState<LibraryTrack[]>([]);
  const [libBackingLoaded, setLibBackingLoaded] = useState(false);
  const [ytBackingTracks, setYtBackingTracks] = useState<YtBackingTrack[]>([]);
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const [playingBackingId, setPlayingBackingId] = useState<string | null>(null);
  const [expandedYtId, setExpandedYtId] = useState<string | null>(null);
  const libAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  // Add Exercise form state
  const [showAddExForm, setShowAddExForm] = useState(false);
  const [newExName, setNewExName] = useState("");
  const CAT_DEFAULTS: Record<string, { bpm: string; focus: string; minutes: number }> = {
    "Warm-Up": { bpm: "60-80", focus: "Finger Independence, Relaxation", minutes: 5 },
    "Shred": { bpm: "120-200", focus: "Speed, Accuracy", minutes: 10 },
    "Legato": { bpm: "80-140", focus: "Hammer-ons, Pull-offs", minutes: 10 },
    "Bends": { bpm: "60-100", focus: "Pitch Accuracy, Vibrato", minutes: 5 },
    "Tapping": { bpm: "100-160", focus: "Two-hand Coordination", minutes: 10 },
    "Sweep": { bpm: "80-160", focus: "Economy of Motion, Arpeggios", minutes: 10 },
    "Rhythm": { bpm: "80-140", focus: "Timing, Groove", minutes: 10 },
    "Fretboard": { bpm: "", focus: "Note Knowledge, Navigation", minutes: 5 },
    "Ear Training": { bpm: "", focus: "Interval Recognition, Pitch", minutes: 10 },
    "Improv": { bpm: "80-120", focus: "Creativity, Phrasing", minutes: 10 },
    "Riffs": { bpm: "100-160", focus: "Precision, Tone", minutes: 10 },
    "Phrasing": { bpm: "60-100", focus: "Expression, Dynamics", minutes: 10 },
    "Modes": { bpm: "80-120", focus: "Scale Patterns, Application", minutes: 10 },
    "Composition": { bpm: "", focus: "Song Structure, Creativity", minutes: 15 },
    "Dynamics": { bpm: "60-120", focus: "Volume Control, Touch", minutes: 5 },
    "Chords": { bpm: "60-100", focus: "Chord Shapes, Transitions", minutes: 10 },
    "Harmonics": { bpm: "60-80", focus: "Natural & Artificial Harmonics", minutes: 5 },
    "Picking": { bpm: "100-180", focus: "Alternate Picking, Economy", minutes: 10 },
    "Arpeggios": { bpm: "80-140", focus: "Sweep, String Skipping", minutes: 10 },
    "Slide": { bpm: "60-100", focus: "Intonation, Slide Control", minutes: 10 },
    "Tunings": { bpm: "", focus: "Alternate Tuning Familiarity", minutes: 10 },
    "Keys": { bpm: "", focus: "Key Signatures, Transposition", minutes: 10 },
  };
  const [newExCat, setNewExCat] = useState("Warm-Up");
  const [newExMinutes, setNewExMinutes] = useState<number | "">(5);
  const [newExBpm, setNewExBpm] = useState("");
  const [newExDesc, setNewExDesc] = useState("");
  const [newExFocus, setNewExFocus] = useState("");
  function saveCustomExercise() {
    if (!newExName.trim()) return;
    const minutes = newExMinutes === "" ? 5 : newExMinutes;
    if (minutes < 1 || minutes > 60) return;
    const maxId = Math.max(...EXERCISES.map(e => e.id), ...customExercises.map(e => e.id), 9999);
    const ex: Exercise = {
      id: maxId + 1, c: newExCat, n: newExName.trim(), m: minutes,
      b: newExBpm, d: newExDesc, yt: newExName.trim() + " guitar exercise",
      t: "", f: newExFocus || newExCat, bt: false,
    };
    const next = [...customExercises, ex];
    setCustomExercises(next);
    try { localStorage.setItem("gf-custom-exercises", JSON.stringify(next)); } catch {}
    setShowAddExForm(false);
    setNewExName(""); setNewExMinutes(5); setNewExDesc(""); setNewExBpm(""); setNewExFocus("");
  }

  const allExercisesRaw = useMemo(() => [...EXERCISES, ...customExercises], [customExercises]);

  // Trash / hidden exercises
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    try { const raw = localStorage.getItem("gf-hidden-exercises"); return raw ? new Set(JSON.parse(raw)) : new Set(); } catch { return new Set(); }
  });
  const [showTrash, setShowTrash] = useState(false);

  function hideExercise(id: number) {
    const next = new Set(hiddenIds);
    next.add(id);
    setHiddenIds(next);
    try { localStorage.setItem("gf-hidden-exercises", JSON.stringify([...next])); } catch {}
    if (editingId === id) setEditingId(null);
  }

  function restoreExercise(id: number) {
    const next = new Set(hiddenIds);
    next.delete(id);
    setHiddenIds(next);
    try { localStorage.setItem("gf-hidden-exercises", JSON.stringify([...next])); } catch {}
  }

  function restoreAll() {
    setHiddenIds(new Set());
    try { localStorage.removeItem("gf-hidden-exercises"); } catch {}
  }

  function permanentlyDelete(id: number) {
    // Only custom exercises can be permanently deleted
    const isCustom = customExercises.some(e => e.id === id);
    if (isCustom) {
      const next = customExercises.filter(e => e.id !== id);
      setCustomExercises(next);
      try { localStorage.setItem("gf-custom-exercises", JSON.stringify(next)); } catch {}
    }
    restoreExercise(id); // Remove from hidden too
  }

  const allExercises = useMemo(() => allExercisesRaw.filter(e => !hiddenIds.has(e.id)), [allExercisesRaw, hiddenIds]);
  const trashedExercises = useMemo(() => allExercisesRaw.filter(e => hiddenIds.has(e.id)), [allExercisesRaw, hiddenIds]);

  // Add Song modal state
  const [addSongModalOpen, setAddSongModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongEntry | null>(null);

  // Recordings sub-tab state
  const [recSubTab, setRecSubTab] = useState<"practice" | "studio">("practice");
  const [practiceRecordings, setPracticeRecordings] = useState<{ id: string; exerciseName: string; date: string; url: string; blob: Blob }[]>([]);
  const [practiceRecLoaded, setPracticeRecLoaded] = useState(false);
  const [idbRecordings, setIdbRecordings] = useState<{ key: string; label: string; date: string; url: string; blobKey: string }[]>([]);
  const [idbRecLoaded, setIdbRecLoaded] = useState(false);

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
        <div className="flex items-center gap-2 mb-3">
          <input type="text" placeholder="Search exercise..." className="input flex-1"
            value={libSearch} onChange={e => setLibSearch(e.target.value)} />
          <button type="button" onClick={() => {
            const opening = !showAddExForm;
            setShowAddExForm(opening);
            if (opening) { const d = CAT_DEFAULTS[newExCat]; if (d) { setNewExMinutes(d.minutes); setNewExBpm(d.bpm); setNewExFocus(d.focus); } }
          }}
            className="font-label text-[11px] px-3 py-2 rounded-lg cursor-pointer border border-[#D4A843] bg-[#D4A843]/10 text-[#D4A843] hover:bg-[#D4A843]/20 transition-all flex-shrink-0 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Exercise
          </button>
        </div>

        {showAddExForm && (
          <div className="panel p-4 mb-4 !border-[#D4A843]/30">
            <div className="font-label text-[11px] text-[#D4A843] mb-3">New Custom Exercise</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <input type="text" placeholder="Exercise name *" value={newExName} onChange={e => setNewExName(e.target.value)}
                className="input" />
              <select value={newExCat} onChange={e => {
                const cat = e.target.value;
                setNewExCat(cat);
                const d = CAT_DEFAULTS[cat];
                if (d) { setNewExMinutes(d.minutes); setNewExBpm(d.bpm); setNewExFocus(d.focus); }
              }} className="input">
                {CATS.filter(c => c !== "Songs").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="Duration (minutes)" value={newExMinutes} onChange={e => setNewExMinutes(e.target.value === "" ? "" : Math.max(1, Math.min(60, Number(e.target.value))))}
                className="input" min={1} max={60} />
              <input type="text" placeholder="BPM range (e.g. 80-120)" value={newExBpm} onChange={e => setNewExBpm(e.target.value)}
                className="input" />
            </div>
            <textarea placeholder="Description" value={newExDesc} onChange={e => setNewExDesc(e.target.value)}
              className="input w-full mb-2" rows={2} />
            <input type="text" placeholder="Focus areas (e.g. Speed, Accuracy)" value={newExFocus} onChange={e => setNewExFocus(e.target.value)}
              className="input w-full mb-3" />
            <div className="flex gap-2">
              <button type="button" onClick={saveCustomExercise}
                className="font-label text-[11px] px-4 py-2 rounded-lg cursor-pointer bg-[#D4A843] text-[#121214] hover:bg-[#e5c060] transition-all">
                Save Exercise
              </button>
              <button type="button" onClick={() => setShowAddExForm(false)} className="btn-ghost !text-[10px]">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-1 flex-wrap mb-4">
          <button onClick={() => setLibFilter("All")} className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border ${libFilter === "All" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>All ({allExercises.length})</button>
          {CATS.filter((c) => c !== "Songs").map((cat) => {
            const cnt = allExercises.filter((e) => e.c === cat).length, c = COL[cat];
            if (!cnt) return null;
            return <button key={cat} onClick={() => setLibFilter(cat)} className="font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all"
              style={libFilter === cat ? { background: c, borderColor: c, color: "#121214" } : { borderColor: c + "40", color: c + "99" }}>{cat} ({cnt})</button>;
          })}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setLibShowAll(!libShowAll)} className="btn-ghost !text-[10px]">
            {libShowAll ? "Group by Category" : "Show Flat List"}
          </button>
          {customExercises.length > 0 && (
            <button onClick={() => setLibFilter(libFilter === "Custom" ? "All" : "Custom")}
              className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all ${libFilter === "Custom" ? "bg-[#8b5cf6] text-[#121214] border-[#8b5cf6]" : "border-[#8b5cf6]/40 text-[#8b5cf6]/80 hover:border-[#8b5cf6]/60"}`}>
              Custom ({customExercises.length})
            </button>
          )}
          {trashedExercises.length > 0 && (
            <button onClick={() => setShowTrash(!showTrash)}
              className={`font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border transition-all flex items-center gap-1 ${showTrash ? "bg-[#C41E3A]/20 text-[#C41E3A] border-[#C41E3A]/40" : "border-[#333] text-[#555] hover:border-[#555] hover:text-[#777]"}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Trash ({trashedExercises.length})
            </button>
          )}
        </div>

        {/* Trash panel */}
        {showTrash && trashedExercises.length > 0 && (
          <div className="panel p-4 mb-4 !border-[#C41E3A]/20">
            <div className="flex items-center justify-between mb-3">
              <div className="font-label text-[11px] text-[#C41E3A] flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Trash ({trashedExercises.length})
              </div>
              <button type="button" onClick={restoreAll}
                className="font-label text-[10px] px-3 py-1 rounded-lg cursor-pointer border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10 transition-all">
                Restore All
              </button>
            </div>
            {trashedExercises.map(ex => {
              const c = COL[ex.c], isCustom = customExercises.some(ce => ce.id === ex.id);
              return (
                <div key={ex.id} className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 bg-[#1a1a1a]/50 border border-[#222]">
                  <span className="tag min-w-[48px] text-center opacity-50" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-[12px] !font-medium !normal-case !tracking-normal text-[#666]">{ex.n}</div>
                    <div className="font-readout text-[9px] text-[#444]">{ex.f} · {ex.m}min</div>
                  </div>
                  <button type="button" onClick={() => restoreExercise(ex.id)}
                    className="font-label text-[9px] px-2 py-1 rounded cursor-pointer border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10 transition-all">
                    Restore
                  </button>
                  {isCustom && (
                    <button type="button" onClick={() => permanentlyDelete(ex.id)}
                      className="font-label text-[9px] px-2 py-1 rounded cursor-pointer border border-[#C41E3A]/30 text-[#C41E3A] hover:bg-[#C41E3A]/10 transition-all">
                      Delete Forever
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(() => {
          const customIds = new Set(customExercises.map(e => e.id));
          const filtered = allExercises.filter((e) => {
            if (libFilter === "Custom") { if (!customIds.has(e.id)) return false; }
            else if (libFilter !== "All" && e.c !== libFilter) return false;
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
              <div key={ex.id} className={`panel mb-1.5 overflow-hidden group ${isEd ? "!border-[#D4A843]/30" : ""}`}>
                <div onClick={() => setEditingId(isEd ? null : ex.id)} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <span className="tag min-w-[48px] text-center" style={{ border: `1px solid ${c}40`, color: c }}>{ex.c}</span>
                  <div className="flex-1">
                    <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{ex.n}</div>
                    <div className="font-readout text-[10px] text-[#444]">{ex.f} · {ex.m}min {ex.b ? "· " + ex.b : ""}</div>
                  </div>
                  {practiceCount > 0 && (
                    <span className="font-readout text-[9px] px-1.5 py-0.5 rounded-sm bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">{practiceCount}x</span>
                  )}
                  <button type="button" title="Delete exercise" onClick={e => { e.stopPropagation(); hideExercise(ex.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] text-[#555] hover:text-[#C41E3A] hover:bg-[#C41E3A]/10 transition-all opacity-0 group-hover:opacity-100">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
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
                  const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444", Expert: "#dc2626" }[song.difficulty] || "#888") : "#888";
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

      {/* Tab 4: My Recordings - Split into Practice / Studio sub-tabs */}
      {libTab === "recordings" && <RecordingsTab
        recSubTab={recSubTab} setRecSubTab={setRecSubTab}
        practiceRecordings={practiceRecordings} setPracticeRecordings={setPracticeRecordings}
        practiceRecLoaded={practiceRecLoaded} setPracticeRecLoaded={setPracticeRecLoaded}
        idbRecordings={idbRecordings} setIdbRecordings={setIdbRecordings}
        idbRecLoaded={idbRecLoaded} setIdbRecLoaded={setIdbRecLoaded}
        libRecordings={libRecordings} setLibRecordings={setLibRecordings}
        libRecordingsLoaded={libRecordingsLoaded} setLibRecordingsLoaded={setLibRecordingsLoaded}
        playingRecId={playingRecId} setPlayingRecId={setPlayingRecId}
        libAudioRef={libAudioRef}
        setView={setView}
      />}

      {/* Tab 5: Backing Tracks */}
      {libTab === "backing" && (() => {
        if (!libBackingLoaded) {
          setLibBackingLoaded(true);
          getAllLibraryTracks().then(tracks => setLibBackingTracks(tracks)).catch(() => {});
          setYtBackingTracks(getYtBackingTracks());
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
        const deleteYtBacking = (id: string) => {
          deleteYtBackingTrack(id);
          setYtBackingTracks(p => p.filter(t => t.id !== id));
        };
        const totalCount = libBackingTracks.length + ytBackingTracks.length;
        return (
          <div>
            {totalCount === 0 ? (
              <div className="panel p-8 sm:p-12 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                  <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
                </svg>
                <div className="font-heading text-lg text-[#D4A843] mb-2">No Backing Tracks</div>
                <div className="font-readout text-[11px] text-[#444] mb-4">Generate a backing track in any exercise, or save YouTube backing tracks from the exercise modal.</div>
                <button type="button" onClick={() => setView("studio")} className="btn-ghost">Open Studio</button>
              </div>
            ) : (
              <>
                <div className="font-readout text-[10px] text-[#555] mb-3">{totalCount} backing track{totalCount !== 1 ? "s" : ""}</div>

                {libBackingTracks.length > 0 && (
                  <>
                    {ytBackingTracks.length > 0 && <div className="font-label text-[10px] text-[#666] uppercase tracking-wider mb-2">Suno AI Tracks</div>}
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

                {ytBackingTracks.length > 0 && (
                  <>
                    {libBackingTracks.length > 0 && <div className="font-label text-[10px] text-[#666] uppercase tracking-wider mb-2 mt-4">YouTube Backing Tracks</div>}
                    {ytBackingTracks.map(track => {
                      const isExpanded = expandedYtId === track.id;
                      return (
                        <div key={track.id} className="panel mb-1.5 overflow-hidden">
                          <div className="flex gap-3 p-4">
                            <div className="w-[120px] h-[68px] rounded-lg overflow-hidden bg-black flex-shrink-0 relative cursor-pointer group"
                              onClick={() => setExpandedYtId(isExpanded ? null : track.id)}>
                              <img src={`https://img.youtube.com/vi/${track.videoId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedYtId(isExpanded ? null : track.id)}>
                              <div className="font-heading text-[13px] !font-medium !normal-case !tracking-normal truncate">{track.title}</div>
                              {track.exerciseName && track.exerciseName !== track.title && (
                                <div className="font-readout text-[10px] text-[#555] truncate">{track.exerciseName}</div>
                              )}
                              <div className="font-readout text-[10px] text-[#444]">
                                {track.style} · {track.scale} {track.mode}
                              </div>
                              <div className="font-readout text-[9px] text-[#333] mt-0.5">
                                {new Date(track.savedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <button type="button" onClick={() => deleteYtBacking(track.id)}
                              className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333] flex-shrink-0 self-center">Delete</button>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                                <iframe src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1&modestbranding=1&rel=0`}
                                  className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title={track.title} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 6: Song Library */}
      {libTab === "songlib" && (
          <div>
            <SongFilterBar
              allSongs={songLibAllSongs}
              search={songLibSearch}
              diffFilter={songLibFilter}
              genres={songLibGenres}
              sort={songLibSort}
              hasGP={songLibHasGP}
              setSearch={setSongLibSearch}
              setDiffFilter={setSongLibFilter}
              setGenres={setSongLibGenres}
              setSort={setSongLibSort}
              setHasGP={setSongLibHasGP}
              onResetLimit={() => setSongLibLimit(20)}
              filteredCount={Math.min(songLibLimit, songLibFiltered.length)}
              totalCount={songLibAllSongs.length}
            />
            <div className="mb-4">
              <button type="button" onClick={() => setAddSongModalOpen(true)}
                className="font-label text-[11px] px-3 py-2 rounded-lg cursor-pointer border border-[#D4A843] bg-[#D4A843]/10 text-[#D4A843] hover:bg-[#D4A843]/20 transition-all flex-shrink-0 flex items-center gap-1.5 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Add Song Manually
              </button>
            </div>
            {(addSongModalOpen || editingSong) && (
              <AddSongModal
                onClose={() => { setAddSongModalOpen(false); setEditingSong(null); }}
                editSong={editingSong || undefined}
                onSave={(song) => {
                  if (editingSong) {
                    setCustomSongs(p => p.map(s => s.id === song.id ? song : s));
                  } else {
                    setCustomSongs(p => [...p, song]);
                  }
                }}
              />
            )}
            {songLibFiltered.length === 0 && (
              <div className="panel p-8 text-center"><div className="font-label text-sm text-[#444]">No songs found</div></div>
            )}
            {(() => {
              const limited = songLibFiltered.slice(0, songLibLimit);
              return (<>
                {limited.map(song => {
                  const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444", Expert: "#dc2626" }[song.difficulty] || "#888") : "#888";
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
                            {(song.gpPath || song.gpFileName) && (
                              <span className="font-readout text-[8px] px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">GP</span>
                            )}
                            {song.personal && (
                              <span className="font-readout text-[8px] px-1.5 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20">Personal</span>
                            )}
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
                            <>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingSong(song); }}
                                className="btn-ghost !px-2 !py-1 !text-[9px] !border-[#333]">Edit</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setCustomSongs(p => p.filter(s => s.id !== song.id)); }}
                                className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333]">Remove</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {songLibLimit < songLibFiltered.length && (
                  <button type="button" onClick={() => setSongLibLimit(p => p + 20)} className="btn-ghost w-full mt-2 !text-[11px]">
                    Load more ({songLibFiltered.length - songLibLimit} remaining)
                  </button>
                )}
              </>);
            })()}
          </div>
      )}
    </div>
  );
}
