"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import type { SongEntry } from "@/lib/types";
import { STYLES } from "@/lib/constants";
import { useFocusTrap } from "./ExerciseModal";

interface YtResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

interface AddSongModalProps {
  onClose: () => void;
  onSave: (song: SongEntry) => void;
  editSong?: SongEntry;
}

const TUNINGS = [
  "Standard", "Drop D", "Drop C", "Drop B", "Drop A",
  "Open G", "Open D", "Open E", "Open A",
  "DADGAD", "Eb Standard", "D Standard", "C Standard", "B Standard",
];

const KEYS = [
  "C", "C#/Db", "D", "D#/Eb", "E", "F",
  "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B",
  "Cm", "C#m/Dbm", "Dm", "D#m/Ebm", "Em", "Fm",
  "F#m/Gbm", "Gm", "G#m/Abm", "Am", "A#m/Bbm", "Bm",
];

const DIFFICULTIES: SongEntry["difficulty"][] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function AddSongModal({ onClose, onSave, editSong }: AddSongModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);
  const isEdit = !!editSong;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [ytResults, setYtResults] = useState<YtResult[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytSearched, setYtSearched] = useState(false);

  // Form fields - pre-fill from editSong if editing
  const [title, setTitle] = useState(editSong?.title || "");
  const [artist, setArtist] = useState(editSong?.artist || "");
  const [ytUrl, setYtUrl] = useState(editSong?.songsterrUrl || "");
  const [difficulty, setDifficulty] = useState<SongEntry["difficulty"]>(editSong?.difficulty);
  const [genre, setGenre] = useState(editSong?.genre || "");
  const [tuning, setTuning] = useState(editSong?.tuning || "Standard");
  const [tempo, setTempo] = useState<number | "">(editSong?.tempo || "");
  const [key, setKey] = useState(editSong?.key || "");
  const [notes, setNotes] = useState(editSong?.notes || "");

  // YouTube preview
  const [previewVideoId, setPreviewVideoId] = useState("");

  // Tutorial auto-search
  const [tutorialResults, setTutorialResults] = useState<YtResult[]>([]);
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const [tutorialSearched, setTutorialSearched] = useState(false);
  const [selectedTutorialId, setSelectedTutorialId] = useState("");

  // File attachments
  const [attachments, setAttachments] = useState<{ name: string; type: string; idbKey: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract videoId from YouTube URL
  const extractVideoId = (url: string): string => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : "";
  };

  // When ytUrl changes, update preview
  useEffect(() => {
    const vid = extractVideoId(ytUrl);
    if (vid) setPreviewVideoId(vid);
  }, [ytUrl]);

  // Search YouTube for songs
  const searchYoutube = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setYtLoading(true);
    setYtSearched(true);
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setYtResults(data.items || []);
      }
    } catch { /* ignore */ }
    setYtLoading(false);
  }, [searchQuery]);

  // Search for tutorials when title+artist change
  const searchTutorials = useCallback(async () => {
    if (!title.trim()) return;
    setTutorialLoading(true);
    setTutorialSearched(true);
    const q = `${title.trim()} ${artist.trim()} guitar tutorial`.trim();
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setTutorialResults(data.items || []);
      }
    } catch { /* ignore */ }
    setTutorialLoading(false);
  }, [title, artist]);

  // Auto-search tutorials when title is filled
  useEffect(() => {
    if (title.trim().length >= 3 && !tutorialSearched) {
      const timer = setTimeout(searchTutorials, 800);
      return () => clearTimeout(timer);
    }
  }, [title, artist, tutorialSearched, searchTutorials]);

  // Select a YouTube result
  const selectYtResult = (result: YtResult) => {
    // Try to parse title into song name + artist
    const raw = result.title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    // Common patterns: "Artist - Song", "Song by Artist", "Song | Artist"
    const dashSplit = raw.split(/\s*[-\u2013\u2014|]\s*/);
    if (dashSplit.length >= 2) {
      if (!title) setTitle(dashSplit[1].replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim());
      if (!artist) setArtist(dashSplit[0].replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim());
    } else {
      if (!title) setTitle(raw.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim());
    }
    setYtUrl(`https://www.youtube.com/watch?v=${result.videoId}`);
    setPreviewVideoId(result.videoId);
    // Reset tutorial search so it re-triggers
    setTutorialSearched(false);
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const idbKey = `gf-song-attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type });

        // Store in IndexedDB
        const dbReq = indexedDB.open("gf-song-attachments", 1);
        dbReq.onupgradeneeded = () => {
          const db = dbReq.result;
          if (!db.objectStoreNames.contains("files")) {
            db.createObjectStore("files");
          }
        };
        dbReq.onsuccess = () => {
          const db = dbReq.result;
          const tx = db.transaction("files", "readwrite");
          tx.objectStore("files").put(blob, idbKey);
        };

        setAttachments(prev => [...prev, { name: file.name, type: file.type, idbKey }]);
      } catch { /* ignore failed uploads */ }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idbKey: string) => {
    setAttachments(prev => prev.filter(a => a.idbKey !== idbKey));
    // Also remove from IDB
    try {
      const dbReq = indexedDB.open("gf-song-attachments", 1);
      dbReq.onsuccess = () => {
        const db = dbReq.result;
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(idbKey);
      };
    } catch { /* ignore */ }
  };

  // Save the song
  const handleSave = () => {
    if (!title.trim() || !artist.trim()) return;

    const song: SongEntry = {
      id: editSong?.id || Date.now(),
      title: title.trim(),
      artist: artist.trim(),
      genre: genre || undefined,
      difficulty: difficulty || undefined,
      tuning: tuning !== "Standard" ? tuning : undefined,
      tempo: typeof tempo === "number" ? tempo : undefined,
      key: key || undefined,
      ytTutorial: selectedTutorialId ? `https://www.youtube.com/watch?v=${selectedTutorialId}` : undefined,
      songsterrUrl: ytUrl || undefined,
      notes: notes || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    onSave(song);
    onClose();
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      role="dialog" aria-modal="true" aria-label={isEdit ? "Edit Song" : "Add Song Manually"}>
      <div ref={modalRef} className="w-full max-w-2xl my-8 rounded-xl border border-[#222] bg-[#0e0e10] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4A843]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="font-heading text-base font-semibold text-[#D4A843]">{isEdit ? "Edit Song" : "Add Song Manually"}</span>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-12rem)] overflow-y-auto">

          {/* Section 1: YouTube Search */}
          <div>
            <div className="font-label text-[11px] text-[#888] uppercase tracking-wider mb-2">Search YouTube</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by song name or artist..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") searchYoutube(); }}
                className="input flex-1"
              />
              <button type="button" onClick={searchYoutube} disabled={ytLoading || !searchQuery.trim()}
                className="font-label text-[11px] px-4 py-2 rounded-lg bg-[#D4A843] text-[#121214] hover:bg-[#e5c060] transition-all disabled:opacity-50 flex-shrink-0 flex items-center gap-1.5">
                {ytLoading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                )}
                Search
              </button>
            </div>
            {ytSearched && ytResults.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-[200px] overflow-y-auto rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-2">
                {ytResults.map(r => (
                  <button key={r.videoId} type="button" onClick={() => selectYtResult(r)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-left">
                    <img src={r.thumbnail || `https://img.youtube.com/vi/${r.videoId}/mqdefault.jpg`}
                      alt="" className="w-20 h-[45px] rounded object-cover flex-shrink-0 bg-[#111]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-label text-[11px] text-[#ccc] truncate" dangerouslySetInnerHTML={{ __html: r.title || r.videoId }} />
                      {r.channel && <div className="font-readout text-[9px] text-[#555] truncate">{r.channel}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {ytSearched && !ytLoading && ytResults.length === 0 && (
              <div className="mt-2 font-readout text-[10px] text-[#555]">No results found. Try a different search.</div>
            )}
          </div>

          {/* YouTube Preview */}
          {previewVideoId && (
            <div>
              <div className="font-label text-[11px] text-[#888] uppercase tracking-wider mb-2">Preview</div>
              <div className="rounded-lg overflow-hidden border border-[#1a1a1a] aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${previewVideoId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube Preview"
                />
              </div>
            </div>
          )}

          {/* Section 2: Song Details */}
          <div>
            <div className="font-label text-[11px] text-[#888] uppercase tracking-wider mb-2">Song Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">Song Name *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Master of Puppets" className="input w-full" />
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">Artist *</label>
                <input type="text" value={artist} onChange={e => setArtist(e.target.value)}
                  placeholder="e.g. Metallica" className="input w-full" />
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">YouTube URL</label>
                <input type="url" value={ytUrl} onChange={e => setYtUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..." className="input w-full" />
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">Difficulty</label>
                <select value={difficulty || ""} onChange={e => setDifficulty((e.target.value || undefined) as SongEntry["difficulty"])}
                  className="input w-full">
                  <option value="">Select...</option>
                  {DIFFICULTIES.map(d => d && <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">Genre / Style</label>
                <select value={genre} onChange={e => setGenre(e.target.value)} className="input w-full">
                  <option value="">Select...</option>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">Tuning</label>
                <select value={tuning} onChange={e => setTuning(e.target.value)} className="input w-full">
                  {TUNINGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">BPM</label>
                <input type="number" value={tempo} onChange={e => setTempo(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 120" min={20} max={300} className="input w-full" />
              </div>
              <div>
                <label className="font-readout text-[10px] text-[#555] mb-1 block">Key</label>
                <select value={key} onChange={e => setKey(e.target.value)} className="input w-full">
                  <option value="">Select...</option>
                  {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="font-readout text-[10px] text-[#555] mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Practice notes, sections to focus on, etc."
                rows={3} className="input w-full resize-none" />
            </div>
          </div>

          {/* Section 3: Tutorial Videos */}
          {title.trim() && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-label text-[11px] text-[#888] uppercase tracking-wider">Tutorial Videos</div>
                <button type="button" onClick={() => { setTutorialSearched(false); setTimeout(searchTutorials, 50); }}
                  className="font-readout text-[9px] text-[#D4A843] hover:text-[#e5c060] transition-colors">
                  {tutorialLoading ? "Searching..." : "Refresh"}
                </button>
              </div>
              {tutorialLoading && (
                <div className="flex items-center gap-2 py-3">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" /></svg>
                  <span className="font-readout text-[10px] text-[#555]">Finding tutorials...</span>
                </div>
              )}
              {tutorialSearched && !tutorialLoading && tutorialResults.length > 0 && (
                <div className="space-y-1.5">
                  {tutorialResults.slice(0, 4).map(r => (
                    <button key={r.videoId} type="button" onClick={() => setSelectedTutorialId(r.videoId === selectedTutorialId ? "" : r.videoId)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${selectedTutorialId === r.videoId ? "border-[#D4A843]/40 bg-[#D4A843]/5" : "border-[#1a1a1a] hover:border-[#333]"}`}>
                      <img src={r.thumbnail || `https://img.youtube.com/vi/${r.videoId}/mqdefault.jpg`}
                        alt="" className="w-24 h-[54px] rounded object-cover flex-shrink-0 bg-[#111]" />
                      <div className="flex-1 min-w-0">
                        <div className="font-label text-[11px] text-[#ccc] truncate" dangerouslySetInnerHTML={{ __html: r.title || "Guitar Tutorial" }} />
                        {r.channel && <div className="font-readout text-[9px] text-[#555] truncate">{r.channel}</div>}
                      </div>
                      {selectedTutorialId === r.videoId && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#D4A843" stroke="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {tutorialSearched && !tutorialLoading && tutorialResults.length === 0 && (
                <div className="font-readout text-[10px] text-[#555]">No tutorials found.</div>
              )}
            </div>
          )}

          {/* Section 4: File Upload */}
          <div>
            <div className="font-label text-[11px] text-[#888] uppercase tracking-wider mb-2">Attachments</div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="font-label text-[11px] px-4 py-2 rounded-lg border border-dashed border-[#333] text-[#666] hover:border-[#D4A843]/40 hover:text-[#D4A843] transition-all flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Upload Files
              </button>
              <span className="font-readout text-[9px] text-[#444]">Guitar Pro, PDF, images, etc.</span>
            </div>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload}
              accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7,.pdf,.png,.jpg,.jpeg,.txt"
              className="hidden" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map(a => (
                  <div key={a.idbKey} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111] border border-[#1a1a1a]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="font-readout text-[10px] text-[#888] flex-1 truncate">{a.name}</span>
                    <button type="button" onClick={() => removeAttachment(a.idbKey)}
                      className="text-[#C41E3A] hover:text-[#ef4444] transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a1a1a] bg-[#0c0c0e]">
          <button type="button" onClick={onClose} className="btn-ghost !text-[11px]">Cancel</button>
          <button type="button" onClick={handleSave}
            disabled={!title.trim() || !artist.trim()}
            className="font-label text-[11px] px-6 py-2.5 rounded-lg bg-[#D4A843] text-[#121214] hover:bg-[#e5c060] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            {isEdit ? "Update Song" : "Save Song"}
          </button>
        </div>
      </div>
    </div>
  );
}
