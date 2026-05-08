import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Brain, Siren, RefreshCcw } from "lucide-react";

import TopNav from "@/components/TopNav";
import SignalBadge from "@/components/SignalBadge";
import DeltaChip from "@/components/DeltaChip";
import { Button } from "@/components/ui/button";
import { fetchAlerts, refreshInsights } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Alerts() {
  const [hours, setHours] = useState(168);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchAlerts(hours);
      setAlerts(r.alerts || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  load();
}, [hours, load]);

  const onRefresh = async () => {
    try {
      toast.loading("Generating AI insights with Claude…", { id: "ins" });
      const r = await refreshInsights(hours, 12);
      toast.success(`Generated ${r.generated} insights`, { id: "ins" });
      load();
    } catch { toast.error("Insight refresh failed", { id: "ins" }); }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">safety signals</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight flex items-center gap-3">
              <Siren className="w-7 h-7 text-[#e07a5f]" /> Alerts & AI insights
            </h1>
            <p className="text-slate-600 mt-2 text-sm">Per-drug AI narratives, spike% vs prior window, and aggregated symptom clusters.</p>
          </div>
          <div className="flex gap-2">
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger data-testid="alerts-window-select" className="h-10 w-[160px] rounded-md bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 72 hours</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
                <SelectItem value="720">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="alerts-refresh-insights" onClick={onRefresh} className="h-10 rounded-md bg-[#2b4c59] hover:bg-[#1e353e] text-white">
              <Brain className="w-4 h-4 mr-1.5" /> Generate AI insights
            </Button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading && <div className="col-span-2 p-10 text-sm text-slate-500">Loading…</div>}
          {!loading && alerts.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500">
              No high-severity alerts in this window. ✧
            </div>
          )}
          {alerts.map((a, i) => (
            <motion.div
              key={`${a.signal_type}-${a.drug}-${i}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`rounded-lg border bg-white p-5 border-l-4 ${
                a.severity === "critical" ? "border-l-[#e07a5f]" :
                a.severity === "high" ? "border-l-[#e5989b]" : "border-l-[#f2cc8f]"
              }`}
              data-testid={`alert-card-${a.drug}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <SignalBadge type={a.signal_type} />
                <span className="font-display text-lg font-semibold capitalize">{a.drug}</span>
                <DeltaChip value={a.delta_pct} className="ml-auto" />
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                {a.count} post{a.count !== 1 ? "s" : ""} {a.prev_count > 0 ? `vs ${a.prev_count} prior` : "(new signal)"} · {a.severity.toUpperCase()} · last {new Date(a.latest_at).toLocaleString()}
              </div>

              <div className="mt-3 rounded-md bg-[#f3f1ec] p-3 text-sm text-slate-800 leading-relaxed flex gap-2">
                <Brain className="w-4 h-4 text-[#2b4c59] mt-0.5 flex-shrink-0" />
                <div>
                  {a.ai_narrative || (
                    <span className="text-slate-500 italic">AI insight pending — click "Generate AI insights" above.</span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1.5">reported symptoms</div>
                <div className="flex flex-wrap gap-1.5">
                  {(a.top_symptoms || []).length === 0 && (
                    <span className="text-xs text-slate-400">no aggregated symptoms</span>
                  )}
                  {(a.top_symptoms || []).map((s) => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-[#e07a5f]/10 text-[#b24a2f] capitalize border border-[#e07a5f]/25">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-500">
                sources: {(a.sources || []).join(", ") || "—"}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
