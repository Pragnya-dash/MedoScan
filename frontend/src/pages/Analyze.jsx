import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";

import TopNav from "@/components/TopNav";
import SignalBadge from "@/components/SignalBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { analyzeText } from "@/lib/api";

const EXAMPLES = [
  "I started Metformin 500mg and Lisinopril last week. Since then I've had constant dizziness and a weird metallic taste.",
  "Ozempic is making me so sick. Constant vomiting for 3 days straight. Is this a normal side effect or should I go to the ER??",
  "After trying 5 different meds, Jardiance is finally working for my blood sugar with zero side effects. I feel great and have so much more energy now!",
  "Please be careful with Gabapentin. My brother started it for nerve pain and began having suicidal thoughts within 48 hours.",
];

export default function Analyze() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("manual");
  const [forceLLM, setForceLLM] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text");
      return;
    }
    setLoading(true);
    try {
      const r = await analyzeText({ text, title, source, force_llm: forceLLM });
      setResult(r);
      toast.success(`Classified as ${r.signal_type.replace("_", " ").toLowerCase()}`);
    } catch (e) {
      toast.error("Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">analyze</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight">Submit a post for NLP analysis</h1>
          <p className="text-slate-600 mt-2 text-sm">
            Rule-based NLP + Claude Sonnet 4.5 fallback · drugs, symptoms, sentiment, signal classification and PII redaction in one call.
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">source</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger data-testid="analyze-source-select" className="rounded-md"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="twitter">Twitter / X</SelectItem>
                    <SelectItem value="quora">Quora</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-[#f9f8f6] rounded-md px-3 border border-slate-200">
                  <input
                    id="force-llm" type="checkbox" checked={forceLLM} onChange={(e) => setForceLLM(e.target.checked)}
                    className="rounded" data-testid="analyze-force-llm-checkbox"
                  />
                  <label htmlFor="force-llm">Force Claude reasoning</label>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">title (optional)</label>
              <Input
                data-testid="analyze-title-input"
                value={title} onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 rounded-md" placeholder="e.g. Started new medication"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">post text</label>
              <Textarea
                data-testid="analyze-text-input"
                value={text} onChange={(e) => setText(e.target.value)}
                className="mt-1.5 rounded-md min-h-[180px] font-mono text-[13px] leading-relaxed"
                placeholder="Paste a patient post, tweet, or forum comment…"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setText(ex)}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-200 bg-[#f9f8f6] hover:bg-white text-slate-600"
                    data-testid={`analyze-example-${i}`}
                  >
                    example {i + 1}
                  </button>
                ))}
              </div>
              <Button
                data-testid="analyze-submit-btn"
                onClick={run} disabled={loading}
                className="bg-[#e07a5f] hover:bg-[#c9664d] text-white h-10 rounded-md"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                Analyze
              </Button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          <div className="sticky top-20">
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#2b4c59]">result</div>
            {!result && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/60 p-8 text-sm text-slate-500">
                Submit a post to see extracted drugs, symptoms, sentiment, PII and Claude reasoning.
              </div>
            )}
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4" data-testid="analyze-result">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <SignalBadge type={result.signal_type} />
                    <span className="text-xs text-slate-500 mono">confidence {result.confidence?.toFixed(2)}</span>
                  </div>
                  <div className="mt-4 text-sm text-slate-800 bg-[#f3f1ec] rounded-md p-3">
                    <span className="text-slate-500 text-xs uppercase tracking-[0.18em] mr-2">reasoning</span>
                    {result.reasoning}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <Mini label="sentiment" value={result.sentiment} />
                    <Mini label="pii" value={result.has_pii ? "detected" : "none"} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="font-display font-semibold text-sm">Entities</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(result.entities || []).map((e, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-md capitalize border ${
                          e.label === "DRUG"
                            ? "bg-[#2b4c59]/8 text-[#2b4c59] border-[#2b4c59]/20"
                            : "bg-[#e07a5f]/10 text-[#b24a2f] border-[#e07a5f]/30"
                        }`}
                      >
                        {e.text} · {e.label.toLowerCase()}
                      </span>
                    ))}
                    {(!result.entities || result.entities.length === 0) && (
                      <span className="text-xs text-slate-500">No entities detected</span>
                    )}
                  </div>
                </div>

                {result.full_result?.pii?.redacted_text && result.has_pii && (
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="font-display font-semibold text-sm">Redacted text</div>
                    <div className="mt-2 text-sm font-mono text-slate-700 bg-[#f3f1ec] rounded-md p-3 leading-relaxed">
                      {result.full_result.pii.redacted_text}
                    </div>
                  </div>
                )}

                <a
                  href={`/posts/${result.post_id}`}
                  className="inline-flex items-center text-sm text-[#e07a5f] hover:underline"
                  data-testid="analyze-open-full"
                >
                  Open full analysis <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[#f9f8f6] p-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="font-display font-semibold">{value}</div>
    </div>
  );
}
