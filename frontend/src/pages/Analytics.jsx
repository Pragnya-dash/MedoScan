import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { BarChart3, Activity, Flame } from "lucide-react";

import TopNav from "@/components/TopNav";
import { fetchStats, fetchHeatmap } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SENT = { POSITIVE: "#81b29a", NEGATIVE: "#e07a5f", NEUTRAL: "#9ca3af" };

const HEAT_LEGEND = [
  { label: "Low", color: "#dfdedb" },
  { label: "Moderate", color: "#cfe1d8" },
  { label: "High", color: "#f2cc8f" },
  { label: "Very High", color: "#e07a5f" },
  { label: "Critical", color: "#b24a2f" },
];

function heatColor(v, max) {
  if (!v) return "#f3f1ec";
  const r = max ? v / max : 0;
  if (r >= 0.85) return "#b24a2f";
  if (r >= 0.65) return "#e07a5f";
  if (r >= 0.4) return "#f2cc8f";
  if (r >= 0.2) return "#cfe1d8";
  return "#dfdedb";
}

export default function Analytics() {
  const [hours, setHours] = useState(168);
  const [stats, setStats] = useState(null);
  const [heat, setHeat] = useState(null);

  useEffect(() => {
    Promise.all([fetchStats(hours), fetchHeatmap(hours)]).then(([s, h]) => {
      setStats(s); setHeat(h);
    });
  }, [hours]);

  const drugBars = useMemo(() => {
    if (!stats?.top_drugs) return [];
    const max = Math.max(1, ...stats.top_drugs.map((d) => d.count));
    return stats.top_drugs.map((d) => ({ ...d, pct: (d.count / max) * 100 }));
  }, [stats]);

  const heatMax = useMemo(() => {
    if (!heat) return 1;
    let m = 1;
    Object.values(heat.grid || {}).forEach((row) =>
      Object.values(row).forEach((v) => { if (v > m) m = v; })
    );
    return m;
  }, [heat]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#2b4c59]">analytics</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-[#2b4c59]" /> Population analytics
            </h1>
          </div>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger data-testid="analytics-window" className="h-10 w-[160px] rounded-md bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Last 24 hours</SelectItem>
              <SelectItem value="72">Last 72 hours</SelectItem>
              <SelectItem value="168">Last 7 days</SelectItem>
              <SelectItem value="720">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sentiment trends */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card-lift mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#2b4c59]" />
            <div className="font-display font-semibold">Sentiment trends over time</div>
          </div>
          <div className="h-72 min-w-0">
            {(stats?.timeline?.length ?? 0) > 0 && (
              <ResponsiveContainer width="100%" height="100%" key={`area-${stats.timeline.length}`}>
                <AreaChart data={stats.timeline}>
                  <defs>
                    <linearGradient id="aPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#81b29a" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#81b29a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e07a5f" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#e07a5f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="POSITIVE" stroke={SENT.POSITIVE} fill="url(#aPos)" strokeWidth={2} isAnimationActive={false} />
                  <Area type="monotone" dataKey="NEGATIVE" stroke={SENT.NEGATIVE} fill="url(#aNeg)" strokeWidth={2} isAnimationActive={false} />
                  <Area type="monotone" dataKey="NEUTRAL" stroke={SENT.NEUTRAL} fill="transparent" strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Drug mentions */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card-lift mt-6 rounded-lg border border-slate-200 bg-white p-6" data-testid="drug-mentions">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#2b4c59]" />
            <div className="font-display font-semibold">Drug mentions &amp; ADR reports</div>
          </div>
          <div className="space-y-3">
            {drugBars.map((d) => (
              <div key={d.drug}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display font-semibold capitalize">{d.drug}</span>
                  <span className="text-xs text-slate-500">{d.count} mentions</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${d.pct}%` }} transition={{ duration: 0.7 }} className="h-full bg-[#2b4c59] rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Heatmap */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card-lift mt-6 mb-12 rounded-lg border border-slate-200 bg-white p-6" data-testid="heatmap">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-[#e07a5f]" />
            <div className="font-display font-semibold">Drug — symptom intensity heatmap</div>
          </div>
          {heat && heat.drugs?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-slate-500 uppercase tracking-[0.18em] font-semibold pb-2 pr-4">drug / symptom</th>
                    {heat.symptoms.map((s) => (
                      <th key={s} className="text-left text-slate-500 uppercase tracking-[0.16em] font-semibold pb-2 pr-2 capitalize whitespace-nowrap">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heat.drugs.map((d) => (
                    <tr key={d}>
                      <td className="py-1.5 pr-4 capitalize font-semibold whitespace-nowrap">{d}</td>
                      {heat.symptoms.map((s) => {
                        const v = heat.grid[d]?.[s] || 0;
                        return (
                          <td key={s} className="py-1.5 pr-2">
                            <div
                              className="w-12 h-7 rounded-md border border-slate-200 flex items-center justify-center text-[11px] font-semibold"
                              style={{ background: heatColor(v, heatMax), color: v >= heatMax * 0.65 ? "#fff" : "#1a1b25" }}
                            >
                              {v || ""}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3 mt-4 text-[11px]">
                {HEAT_LEGEND.map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm border border-slate-200" style={{ background: l.color }} />
                    <span className="text-slate-600">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Not enough drug-symptom data yet.</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
