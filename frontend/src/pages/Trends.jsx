import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

import TopNav from "@/components/TopNav";
import { fetchTrends } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const DIR_META = {
  increasing: { color: "#e07a5f", bg: "rgba(224,122,95,0.14)", label: "Increasing", Icon: TrendingUp },
  decreasing: { color: "#3d6b53", bg: "rgba(129,178,154,0.18)", label: "Decreasing", Icon: TrendingDown },
  stable: { color: "#3d405b", bg: "rgba(61,64,91,0.10)", label: "Stable", Icon: Minus },
};

export default function Trends() {
  const [hours, setHours] = useState(168);
  const [trends, setTrends] = useState([]);

  useEffect(() => {
    fetchTrends(hours).then((d) => setTrends(d.trends || []));
  }, [hours]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#2b4c59]">trend signals</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight flex items-center gap-3">
              <Activity className="w-7 h-7 text-[#2b4c59]" /> Active Trend Signals
            </h1>
            <p className="text-slate-600 mt-2 text-sm">Direction, mention volume, top reported symptom and aggregate confidence per drug.</p>
          </div>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger data-testid="trends-window" className="h-10 w-[160px] rounded-md bg-white">
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

        <div className="mt-8 space-y-3" data-testid="trends-list">
          {trends.length === 0 && <div className="text-sm text-slate-500">No trend signals in this window.</div>}
          {trends.map((t, i) => {
            const meta = DIR_META[t.direction] || DIR_META.stable;
            const conf = Math.round((t.confidence || 0) * 100);
            const confColor = conf >= 80 ? "#e07a5f" : conf >= 60 ? "#f2cc8f" : "#9ca3af";
            return (
              <motion.div
                key={t.drug}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                whileHover={{ y: -2 }}
                className="card-lift rounded-lg border border-slate-200 bg-white p-5"
                data-testid={`trend-row-${t.drug}`}
              >
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-lg font-semibold capitalize">{t.drug}</span>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        <meta.Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1 capitalize">{t.top_symptom}</div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500 uppercase tracking-[0.18em]">confidence</span>
                        <span className="mono font-semibold" style={{ color: confColor }}>{conf}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${conf}%` }} transition={{ duration: 0.8, delay: i * 0.04 }}
                          className="h-full rounded-full"
                          style={{ background: confColor }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-3xl font-extrabold text-[#1a1b25]">{t.count}</div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">reports</div>
                    <div className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                      first seen {new Date(t.first_seen).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
