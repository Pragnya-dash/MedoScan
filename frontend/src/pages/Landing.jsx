import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, ShieldAlert, Brain, Sparkles, TrendingUp, Globe2, ArrowRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopNav from "@/components/TopNav";
import SignalBadge from "@/components/SignalBadge";

const STATS = [
  { label: "signals/hour", value: "12.4k" },
  { label: "drugs tracked", value: "2,300+" },
  { label: "sources", value: "Reddit · X · Quora · Forums" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "Biomedical NLP",
    desc: "Lexicon-first entity recognition for drugs & symptoms, Claude Sonnet 4.5 for nuanced reasoning.",
    accent: "#2b4c59",
  },
  {
    icon: ShieldAlert,
    title: "Adverse event detection",
    desc: "Classifies each post into ADR, side effect, treatment failure, positive outcome or general.",
    accent: "#e07a5f",
  },
  {
    icon: TrendingUp,
    title: "Anomaly & trend surfacing",
    desc: "Spot spikes of negative sentiment per drug before official pharmacovigilance channels.",
    accent: "#81b29a",
  },
  {
    icon: ShieldAlert,
    title: "Built-in PII redaction",
    desc: "Patient names, emails, phone numbers are automatically detected and masked before storage.",
    accent: "#3d405b",
  },
];

