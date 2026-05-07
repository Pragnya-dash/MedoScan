import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function DeltaChip({ value, className = "" }) {
  if (value === null || value === undefined) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold text-slate-400 ${className}`}>
        <Minus className="w-3 h-3" /> baseline
      </span>
    );
  }
  const v = Number(value);
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-500 bg-slate-100" : up ? "text-[#b24a2f] bg-[#e07a5f]/12" : "text-[#3d6b53] bg-[#81b29a]/15";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-0.5 ${color} ${className}`} data-testid="delta-chip">
      <Icon className="w-3 h-3" />
      {up ? "+" : ""}{v.toFixed(0)}%
    </span>
  );
}
