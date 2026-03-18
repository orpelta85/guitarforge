"use client";
import { useState, useEffect } from "react";
import { EXERCISES } from "@/lib/exercises";
import { CATS, COL } from "@/lib/constants";

interface UserProfile {
  name: string; instrument: string; level: string; yearsPlaying: number;
  genres: string[]; goals: string; practiceHoursPerDay: number;
  favoriteArtists: string; equipment: string;
}

interface PracticePlan {
  name: string;
  weeks: number;
  phases: { name: string; weeks: string; focus: string; categories: string[]; dailyMinutes: number; exercises: number[] }[];
}

const PLAN_TEMPLATES: Record<string, PracticePlan> = {
  "Beginner Rock": {
    name: "Beginner Rock Foundation", weeks: 8,
    phases: [
      { name: "Basics", weeks: "1-2", focus: "Warm-up, basic chords, simple riffs", categories: ["Warm-Up", "Rhythm", "Fretboard"], dailyMinutes: 60, exercises: [1, 4, 5, 28, 29, 33, 34] },
      { name: "Building", weeks: "3-4", focus: "Pentatonic scale, simple solos, bends", categories: ["Warm-Up", "Shred", "Bends", "Fretboard"], dailyMinutes: 75, exercises: [1, 5, 6, 17, 18, 35] },
      { name: "Expanding", weeks: "5-6", focus: "Full songs, improvisation basics", categories: ["Warm-Up", "Shred", "Improv", "Riffs"], dailyMinutes: 90, exercises: [1, 6, 43, 47, 49, 50] },
      { name: "Performing", weeks: "7-8", focus: "Song mastery, recording yourself", categories: ["Warm-Up", "Improv", "Composition", "Songs"], dailyMinutes: 90, exercises: [1, 43, 46, 60, 63] },
    ],
  },
  "Shred Builder": {
    name: "Shred Speed Builder", weeks: 12,
    phases: [
      { name: "Foundation", weeks: "1-3", focus: "Alternate picking, synchronization, pentatonic speed", categories: ["Warm-Up", "Shred"], dailyMinutes: 90, exercises: [1, 2, 3, 5, 6, 9] },
      { name: "Techniques", weeks: "4-6", focus: "Legato, economy picking, string skipping", categories: ["Warm-Up", "Shred", "Legato"], dailyMinutes: 105, exercises: [1, 6, 10, 11, 12, 13] },
      { name: "Speed Push", weeks: "7-9", focus: "Sextuplets, 3NPS, burst picking", categories: ["Warm-Up", "Shred", "Legato", "Phrasing"], dailyMinutes: 120, exercises: [1, 7, 8, 9, 14, 53, 54] },
      { name: "Application", weeks: "10-12", focus: "Musical application, solos, improvisation", categories: ["Warm-Up", "Shred", "Improv", "Phrasing"], dailyMinutes: 120, exercises: [1, 7, 8, 43, 44, 48, 55, 56] },
    ],
  },
  "Blues Master": {
    name: "Blues Guitar Mastery", weeks: 8,
    phases: [
      { name: "Blues Basics", weeks: "1-2", focus: "Blues scale, bending, vibrato", categories: ["Warm-Up", "Bends", "Modes"], dailyMinutes: 75, exercises: [1, 3, 17, 18, 19, 58] },
      { name: "Phrasing", weeks: "3-4", focus: "Call-response, dynamics, space", categories: ["Warm-Up", "Bends", "Improv", "Dynamics"], dailyMinutes: 90, exercises: [1, 19, 20, 46, 47, 65, 67] },
      { name: "Ear & Feel", weeks: "5-6", focus: "Ear training, chord tones, transcription", categories: ["Warm-Up", "Ear Training", "Improv"], dailyMinutes: 90, exercises: [1, 37, 39, 41, 42, 44] },
      { name: "Expression", weeks: "7-8", focus: "Full blues performance, recording, creation", categories: ["Warm-Up", "Improv", "Composition", "Dynamics"], dailyMinutes: 90, exercises: [1, 43, 46, 60, 61, 64, 66] },
    ],
  },
  "Metal Technique": {
    name: "Metal Technique Complete", weeks: 12,
    phases: [
      { name: "Rhythm", weeks: "1-3", focus: "Downpicking, palm muting, galloping, odd time", categories: ["Warm-Up", "Rhythm"], dailyMinutes: 90, exercises: [1, 4, 28, 29, 30, 31, 32] },
      { name: "Lead Basics", weeks: "4-6", focus: "Alternate picking, legato, bends", categories: ["Warm-Up", "Shred", "Legato", "Bends"], dailyMinutes: 105, exercises: [1, 6, 9, 12, 13, 17, 18] },
      { name: "Advanced", weeks: "7-9", focus: "Sweep, tapping, modes, riff writing", categories: ["Warm-Up", "Tapping", "Sweep", "Modes", "Riffs"], dailyMinutes: 120, exercises: [1, 22, 23, 25, 26, 49, 51, 57] },
      { name: "Mastery", weeks: "10-12", focus: "Integration, song learning, improvisation", categories: ["Warm-Up", "Shred", "Improv", "Songs", "Composition"], dailyMinutes: 120, exercises: [1, 7, 8, 27, 43, 44, 52, 62] },
    ],
  },
};

