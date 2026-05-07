"""Hybrid NLP pipeline for MedoScan.

Approach: lightweight rule-based pre-processing + Claude LLM fallback for
adverse-event reasoning.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lexicons
# ---------------------------------------------------------------------------
DRUG_LEXICON = [
    "metformin", "lisinopril", "ozempic", "humira", "gabapentin",
    "jardiance", "ibuprofen", "atorvastatin", "aspirin", "warfarin",
    "prozac", "zoloft", "xanax", "adderall", "oxycodone", "tylenol",
    "paracetamol", "amoxicillin", "prednisone", "insulin", "wegovy",
    "mounjaro", "rybelsus", "trulicity", "januvia", "synthroid",
    "levothyroxine", "losartan", "amlodipine", "omeprazole", "sertraline",
    "escitalopram", "fluoxetine", "duloxetine", "lipitor", "crestor",
    "keppra", "lyrica", "cymbalta", "viagra", "cialis", "plavix",
]

SYMPTOM_LEXICON = [
    "nausea", "vomiting", "dizziness", "headache", "fatigue", "rash",
    "itching", "swelling", "diarrhea", "constipation", "insomnia",
    "drowsiness", "anxiety", "depression", "suicidal thoughts",
    "suicidal", "chest pain", "shortness of breath", "breakout",
    "hives", "weight gain", "weight loss", "hair loss", "dry mouth",
    "metallic taste", "blurred vision", "joint pain", "muscle pain",
    "cramps", "bloating", "heartburn", "palpitations", "fever",
    "cough", "sore throat", "tremor", "seizure", "confusion",
    "memory loss", "numbness", "tingling", "itch",
]

NEGATIVE_TERMS = [
    "sick", "worse", "terrible", "awful", "horrible", "nightmare",
    "stopped working", "doesn't work", "not working", "failed",
    "hate", "dangerous", "scared", "worried", "painful", "severe",
    "unbearable", "suffering", "ruined", "hospital", "er",
]

POSITIVE_TERMS = [
    "working", "amazing", "great", "wonderful", "love", "relief",
    "better", "improved", "energy", "thankful", "grateful",
    "life changing", "life-changing", "best", "perfect", "zero side effects",
    "no side effects", "no issues", "game changer", "game-changer",
    "kept", "worth it", "finally working", "down ", "lost ",
]

ADVERSE_KEYWORDS = [
    r"\bsuicidal\b", r"\boverdose\b", r"\bhospital\b", r"\bhospitalized\b",
    r"\bemergency room\b", r"\bgo to the er\b", r"\ban? er\b",
    r"\bsevere\b", r"\bdangerous\b", r"\blife[- ]threatening\b",
    r"\bdied\b", r"\bdeath\b", r"\ballergic reaction\b",
    r"\banaphylaxis\b", r"\bseizure\b", r"\brushed to\b",
]

FAILURE_KEYWORDS = [
    r"\bstopped working\b", r"\bnot working\b", r"\bdoesn'?t work\b",
    r"\bno longer\b", r"\brelapse\b", r"\bfailed\b", r"\bresistant\b",
    r"\bbreakthrough\b",
]

# ---------------------------------------------------------------------------
# Cleaning & PII
# ---------------------------------------------------------------------------
URL_RE = re.compile(r"https?://\S+|www\.\S+")
EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
MENTION_RE = re.compile(r"(?<![A-Za-z0-9_.+-])@[A-Za-z0-9_]+")
WHITESPACE_RE = re.compile(r"\s+")


def clean_text(raw: str) -> str:
    text = URL_RE.sub(" ", raw)
    text = MENTION_RE.sub(" ", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def detect_pii(text: str) -> dict[str, Any]:
    spans: list[dict[str, Any]] = []
    redacted = text

    for m in EMAIL_RE.finditer(text):
        spans.append({
            "text": m.group(), "pii_type": "EMAIL_ADDRESS",
            "start": m.start(), "end": m.end(), "score": 0.99,
        })
    for m in PHONE_RE.finditer(text):
        spans.append({
            "text": m.group(), "pii_type": "PHONE_NUMBER",
            "start": m.start(), "end": m.end(), "score": 0.95,
        })

    # simple person name heuristic: "my name is X" or "I'm X"
    name_re = re.compile(r"\b(?:my name is|i'?m|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", re.IGNORECASE)
    for m in name_re.finditer(text):
        spans.append({
            "text": m.group(1), "pii_type": "PERSON",
            "start": m.start(1), "end": m.end(1), "score": 0.7,
        })

    # redact
    for s in sorted(spans, key=lambda x: x["start"], reverse=True):
        redacted = redacted[: s["start"]] + f"<{s['pii_type']}>" + redacted[s["end"] :]

    return {
        "has_pii": len(spans) > 0,
        "spans": spans,
        "redacted_text": redacted if spans else text,
    }


# ---------------------------------------------------------------------------
# Entity extraction
# ---------------------------------------------------------------------------
def extract_entities(text: str) -> list[dict[str, Any]]:
    entities: list[dict[str, Any]] = []
    lower = text.lower()

    for drug in DRUG_LEXICON:
        for m in re.finditer(rf"\b{re.escape(drug)}\b", lower):
            entities.append({
                "text": text[m.start(): m.end()],
                "label": "DRUG",
                "start": m.start(),
                "end": m.end(),
                "confidence": 0.92,
                "source_model": "medoscan-lexicon",
            })

    for sym in SYMPTOM_LEXICON:
        for m in re.finditer(rf"\b{re.escape(sym)}\b", lower):
            entities.append({
                "text": text[m.start(): m.end()],
                "label": "SYMPTOM",
                "start": m.start(),
                "end": m.end(),
                "confidence": 0.80,
                "source_model": "medoscan-lexicon",
            })
    return entities


# ---------------------------------------------------------------------------
# Sentiment (lightweight rule-based)
# ---------------------------------------------------------------------------
def analyze_sentiment(text: str) -> dict[str, Any]:
    lower = text.lower()
    neg = sum(1 for t in NEGATIVE_TERMS if t in lower)
    pos = sum(1 for t in POSITIVE_TERMS if t in lower)

    if neg == 0 and pos == 0:
        label = "NEUTRAL"
        raw = {"POSITIVE": 0.20, "NEGATIVE": 0.20, "NEUTRAL": 0.60}
    elif neg > pos:
        label = "NEGATIVE"
        s = min(0.55 + 0.08 * neg, 0.92)
        rem = 1 - s
        raw = {"POSITIVE": round(rem * 0.25, 3), "NEGATIVE": round(s, 3), "NEUTRAL": round(rem * 0.75, 3)}
    elif pos > neg:
        label = "POSITIVE"
        s = min(0.55 + 0.08 * pos, 0.92)
        rem = 1 - s
        raw = {"POSITIVE": round(s, 3), "NEGATIVE": round(rem * 0.25, 3), "NEUTRAL": round(rem * 0.75, 3)}
    else:
        label = "NEUTRAL"
        raw = {"POSITIVE": 0.30, "NEGATIVE": 0.30, "NEUTRAL": 0.40}

    # Re-normalize defensively so all 3 are non-negative and sum to 1
    raw = {k: max(0.0, float(v)) for k, v in raw.items()}
    total = sum(raw.values()) or 1.0
    raw = {k: round(v / total, 3) for k, v in raw.items()}

    return {
        "label": label,
        "score": raw[label],
        "raw_scores": raw,
        "model": "medoscan-rule-v1",
    }


# ---------------------------------------------------------------------------
# Rule-based signal quick pass
# ---------------------------------------------------------------------------
def rule_based_signal(text: str, drugs: list[str], symptoms: list[str], sentiment: str) -> dict[str, Any] | None:
    lower = text.lower()

    if any(re.search(k, lower) for k in ADVERSE_KEYWORDS):
        return {
            "signal_type": "ADVERSE_EVENT",
            "confidence": 0.85,
            "reasoning": "Contains serious adverse-event keywords (e.g., suicidal, hospitalisation, severe).",
            "drugs_implicated": drugs,
            "symptoms_reported": symptoms,
            "classified_by": "medoscan-rules",
        }
    if any(re.search(k, lower) for k in FAILURE_KEYWORDS):
        return {
            "signal_type": "TREATMENT_FAILURE",
            "confidence": 0.78,
            "reasoning": "Contains treatment-failure phrasing (e.g., stopped working, not working).",
            "drugs_implicated": drugs,
            "symptoms_reported": symptoms,
            "classified_by": "medoscan-rules",
        }
    if sentiment == "NEGATIVE" and symptoms:
        return {
            "signal_type": "SIDE_EFFECT",
            "confidence": 0.72,
            "reasoning": "Negative sentiment combined with reported symptoms suggests a side effect.",
            "drugs_implicated": drugs,
            "symptoms_reported": symptoms,
            "classified_by": "medoscan-rules",
        }
    if sentiment == "POSITIVE" and drugs:
        return {
            "signal_type": "POSITIVE_OUTCOME",
            "confidence": 0.75,
            "reasoning": "Positive sentiment about a medication indicates favorable outcome.",
            "drugs_implicated": drugs,
            "symptoms_reported": symptoms,
            "classified_by": "medoscan-rules",
        }
    return None


# ---------------------------------------------------------------------------
# Claude fallback
# ---------------------------------------------------------------------------
async def llm_classify_signal(text: str, drugs: list[str], symptoms: list[str], api_key: str) -> dict[str, Any]:
    system_msg = (
        "You are a pharmacovigilance analyst. Classify a patient social-media post into "
        "ONE of: ADVERSE_EVENT, SIDE_EFFECT, TREATMENT_FAILURE, POSITIVE_OUTCOME, GENERAL. "
        "Return ONLY a JSON object with keys: signal_type, confidence (0-1), reasoning (<=200 chars). "
        "Use ADVERSE_EVENT only for serious harm (hospitalization, self-harm, death)."
    )

    prompt = (
        f"Post: {text}\n\n"
        f"Drugs detected: {drugs or 'none'}\n"
        f"Symptoms detected: {symptoms or 'none'}\n\n"
        "Respond with JSON only."
    )

    import anthropic as _anthropic
    aclient = _anthropic.AsyncAnthropic(api_key=api_key)

    try:
        msg = await aclient.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=256,
            system=system_msg,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text
        # extract JSON
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        signal_type = str(data.get("signal_type", "GENERAL")).upper()
        if signal_type not in {"ADVERSE_EVENT", "SIDE_EFFECT", "TREATMENT_FAILURE", "POSITIVE_OUTCOME", "GENERAL"}:
            signal_type = "GENERAL"
        return {
            "signal_type": signal_type,
            "confidence": float(data.get("confidence", 0.6)),
            "reasoning": str(data.get("reasoning", "LLM classification"))[:300],
            "drugs_implicated": drugs,
            "symptoms_reported": symptoms,
            "classified_by": "claude-sonnet-4-5",
        }
    except Exception as e:
        logger.exception("LLM classify failed: %s", e)
        return {
            "signal_type": "GENERAL",
            "confidence": 0.4,
            "reasoning": f"LLM error: {e}",
            "drugs_implicated": drugs,
            "symptoms_reported": symptoms,
            "classified_by": "fallback",
        }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def combine_raw_text(raw: dict[str, Any]) -> str:
    parts = []
    for k in ("title", "selftext", "text", "content"):
        v = raw.get(k)
        if v:
            parts.append(str(v))
    return " \n ".join(parts)


async def process_post(raw: dict[str, Any], api_key: str, force_llm: bool = False) -> dict[str, Any] | None:
    text = combine_raw_text(raw)
    if not text.strip():
        return None

    cleaned = clean_text(text)
    pii = detect_pii(cleaned)
    entities = extract_entities(cleaned)
    sentiment = analyze_sentiment(cleaned)

    drugs = sorted({e["text"].lower() for e in entities if e["label"] == "DRUG"})
    symptoms = sorted({e["text"].lower() for e in entities if e["label"] == "SYMPTOM"})

    signal = None if force_llm else rule_based_signal(cleaned, drugs, symptoms, sentiment["label"])
    if signal is None:
        if force_llm:
            signal = await llm_classify_signal(cleaned, drugs, symptoms, api_key)
        else:
            # Deterministic GENERAL fallback — no external API calls
            signal = {
                "signal_type": "GENERAL",
                "confidence": 0.5,
                "reasoning": "No specific signal matched by rules; classified as GENERAL discussion.",
                "drugs_implicated": drugs,
                "symptoms_reported": symptoms,
                "classified_by": "medoscan-rules",
            }

    now = datetime.now(timezone.utc)
    collected = raw.get("collected_at")
    if isinstance(collected, datetime):
        collected_iso = collected.astimezone(timezone.utc).isoformat()
    elif isinstance(collected, str) and collected:
        # Trust ISO-8601 string (used by seed data and external ingest)
        collected_iso = collected
    else:
        collected_iso = now.isoformat()

    return {
        "post_id": raw.get("id") or str(uuid.uuid4()),
        "source": raw.get("source", "unknown"),
        "url": raw.get("url"),
        "collected_at": collected_iso,
        "raw_text": text,
        "cleaned_text": cleaned,
        "entities": entities,
        "sentiment": sentiment,
        "pii": pii,
        "adverse_event": signal,
        "processed_at": now.isoformat(),
        "pipeline_version": "1.0.0",
    }


async def process_batch(raw_posts: list[dict[str, Any]], api_key: str, force_llm: bool = False) -> list[dict[str, Any]]:
    results = []
    for rp in raw_posts:
        out = await process_post(rp, api_key, force_llm=force_llm)
        if out:
            results.append(out)
    return results


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------
def aggregate_posts(posts: list[dict[str, Any]], window_hours: int = 24, prev_posts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    drug_counts: dict[str, int] = {}
    drug_sent: dict[str, list[str]] = {}
    signal_drug: dict[tuple[str, str], int] = {}
    pii_count = 0

    for p in posts:
        if p.get("pii", {}).get("has_pii"):
            pii_count += 1
        sig = p.get("adverse_event", {}).get("signal_type", "GENERAL")
        for d in p.get("adverse_event", {}).get("drugs_implicated", []):
            drug_counts[d] = drug_counts.get(d, 0) + 1
            drug_sent.setdefault(d, []).append(p["sentiment"]["label"])
            signal_drug[(sig, d)] = signal_drug.get((sig, d), 0) + 1

    # Previous-window counts for delta_pct
    prev_signal_drug: dict[tuple[str, str], int] = {}
    if prev_posts:
        for p in prev_posts:
            sig = p.get("adverse_event", {}).get("signal_type", "GENERAL")
            for d in p.get("adverse_event", {}).get("drugs_implicated", []):
                prev_signal_drug[(sig, d)] = prev_signal_drug.get((sig, d), 0) + 1

    trending = []
    for (sig, drug), cnt in signal_drug.items():
        severity = {
            "ADVERSE_EVENT": 1.0,
            "TREATMENT_FAILURE": 0.7,
            "SIDE_EFFECT": 0.5,
            "POSITIVE_OUTCOME": 0.1,
            "GENERAL": 0.2,
        }.get(sig, 0.3)
        prev = prev_signal_drug.get((sig, drug), 0)
        if prev == 0:
            delta_pct = None if cnt == 0 else 100.0  # new signal = +100% (no baseline)
        else:
            delta_pct = round(((cnt - prev) / prev) * 100.0, 1)
        trending.append({
            "signal_type": sig,
            "drug": drug,
            "count": cnt,
            "prev_count": prev,
            "window_hours": window_hours,
            "delta_pct": delta_pct,
            "severity_score": round(severity * min(1.0, cnt / 5.0) + 0.1, 3),
        })
    trending.sort(key=lambda t: (-t["severity_score"], -(t["delta_pct"] or 0), -t["count"]))

    top_drugs = []
    for d, c in sorted(drug_counts.items(), key=lambda x: -x[1])[:10]:
        sents = drug_sent.get(d, [])
        score = (sents.count("POSITIVE") - sents.count("NEGATIVE")) / max(len(sents), 1)
        top_drugs.append({
            "drug": d,
            "mention_count": c,
            "avg_sentiment": round(score, 3),
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_hours": window_hours,
        "total_posts": len(posts),
        "trending_signals": trending[:20],
        "top_drugs": top_drugs,
        "pii_flagged_count": pii_count,
    }
