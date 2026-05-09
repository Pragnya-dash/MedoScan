import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  Activity, RefreshCcw, Sparkles, TrendingUp, ShieldAlert,
  Users, Brain, AlertTriangle, CheckCircle, Pill, ExternalLink,
} from "lucide-react";

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

function StatCard({ label, value, delta, icon: Icon, accent = "#2b4c59" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <span className="font-display font-bold text-3xl text-slate-900">{value ?? "—"}</span>
        {delta != null && <DeltaChip delta={delta} />}
      </div>
    </motion.div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="font-display font-semibold text-slate-800 text-lg">{children}</h2>
  );
}

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
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

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
    return Object.entries(stats.signal_distribution || {}).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const sourceData = useMemo(() => {
    if (!stats) return [];
    const labelMap = { twitter: "Twitter/X", reddit: "Reddit", quora: "Quora", forum: "Forum", manual: "Manual" };
    return Object.entries(stats.source_distribution || {}).map(([name, value]) => ({
      name: labelMap[name] || name, value,
    }));
  }, [stats]);

  const timelineData = useMemo(() => {
    if (!stats) return [];
    return (stats.timeline || []).map((t) => ({
      date: t.date.slice(5),
      Positive: t.POSITIVE,
      Negative: t.NEGATIVE,
      Neutral: t.NEUTRAL,
    }));
  }, [stats]);

  return (
    <div className="min-h-screen">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* Header */}
        <div className="flex items-start flex-wrap gap-4 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">control room</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-2">Live signal dashboard</h1>
            <p className="text-slate-600 mt-1.5 text-sm">Real-time surveillance across Reddit, X, Quora and forums.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <Button onClick={load} variant="outline"><RefreshCcw className="w-4 h-4 mr-1.5" /> Refresh</Button>
            <Button onClick={handleRefreshInsights} variant="outline"><Brain className="w-4 h-4 mr-1.5" /> AI insights</Button>
            <Button onClick={handleSeed} className="bg-[#2b4c59] text-white"><Sparkles className="w-4 h-4 mr-1.5" /> Seed demo</Button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-5 h-28 animate-pulse">
                <div className="h-3 w-24 bg-slate-100 rounded mb-4" />
                <div className="h-8 w-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Stat Cards */}
        {!loading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total posts" value={stats.total_posts} delta={stats.deltas?.total} icon={Activity} accent="#2b4c59" />
            <StatCard label="Adverse events" value={stats.adverse_events} delta={stats.deltas?.adverse_events} icon={ShieldAlert} accent="#e07a5f" />
            <StatCard label="Positive outcomes" value={stats.positive_outcomes} delta={stats.deltas?.positive_outcomes} icon={CheckCircle} accent="#81b29a" />
            <StatCard label="PII flagged" value={stats.pii_flagged} delta={stats.deltas?.pii_flagged} icon={Users} accent="#3d405b" />
          </div>
        )}

        {/* Extra stat row */}
        {!loading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Side effects" value={stats.side_effects} icon={AlertTriangle} accent="#f2cc8f" />
            <StatCard label="Treatment failures" value={stats.treatment_failures} icon={TrendingUp} accent="#e5989b" />
            <StatCard label="Sources tracked" value={Object.keys(stats.source_distribution || {}).length} icon={Users} accent="#2b4c59" />
          </div>
        )}

        {/* Charts row */}
        {!loading && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Sentiment timeline */}
            <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-6">
              <SectionTitle>Sentiment over time</SectionTitle>
              <p className="text-xs text-slate-500 mb-4">Daily breakdown of positive / negative / neutral posts</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Positive" stackId="1" stroke="#81b29a" fill="#81b29a" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Neutral" stackId="1" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="Negative" stackId="1" stroke="#e07a5f" fill="#e07a5f" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Signal distribution pie */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <SectionTitle>Signal distribution</SectionTitle>
              <p className="text-xs text-slate-500 mb-4">By signal type</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sigData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {sigData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || "#ccc"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2">
                {sigData.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[s.name] || "#ccc" }} />
                    {s.name.replace(/_/g, " ")} ({s.value})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Second charts row */}
        {!loading && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top drugs bar chart */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <SectionTitle>Top drugs mentioned</SectionTitle>
              <p className="text-xs text-slate-500 mb-4">By mention count</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.top_drugs || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="drug" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2b4c59" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Source distribution bar chart */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <SectionTitle>Posts by source</SectionTitle>
              <p className="text-xs text-slate-500 mb-4">Where signals are coming from</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#81b29a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Active alerts */}
        {!loading && alerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Active alerts</SectionTitle>
              <Link to="/alerts" className="text-xs text-[#2b4c59] hover:underline">View all →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alerts.slice(0, 6).map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-semibold text-slate-800 capitalize">{a.drug}</div>
                      <SignalBadge type={a.signal_type} />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      a.severity === "critical" ? "bg-red-100 text-red-700" :
                      a.severity === "high" ? "bg-orange-100 text-orange-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{a.severity}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="text-slate-500">{a.count} posts</span>
                    {a.delta_pct != null && <DeltaChip delta={a.delta_pct} />}
                  </div>
                  {a.top_symptoms?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.top_symptoms.slice(0, 3).map((s) => (
                        <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recent posts */}
        {!loading && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <SectionTitle>Recent posts ({filteredPosts.length})</SectionTitle>
              <div className="flex gap-2">
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="h-9 w-[130px] bg-white text-sm">
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="quora">Quora</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterSignal} onValueChange={setFilterSignal}>
                  <SelectTrigger className="h-9 w-[160px] bg-white text-sm">
                    <SelectValue placeholder="All signals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All signals</SelectItem>
                    <SelectItem value="ADVERSE_EVENT">Adverse Event</SelectItem>
                    <SelectItem value="SIDE_EFFECT">Side Effect</SelectItem>
                    <SelectItem value="TREATMENT_FAILURE">Treatment Failure</SelectItem>
                    <SelectItem value="POSITIVE_OUTCOME">Positive Outcome</SelectItem>
                    <SelectItem value="GENERAL">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
                <Pill className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No posts yet. Click <strong>Seed demo</strong> to load sample data.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.slice(0, 50).map((p) => (
                  <motion.div
                    key={p.post_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <SignalBadge type={p.signal_type} />
                          <span className="text-xs text-slate-400 capitalize">{p.source}</span>
                          {p.has_pii && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">PII redacted</span>
                          )}
                          {p.drugs?.length > 0 && p.drugs.map((d) => (
                            <span key={d} className="text-[10px] bg-[#2b4c59]/10 text-[#2b4c59] px-2 py-0.5 rounded-full font-medium capitalize">{d}</span>
                          ))}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed line-clamp-2">{p.preview}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.sentiment === "POSITIVE" ? "bg-green-100 text-green-700" :
                          p.sentiment === "NEGATIVE" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>{p.sentiment}</span>
                        <Link to={`/posts/${p.post_id}`} className="text-[10px] text-slate-400 hover:text-[#2b4c59] flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
