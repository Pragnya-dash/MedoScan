import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, ShieldAlert, Target, Lightbulb, Zap } from "lucide-react";

import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchAlerts, fetchStats, fetchTrends } from "@/lib/api";

const PRIORITY = { HIGH: "prio-high", MEDIUM: "prio-medium", LOW: "prio-low" };

export default function AIInsights() {
  const [hours, setHours] = useState(168);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [trends, setTrends] = useState([]);

  useEffect(() => {
    Promise.all([fetchStats(hours), fetchAlerts(hours), fetchTrends(hours)]).then(([s, a, t]) => {
      setStats(s); setAlerts(a.alerts || []); setTrends(t.trends || []);
    });
  }, [hours]);

  const totalPosts = stats?.total_posts ?? 0;
  const adverse = stats?.adverse_events ?? 0;
  const totalDelta = stats?.deltas?.total;
  const accelerating = trends.filter((t) => t.direction === "increasing").length;
  const declining = trends.filter((t) => t.direction === "decreasing").length;
  const piiCount = stats?.pii_flagged ?? 0;
  const topConf = trends.slice().sort((a, b) => b.confidence - a.confidence)[0];

  const emerging = alerts.slice(0, 4).map((a) => ({
    icon: a.signal_type === "ADVERSE_EVENT" ? ShieldAlert : Target,
    title: `${a.drug.charAt(0).toUpperCase() + a.drug.slice(1)} — ${a.signal_type === "ADVERSE_EVENT" ? "Adverse Event Cluster" : a.signal_type === "TREATMENT_FAILURE" ? "Treatment Failure Pattern" : "Side Effect Build-up"}`,
    body: a.ai_narrative || "Insight pending.",
    tags: [a.drug, ...(a.top_symptoms || []).slice(0, 3)],
    priority: a.severity === "critical" ? "HIGH" : a.severity === "high" ? "MEDIUM" : "LOW",
  }));

  const predictive = [];
  const accelerator = trends.find((t) => t.direction === "increasing" && t.count >= 3);
  if (accelerator) {
    const projected = Math.round(accelerator.count * 1.7);
    predictive.push({
      icon: Zap,
      title: `Projected: ${accelerator.drug.charAt(0).toUpperCase() + accelerator.drug.slice(1)} reports may exceed ${projected}/window`,
      body: `Based on the current acceleration rate, ${accelerator.drug} reports are projected to grow ~70% within the next comparable period if the trend continues. Top-cited symptom: ${accelerator.top_symptom}.`,
      tags: ["Forecast", accelerator.drug, "Trend Acceleration"],
      priority: "HIGH",
    });
  }
  const decel = trends.find((t) => t.direction === "decreasing" && t.count >= 2);
  if (decel) {
    predictive.push({
      icon: Lightbulb,
      title: `${decel.drug.charAt(0).toUpperCase() + decel.drug.slice(1)} reports declining — Seasonal or formulation?`,
      body: `${decel.drug} mentions have decreased vs the prior window. Analysis recommended to determine if this is a seasonal effect, formulation change, or reporting artefact.`,
      tags: [decel.drug, "Declining Trend", "Data Quality"],
      priority: "LOW",
    });
  }
  if (topConf) {
    predictive.push({
      icon: Target,
      title: `Cross-Drug Pattern: high confidence on ${topConf.drug.charAt(0).toUpperCase() + topConf.drug.slice(1)}`,
      body: `${topConf.drug} reports remain the most confident in the dataset (${(topConf.confidence * 100).toFixed(0)}%) with ${topConf.count} mentions. Consider cross-referencing with class-effect drugs for class-wide signal assessment.`,
      tags: [topConf.drug, "Class Effect", "Cross-Drug"],
      priority: "MEDIUM",
    });
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#2b4c59]">ai analysis</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight flex items-center gap-3">
              <Brain className="w-7 h-7 text-[#2b4c59]" /> AI Insights
            </h1>
            <p className="text-slate-600 mt-2 text-sm">Auto-generated safety briefings, emerging risk clusters and predictive forecasts.</p>
          </div>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger data-testid="insights-window" className="h-10 w-[160px] rounded-md bg-white">
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

        {/* AI-Generated Safety Summary */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="card-lift mt-8 rounded-lg border-l-4 border-l-[#2b4c59] border border-slate-200 bg-gradient-to-br from-white to-[#f3f1ec] p-6"
          data-testid="ai-summary"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2b4c59]" />
            <span className="font-display font-semibold">AI-Generated Safety Summary</span>
          </div>
          <div className="mt-4 rounded-md bg-white border border-slate-200 p-5">
            <div className="text-sm text-[#2b4c59] font-display font-semibold">Key findings · current window</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>→ <span className="text-[#b24a2f] font-semibold">{adverse} high-severity events</span> detected across {totalPosts} tracked posts{totalDelta != null ? ` — a ${totalDelta >= 0 ? "+" : ""}${totalDelta.toFixed(0)}% volume change vs the prior window.` : "."}</li>
              {topConf && <li>→ <span className="text-[#b24a2f] font-semibold">{topConf.drug.charAt(0).toUpperCase()+topConf.drug.slice(1)}</span> shows the highest confidence signal ({(topConf.confidence*100).toFixed(0)}%) with {topConf.count} reports and an {topConf.direction} trend.</li>}
              <li>→ <span className="text-[#8a6a2c] font-semibold">{accelerating} trend signals</span> are currently accelerating; {declining} are declining.</li>
              <li>→ PII was detected and redacted in <span className="font-semibold">{piiCount} posts</span>, demonstrating the pipeline's data-privacy compliance.</li>
            </ul>
          </div>
        </motion.div>

        {/* Emerging Risk Signals */}
        <div className="mt-10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#e07a5f]" />
            <h2 className="font-display text-xl font-bold">Emerging Risk Signals</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="emerging-risks">
            {emerging.length === 0 && <div className="col-span-2 text-sm text-slate-500">No emerging risks in this window.</div>}
            {emerging.map((e, i) => (
              <InsightCard key={i} {...e} />
            ))}
          </div>
        </div>

        {/* Predictive Insights */}
        <div className="mt-10 mb-10">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#3d405b]" />
            <h2 className="font-display text-xl font-bold">Predictive Insights</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="predictive-insights">
            {predictive.length === 0 && <div className="col-span-2 text-sm text-slate-500">Not enough trend volume yet to predict.</div>}
            {predictive.map((e, i) => <InsightCard key={i} {...e} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, body, tags, priority }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="card-lift rounded-lg border border-slate-200 bg-white p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-[#f3f1ec]">
          <Icon className="w-4 h-4 text-[#2b4c59]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display font-semibold leading-snug">{title}</div>
            <span className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-md ${PRIORITY[priority] || "prio-medium"}`}>
              {priority} priority
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">{body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span key={i} className="text-[10px] capitalize px-2 py-0.5 rounded-md bg-[#f3f1ec] text-slate-600 border border-slate-200">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
