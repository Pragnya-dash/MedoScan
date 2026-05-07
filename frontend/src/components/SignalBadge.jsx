const LABELS = {
  ADVERSE_EVENT: "Adverse event",
  SIDE_EFFECT: "Side effect",
  TREATMENT_FAILURE: "Treatment failure",
  POSITIVE_OUTCOME: "Positive outcome",
  GENERAL: "General",
};

export default function SignalBadge({ type, className = "" }) {
  const t = type || "GENERAL";
  return (
    <span className={`signal-chip signal-chip-${t} ${className}`} data-testid={`signal-badge-${t}`}>
      <span className={`dot dot-${t}`} /> {LABELS[t] || t}
    </span>
  );
}
