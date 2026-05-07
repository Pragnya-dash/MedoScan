import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink } from "lucide-react";

import TopNav from "@/components/TopNav";
import SignalBadge from "@/components/SignalBadge";
import { fetchPost } from "@/lib/api";

export default function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetchPost(id).then(setPost).catch(() => setErr("Post not found"));
  }, [id]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800" data-testid="post-back-link">
          <ArrowLeft className="w-4 h-4 mr-1" /> back to dashboard
        </Link>

        {err && <div className="mt-6 text-red-600">{err}</div>}
        {!post && !err && <div className="mt-6 text-slate-500 text-sm">Loading…</div>}

        {post && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <SignalBadge type={post.adverse_event.signal_type} />
                  <span className="text-xs text-slate-500 mono uppercase">{post.source}</span>
                  <span className="text-xs text-slate-400">{new Date(post.collected_at).toLocaleString()}</span>
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noreferrer" className="text-xs text-[#2b4c59] inline-flex items-center gap-1 hover:underline">
                      <ExternalLink className="w-3 h-3" /> source
                    </a>
                  )}
                </div>
                <div className="mt-4 font-display text-xl font-semibold">Raw text</div>
                <p className="mt-2 text-slate-800 leading-relaxed whitespace-pre-line">{post.raw_text}</p>

                {post.pii.has_pii && (
                  <div className="mt-5">
                    <div className="font-display font-semibold text-sm">Redacted (as stored)</div>
                    <div className="mt-2 text-sm font-mono text-slate-700 bg-[#f3f1ec] rounded-md p-3 leading-relaxed">
                      {post.pii.redacted_text}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="font-display font-semibold">AI reasoning</div>
                <div className="text-xs text-slate-500 mt-0.5">classified by {post.adverse_event.classified_by}</div>
                <div className="mt-3 text-sm text-slate-800 bg-[#f3f1ec] rounded-md p-4 leading-relaxed">
                  {post.adverse_event.reasoning}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <Stat label="confidence" value={post.adverse_event.confidence?.toFixed(2)} />
                  <Stat label="sentiment" value={post.sentiment.label} />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="font-display font-semibold">Drugs implicated</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.adverse_event.drugs_implicated.length === 0 && <span className="text-sm text-slate-500">—</span>}
                  {post.adverse_event.drugs_implicated.map((d) => (
                    <span key={d} className="text-xs px-2 py-0.5 rounded-md capitalize border bg-[#2b4c59]/8 text-[#2b4c59] border-[#2b4c59]/20">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="font-display font-semibold mt-5">Symptoms reported</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.adverse_event.symptoms_reported.length === 0 && <span className="text-sm text-slate-500">—</span>}
                  {post.adverse_event.symptoms_reported.map((d) => (
                    <span key={d} className="text-xs px-2 py-0.5 rounded-md capitalize border bg-[#e07a5f]/10 text-[#b24a2f] border-[#e07a5f]/30">
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="font-display font-semibold">Sentiment scores</div>
                <div className="mt-3 space-y-2">
                  {Object.entries(post.sentiment.raw_scores).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">{k.toLowerCase()}</span>
                        <span className="mono">{(v * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full"
                          style={{
                            width: `${v * 100}%`,
                            background: k === "POSITIVE" ? "#81b29a" : k === "NEGATIVE" ? "#e07a5f" : "#9ca3af",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[#f9f8f6] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="font-display font-semibold mt-0.5">{value}</div>
    </div>
  );
}
