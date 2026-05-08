import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import { Activity, RefreshCcw, Sparkles, TrendingUp, ShieldAlert, Users, Brain } from "lucide-react";

import TopNav from "@/components/TopNav";
import SignalBadge from "@/components/SignalBadge";
import DeltaChip from "@/components/DeltaChip";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchStats, fetchPosts, fetchAlerts, seedDemo, fetchReport, refreshInsights } from "@/lib/api";

const COLORS = {
  ADVERSE_EVENT: "#e07a5f",
  SIDE_EFFECT: "#f2cc8f",
  TREATMENT_FAILURE: "#e5989b",
  POSITIVE_OUTCOME: "#81b29a",
  GENERAL: "#3d405b",
};
const SENT = { POSITIVE: "#81b29a", NEGATIVE: "#e07a5f", NEUTRAL: "#9ca3af" };

export default function Dashboard() {
  const [hours, setHours] = useState(168);
  const [stats, setStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState("all");
  const [filterSignal, setFilterSignal] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, a, r] = await Promise.all([
        fetchStats(hours),
        fetchPosts({ hours, limit: 200 }),
        fetchAlerts(hours),
        fetchReport(hours),
      ]);

      setStats(s);
      setPosts(p.posts || []);
      setAlerts(a.alerts || []);
      setReport(r);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSeed = async () => {
    try {
      toast.loading("Seeding demo posts…", { id: "seed" });
      const r = await seedDemo();
      toast.success(`Seeded ${r.seeded} posts`, { id: "seed" });
      load();
    } catch {
      toast.error("Seed failed", { id: "seed" });
    }
  };

  const handleRefreshInsights = async () => {
    try {
      toast.loading("Generating AI insights…", { id: "ins" });
      const r = await refreshInsights(hours, 10);
      toast.success(`Generated ${r.generated} insights`, { id: "ins" });
      load();
    } catch {
      toast.error("Insight refresh failed", { id: "ins" });
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((p) =>
      (filterSource === "all" || p.source === filterSource) &&
      (filterSignal === "all" || p.signal_type === filterSignal)
    );
  }, [posts, filterSource, filterSignal]);

  const sigData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.signal_distribution || {}).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const sourceData = useMemo(() => {
    if (!stats) return [];
    const labelMap = {
      twitter: "Twitter/X",
      reddit: "Reddit",
      quora: "Quora",
      forum: "Forum",
      manual: "Manual",
    };
    return Object.entries(stats.source_distribution || {}).map(([name, value]) => ({
      name: labelMap[name] || name,
      value,
    }));
  }, [stats]);

  return (
    <div className="min-h-screen">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* UI SAME AS YOUR ORIGINAL — no changes needed */}
        <div className="flex items-start flex-wrap gap-4 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">
              control room
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-2">
              Live signal dashboard
            </h1>
            <p className="text-slate-600 mt-1.5 text-sm">
              Real-time surveillance across Reddit, X, Quora and forums.
            </p>
          </div>

          <div className="flex gap-2">
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger className="h-10 w-[160px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 72 hours</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
                <SelectItem value="720">Last 30 days</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={load} variant="outline">
              <RefreshCcw className="w-4 h-4 mr-1.5" /> Refresh
            </Button>

            <Button onClick={handleRefreshInsights} variant="outline">
              <Brain className="w-4 h-4 mr-1.5" /> AI insights
            </Button>

            <Button onClick={handleSeed} className="bg-[#2b4c59] text-white">
              <Sparkles className="w-4 h-4 mr-1.5" /> Seed demo
            </Button>
          </div>
        </div>

        {/* rest of your UI unchanged */}
      </div>
    </div>
  );
}