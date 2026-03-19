"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { DAYS, COL } from "@/lib/constants";
import type { DayExMap, BoolMap, StringMap } from "@/lib/types";

interface Props {
  week: number;
  dayExMap: DayExMap;
  doneMap: BoolMap;
  bpmLog: StringMap;
}

export default function WeeklyCharts({ week, dayExMap, doneMap, bpmLog }: Props) {
  // Practice time per day
  const barData = DAYS.map((day) => {
    const exs = dayExMap[day] || [];
    const totalMin = exs.reduce((s, e) => s + e.m, 0);
    const doneMin = exs.filter((e) => doneMap[week + "-" + day + "-" + e.id]).reduce((s, e) => s + e.m, 0);
    return { name: day, planned: totalMin, done: doneMin };
  });

  // Category completion
  const catCount: Record<string, { done: number; total: number }> = {};
  DAYS.forEach((day) => {
    (dayExMap[day] || []).forEach((e) => {
      if (!catCount[e.c]) catCount[e.c] = { done: 0, total: 0 };
      catCount[e.c].total++;
      if (doneMap[week + "-" + day + "-" + e.id]) catCount[e.c].done++;
    });
  });
  const pieData = Object.entries(catCount).map(([cat, { done }]) => ({
    name: cat, value: done, color: COL[cat] || "#888",
  })).filter(d => d.value > 0);

  // BPM progress (collect all logged BPMs this week)
  const bpmData: { name: string; bpm: number }[] = [];
  DAYS.forEach((day) => {
    (dayExMap[day] || []).forEach((e) => {
      const k = week + "-" + day + "-" + e.id;
      const val = bpmLog[k];
      if (val && !isNaN(Number(val))) {
        bpmData.push({ name: e.n.substring(0, 15), bpm: Number(val) });
      }
    });
  });

  const hasData = barData.some((d) => d.planned > 0);
  if (!hasData) return null;

  // Stats
  const totalPlanned = barData.reduce((s, d) => s + d.planned, 0);
  const totalDone = barData.reduce((s, d) => s + d.done, 0);
  const daysActive = barData.filter(d => d.done > 0).length;

  return (
    <div>
      {/* Summary stats */}
      <div className="panel p-4 mb-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="font-readout text-2xl font-bold text-[#D4A843]">{totalDone}</div>
            <div className="font-label text-[9px] text-[#555]">Minutes Done</div>
          </div>
          <div>
            <div className="font-readout text-2xl font-bold text-[#D4A843]">{daysActive}</div>
            <div className="font-label text-[9px] text-[#555]">Days Active</div>
          </div>
          <div>
            <div className="font-readout text-2xl font-bold text-[#D4A843]">
              {totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0}%
            </div>
            <div className="font-label text-[9px] text-[#555]">Completion</div>
          </div>
        </div>
      </div>

      {/* Practice time bar chart */}
      <div className="panel p-4 mb-3">
        <div className="font-label text-[9px] text-[#555] mb-3">Daily Practice (minutes)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} barSize={20}>
            <XAxis dataKey="name" tick={{ fill: "#777", fontSize: 10, fontFamily: "'JetBrains Mono'" }} axisLine={{ stroke: "#222" }} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 10, fontFamily: "'JetBrains Mono'" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={{ background: "#141414", border: "1px solid #333", borderRadius: 2, fontSize: 11, fontFamily: "'JetBrains Mono'" }} cursor={{ fill: "rgba(212,168,67,0.05)" }} />
            <Bar dataKey="planned" fill="#2a2a2a" radius={[2, 2, 0, 0]} name="Planned" />
            <Bar dataKey="done" fill="#D4A843" radius={[2, 2, 0, 0]} name="Done" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category pie + BPM line */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {pieData.length > 0 && (
          <div className="panel p-4">
            <div className="font-label text-[9px] text-[#555] mb-2">By Category</div>
            <div className="flex items-center">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} strokeWidth={0}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1 ml-2">
                {pieData.map(e => (
                  <div key={e.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                    <span className="font-label text-[8px] text-[#888]">{e.name}</span>
                    <span className="font-readout text-[8px] text-[#555]">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {bpmData.length > 0 && (
          <div className="panel p-4">
            <div className="font-label text-[9px] text-[#555] mb-2">BPM Log</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={bpmData}>
                <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 9, fontFamily: "'JetBrains Mono'" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10, fontFamily: "'JetBrains Mono'" }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={{ background: "#141414", border: "1px solid #333", borderRadius: 2, fontSize: 10 }} />
                <Line type="monotone" dataKey="bpm" stroke="#D4A843" strokeWidth={2} dot={{ r: 3, fill: "#D4A843" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category detail table */}
      <div className="panel p-4">
        <div className="font-label text-[9px] text-[#555] mb-2">Category Breakdown</div>
        {Object.entries(catCount).map(([cat, { done, total }]) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={cat} className="flex items-center gap-3 py-1.5 border-b border-[#111] last:border-0">
              <div className="w-2 h-4 rounded-sm" style={{ background: COL[cat] || "#888" }} />
              <span className="font-label text-[10px] text-[#aaa] flex-1">{cat}</span>
              <span className="font-readout text-[10px] text-[#555]">{done}/{total}</span>
              <div className="w-16">
                <div className="vu !h-[3px]"><div className="vu-fill" style={{ width: pct + "%" }} /></div>
              </div>
              <span className="font-readout text-[10px] text-[#D4A843] w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
