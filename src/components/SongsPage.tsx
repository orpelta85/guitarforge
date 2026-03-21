"use client";
import { useMemo } from "react";
import type { SongEntry } from "@/lib/types";
import { SONG_LIBRARY } from "@/lib/songs-data";
import type { LibraryTrack } from "@/lib/suno";

interface SongsPageProps {
  customSongs: SongEntry[];
  songLibSearch: string;
  songLibFilter: "all" | "Beginner" | "Intermediate" | "Advanced";
  songLibGenre: string;
  songLibLimit: number;
  showAddSong: boolean;
  newSongTitle: string;
  newSongArtist: string;
  songBackingTracks: Record<number, string>;
  songBackingLoading: Record<number, boolean>;
  songBackingPlaying: number | null;
  // Setters
  setCustomSongs: React.Dispatch<React.SetStateAction<SongEntry[]>>;
  setSongLibSearch: (s: string) => void;
  setSongLibFilter: (f: "all" | "Beginner" | "Intermediate" | "Advanced") => void;
  setSongLibGenre: (s: string) => void;
  setSongLibLimit: React.Dispatch<React.SetStateAction<number>>;
  setShowAddSong: (b: boolean) => void;
  setNewSongTitle: (s: string) => void;
  setNewSongArtist: (s: string) => void;
  setSongModal: (s: SongEntry | null) => void;
  // Functions
  generateSongBacking: (song: SongEntry) => void;
  toggleSongBackingPlay: (songId: number) => void;
}

