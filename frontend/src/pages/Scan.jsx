import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ScanSearch, Database, Brain, Shield, AlertTriangle,
  CheckCircle, ChevronRight, RefreshCcw, ExternalLink,
  Loader2, Pill, Activity, Zap, FileSearch,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import TopNav from "@/components/TopNav";
import { scanNow } from "@/lib/api";

const PIPELINE_STEPS = [
  { key: "Data Acquisition",              icon: Database,       color: "#2b4c59", bg: "#2b4c5918", description: "Crawling Reddit, Twitter & Quora via Apify" },
  { key: "Text Cleaning & PII Detection", icon: Shield,         color: "#6366f1", bg: "#6366f118", description: "Removing URLs, mentions & redacting personal info" },
  { key: "Entity Extraction",             icon: FileSearch,     color: "#f2cc8f", bg: "#f2cc8f22", description: "Identifying drugs & symptoms using medical lexicon" },
  { key: "Sentiment Analysis",            icon: Brain,          color: "#81b29a", bg: "#81b29a18", description: "Scoring sentiment across all collected posts" },
  { key: "Adverse Event Detection",       icon: AlertTriangle,  color: "#e07a5f", bg: "#e07a5f18", description: "Detecting adverse events, side effects & failures" },
  { key: "Risk Classification",           icon: Zap,            color: "#e5989b", bg: "#e5989b22", description: "Generating risk alerts ranked by severity" },
];

const SIGNAL_COLORS = {
  ADVERSE_EVENT:     "#e07a5f",
  SIDE_EFFECT:       "#f2cc8f",
  TREATMENT_FAILURE: "#e5989b",
  POSITIVE_OUTCOME:  "#81b29a",
  GENERAL:           "#3d405b",
};

const SENT_COLORS = {
  POSITIVE: "#81b29a",
  NEGATIVE: "#e07a5f",
  NEUTRAL:  "#9ca3af",
};

const PRESETS = [
  ["ozempic", "semaglutide", "weight loss"],
  ["metformin", "diabetes", "side effects"],
  ["humira", "adalimumab", "inflammation"],
  ["gabapentin", "neuropathy", "pain"],
  ["adderall", "adhd", "medication"],
];

const ALL_SOURCES = [
  { id: "reddit",  label: "Reddit",     sub: "via Apify actor" },
  { id: "twitter", label: "Twitter / X",sub: "via Apify actor" },
  { id: "quora",   label: "Quora",      sub: "rich mock data"  },
  { id: "forum",   label: "Forums",     sub: "rich mock data"  },
];

