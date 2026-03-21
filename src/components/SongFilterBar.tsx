"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import type { SongEntry } from "@/lib/types";

export type SongSort = "popular" | "artist" | "title" | "recent";
export type DifficultyFilter = "all" | "Beginner" | "Intermediate" | "Advanced";

interface SongFilterBarProps {
  allSongs: SongEntry[];
  search: string;
  diffFilter: DifficultyFilter;
  genres: string[];
  sort: SongSort;
  hasGP: boolean;
  setSearch: (s: string) => void;
  setDiffFilter: (f: DifficultyFilter) => void;
  setGenres: (g: string[]) => void;
  setSort: (s: SongSort) => void;
  setHasGP: (b: boolean) => void;
  onResetLimit: () => void;
  filteredCount: number;
  totalCount: number;
}

export function useFilteredSongs(
  allSongs: SongEntry[],
  search: string,
  diffFilter: DifficultyFilter,
  genres: string[],
  sort: SongSort,
  hasGP: boolean,
) {
  return useMemo(() => {
    let result = allSongs;

    // Genre filter (multi-select)
    if (genres.length > 0) {
      result = result.filter(s => s.genre && genres.includes(s.genre));
    }

    // Difficulty filter
    if (diffFilter !== "all") {
      result = result.filter(s => s.difficulty === diffFilter);
    }

    // Has GP filter
    if (hasGP) {
      result = result.filter(s => s.gp || s.gpPath);
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.genre || "").toLowerCase().includes(q) ||
        (s.album || "").toLowerCase().includes(q) ||
        (s.key || "").toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "popular":
          return (b.popularity || 0) - (a.popularity || 0);
        case "artist":
          return a.artist.localeCompare(b.artist);
        case "title":
          return a.title.localeCompare(b.title);
        case "recent":
          return b.id - a.id;
        default:
          return 0;
      }
    });

    return result;
  }, [allSongs, search, diffFilter, genres, sort, hasGP]);
}

