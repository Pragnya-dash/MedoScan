"""Generate insight narratives for alerts.

Uses deterministic templates over the aggregated NLP signals so no external
API keys are required. Produces varied, contextual narratives that read
naturally.
"""
from __future__ import annotations

import logging
import random

logger = logging.getLogger(__name__)


SEVERITY_WORDS = {
    "ADVERSE_EVENT": ["serious", "concerning", "high-severity", "potentially harmful"],
    "TREATMENT_FAILURE": ["loss-of-efficacy", "breakthrough", "treatment-failure"],
    "SIDE_EFFECT": ["side-effect", "tolerability", "adherence-impacting"],
}

TREND_PHRASES = {
    "spike": [
        "shows a {pct}% spike vs the prior window",
        "is trending sharply up ({pct}% increase)",
        "has surged {pct}% over the last comparable period",
        "is accelerating ({pct}% week-over-week)",
    ],
    "rise": [
        "is up {pct}% versus the prior window",
        "shows a {pct}% increase from baseline",
        "has climbed {pct}% over the prior period",
    ],
    "new": [
        "is a new emerging signal with no prior baseline",
        "has surfaced as a fresh signal in this window",
        "appears for the first time in the comparable window",
    ],
    "flat": [
        "is holding steady against the prior window",
        "remains roughly flat versus the previous period",
    ],
    "drop": [
        "is down {pct}% from the prior window — recovery trend",
        "has eased by {pct}% over the prior period",
    ],
}

CALL_TO_ACTION = {
    "ADVERSE_EVENT": [
        "Recommend immediate pharmacovigilance review.",
        "Flag for clinical safety committee.",
        "Worth escalating to the medical safety officer.",
        "Consider expedited individual case safety report (ICSR) review.",
    ],
    "TREATMENT_FAILURE": [
        "Investigate dosing adherence and possible resistance patterns.",
        "Worth correlating with batch / formulation data.",
        "Consider therapeutic switch protocols and supply continuity.",
    ],
    "SIDE_EFFECT": [
        "Monitor for adherence drop-off in the next window.",
        "Consider patient-education updates on tolerability.",
        "Track whether symptoms cluster with specific dosage tiers.",
    ],
}


def _trend_bucket(delta_pct: float | None) -> str:
    if delta_pct is None:
        return "new"
    if delta_pct >= 75:
        return "spike"
    if delta_pct > 0:
        return "rise"
    if delta_pct == 0:
        return "flat"
    return "drop"


def _humanize_signal(sig: str) -> str:
    return {
        "ADVERSE_EVENT": "adverse event",
        "TREATMENT_FAILURE": "treatment-failure",
        "SIDE_EFFECT": "side-effect",
    }.get(sig, sig.lower().replace("_", " "))


async def generate_narrative(drug: str, signal_type: str, count: int, prev_count: int,
                             delta_pct: float | None, top_symptoms: list[str],
                             sample_excerpts: list[str], api_key: str = "") -> str:
    """Compose a 1-2 sentence pharmacovigilance insight from the aggregated data.

    `api_key` and `sample_excerpts` are accepted for interface compatibility but
    not used — narratives are built deterministically from structured signals.
    """
    rng = random.Random(f"{drug}|{signal_type}|{count}|{delta_pct}")

    bucket = _trend_bucket(delta_pct)
    trend_template = rng.choice(TREND_PHRASES[bucket])
    trend = trend_template.format(pct=int(abs(delta_pct)) if delta_pct is not None else 0)

    severity_word = rng.choice(SEVERITY_WORDS.get(signal_type, ["notable"]))
    sig_label = _humanize_signal(signal_type)

    drug_disp = drug.title()

    if top_symptoms:
        sym_list = ", ".join(top_symptoms[:3])
        symptom_clause = f" Top reported symptoms: {sym_list}."
    else:
        symptom_clause = " No specific symptom cluster has emerged yet."

    cta = rng.choice(CALL_TO_ACTION.get(signal_type, ["Worth a closer look."]))

    base = (
        f"{drug_disp} {trend} with {count} {severity_word} {sig_label} report"
        f"{'s' if count != 1 else ''} ({prev_count} in the prior window)."
    )
    return f"{base}{symptom_clause} {cta}"
