"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DAYS, COL, CATS } from "@/lib/constants";
import type { DayExMap, BoolMap } from "@/lib/types";

interface WeeklyChartsProps {
  week: number;
  dayExMap: DayExMap;
  doneMap: BoolMap;
}

export default function WeeklyCharts({ week, dayExMap, doneMap }: WeeklyChartsProps) {
  // Practice time per day
  const barData = DAYS.map((day) => {
    const exs = dayExMap[day] || [];
    const totalMin = exs.reduce((s, e) => s + e.m, 0);
    const doneMin = exs.filter((e) => doneMap[week + "-" + day + "-" + e.id]).reduce((s, e) => s + e.m, 0);
    return { name: day, total: totalMin, done: doneMin };
  });

  // Category completion
  const catData: { name: string; value: number; color: string }[] = [];
  const catCount: Record<string, number> = {};
  DAYS.forEach((day) => {
    (dayExMap[day] || []).forEach((e) => {
      if (doneMap[week + "-" + day + "-" + e.id]) {
        catCount[e.c] = (catCount[e.c] || 0) + 1;
      }
    });
  });
  Object.entries(catCount).forEach(([cat, count]) => {
    catData.push({ name: cat, value: count, color: COL[cat] || "#888" });
  });

  const hasData = barData.some((d) => d.total > 0);

  if (!hasData) return null;

  return (
    <div className="panel p-5 mb-4">
      <div className="font-label text-[11px] text-[#D4A843] mb-4 flex items-center gap-2">
        <div className="led led-gold" /> Analytics
      </div>

      {/* Bar chart — practice time per day */}
      <div className="mb-6">
        <div className="font-label text-[9px] text-[#555] mb-2">Practice Time (minutes per day)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} barSize={20}>
            <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }} axisLine={{ stroke: "#222" }} tickLine={false} />
            <YAxis tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: "#141414", border: "1px solid #333", borderRadius: 2, fontSize: 11 }}
              labelStyle={{ color: "#D4A843", fontFamily: "Barlow Condensed", textTransform: "uppercase" }}
              cursor={{ fill: "rgba(212,168,67,0.05)" }}
            />
            <Bar dataKey="total" fill="#333" radius={[2, 2, 0, 0]} name="Planned" />
            <Bar dataKey="done" fill="#D4A843" radius={[2, 2, 0, 0]} name="Completed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart — category breakdown */}
      {catData.length > 0 && (
        <div>
          <div className="font-label text-[9px] text-[#555] mb-2">Completed by Category</div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={catData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} strokeWidth={0}>
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
              {catData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                  <span className="font-label text-[9px] text-[#888]">{entry.name}</span>
                  <span className="font-readout text-[9px] text-[#555]">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