function Dropdown({ label, open, setOpen, children, activeCount }: {
  label: string;
  open: boolean;
  setOpen: (b: boolean) => void;
  children: React.ReactNode;
  activeCount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`font-label text-[11px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
          activeCount ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#333] text-[#666] hover:border-[#555] hover:text-[#888]"
        }`}
      >
        {label}
        {activeCount ? <span className="bg-[#D4A843] text-[#121214] rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">{activeCount}</span> : null}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl min-w-[200px] max-h-[300px] overflow-y-auto p-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SongFilterBar(props: SongFilterBarProps) {
  const {
    allSongs, search, diffFilter, genres, sort, hasGP,
    setSearch, setDiffFilter, setGenres, setSort, setHasGP,
    onResetLimit, filteredCount, totalCount,
  } = props;

  const [genreOpen, setGenreOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [gpOpen, setGpOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const allGenres = useMemo(() =>
    [...new Set(allSongs.map(s => s.genre).filter((g): g is string => !!g))].sort(),
    [allSongs]
  );

  const hasActiveFilters = diffFilter !== "all" || genres.length > 0 || hasGP || search.trim().length > 0;

  const clearAll = () => {
    setSearch("");
    setDiffFilter("all");
    setGenres([]);
    setSort("popular");
    setHasGP(false);
    onResetLimit();
  };

  const toggleGenre = (g: string) => {
    setGenres(genres.includes(g) ? genres.filter(x => x !== g) : [...genres, g]);
    onResetLimit();
  };

  const diffColors: Record<string, string> = {
    Beginner: "#22c55e",
    Intermediate: "#D4A843",
    Advanced: "#ef4444",
  };

  const sortLabels: Record<SongSort, string> = {
    popular: "Popularity",
    artist: "Artist A-Z",
    title: "Title A-Z",
    recent: "Recently Added",
  };

  const filterDropdowns = (
    <>
      {/* Genre Dropdown */}
      <Dropdown label="Genre" open={genreOpen} setOpen={setGenreOpen} activeCount={genres.length}>
        <button
          type="button"
          onClick={() => { setGenres([]); onResetLimit(); }}
          className={`w-full text-left px-3 py-1.5 rounded font-label text-[11px] transition-colors ${
            genres.length === 0 ? "bg-[#D4A843]/20 text-[#D4A843]" : "text-[#888] hover:bg-[#252525]"
          }`}
        >
          All Genres
        </button>
        {allGenres.map(g => {
          const active = genres.includes(g);
          const cnt = allSongs.filter(s => s.genre === g).length;
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className={`w-full text-left px-3 py-1.5 rounded font-label text-[11px] transition-colors flex items-center justify-between ${
                active ? "bg-[#D4A843]/20 text-[#D4A843]" : "text-[#888] hover:bg-[#252525]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${active ? "border-[#D4A843] bg-[#D4A843]" : "border-[#555]"}`}>
                  {active && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#121214" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </span>
                {g}
              </span>
              <span className="text-[#555] text-[10px]">{cnt}</span>
            </button>
          );
        })}
      </Dropdown>

      {/* Difficulty Dropdown */}
      <Dropdown label="Difficulty" open={diffOpen} setOpen={setDiffOpen} activeCount={diffFilter !== "all" ? 1 : 0}>
        {(["all", "Beginner", "Intermediate", "Advanced"] as const).map(d => {
          const active = diffFilter === d;
          const label = d === "all" ? "All Levels" : d;
          const color = d === "all" ? "#D4A843" : diffColors[d];
          return (
            <button
              key={d}
              type="button"
              onClick={() => { setDiffFilter(d); setDiffOpen(false); onResetLimit(); }}
              className={`w-full text-left px-3 py-1.5 rounded font-label text-[11px] transition-colors ${
                active ? "bg-[#252525]" : "hover:bg-[#252525]"
              }`}
              style={{ color: active ? color : "#888" }}
            >
              {label}
            </button>
          );
        })}
      </Dropdown>

      {/* Has GP Dropdown */}
      <Dropdown label="Has GP" open={gpOpen} setOpen={setGpOpen} activeCount={hasGP ? 1 : 0}>
        <button
          type="button"
          onClick={() => { setHasGP(false); setGpOpen(false); onResetLimit(); }}
          className={`w-full text-left px-3 py-1.5 rounded font-label text-[11px] transition-colors ${!hasGP ? "bg-[#D4A843]/20 text-[#D4A843]" : "text-[#888] hover:bg-[#252525]"}`}
        >
          All Songs
        </button>
        <button
          type="button"
          onClick={() => { setHasGP(true); setGpOpen(false); onResetLimit(); }}
          className={`w-full text-left px-3 py-1.5 rounded font-label text-[11px] transition-colors ${hasGP ? "bg-[#D4A843]/20 text-[#D4A843]" : "text-[#888] hover:bg-[#252525]"}`}
        >
          With GP Tab Only
        </button>
      </Dropdown>

      {/* Sort Dropdown */}
      <Dropdown label={`Sort: ${sortLabels[sort]}`} open={sortOpen} setOpen={setSortOpen}>
        {(["popular", "artist", "title", "recent"] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => { setSort(s); setSortOpen(false); onResetLimit(); }}
            className={`w-full text-left px-3 py-1.5 rounded font-label text-[11px] transition-colors ${
              sort === s ? "bg-[#D4A843]/20 text-[#D4A843]" : "text-[#888] hover:bg-[#252525]"
            }`}
          >
            {sortLabels[s]}
          </button>
        ))}
      </Dropdown>
    </>
  );

  return (
    <div className="mb-4">
      {/* Search bar */}
      <div className="relative mb-2.5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search songs, artists, genres, keys..."
          className="input w-full !pl-9 !pr-8"
          value={search}
          onChange={e => { setSearch(e.target.value); onResetLimit(); }}
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); onResetLimit(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Filter row - desktop */}
      <div className="hidden sm:flex gap-2 flex-wrap items-center mb-2">
        {filterDropdowns}
      </div>

      {/* Filter row - mobile */}
      <div className="sm:hidden mb-2">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className={`font-label text-[11px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer w-full justify-center ${
            hasActiveFilters ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#333] text-[#666]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="bg-[#D4A843] text-[#121214] rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">
              {(diffFilter !== "all" ? 1 : 0) + genres.length + (hasGP ? 1 : 0)}
            </span>
          )}
        </button>
        {mobileFiltersOpen && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {filterDropdowns}
          </div>
        )}
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex gap-1.5 flex-wrap items-center mb-2">
          {genres.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className="font-label text-[10px] px-2 py-1 rounded-full bg-[#D4A843]/15 text-[#D4A843] border border-[#D4A843]/30 flex items-center gap-1 cursor-pointer hover:bg-[#D4A843]/25 transition-colors"
            >
              {g}
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          ))}
          {diffFilter !== "all" && (
            <button
              type="button"
              onClick={() => { setDiffFilter("all"); onResetLimit(); }}
              className="font-label text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: diffColors[diffFilter] + "15", color: diffColors[diffFilter], borderColor: diffColors[diffFilter] + "30" }}
            >
              {diffFilter}
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          {hasGP && (
            <button
              type="button"
              onClick={() => { setHasGP(false); onResetLimit(); }}
              className="font-label text-[10px] px-2 py-1 rounded-full bg-[#D4A843]/15 text-[#D4A843] border border-[#D4A843]/30 flex items-center gap-1 cursor-pointer hover:bg-[#D4A843]/25 transition-colors"
            >
              Has GP
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={clearAll}
            className="font-label text-[10px] px-2 py-1 text-[#666] hover:text-[#999] cursor-pointer transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Result count */}
      <div className="font-readout text-[10px] text-[#555]">
        Showing {filteredCount} of {totalCount} songs
      </div>
    </div>
  );
}
