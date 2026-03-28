"use client";
import { useMemo, useState } from "react";
import type { SongEntry } from "@/lib/types";
import { SONG_LIBRARY } from "@/lib/songs-data";
import SongFilterBar, { useFilteredSongs } from "./SongFilterBar";
import type { SongSort, DifficultyFilter } from "./SongFilterBar";
import AddSongModal from "./AddSongModal";

interface SongsPageProps {
  customSongs: SongEntry[];
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
  songBackingTracks: Record<number, string>;
  songBackingLoading: Record<number, boolean>;
  songBackingPlaying: number | null;
  // Setters
  setCustomSongs: React.Dispatch<React.SetStateAction<SongEntry[]>>;
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
  setSongModal: (s: SongEntry | null) => void;
  // Functions
  generateSongBacking: (song: SongEntry) => void;
  toggleSongBackingPlay: (songId: number) => void;
}

export default function SongsPage(props: SongsPageProps) {
  const {
    customSongs, songLibSearch, songLibFilter, songLibGenres, songLibSort, songLibHasGP, songLibLimit,
    showAddSong, newSongTitle, newSongArtist,
    songBackingTracks, songBackingLoading, songBackingPlaying,
    setCustomSongs, setSongLibSearch, setSongLibFilter, setSongLibGenres,
    setSongLibSort, setSongLibHasGP, setSongLibLimit, setShowAddSong,
    setNewSongTitle, setNewSongArtist, setSongModal, generateSongBacking, toggleSongBackingPlay,
  } = props;

  const [addSongModalOpen, setAddSongModalOpen] = useState(false);

  const allSongs = useMemo(() => [...SONG_LIBRARY, ...customSongs], [customSongs]);
  const filtered = useFilteredSongs(allSongs, songLibSearch, songLibFilter, songLibGenres, songLibSort, songLibHasGP);

  return (
    <div className="animate-fade-in">
      <div className="font-heading text-xl font-bold text-[#D4A843] mb-4">Song Library</div>

      <SongFilterBar
        allSongs={allSongs}
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
        filteredCount={Math.min(songLibLimit, filtered.length)}
        totalCount={allSongs.length}
      />

      <div className="mb-4">
        <button onClick={() => setAddSongModalOpen(true)}
          className="font-label text-[11px] px-3 py-2 rounded-lg cursor-pointer border border-[#D4A843] bg-[#D4A843]/10 text-[#D4A843] hover:bg-[#D4A843]/20 transition-all flex-shrink-0 flex items-center gap-1.5 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add Song Manually
        </button>
      </div>

      {addSongModalOpen && (
        <AddSongModal
          onClose={() => setAddSongModalOpen(false)}
          onSave={(song) => setCustomSongs(p => [...p, song])}
        />
      )}

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
            const dc = song.difficulty ? ({ Beginner: "#22c55e", Intermediate: "#D4A843", Advanced: "#ef4444", Expert: "#dc2626" }[song.difficulty] || "#888") : "#888";
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
                      {(song.gpPath || song.gpFileName) && (
                        <span className="font-readout text-[8px] px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">GP</span>
                      )}
                      {song.personal && (
                        <span className="font-readout text-[8px] px-1.5 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20">Personal</span>
                      )}
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
