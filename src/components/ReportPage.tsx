"use client";
import type { Song, DayExMap, BoolMap, StringMap } from "@/lib/types";
import { DAYS } from "@/lib/constants";
import WeeklyCharts from "./WeeklyCharts";

interface ReportPageProps {
  week: number;
  mode: string;
  scale: string;
  style: string;
  dayExMap: DayExMap;
  doneMap: BoolMap;
  bpmLog: StringMap;
  songs: Song[];
  streak: { currentStreak: number; longestStreak: number; lastPracticeDate: string; totalDays: number };
  wTot: number;
  wDn: number;
  wPct: number;
}

export default function ReportPage(props: ReportPageProps) {
  const { week, mode, scale, style, dayExMap, doneMap, bpmLog, songs, streak, wTot, wDn, wPct } = props;

  return (
    <div className="animate-fade-in">
      <div className="panel p-3 sm:p-5 mb-4">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Week {week}</div>
        <div className="font-label text-[10px] text-[#555] mt-1">{mode} &middot; {scale} &middot; {style}</div>
        <div className="vu mt-3"><div className="vu-fill" style={{ width: wPct + "%" }} /></div>
        <div className="font-readout text-[11px] text-[#555] mt-2">{wDn}/{wTot} ({wPct}%)</div>
      </div>

      {/* Streak stats in report */}
      <div className="panel p-4 mb-4">
        <div className="font-label text-[10px] text-[#555] mb-2 flex items-center gap-2">&#x1F525; Practice Streak</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="font-stat text-xl text-[#D4A843]">{streak.currentStreak}</div>
            <div className="font-label text-[9px] text-[#555]">Current Streak</div>
          </div>
          <div>
            <div className="font-stat text-xl text-[#D4A843]">{streak.longestStreak}</div>
            <div className="font-label text-[9px] text-[#555]">Longest Streak</div>
          </div>
          <div>
            <div className="font-stat text-xl text-[#D4A843]">{streak.totalDays}</div>
            <div className="font-label text-[9px] text-[#555]">Total Days</div>
          </div>
          <div>
            <div className="font-readout text-sm text-[#666] mt-1">{streak.lastPracticeDate || "\u2014"}</div>
            <div className="font-label text-[9px] text-[#555]">Last Practice</div>
          </div>
        </div>
      </div>

      <WeeklyCharts week={week} dayExMap={dayExMap} doneMap={doneMap} bpmLog={bpmLog} />

      {songs.length > 0 && (
        <div className="panel p-5 mb-4">
          <div className="font-label text-[11px] text-[#33CC33] mb-3 flex items-center gap-2"><div className="led led-on" /> Songs</div>
          {songs.map((song) => (
              <div key={song.id} className="p-3 bg-[#121214] rounded-lg mb-2 border border-[#1a1a1a]">
                <span className="font-medium text-sm">{song.name}</span>
                {song.url && <a href={song.url} target="_blank" rel="noopener noreferrer" className="font-label text-[9px] text-[#D4A843] ml-2 no-underline">Tab</a>}
              </div>
          ))}
        </div>
      )}

      {DAYS.map((day) => {
        const exs = dayExMap[day] || [];
        if (!exs.length) return null;
        return (
          <div key={day} className="panel p-5 mb-4">
            <div className="font-label text-[12px] text-[#aaa] mb-3">{day}</div>
            {exs.map((ex, idx) => {
              const k = week + "-" + day + "-" + ex.id, done = doneMap[k];
              return (
                <div key={String(ex.id) + "-" + idx} className="flex gap-2 py-1.5 text-[12px] border-b border-[#111] last:border-0">
                  <div className={`led ${done ? "led-on" : "led-off"}`} style={{ width: 6, height: 6, marginTop: 6 }} />
                  <span className="flex-1" style={{ color: done ? "#ccc" : "#444" }}>{ex.n}</span>
                  {bpmLog[k] && <span className="font-readout text-[#D4A843]">{bpmLog[k]} BPM</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