export default function AiCoachPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<PracticePlan | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gf-profile");
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem("gf-active-plan");
      if (raw) setActivePlan(JSON.parse(raw));
    } catch {}
  }, []);

  function adoptPlan(key: string) {
    const plan = PLAN_TEMPLATES[key];
    setActivePlan(plan);
    setSelectedPlan(key);
    try { localStorage.setItem("gf-active-plan", JSON.stringify(plan)); } catch {}
  }

  // Suggest plan based on profile
  function getSuggested(): string {
    if (!profile) return "Beginner Rock";
    const level = profile.level.toLowerCase();
    const genres = profile.genres.map(g => g.toLowerCase());
    if (genres.some(g => g.includes("blues"))) return "Blues Master";
    if (genres.some(g => g.includes("thrash") || g.includes("death") || g.includes("metal"))) return "Metal Technique";
    if (level.includes("advanced") || level.includes("expert")) return "Shred Builder";
    return "Beginner Rock";
  }

  const suggested = getSuggested();

  return (
    <div>
      <div className="panel p-3 sm:p-5 mb-3">
        <div className="font-heading text-xl font-bold text-[#D4A843]">AI Practice Coach</div>
        <div className="font-label text-[10px] text-[#555] mt-1">Personalized practice plans based on your goals</div>
      </div>

      {/* Profile summary */}
      {profile ? (
        <div className="panel p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-label text-[11px] text-[#D4A843] flex items-center gap-2"><div className="led led-gold" /> Player Profile</div>
              <div className="text-sm text-[#ccc] mt-1">{profile.name || "Guitarist"}</div>
              <div className="font-readout text-[10px] text-[#555]">{profile.level} · {profile.yearsPlaying}y · {profile.practiceHoursPerDay}h/day</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {profile.genres.slice(0, 4).map(g => (
                  <span key={g} className="font-label text-[9px] text-[#888] border border-[#222] px-1.5 py-0.5 rounded-sm">{g}</span>
                ))}
              </div>
            </div>
            <div className="font-label text-[10px] text-[#D4A843] px-3 py-1 border border-[#D4A843]/30 rounded-sm">
              Suggested: {suggested}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel p-4 mb-3 text-center">
          <div className="font-label text-sm text-[#444]">Set up your profile first for personalized suggestions</div>
          <div className="font-label text-[10px] text-[#333] mt-1">Go to Profile tab to fill in your details</div>
        </div>
      )}

      {/* Active plan */}
      {activePlan && (
        <div className="panel p-3 sm:p-5 mb-3" style={{ borderColor: "#33CC3333" }}>
          <div className="font-label text-[11px] text-[#33CC33] mb-3 flex items-center gap-2"><div className="led led-on" /> Active Plan</div>
          <div className="font-heading text-lg text-[#D4A843]">{activePlan.name}</div>
          <div className="font-readout text-[10px] text-[#555] mb-3">{activePlan.weeks} weeks</div>
          {activePlan.phases.map((phase, i) => (
            <div key={i} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="font-label text-[11px] text-[#D4A843]">{phase.name}</span>
                <span className="font-readout text-[9px] text-[#555]">Weeks {phase.weeks} · {phase.dailyMinutes}min/day</span>
              </div>
              <div className="text-[11px] text-[#888] mb-2">{phase.focus}</div>
              <div className="flex gap-1 flex-wrap mb-2">
                {phase.categories.map(c => (
                  <span key={c} className="tag" style={{ border: `1px solid ${(COL[c] || "#888")}40`, color: COL[c] || "#888" }}>{c}</span>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {phase.exercises.map(id => {
                  const ex = EXERCISES.find(e => e.id === id);
                  return ex ? (
                    <span key={id} className="font-readout text-[9px] text-[#555] bg-[#111] border border-[#1a1a1a] px-1.5 py-0.5 rounded-sm">{ex.n.substring(0, 30)}</span>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan selector */}
      <div className="panel p-3 sm:p-5">
        <div className="font-label text-[11px] text-[#D4A843] mb-3">Available Plans</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(PLAN_TEMPLATES).map(([key, plan]) => (
            <div key={key} className={`bg-[#0A0A0A] border rounded-sm p-4 cursor-pointer transition-all hover:border-[#D4A843]/40 ${
              selectedPlan === key ? "border-[#D4A843]/60" : "border-[#1a1a1a]"
            }`} onClick={() => adoptPlan(key)}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading text-sm font-bold text-[#D4A843]">{plan.name}</span>
                {key === suggested && <span className="font-label text-[8px] text-[#33CC33] border border-[#33CC33]/30 px-1.5 py-0.5 rounded-sm">Recommended</span>}
              </div>
              <div className="font-readout text-[10px] text-[#555] mb-2" style={{ textAlign: "left" }}>{plan.weeks} weeks · {plan.phases.length} phases</div>
              <div className="flex gap-1 flex-wrap">
                {plan.phases.map((p, i) => (
                  <span key={i} className="font-label text-[8px] text-[#444] border border-[#1a1a1a] px-1.5 py-0.5 rounded-sm">{p.name}</span>
                ))}
              </div>
              <button onClick={(e) => { e.stopPropagation(); adoptPlan(key); }}
                className={`mt-3 w-full text-center py-1.5 rounded-sm font-label text-[10px] transition-all ${
                  activePlan?.name === plan.name ? "bg-[#33CC33] text-[#0A0A0A]" : "btn-gold"
                }`}>
                {activePlan?.name === plan.name ? "Active" : "Start This Plan"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