export default function Scan() {
  const navigate = useNavigate();
  const [keywords, setKeywords]       = useState("ozempic, semaglutide, weight loss");
  const [sources, setSources]         = useState(["reddit"]);
  const [limit, setLimit]             = useState(25);
  const [phase, setPhase]             = useState("idle");
  const [activeIdx, setActiveIdx]     = useState(-1);
  const [doneSteps, setDoneSteps]     = useState([]);
  const [results, setResults]         = useState(null);
  const abortRef = useRef(false);

  const toggleSource = (id) =>
    setSources((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const runScan = async () => {
    if (!keywords.trim()) return toast.error("Enter at least one keyword");
    if (!sources.length)  return toast.error("Select at least one source");

    abortRef.current = false;
    setPhase("running");
    setActiveIdx(0);
    setDoneSteps([]);
    setResults(null);

    const DELAYS = [0, 1200, 2400, 3600, 4800, 6000];

    const [, data] = await Promise.all([
      // animate steps
      (async () => {
        for (let i = 0; i < PIPELINE_STEPS.length; i++) {
          if (abortRef.current) return;
          if (i > 0) await new Promise((r) => setTimeout(r, DELAYS[i] - DELAYS[i - 1]));
          setActiveIdx(i);
        }
      })(),
      // real API call
      (async () => {
        try {
          const kwList = keywords.split(",").map((k) => k.trim()).filter(Boolean);
          return await scanNow({ keywords: kwList, sources, limit_per_source: limit, force_llm: false });
        } catch (e) {
          return null;
        }
      })(),
    ]);

    if (!data || !data.success) {
      setPhase("error");
      return toast.error("Scan failed — check backend logs");
    }

    setDoneSteps(data.pipeline_steps || []);
    setActiveIdx(-1);
    setResults(data);
    setPhase("done");
    toast.success(`Scan complete — ${data.processed} posts processed`);
  };

  const reset = () => {
    abortRef.current = true;
    setPhase("idle");
    setActiveIdx(-1);
    setDoneSteps([]);
    setResults(null);
  };

  const sigData  = results ? Object.entries(results.summary?.signal_distribution  || {}).map(([name, value]) => ({ name, value })) : [];
  const sentData = results ? Object.entries(results.summary?.sentiment_distribution|| {}).map(([name, value]) => ({ name, value, fill: SENT_COLORS[name] || "#ccc" })) : [];
  const drugData = results ? (results.summary?.top_drugs || []).map(([drug, count]) => ({ drug, count })).slice(0, 8) : [];

  return (
    <div className="min-h-screen bg-[#f9f8f6]">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">live intelligence</div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Live Scan</h1>
          <p className="text-slate-500 text-sm mt-1">
            Crawl Reddit, Twitter & Quora in real time → run the full NLP pipeline → get risk alerts instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Config ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Keywords */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <label className="block text-xs uppercase tracking-widest font-semibold text-slate-400 mb-3">Keywords</label>
              <textarea
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#2b4c59]/30 text-slate-800 placeholder:text-slate-400"
                rows={3}
                placeholder="ozempic, side effects, nausea…"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={phase === "running"}
              />
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Quick presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setKeywords(p.join(", "))}
                      disabled={phase === "running"}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full transition-colors disabled:opacity-40"
                    >
                      {p[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sources */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <label className="block text-xs uppercase tracking-widest font-semibold text-slate-400 mb-3">Data Sources</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SOURCES.map(({ id, label, sub }) => (
                  <button
                    key={id}
                    onClick={() => toggleSource(id)}
                    disabled={phase === "running"}
                    className={`flex flex-col items-start p-3 rounded-md border text-left transition-all disabled:opacity-40 ${
                      sources.includes(id) ? "border-[#2b4c59] bg-[#2b4c5908]" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Limit slider */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <label className="block text-xs uppercase tracking-widest font-semibold text-slate-400 mb-3">
                Posts per source: <span className="text-[#2b4c59] font-bold">{limit}</span>
              </label>
              <input
                type="range" min={5} max={50} step={5} value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={phase === "running"}
                className="w-full accent-[#2b4c59]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5 (fast)</span><span>50 (thorough)</span>
              </div>
            </div>

            {/* Action buttons */}
            {phase === "idle" && (
              <button
                onClick={runScan}
                className="w-full bg-[#2b4c59] text-white h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1e3540] transition-colors"
              >
                <ScanSearch className="w-4 h-4" /> Start Live Scan
              </button>
            )}
            {phase === "running" && (
              <button disabled className="w-full h-11 rounded-lg text-sm border border-slate-200 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Scanning…
              </button>
            )}
            {(phase === "done" || phase === "error") && (
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 h-11 rounded-lg text-sm border border-slate-200 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                  <RefreshCcw className="w-4 h-4" /> New Scan
                </button>
                <button onClick={() => navigate("/dashboard")} className="flex-1 h-11 rounded-lg bg-[#2b4c59] text-white text-sm flex items-center justify-center gap-1 hover:bg-[#1e3540] transition-colors">
                  Dashboard <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Pipeline ── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-[#2b4c59]" />
                <h2 className="font-semibold text-slate-800">NLP Pipeline</h2>
                {phase === "running" && (
                  <span className="ml-auto text-[10px] bg-[#e07a5f] text-white px-2 py-0.5 rounded-full animate-pulse">live</span>
                )}
                {phase === "done" && (
                  <span className="ml-auto text-[10px] bg-[#81b29a] text-white px-2 py-0.5 rounded-full">complete</span>
                )}
              </div>

              <div className="space-y-2">
                {PIPELINE_STEPS.map((cfg, idx) => {
                  const isActive = phase === "running" && activeIdx === idx;
                  const isDone   = doneSteps.find((s) => s.step === cfg.key);
                  const isPending = !isDone && !(phase === "running" && idx <= activeIdx);
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={cfg.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        isActive  ? "border-[#2b4c59] bg-[#2b4c5906] shadow-sm" :
                        isDone    ? "border-slate-200 bg-white" :
                                    "border-slate-100 bg-slate-50 opacity-40"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                           style={{ background: cfg.bg, color: cfg.color }}>
                        {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                         isDone   ? <CheckCircle className="w-4 h-4 text-[#81b29a]" /> :
                                    <Icon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{cfg.key}</span>
                          {isDone && isDone.count !== undefined && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {isDone.count} found
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {isDone?.detail || cfg.description}
                        </p>
                      </div>
                      {isActive && (
                        <span className="text-[10px] bg-[#2b4c59] text-white px-2 py-0.5 rounded-full shrink-0 mt-1">running</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            {phase === "done" && results && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Posts crawled",    value: results.crawled,              color: "#2b4c59" },
                  { label: "Processed",        value: results.processed,            color: "#6366f1" },
                  { label: "Alerts generated", value: results.alerts?.length || 0,  color: "#e07a5f" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-lg border border-slate-200 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Charts ── */}
        {phase === "done" && results && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Signal pie */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-1">Signal distribution</h3>
              <p className="text-xs text-slate-400 mb-4">What the pipeline found</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={sigData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
                       label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {sigData.map((e) => <Cell key={e.name} fill={SIGNAL_COLORS[e.name] || "#ccc"} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {sigData.map((s) => (
                  <span key={s.name} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: SIGNAL_COLORS[s.name] || "#ccc" }} />
                    {s.name.replace(/_/g, " ")} ({s.value})
                  </span>
                ))}
              </div>
            </div>

            {/* Sentiment bar */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-1">Sentiment breakdown</h3>
              <p className="text-xs text-slate-400 mb-4">Across all scanned posts</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={sentData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sentData.map((e) => <Cell key={e.name} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top drugs */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-1">Top drugs detected</h3>
              <p className="text-xs text-slate-400 mb-4">By mention count in this scan</p>
              {drugData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-300 text-sm gap-2">
                  <Pill className="w-5 h-5" /> No drugs detected
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={drugData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ec" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="drug" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2b4c59" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ── Alerts ── */}
        {phase === "done" && results?.alerts?.length > 0 && (
          <div>
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#e07a5f]" />
              Alerts Generated ({results.alerts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.alerts.map((alert, i) => {
                const sevStyle = {
                  critical: "bg-red-100 text-red-700 border-red-200",
                  high:     "bg-orange-100 text-orange-700 border-orange-200",
                  medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
                }[alert.severity] || "bg-slate-100 text-slate-600";
                return (
                  <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm capitalize">
                          {alert.drugs?.join(", ") || "Unknown drug"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{alert.signal_type?.replace(/_/g, " ")}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${sevStyle}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-2">{alert.preview}</p>
                    {alert.symptoms?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {alert.symptoms.slice(0, 3).map((s) => (
                          <span key={s} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-slate-400 capitalize">{alert.source}</span>
                      <span className="text-[10px] text-slate-400">conf {(alert.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Posts feed ── */}
        {phase === "done" && results?.posts?.length > 0 && (
          <div>
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-slate-400" />
              Processed Posts ({results.posts.length})
            </h2>
            <div className="space-y-3">
              {results.posts.map((post) => (
                <div key={post.post_id} className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: `${SIGNAL_COLORS[post.signal_type]}22`, color: SIGNAL_COLORS[post.signal_type] || "#555" }}>
                          {post.signal_type?.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">{post.source}</span>
                        {post.has_pii && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">PII redacted</span>
                        )}
                        {post.drugs?.map((d) => (
                          <span key={d} className="text-[10px] bg-[#2b4c59]/10 text-[#2b4c59] px-2 py-0.5 rounded-full capitalize">{d}</span>
                        ))}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed line-clamp-2">{post.preview}</p>
                      {post.reasoning && (
                        <p className="text-[11px] text-slate-400 mt-1 italic">"{post.reasoning}"</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        post.sentiment === "POSITIVE" ? "bg-green-100 text-green-700" :
                        post.sentiment === "NEGATIVE" ? "bg-red-100 text-red-700" :
                                                         "bg-slate-100 text-slate-500"}`}>
                        {post.sentiment}
                      </span>
                      <span className="text-[10px] text-slate-400">conf {(post.confidence * 100).toFixed(0)}%</span>
                      {post.url && post.url !== "#" && (
                        <a href={post.url} target="_blank" rel="noopener noreferrer"
                           className="text-[10px] text-slate-400 hover:text-[#2b4c59] flex items-center gap-0.5">
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {phase === "idle" && (
          <div className="rounded-lg border border-dashed border-slate-200 p-16 text-center">
            <ScanSearch className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-medium">Configure your scan and click Start</p>
            <p className="text-slate-400 text-xs mt-1">Posts will be crawled and run through the full NLP pipeline</p>
          </div>
        )}

      </div>
    </div>
  );
}