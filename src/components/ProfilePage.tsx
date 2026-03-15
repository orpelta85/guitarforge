"use client";
import { useState, useEffect } from "react";

interface UserProfile {
  name: string;
  instrument: string;
  level: string;
  yearsPlaying: number;
  genres: string[];
  goals: string;
  practiceHoursPerDay: number;
  favoriteArtists: string;
  equipment: string;
}

const INSTRUMENTS = ["Electric Guitar", "Acoustic Guitar", "Bass Guitar", "Classical Guitar"];
const LEVELS = ["Beginner (0-1 years)", "Intermediate (1-3 years)", "Advanced (3-7 years)", "Expert (7+ years)"];
const GENRES = ["Metal", "Hard Rock", "Blues Rock", "Thrash Metal", "Death Metal", "Black Metal", "Doom Metal", "Stoner Rock", "Progressive Metal", "Neo-Classical", "Jazz Fusion", "Grunge", "Punk", "Classic Rock", "Blues", "Jazz", "Funk"];

const STORAGE_KEY = "gf-profile";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>({
    name: "", instrument: "Electric Guitar", level: "Intermediate (1-3 years)",
    yearsPlaying: 2, genres: ["Metal", "Hard Rock"], goals: "",
    practiceHoursPerDay: 2, favoriteArtists: "", equipment: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
  }, []);

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(key: keyof UserProfile, value: unknown) {
    setProfile(p => ({ ...p, [key]: value }));
  }

  function toggleGenre(genre: string) {
    setProfile(p => {
      const g = p.genres.includes(genre) ? p.genres.filter(x => x !== genre) : [...p.genres, genre];
      return { ...p, genres: g };
    });
  }

  return (
    <div>
      <div className="panel p-5 mb-4">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Profile &amp; Settings</div>
        <div className="font-label text-[10px] text-[#555] mt-1">Personal info for AI-powered practice plans</div>
      </div>

      {/* Personal info */}
      <div className="panel p-5 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-4 flex items-center gap-2">
          <div className="led led-gold" /> Personal
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="font-label text-[10px] text-[#555]">
            Name
            <input value={profile.name} onChange={e => update("name", e.target.value)}
              placeholder="Your name..." className="input mt-1" />
          </label>
          <label className="font-label text-[10px] text-[#555]">
            Instrument
            <select value={profile.instrument} onChange={e => update("instrument", e.target.value)} className="input mt-1">
              {INSTRUMENTS.map(i => <option key={i}>{i}</option>)}
            </select>
          </label>
          <label className="font-label text-[10px] text-[#555]">
            Skill Level
            <select value={profile.level} onChange={e => update("level", e.target.value)} className="input mt-1">
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label className="font-label text-[10px] text-[#555]">
            Years Playing
            <input type="number" value={profile.yearsPlaying} min={0} max={50}
              onChange={e => update("yearsPlaying", Number(e.target.value))}
              className="input input-gold mt-1" />
          </label>
          <label className="font-label text-[10px] text-[#555]">
            Daily Practice (hours)
            <input type="number" value={profile.practiceHoursPerDay} min={0.5} max={8} step={0.5}
              onChange={e => update("practiceHoursPerDay", Number(e.target.value))}
              className="input input-gold mt-1" />
          </label>
          <label className="font-label text-[10px] text-[#555]">
            Equipment
            <input value={profile.equipment} onChange={e => update("equipment", e.target.value)}
              placeholder="Gibson LP, Marshall JCM800..." className="input mt-1" />
          </label>
        </div>
      </div>

      {/* Genres */}
      <div className="panel p-5 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2">
          <div className="led led-gold" /> Preferred Genres
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map(g => (
            <button key={g} onClick={() => toggleGenre(g)}
              className={`font-label text-[10px] px-3 py-1.5 rounded-sm cursor-pointer border transition-all ${
                profile.genres.includes(g)
                  ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10"
                  : "border-[#222] text-[#444]"
              }`}>{g}</button>
          ))}
        </div>
      </div>

      {/* Goals & Artists */}
      <div className="panel p-5 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2">
          <div className="led led-gold" /> Goals &amp; Inspiration
        </div>
        <label className="font-label text-[10px] text-[#555] block mb-3">
          Practice Goals
          <textarea value={profile.goals} onChange={e => update("goals", e.target.value)}
            placeholder="What do you want to achieve? (e.g., Master sweep picking, learn 10 solos, improvise over jazz changes...)"
            className="input mt-1 !h-20 resize-none" />
        </label>
        <label className="font-label text-[10px] text-[#555] block">
          Favorite Artists / Guitarists
          <input value={profile.favoriteArtists} onChange={e => update("favoriteArtists", e.target.value)}
            placeholder="Slash, Hammett, Gilmour, Petrucci..." className="input mt-1" />
        </label>
      </div>

      {/* Save */}
      <div className="flex gap-3 items-center">
        <button onClick={save} className="btn-gold">Save Profile</button>
        {saved && <span className="font-label text-[11px] text-[#33CC33]">Saved</span>}
      </div>
    </div>
  );
}
