"use client";
import { useState } from "react";

interface SongsterrResult {
  id: number;
  title: string;
  artist: string;
  url: string;
  tracks: { instrument: string; name: string; difficulty: string }[];
}

interface SongsterrSearchProps {
  onSelect: (name: string, url: string) => void;
}

export default function SongsterrSearch({ onSelect }: SongsterrSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongsterrResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/songsterr?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch { /* network error */ }
    setLoading(false);
  }

  return (
    <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 mt-2">
      <div className="font-label text-[9px] text-[#555] mb-2">Search Songsterr</div>
      <div className="flex gap-2 mb-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Artist or song name..."
          className="input flex-1 !text-xs" />
        <button onClick={search} disabled={loading} className="btn-gold !text-[10px]">
          {loading ? "..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto">
          {results.map((r) => (
            <div key={r.id}
              onClick={() => onSelect(`${r.artist} - ${r.title}`, r.url)}
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#141414] rounded-sm transition-all border-b border-[#111] last:border-0">
              <div className="flex-1">
                <div className="text-xs font-medium text-[#ccc]">{r.title}</div>
                <div className="text-[10px] text-[#555]">{r.artist}</div>
              </div>
              <div className="flex gap-1">
                {r.tracks.slice(0, 3).map((t, i) => (
                  <span key={i} className="font-label text-[8px] text-[#444] px-1 border border-[#222] rounded-sm">{String(t.instrument).replace("electric-", "").replace("acoustic-", "")}</span>
                ))}
              </div>
              <span className="font-label text-[9px] text-[#D4A843]">Add</span>
            </div>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-3 font-label text-[10px] text-[#444]">No results found</div>
      )}
    </div>
  );
}