export default function SongsPage(props: SongsPageProps) {
  const {
    customSongs, songLibSearch, songLibFilter, songLibGenre, songLibLimit,
    showAddSong, newSongTitle, newSongArtist,
    songBackingTracks, songBackingLoading, songBackingPlaying,
    setCustomSongs, setSongLibSearch, setSongLibFilter, setSongLibGenre,
    setSongLibLimit, setShowAddSong, setNewSongTitle, setNewSongArtist,
    setSongModal, generateSongBacking, toggleSongBackingPlay,
  } = props;

  const allSongsMemo = useMemo(() => [...SONG_LIBRARY, ...customSongs], [customSongs]);
  const songGenres = useMemo(() => [...new Set(allSongsMemo.map(s => s.genre).filter((g): g is string => !!g))].sort(), [allSongsMemo]);
  const songLibFiltered = useMemo(() => {
    const genreFiltered = songLibGenre === "all" ? allSongsMemo : allSongsMemo.filter(s => s.genre === songLibGenre);
    return genreFiltered.filter(s => {
      if (songLibFilter !== "all" && s.difficulty !== songLibFilter) return false;
      if (songLibSearch.trim()) {
        const q = songLibSearch.trim().toLowerCase();
        return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.genre || "").toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [allSongsMemo, songLibGenre, songLibFilter, songLibSearch]);
  const songLibDiffCounts = useMemo(() => {
    const genreFiltered = songLibGenre === "all" ? allSongsMemo : allSongsMemo.filter(s => s.genre === songLibGenre);
    return { all: genreFiltered.length, Beginner: genreFiltered.filter(s => s.difficulty === "Beginner").length, Intermediate: genreFiltered.filter(s => s.difficulty === "Intermediate").length, Advanced: genreFiltered.filter(s => s.difficulty === "Advanced").length };
  }, [allSongsMemo, songLibGenre]);

  const filtered = songLibFiltered;
  const diffCounts = songLibDiffCounts;

  return (
    <div className="animate-fade-in">
      <div className="font-heading text-xl font-bold text-[#D4A843] mb-4">Song Library</div>

      {/* Genre tabs */}
      <div className="flex gap-1 flex-wrap mb-3 overflow-x-auto scrollbar-hide">
        <button onClick={() => { setSongLibGenre("all"); setSongLibLimit(20); }}
          className={`font-label text-[10px] px-3 py-1 min-h-[44px] rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === "all" ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
          All ({allSongsMemo.length})
        </button>
        {songGenres.map(g => {
          const cnt = allSongsMemo.filter(s => s.genre === g).length;
          return (
            <button key={g} onClick={() => { setSongLibGenre(g); setSongLibLimit(20); }}
              className={`font-label text-[10px] px-3 py-1 min-h-[44px] rounded-lg cursor-pointer border transition-all flex-shrink-0 ${songLibGenre === g ? "bg-[#D4A843] text-[#121214] border-[#D4A843]" : "border-[#333] text-[#666]"}`}>
              {g} ({cnt})
            </button>
          );
        })}
      </div>

      <input type="text" placeholder="Search song, artist, genre..." className="input w-full mb-3"
        value={songLibSearch} onChange={e => { setSongLibSearch(e.target.value); setSongLibLimit(20); }} />

      {/* Difficulty filter */}
      <div className="flex gap-1 flex-wrap mb-4">
        {([["all", "All", "#D4A843"], ["Beginner", "Beginner", "#22c55e"], ["Intermediate", "Intermediate", "#D4A843"], ["Advanced", "Advanced", "#ef4444"]] as const).map(([key, label, color]) => (
          <button key={key} onClick={() => { setSongLibFilter(key as typeof songLibFilter); setSongLibLimit(20); }}
            className="font-label text-[10px] px-3 py-1 min-h-[44px] rounded-lg cursor-pointer border transition-all"
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

      {/* Showing count */}
      <div className="font-readout text-[10px] text-[#555] mb-2">
        Showing {Math.min(songLibLimit, filtered.length)} of {filtered.length} songs
      </div>

      {filtered.length === 0 && (
        <div className="panel p-8 sm:p-10 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <div className="font-heading text-base text-[#D4A843] mb-1.5">No songs match your search</div>
          <div className="font-label text-[11px] text-[#555]">Try a different term or clear your filters.</div>
        </div>
      )}
      {(() => {
        const limited = filtered.slice(0, songLibLimit);
        return (<>
          {limited.map(song => {
            const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444" }[song.difficulty] || "#888") : "#888";
            const isCustom = song.id >= 1000000000;
            return (
              <div key={song.id} onClick={() => setSongModal(song)}
                tabIndex={0} role="button" aria-label={`${song.title} by ${song.artist}`}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSongModal(song); } }}
                className="panel p-4 mb-1.5 cursor-pointer hover:border-[#D4A843]/30 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-[13px] !font-medium !normal-case !tracking-normal">{song.title}</span>
                      {song.difficulty && <span className="tag" style={{ border: `1px solid ${dc}60`, color: dc, background: dc + "15" }}>{song.difficulty}</span>}
                    </div>
                    <div className="font-readout text-[11px] text-[#666] mt-1">{song.artist}</div>
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      {song.genre && <span className="font-readout text-[9px] text-[#555]">{song.genre}</span>}
                      {song.key && <span className="font-readout text-[9px] text-[#555]">Key: {song.key}</span>}
                      {song.tempo && <span className="font-readout text-[9px] text-[#555]">{song.tempo} BPM</span>}
                      {song.tuning && song.tuning !== "Standard" && <span className="font-readout text-[9px] text-[#555]">{song.tuning}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isCustom && (
                      <button onClick={(e) => { e.stopPropagation(); setCustomSongs(p => p.filter(s => s.id !== song.id)); }}
                        className="btn-ghost !px-2 !py-1 !text-[9px] !text-[#C41E3A] !border-[#333]">Remove</button>
                    )}
                    {songBackingTracks[song.id] ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSongBackingPlay(song.id); }}
                        className="btn-ghost !px-2 !py-1 !text-[9px] flex items-center gap-1"
                        style={{ borderColor: songBackingPlaying === song.id ? "#D4A843" : undefined }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={songBackingPlaying === song.id ? "#D4A843" : "none"} stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {songBackingPlaying === song.id
                            ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
                            : <polygon points="5 3 19 12 5 21 5 3"/>}
                        </svg>
                        {songBackingPlaying === song.id ? "Pause" : "Play"}
                      </button>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); generateSongBacking(song); }}
                        disabled={songBackingLoading[song.id]}
                        className="btn-ghost !px-2 !py-1 !text-[9px] flex items-center gap-1 disabled:opacity-50">
                        {songBackingLoading[song.id] ? (
                          <>
                            <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/></svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>
                            Backing
                          </>
                        )}
                      </button>
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
}
