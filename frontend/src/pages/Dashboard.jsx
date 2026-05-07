import { useEffect, useMemo, useState } from "react";
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

  const load = async () => {
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
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [hours]);

  const handleSeed = async () => {
    try {
      toast.loading("Seeding demo posts…", { id: "seed" });
      const r = await seedDemo();
      toast.success(`Seeded ${r.seeded} posts. Generating AI insights in background…`, { id: "seed", duration: 4000 });
      load();
    } catch { toast.error("Seed failed", { id: "seed" }); }
  };

  const handleRefreshInsights = async () => {
    try {
      toast.loading("Generating AI insights with Claude…", { id: "ins" });
      const r = await refreshInsights(hours, 10);
      toast.success(`Generated ${r.generated} insights`, { id: "ins" });
      load();
    } catch { toast.error("Insight refresh failed", { id: "ins" }); }
  };

  const filteredPosts = useMemo(() => posts.filter((p) =>
    (filterSource === "all" || p.source === filterSource) &&
    (filterSignal === "all" || p.signal_type === filterSignal)
  ), [posts, filterSource, filterSignal]);

  const sigData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.signal_distribution || {}).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const sourceData = useMemo(() => {
    if (!stats) return [];
    const labelMap = { twitter: "Twitter/X", reddit: "Reddit", quora: "Quora", forum: "Forum", manual: "Manual" };
    return Object.entries(stats.source_distribution || {}).map(([name, value]) => ({
      name: labelMap[name] || name,
      value,
    }));
  }, [stats]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start flex-wrap gap-4 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">control room</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-2">Live signal dashboard</h1>
            <p className="text-slate-600 mt-1.5 text-sm">Real-time surveillance across Reddit, X, Quora and forums.</p>
          </div>
          <div className="flex gap-2">
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger data-testid="dashboard-timewindow-select" className="h-10 w-[160px] rounded-md bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 72 hours</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
                <SelectItem value="720">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="dashboard-refresh-btn" onClick={load} variant="outline" className="h-10 rounded-md">
              <RefreshCcw className="w-4 h-4 mr-1.5" /> Refresh
            </Button>
            <Button data-testid="dashboard-insights-btn" onClick={handleRefreshInsights} variant="outline" className="h-10 rounded-md border-[#2b4c59]/30 text-[#2b4c59]">
              <Brain className="w-4 h-4 mr-1.5" /> AI insights
            </Button>
            <Button data-testid="dashboard-seed-btn" onClick={handleSeed} className="h-10 rounded-md bg-[#2b4c59] hover:bg-[#1e353e] text-white">
              <Sparkles className="w-4 h-4 mr-1.5" /> Seed demo
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi icon={Activity} label="Total posts analyzed" value={stats?.total_posts ?? "—"} delta={stats?.deltas?.total} accent="#2b4c59" testid="kpi-total-posts" />
          <Kpi icon={ShieldAlert} label="Adverse events" value={stats?.adverse_events ?? 0} delta={stats?.deltas?.adverse_events} accent="#e07a5f" testid="kpi-adverse-events" />
          <Kpi icon={TrendingUp} label="Positive outcomes" value={stats?.positive_outcomes ?? 0} delta={stats?.deltas?.positive_outcomes} accent="#81b29a" testid="kpi-positive-outcomes" />
          <Kpi icon={Users} label="PII flagged" value={stats?.pii_flagged ?? 0} delta={stats?.deltas?.pii_flagged} accent="#3d405b" testid="kpi-pii-flagged" />
        </div>

        {/* Charts row */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel title="Signal distribution" subtitle="share of posts per signal">
            <div className="h-64 min-w-0" data-testid="signal-pie">
              {sigData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%" key={`pie-${sigData.length}-${stats?.total_posts}`}>
                  <PieChart>
                    <Pie data={sigData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} isAnimationActive={false}>
                      {sigData.map((entry) => (
                        <Cell key={entry.name} fill={COLORS[entry.name] || "#999"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <Legend2 items={sigData} colorMap={COLORS} />
          </Panel>

          <Panel title="Sentiment timeline" subtitle="posts per day by polarity">
            <div className="h-64 min-w-0">
              {(stats?.timeline?.length ?? 0) > 0 && (
                <ResponsiveContainer width="100%" height="100%" key={`area-${stats.timeline.length}`}>
                  <AreaChart data={stats.timeline}>
                    <defs>
                      <linearGradient id="gPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#81b29a" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#81b29a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e07a5f" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#e07a5f" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gNeu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="POSITIVE" stroke={SENT.POSITIVE} strokeWidth={2} fill="url(#gPos)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="NEGATIVE" stroke={SENT.NEGATIVE} strokeWidth={2} fill="url(#gNeg)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="NEUTRAL" stroke={SENT.NEUTRAL} strokeWidth={2} fill="url(#gNeu)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Top drugs mentioned" subtitle={`top ${Math.min(10, stats?.top_drugs?.length ?? 0)} in window`}>
            <div className="h-64 min-w-0">
              {(stats?.top_drugs?.length ?? 0) > 0 && (
                <ResponsiveContainer width="100%" height="100%" key={`bar-${stats.top_drugs.length}`}>
                  <BarChart data={stats.top_drugs} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                    <YAxis type="category" dataKey="drug" stroke="#4b5563" fontSize={11} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2b4c59" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {report?.trending_signals?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5" data-testid="trending-deltas">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1.5">spikes vs prior window</div>
                {report.trending_signals.slice(0, 4).map((t, i) => (
                  <div key={`${t.signal_type}-${t.drug}-${i}`} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`dot dot-${t.signal_type}`} />
                      <span className="capitalize font-display font-semibold truncate">{t.drug}</span>
                      <span className="text-slate-400">· {t.count}</span>
                    </div>
                    <DeltaChip value={t.delta_pct} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Sources + Alerts */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel title="Posts by source" subtitle="coverage across platforms">
            <div className="h-56 min-w-0">
              {sourceData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%" key={`src-${sourceData.length}`}>
                  <BarChart data={sourceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#81b29a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-6" data-testid="alerts-panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#2b4c59]" /> AI insights · active alerts
                </div>
                <div className="text-xs text-slate-500 mt-1">Trends, spikes & symptom clusters across high-severity signals</div>
              </div>
              <Link to="/alerts" className="text-sm text-[#2b4c59] underline underline-offset-4">View all →</Link>
            </div>
            <div className="mt-5 space-y-3">
              {alerts.length === 0 && (
                <div className="py-6 text-sm text-slate-500">No high-severity signals in this window. ✧</div>
              )}
              {alerts.slice(0, 4).map((a, i) => (
                <motion.div
                  key={`${a.signal_type}-${a.drug}-${i}`}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={`rounded-md border bg-[#f9f8f6]/60 p-4 border-l-4 ${
                    a.severity === "critical" ? "border-l-[#e07a5f] border-slate-200" : a.severity === "high" ? "border-l-[#e5989b] border-slate-200" : "border-l-[#f2cc8f] border-slate-200"
                  }`}
                  data-testid={`alert-insight-${a.drug}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <SignalBadge type={a.signal_type} />
                    <span className="font-display font-semibold capitalize">{a.drug}</span>
                    <DeltaChip value={a.delta_pct} className="ml-auto" />
                    <span className="text-[11px] text-slate-500">{a.count} post{a.count !== 1 ? "s" : ""}{a.prev_count > 0 ? ` vs ${a.prev_count} prior` : ""}</span>
                  </div>
                  {a.ai_narrative ? (
                    <div className="mt-2.5 text-sm text-slate-800 leading-relaxed">{a.ai_narrative}</div>
                  ) : (
                    <div className="mt-2.5 text-sm text-slate-500 italic">AI insight pending — click "AI insights" to generate.</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                    {(a.top_symptoms || []).slice(0, 5).map((s) => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-[#e07a5f]/10 text-[#b24a2f] capitalize border border-[#e07a5f]/25">
                        {s}
                      </span>
                    ))}
                    {(!a.top_symptoms || a.top_symptoms.length === 0) && (
                      <span className="text-[11px] text-slate-400">no aggregated symptoms yet</span>
                    )}
                    <span className="text-[11px] text-slate-400 ml-auto">sources: {(a.sources || []).join(", ")}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-white">
          <div className="p-5 flex items-center justify-between flex-wrap gap-3 border-b border-slate-100">
            <div>
              <div className="font-display font-semibold">Real-time feed</div>
              <div className="text-xs text-slate-500">{filteredPosts.length} posts · newest first</div>
            </div>
            <div className="flex gap-2">
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger data-testid="feed-source-filter" className="h-9 w-[140px] rounded-md"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="twitter">Twitter / X</SelectItem>
                  <SelectItem value="quora">Quora</SelectItem>
                  <SelectItem value="forum">Forum</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSignal} onValueChange={setFilterSignal}>
                <SelectTrigger data-testid="feed-signal-filter" className="h-9 w-[180px] rounded-md"><SelectValue placeholder="Signal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All signals</SelectItem>
                  <SelectItem value="ADVERSE_EVENT">Adverse event</SelectItem>
                  <SelectItem value="SIDE_EFFECT">Side effect</SelectItem>
                  <SelectItem value="TREATMENT_FAILURE">Treatment failure</SelectItem>
                  <SelectItem value="POSITIVE_OUTCOME">Positive outcome</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {loading && <div className="p-8 text-sm text-slate-500">Loading…</div>}
            {!loading && filteredPosts.length === 0 && (
              <div className="p-8 text-sm text-slate-500">No posts match. Try seeding demo posts or widening the window.</div>
            )}
            {filteredPosts.map((p, i) => (
              <motion.div
                key={p.post_id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="p-5 hover:bg-[#f9f8f6] transition-colors"
                data-testid={`feed-post-${i}`}
                data-post-id={p.post_id}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <SignalBadge type={p.signal_type} />
                  <span className="text-xs text-slate-500 mono uppercase">{p.source}</span>
                  <span className="text-xs text-slate-400">{new Date(p.collected_at).toLocaleString()}</span>
                  {p.has_pii && (
                    <span className="text-[10px] uppercase tracking-[0.18em] bg-[#f3f1ec] text-slate-600 px-2 py-0.5 rounded-md">PII redacted</span>
                  )}
                  <span className={`text-xs font-semibold ${p.sentiment === "NEGATIVE" ? "text-[#b24a2f]" : p.sentiment === "POSITIVE" ? "text-[#3d6b53]" : "text-slate-500"}`}>
                    {p.sentiment}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-800">{p.preview}</div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {p.drugs?.slice(0, 6).map((d) => (
                    <span key={d} className="text-xs px-2 py-0.5 rounded-md bg-[#2b4c59]/8 text-[#2b4c59] capitalize border border-[#2b4c59]/15">{d}</span>
                  ))}
                  <Link
                    to={`/posts/${p.post_id}`}
                    className="ml-auto text-xs text-[#e07a5f] hover:underline"
                    data-testid={`feed-open-${p.post_id}`}
                  >
                    full analysis →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, delta, accent, testid }) {
  const dv = delta;
  const up = dv !== null && dv !== undefined && dv > 0;
  const down = dv !== null && dv !== undefined && dv < 0;
  const flat = dv === 0;
  return (
    <motion.div whileHover={{ y: -3 }} className="card-lift rounded-lg bg-white border border-slate-200 p-5 relative" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold" style={{ color: accent }}>{value}</div>
      <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[11px] font-semibold" data-testid={`${testid}-delta`}>
        {dv === null || dv === undefined ? (
          <span className="text-slate-400">— baseline</span>
        ) : flat ? (
          <span className="text-slate-500">→ steady</span>
        ) : up ? (
          <span className="text-[#b24a2f]">▲ +{Math.abs(dv).toFixed(0)}%</span>
        ) : (
          <span className="text-[#3d6b53]">▼ {Math.abs(dv).toFixed(0)}%</span>
        )}
      </div>
    </motion.div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="card-lift rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <div className="font-display font-semibold">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Legend2({ items, colorMap }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
      {items.map((i) => (
        <div key={i.name} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorMap[i.name] || "#999" }} />
          {i.name.replace("_", " ").toLowerCase()} · <span className="mono">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