const PERSONAS = [
  { title: "Hospitals", body: "Monitor patient feedback on prescribed medications in real time." },
  { title: "Pharma R&D", body: "Track drug safety, side-effect velocity, and post-market perception." },
  { title: "Researchers", body: "Study patient behaviour, therapy adherence, and treatment impact." },
  { title: "Health authorities", body: "Early-detection layer for emerging public health risks." },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <TopNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-70 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #81b29a, transparent 70%)" }} />
        <div className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #e07a5f, transparent 70%)" }} />

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 backdrop-blur px-3 py-1.5 text-xs text-slate-600"
            data-testid="hero-tag"
          >
            <Radio className="w-3.5 h-3.5 text-[#e07a5f]" />
            Real-time pharmacovigilance from patient voices
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-4xl leading-[1.05]"
            data-testid="hero-heading"
          >
            The early-warning layer for <span className="text-[#e07a5f]">medicine in the wild</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 text-lg text-slate-600 max-w-2xl"
          >
            MedoScan listens to Reddit, X, Quora and patient forums, extracts drugs & symptoms, and uses Claude
            Sonnet 4.5 to detect adverse events and treatment failures — hours to days before hospital reports surface.
          </motion.p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/dashboard">
              <Button data-testid="hero-open-dashboard" className="bg-[#2b4c59] hover:bg-[#1e353e] text-white h-11 px-5 rounded-md">
                Open live dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link to="/analyze">
              <Button data-testid="hero-analyze-btn" variant="outline" className="h-11 px-5 rounded-md border-slate-300">
                <Sparkles className="w-4 h-4 mr-1.5" /> Analyze a post
              </Button>
            </Link>
          </div>

          {/* Floating demo card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-14 grid grid-cols-12 gap-6"
          >
            <div className="col-span-12 lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 noise-overlay">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="dot dot-ADVERSE_EVENT pulse-dot text-[#e07a5f]" />
                  incoming signal · 12 seconds ago · reddit
                </div>
                <SignalBadge type="ADVERSE_EVENT" />
              </div>
              <p className="mt-4 text-slate-800 font-medium leading-relaxed">
                "Please be careful with <mark className="bg-[#f2cc8f]/60 rounded px-1">Gabapentin</mark>. My brother
                started it for nerve pain and began having <mark className="bg-[#e5989b]/50 rounded px-1">suicidal thoughts</mark>
                &nbsp;within 48 hours. Hospitalized last week."
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                <Kpi label="sentiment" value="Negative" accent="#e07a5f" />
                <Kpi label="pii" value="1 email redacted" accent="#2b4c59" />
                <Kpi label="confidence" value="0.91" accent="#3d405b" />
              </div>
              <div className="mt-5 rounded-md bg-[#f3f1ec] px-4 py-3 text-sm text-slate-700 font-mono">
                <span className="text-slate-500 mr-2">reasoning →</span>
                Post explicitly mentions suicidal ideation and hospitalisation after drug initiation. Classic ADR.
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 rounded-lg border border-slate-200 bg-[#2b4c59] text-white p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(#ffffff22 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.2em] text-white/60">trending drugs · 24h</div>
                <div className="mt-4 space-y-3">
                  {[
                    { d: "Ozempic", s: "ADVERSE_EVENT", v: 42 },
                    { d: "Humira", s: "TREATMENT_FAILURE", v: 18 },
                    { d: "Gabapentin", s: "ADVERSE_EVENT", v: 11 },
                    { d: "Jardiance", s: "POSITIVE_OUTCOME", v: 27 },
                  ].map((row) => (
                    <div key={row.d} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`dot dot-${row.s}`} />
                        <span className="font-display font-semibold">{row.d}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 rounded-full bg-white/20 overflow-hidden">
                          <div className="h-full bg-[#e07a5f]" style={{ width: `${Math.min(100, row.v * 2)}%` }} />
                        </div>
                        <span className="mono text-sm">{row.v}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* stats strip */}
          <div className="mt-14 flex flex-wrap gap-x-10 gap-y-3 text-sm text-slate-600">
            {STATS.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <span className="font-display font-bold text-slate-900 text-xl">{s.value}</span>
                <span className="uppercase tracking-[0.18em] text-xs text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-[#e07a5f]">the platform</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">
            An entire pharmacovigilance stack, distilled.
          </h2>
          <p className="mt-4 text-slate-600">
            From unstructured posts to structured signals in under 2 seconds — with redaction, reasoning and audit trail.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, accent }) => (
            <motion.div
              key={title}
              whileHover={{ y: -3 }}
              className="rounded-lg border border-slate-200 bg-white p-6 transition-shadow hover:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.15)]"
            >
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
                <Icon className="w-4.5 h-4.5" strokeWidth={2} />
              </div>
              <div className="font-display font-semibold mt-4">{title}</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="bg-[#f3f1ec] border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <span className="text-xs uppercase tracking-[0.2em] font-semibold text-[#2b4c59]">who uses it</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 leading-tight">
              For everyone who has to <em>answer</em> for a medicine.
            </h2>
          </div>
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {PERSONAS.map((p) => (
              <div key={p.title} className="rounded-lg bg-white border border-slate-200 p-6">
                <Globe2 className="w-4 h-4 text-[#81b29a]" />
                <div className="font-display font-semibold mt-3">{p.title}</div>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="rounded-lg bg-[#1a1b25] text-white p-10 md:p-14 relative overflow-hidden">
          <div className="absolute inset-0 grid-pattern opacity-10" />
          <div className="relative grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                See what patients are really saying about your drugs — <span className="text-[#e07a5f]">today.</span>
              </h2>
              <p className="mt-4 text-white/70 leading-relaxed">
                Launch the live dashboard with 15 pre-loaded posts across Reddit, X, Quora and forums, or paste your own.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/dashboard">
                  <Button data-testid="cta-open-dashboard" className="bg-[#e07a5f] hover:bg-[#c9664d] text-white h-11 px-5 rounded-md">
                    <Activity className="w-4 h-4 mr-1.5" /> Open dashboard
                  </Button>
                </Link>
                <Link to="/analyze">
                  <Button data-testid="cta-analyze" variant="outline" className="h-11 px-5 rounded-md bg-transparent border-white/30 text-white hover:bg-white/10">
                    <Sparkles className="w-4 h-4 mr-1.5" /> Try an analysis
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["ADVERSE_EVENT","SIDE_EFFECT","TREATMENT_FAILURE","POSITIVE_OUTCOME"].map((t) => (
                <div key={t} className="rounded-md bg-white/5 border border-white/10 p-4">
                  <SignalBadge type={t} />
                  <div className="mt-3 font-display font-semibold">{t.replace("_", " ").toLowerCase()}</div>
                  <div className="text-xs text-white/60 mt-1">color-coded signal class</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-10 text-sm text-slate-500 flex flex-wrap justify-between gap-3 border-t border-slate-200">
        <div>© MedoScan · Built for healthcare intelligence.</div>
        <div className="mono">Claude Sonnet 4.5 · MongoDB · FastAPI · React</div>
      </footer>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[#f9f8f6] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="font-display font-semibold mt-0.5" style={{ color: accent }}>{value}</div>
    </div>
  );
}
