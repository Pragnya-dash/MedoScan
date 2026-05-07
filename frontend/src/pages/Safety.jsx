import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, CheckCircle2, Sparkles, Clock, AlertOctagon } from "lucide-react";

import TopNav from "@/components/TopNav";
import { fetchSafety } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Safety() {
  const [hours, setHours] = useState(168);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchSafety(hours).then(setData);
  }, [hours]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#2b4c59]">safety monitor</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-[#2b4c59]" /> Safety monitor dashboard
            </h1>
          </div>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger data-testid="safety-window" className="h-10 w-[160px] rounded-md bg-white">
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

        {/* Counter cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="safety-counters">
          <Counter icon={AlertOctagon} label="Critical signals" value={data?.critical ?? 0} sub="Requires immediate action" accent="#e07a5f" />
          <Counter icon={AlertTriangle} label="Warning signals" value={data?.warning ?? 0} sub="Under investigation" accent="#f2cc8f" />
          <Counter icon={CheckCircle2} label="Stable signals" value={data?.stable ?? 0} sub="Monitoring continues" accent="#81b29a" />
        </div>

        {/* AI Safety Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="card-lift mt-6 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-[#f3f1ec] p-6"
          data-testid="safety-assessment"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2b4c59]" />
            <span className="font-display font-semibold">Safety assessment</span>
          </div>
          <p className="mt-3 text-sm text-slate-700 leading-relaxed">{data?.narrative || "Loading…"}</p>
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-md prio-high">
              <AlertOctagon className="w-3.5 h-3.5" /> Action required
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600">
              <Clock className="w-3.5 h-3.5" /> 24h review window
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Counter({ icon: Icon, label, value, sub, accent }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="card-lift rounded-lg bg-white border border-slate-200 p-6 text-center">
      <Icon className="w-5 h-5 mx-auto" style={{ color: accent }} />
      <div className="mt-3 font-display text-5xl font-extrabold" style={{ color: accent }}>{value}</div>
      <div className="mt-2 font-display font-semibold">{label}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </motion.div>
  );
}
