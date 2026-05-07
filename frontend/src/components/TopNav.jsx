import { Link, useLocation } from "react-router-dom";
import { Gauge, Sparkles, Siren, Brain, TrendingUp, BarChart3, ShieldCheck } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/insights", label: "AI Insights", icon: Brain },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/safety", label: "Safety", icon: ShieldCheck },
  { to: "/alerts", label: "Alerts", icon: Siren },
  { to: "/analyze", label: "Analyze", icon: Sparkles },
];

export default function TopNav() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/75 border-b border-[#e5e7eb]" data-testid="top-nav">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" data-testid="brand-home-link">
          <div className="w-10 h-10 rounded-md flex items-center justify-center overflow-hidden bg-[#f3f1ec] border border-[#e5dccf]">
            <img
              src="/medoscan-logo.jpeg"
              alt="MedoScan"
              className="w-full h-full object-cover"
              style={{ mixBlendMode: "multiply" }}
            />
          </div>
          <div className="leading-tight">
            <div className="font-display font-extrabold text-lg tracking-tight">MedoScan</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 -mt-0.5">Patient Driven Insights</div>
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 ml-2 text-xs text-slate-500">
            <span className="relative text-[#81b29a] pulse-dot"><span className="dot" style={{ background: "#81b29a" }} /></span>
            live signals
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}-link`}
                className={`px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#2b4c59] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
