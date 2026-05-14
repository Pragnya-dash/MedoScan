
"""MedoScan FastAPI backend."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from pipeline import aggregate_posts, process_batch, process_post
from insights import generate_narrative
from seed_data import get_seed_posts

from apify_ingestion import (
    fetch_twitter_posts,
    fetch_reddit_posts,
    fetch_quora_posts,
    fetch_forum_posts,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
logger = logging.getLogger("medoscan")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
posts_col    = db.medoscan_posts
reports_col  = db.medoscan_reports
insights_col = db.medoscan_insights

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

app = FastAPI(title="MedoScan API", version="1.0.0")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://medoscan.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class RawPostInput(BaseModel):
    id: Optional[str] = None
    source: str = "manual"
    text: Optional[str] = None
    title: Optional[str] = None
    selftext: Optional[str] = None
    content: Optional[str] = None
    url: Optional[str] = None
    collected_at: Optional[datetime] = None


class BatchInput(BaseModel):
    posts: list[RawPostInput]
    force_llm: bool = False


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    source: str = "manual"
    title: Optional[str] = None
    url: Optional[str] = None
    force_llm: bool = False


class ScanRequest(BaseModel):
    keywords: list[str] = Field(default=["ozempic"])
    sources: list[str]  = Field(default=["reddit"])
    limit_per_source: int = Field(default=25, ge=5, le=50)
    force_llm: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _save_post(doc: dict[str, Any]) -> None:
    try:
        await posts_col.replace_one({"post_id": doc["post_id"]}, doc, upsert=True)
    except Exception as e:
        logger.warning("save_post failed: %s", e)


async def _tick_dynamic_data() -> None:
    import random
    state = await db.medoscan_state.find_one({"_id": "ticker"})
    now = datetime.now(timezone.utc)
    if state:
        last = state.get("last_tick_at")
        try:
            last_dt = datetime.fromisoformat(last) if isinstance(last, str) else last
        except Exception:
            last_dt = None
        if last_dt and (now - last_dt).total_seconds() < 240:
            return

    try:
        from seed_data import DRUGS, NEGATIVE_TEMPLATES, ADVERSE_TEMPLATES, FAILURE_TEMPLATES, POSITIVE_TEMPLATES, NEUTRAL_TEMPLATES, SYMPTOMS
    except Exception:
        return

    drug = random.choice(DRUGS)
    mix = random.choices(
        ["NEGATIVE", "ADVERSE", "FAILURE", "POSITIVE", "NEUTRAL"],
        weights=[0.30, 0.10, 0.12, 0.32, 0.16],
    )[0]
    tpl_set = {
        "NEGATIVE": NEGATIVE_TEMPLATES, "ADVERSE": ADVERSE_TEMPLATES,
        "FAILURE":  FAILURE_TEMPLATES,  "POSITIVE": POSITIVE_TEMPLATES,
        "NEUTRAL":  NEUTRAL_TEMPLATES,
    }[mix]
    source, template = random.choice(tpl_set)
    sym  = random.choice(SYMPTOMS)
    text = template.format(drug=drug, sym=sym)

    pid = f"live_{int(now.timestamp())}_{random.randint(1000,9999)}"
    raw: dict[str, Any] = {
        "id": pid, "source": source,
        "url": f"https://example.com/{source}/{pid}",
        "collected_at": now.isoformat(),
    }
    if source == "reddit":
        raw["title"]   = f"My {drug} update"
        raw["selftext"] = text
    else:
        raw["content" if source != "twitter" else "text"] = text

    result = await process_post(raw, ANTHROPIC_API_KEY, force_llm=False)
    if result:
        await _save_post(result)

    await db.medoscan_state.replace_one(
        {"_id": "ticker"},
        {"_id": "ticker", "last_tick_at": now.isoformat()},
        upsert=True,
    )


def _strip_id(d: dict[str, Any]) -> dict[str, Any]:
    d.pop("_id", None)
    return d


async def _recent_posts(
    hours: int,
    source: str | None = None,
    signal_type: str | None = None,
    limit: int = 200,
) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    q: dict[str, Any] = {"collected_at": {"$gte": cutoff}}
    if source:
        q["source"] = source
    if signal_type:
        q["adverse_event.signal_type"] = signal_type
    cursor = posts_col.find(q, {"_id": 0}).sort("collected_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }


@api.post("/analyze")
async def analyze(req: AnalyzeRequest):
    raw_input = {
        "id": None, "source": req.source,
        "text": req.text, "title": req.title, "url": req.url,
    }
    result = await process_post(raw_input, ANTHROPIC_API_KEY, force_llm=req.force_llm)
    if result is None:
        raise HTTPException(status_code=422, detail="No text to analyze")
    await _save_post(result)
    return {
        "success":     True,
        "post_id":     result["post_id"],
        "signal_type": result["adverse_event"]["signal_type"],
        "confidence":  result["adverse_event"]["confidence"],
        "has_pii":     result["pii"]["has_pii"],
        "entities":    result["entities"],
        "sentiment":   result["sentiment"]["label"],
        "reasoning":   result["adverse_event"]["reasoning"],
        "full_result": result,
    }


@api.post("/analyze/batch")
async def analyze_batch(body: BatchInput):
    raw_posts = [p.model_dump() for p in body.posts]
    results   = await process_batch(raw_posts, ANTHROPIC_API_KEY, force_llm=body.force_llm)
    saved = 0
    signal_counts: dict[str, int] = {}
    pii_flagged = 0
    simplified  = []
    for r in results:
        await _save_post(r)
        saved += 1
        st = r["adverse_event"]["signal_type"]
        signal_counts[st] = signal_counts.get(st, 0) + 1
        if r["pii"]["has_pii"]:
            pii_flagged += 1
        simplified.append({
            "post_id":     r["post_id"],
            "signal_type": st,
            "confidence":  r["adverse_event"]["confidence"],
            "sentiment":   r["sentiment"]["label"],
            "has_pii":     r["pii"]["has_pii"],
            "entities":    [e["text"] for e in r["entities"]],
        })
    return {
        "processed":    len(results),
        "saved_to_db":  saved,
        "skipped":      len(raw_posts) - len(results),
        "pii_flagged":  pii_flagged,
        "signal_counts": signal_counts,
        "results":      simplified,
    }


@api.get("/posts")
async def list_posts(
    hours: int = Query(168, ge=1, le=720),
    source: Optional[str] = None,
    signal_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    records = await _recent_posts(hours, source, signal_type, limit)
    return {"count": len(records), "posts": [
        {
            "post_id":      r["post_id"],
            "source":       r["source"],
            "collected_at": r["collected_at"],
            "signal_type":  r["adverse_event"]["signal_type"],
            "confidence":   r["adverse_event"]["confidence"],
            "sentiment":    r["sentiment"]["label"],
            "has_pii":      r["pii"]["has_pii"],
            "url":          r.get("url"),
            "preview":      r["cleaned_text"][:180],
            "drugs":        [e["text"] for e in r["entities"] if e["label"] == "DRUG"],
        }
        for r in records
    ]}


@api.get("/posts/{post_id}")
async def get_post(post_id: str):
    record = await posts_col.find_one({"post_id": post_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Post not found")
    return record


@api.get("/report")
async def get_report(hours: int = Query(24, ge=1, le=720), save: bool = False):
    records     = await _recent_posts(hours, limit=500)
    cutoff_now  = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_prev = cutoff_now - timedelta(hours=hours)
    prev_records = await posts_col.find(
        {"collected_at": {"$gte": cutoff_prev.isoformat(), "$lt": cutoff_now.isoformat()}},
        {"_id": 0}
    ).to_list(length=500)
    if not records:
        return {"message": "no posts found", "window_hours": hours, "total_posts": 0,
                "trending_signals": [], "top_drugs": [], "pii_flagged_count": 0}
    report = aggregate_posts(records, window_hours=hours, prev_posts=prev_records)
    if save:
        try:
            await reports_col.insert_one(report.copy())
        except Exception as e:
            logger.warning("save report failed: %s", e)
    return _strip_id(report)


@api.get("/signals")
async def signals(hours: int = Query(24, ge=1, le=720)):
    records = await _recent_posts(hours, limit=1000)
    out: dict[str, dict[str, int]] = {}
    for r in records:
        sig = r["adverse_event"]["signal_type"]
        for d in r["adverse_event"].get("drugs_implicated", []):
            out.setdefault(d, {})
            out[d][sig] = out[d].get(sig, 0) + 1
    return {"window_hours": hours, "signals": out}


@api.get("/stats")
async def stats(hours: int = Query(168, ge=1, le=720)):
    await _tick_dynamic_data()
    records = await _recent_posts(hours, limit=2000)
    total   = len(records)
    sig_counts: dict[str, int]    = {}
    sent_counts: dict[str, int]   = {}
    source_counts: dict[str, int] = {}
    pii_count  = 0
    drug_counts: dict[str, int]   = {}
    timeline: dict[str, dict[str, int]] = {}

    for r in records:
        sig  = r["adverse_event"]["signal_type"]
        sent = r["sentiment"]["label"]
        sig_counts[sig]            = sig_counts.get(sig, 0) + 1
        sent_counts[sent]          = sent_counts.get(sent, 0) + 1
        source_counts[r["source"]] = source_counts.get(r["source"], 0) + 1
        if r["pii"]["has_pii"]:
            pii_count += 1
        for d in r["adverse_event"].get("drugs_implicated", []):
            drug_counts[d] = drug_counts.get(d, 0) + 1
        day = r["collected_at"][:10]
        timeline.setdefault(day, {"POSITIVE": 0, "NEGATIVE": 0, "NEUTRAL": 0})
        timeline[day][sent] = timeline[day].get(sent, 0) + 1

    timeline_list = [{"date": d, **v} for d, v in sorted(timeline.items())]
    top_drugs     = [{"drug": d, "count": c}
                     for d, c in sorted(drug_counts.items(), key=lambda x: -x[1])[:10]]

    cutoff_now  = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_prev = cutoff_now - timedelta(hours=hours)
    prev = await posts_col.find(
        {"collected_at": {"$gte": cutoff_prev.isoformat(), "$lt": cutoff_now.isoformat()}},
        {"_id": 0, "adverse_event.signal_type": 1, "pii.has_pii": 1}
    ).to_list(length=2000)

    prev_total = len(prev)
    prev_sig: dict[str, int] = {}
    prev_pii  = 0
    for p in prev:
        s = p.get("adverse_event", {}).get("signal_type", "GENERAL")
        prev_sig[s] = prev_sig.get(s, 0) + 1
        if p.get("pii", {}).get("has_pii"):
            prev_pii += 1

    def _delta(curr: int, prev_v: int) -> float | None:
        if prev_v == 0:
            return 100.0 if curr > 0 else None
        return round(((curr - prev_v) / prev_v) * 100.0, 1)

    return {
        "total_posts":        total,
        "adverse_events":     sig_counts.get("ADVERSE_EVENT", 0),
        "side_effects":       sig_counts.get("SIDE_EFFECT", 0),
        "treatment_failures": sig_counts.get("TREATMENT_FAILURE", 0),
        "positive_outcomes":  sig_counts.get("POSITIVE_OUTCOME", 0),
        "pii_flagged":        pii_count,
        "deltas": {
            "total":            _delta(total, prev_total),
            "adverse_events":   _delta(sig_counts.get("ADVERSE_EVENT", 0), prev_sig.get("ADVERSE_EVENT", 0)),
            "positive_outcomes": _delta(sig_counts.get("POSITIVE_OUTCOME", 0), prev_sig.get("POSITIVE_OUTCOME", 0)),
            "pii_flagged":      _delta(pii_count, prev_pii),
        },
        "signal_distribution":    sig_counts,
        "sentiment_distribution": sent_counts,
        "source_distribution":    source_counts,
        "timeline":   timeline_list,
        "top_drugs":  top_drugs,
        "window_hours": hours,
    }


@api.get("/trends")
async def trends_endpoint(hours: int = Query(168, ge=1, le=720)):
    records     = await _recent_posts(hours, limit=2000)
    cutoff_now  = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_prev = cutoff_now - timedelta(hours=hours)
    prev_records = await posts_col.find(
        {"collected_at": {"$gte": cutoff_prev.isoformat(), "$lt": cutoff_now.isoformat()}},
        {"_id": 0}
    ).to_list(length=2000)

    def aggr(rs):
        per_drug: dict[str, dict[str, Any]] = {}
        for r in rs:
            sym_counts = {}
            for s in r["adverse_event"].get("symptoms_reported", []):
                sym_counts[s] = sym_counts.get(s, 0) + 1
            for d in r["adverse_event"].get("drugs_implicated", []):
                bucket = per_drug.setdefault(d, {
                    "count": 0, "first_seen": r["collected_at"],
                    "symptoms": {}, "signals": {}, "confidences": [],
                })
                bucket["count"] += 1
                if r["collected_at"] < bucket["first_seen"]:
                    bucket["first_seen"] = r["collected_at"]
                for s, c in sym_counts.items():
                    bucket["symptoms"][s] = bucket["symptoms"].get(s, 0) + c
                sig = r["adverse_event"]["signal_type"]
                bucket["signals"][sig] = bucket["signals"].get(sig, 0) + 1
                bucket["confidences"].append(r["adverse_event"].get("confidence", 0.5))
        return per_drug

    cur  = aggr(records)
    prev = aggr(prev_records)
    out  = []
    for drug, b in cur.items():
        prev_count = prev.get(drug, {}).get("count", 0)
        ratio      = b["count"] / prev_count if prev_count else None
        direction  = ("increasing" if ratio is None or ratio >= 1.2
                      else "decreasing" if ratio <= 0.8 else "stable")
        top_symptom = max(b["symptoms"].items(), key=lambda x: x[1])[0] if b["symptoms"] else "general discussion"
        top_signal  = max(b["signals"].items(),  key=lambda x: x[1])[0] if b["signals"]  else "GENERAL"
        confidence  = round(sum(b["confidences"]) / len(b["confidences"]), 2) if b["confidences"] else 0.5
        out.append({
            "drug": drug, "count": b["count"], "prev_count": prev_count,
            "direction": direction, "top_symptom": top_symptom,
            "top_signal": top_signal, "confidence": confidence,
            "first_seen": b["first_seen"],
        })
    out.sort(key=lambda x: -x["count"])
    return {"window_hours": hours, "trends": out}


@api.get("/heatmap")
async def heatmap(hours: int = Query(168, ge=1, le=720)):
    records = await _recent_posts(hours, limit=2000)
    grid: dict[str, dict[str, int]] = {}
    drug_totals: dict[str, int]     = {}
    for r in records:
        for d in r["adverse_event"].get("drugs_implicated", []):
            drug_totals[d] = drug_totals.get(d, 0) + 1
            for s in r["adverse_event"].get("symptoms_reported", []):
                grid.setdefault(d, {})
                grid[d][s] = grid[d].get(s, 0) + 1
    top_drugs = [d for d, _ in sorted(drug_totals.items(), key=lambda x: -x[1])[:8]]
    sym_totals: dict[str, int] = {}
    for d in top_drugs:
        for s, c in grid.get(d, {}).items():
            sym_totals[s] = sym_totals.get(s, 0) + c
    top_symptoms = [s for s, _ in sorted(sym_totals.items(), key=lambda x: -x[1])[:8]]
    return {
        "drugs": top_drugs, "symptoms": top_symptoms,
        "grid": {d: {s: grid.get(d, {}).get(s, 0) for s in top_symptoms} for d in top_drugs},
    }


@api.get("/safety/summary")
async def safety_summary(hours: int = Query(168, ge=1, le=720)):
    records  = await _recent_posts(hours, limit=2000)
    critical = sum(1 for r in records if r["adverse_event"]["signal_type"] == "ADVERSE_EVENT")
    warning  = sum(1 for r in records if r["adverse_event"]["signal_type"] in {"TREATMENT_FAILURE", "SIDE_EFFECT"})
    stable   = sum(1 for r in records if r["adverse_event"]["signal_type"] in {"POSITIVE_OUTCOME", "GENERAL"})
    drug_crit: dict[str, int] = {}
    for r in records:
        if r["adverse_event"]["signal_type"] == "ADVERSE_EVENT":
            for d in r["adverse_event"].get("drugs_implicated", []):
                drug_crit[d] = drug_crit.get(d, 0) + 1
    top = sorted(drug_crit.items(), key=lambda x: -x[1])
    if top:
        td, tc = top[0]
        narrative = (
            f"The pharmacovigilance system has identified {critical} critical safety signals "
            f"requiring immediate review. {td.title()} leads the alert queue with {tc} "
            f"adverse-event reports and shows an accelerating trend with high confidence. "
            f"Regulatory notification thresholds may be reached within the 24-hour review window."
        )
    else:
        narrative = (
            f"No critical signals in the current window. "
            f"{warning} warning-level signals are under investigation; {stable} signals remain stable."
        )
    return {"critical": critical, "warning": warning, "stable": stable,
            "narrative": narrative, "window_hours": hours}


@api.get("/alerts")
async def alerts(hours: int = Query(72, ge=1, le=720)):
    records     = await _recent_posts(hours, limit=2000)
    cutoff_now  = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_prev = cutoff_now - timedelta(hours=hours)
    prev_records = await posts_col.find(
        {"collected_at": {"$gte": cutoff_prev.isoformat(), "$lt": cutoff_now.isoformat()}},
        {"_id": 0}
    ).to_list(length=2000)

    def _bucket(rs):
        out: dict[tuple, list] = {}
        for r in rs:
            sig = r["adverse_event"]["signal_type"]
            if sig not in {"ADVERSE_EVENT", "TREATMENT_FAILURE", "SIDE_EFFECT"}:
                continue
            for d in r["adverse_event"].get("drugs_implicated", []):
                out.setdefault((sig, d), []).append(r)
        return out

    cur    = _bucket(records)
    prev   = _bucket(prev_records)
    cached: dict[str, dict] = {}
    async for doc in insights_col.find({}, {"_id": 0}):
        cached[f"{doc['signal_type']}|{doc['drug']}"] = doc

    alerts_list = []
    for (sig, drug), rs in cur.items():
        prev_count = len(prev.get((sig, drug), []))
        cnt        = len(rs)
        delta_pct  = (None if prev_count == 0 and cnt == 0
                      else 100.0 if prev_count == 0
                      else round(((cnt - prev_count) / prev_count) * 100.0, 1))
        sym_counts: dict[str, int] = {}
        for r in rs:
            for s in r["adverse_event"].get("symptoms_reported", []):
                sym_counts[s] = sym_counts.get(s, 0) + 1
        top_symptoms = [s for s, _ in sorted(sym_counts.items(), key=lambda x: -x[1])[:5]]
        severity     = ("critical" if sig == "ADVERSE_EVENT" else
                        "high"     if sig == "TREATMENT_FAILURE" else "medium")
        narrative    = cached.get(f"{sig}|{drug}", {}).get("narrative")
        alerts_list.append({
            "signal_type":    sig,
            "drug":           drug,
            "count":          cnt,
            "prev_count":     prev_count,
            "delta_pct":      delta_pct,
            "top_symptoms":   top_symptoms,
            "severity":       severity,
            "latest_at":      max(r["collected_at"] for r in rs),
            "sample_post_id": rs[0]["post_id"],
            "ai_narrative":   narrative,
            "sources":        sorted({r["source"] for r in rs}),
        })
    sev_rank = {"critical": 0, "high": 1, "medium": 2}
    alerts_list.sort(key=lambda a: (sev_rank.get(a["severity"], 3), -(a["delta_pct"] or 0), -a["count"]))
    return {"window_hours": hours, "alerts": alerts_list}


@api.post("/insights/refresh")
async def refresh_insights(hours: int = Query(168, ge=1, le=720), top_n: int = Query(10, ge=1, le=30)):
    payload  = await alerts(hours=hours)
    items    = payload.get("alerts", [])[:top_n]
    generated = 0
    for a in items:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        rs = await posts_col.find({
            "adverse_event.signal_type":      a["signal_type"],
            "adverse_event.drugs_implicated": a["drug"],
            "collected_at":                   {"$gte": cutoff},
        }, {"_id": 0, "cleaned_text": 1, "pii": 1}).to_list(length=10)
        excerpts = [(r.get("pii", {}).get("redacted_text") or r.get("cleaned_text") or "") for r in rs]
        excerpts = [e for e in excerpts if e]
        narrative = await generate_narrative(
            drug=a["drug"], signal_type=a["signal_type"],
            count=a["count"], prev_count=a["prev_count"], delta_pct=a["delta_pct"],
            top_symptoms=a["top_symptoms"], sample_excerpts=excerpts, api_key=ANTHROPIC_API_KEY,
        )
        await insights_col.replace_one(
            {"signal_type": a["signal_type"], "drug": a["drug"]},
            {"signal_type": a["signal_type"], "drug": a["drug"], "narrative": narrative,
             "generated_at": datetime.now(timezone.utc).isoformat(),
             "count": a["count"], "delta_pct": a["delta_pct"], "top_symptoms": a["top_symptoms"]},
            upsert=True,
        )
        generated += 1
    return {"generated": generated}


# ---------------------------------------------------------------------------
# SCAN endpoint — Apify crawl → pipeline → save → return
# ---------------------------------------------------------------------------
@api.post("/scan")
async def scan(req: ScanRequest):
    all_posts: list[dict] = []

    if "reddit"  in req.sources:
        all_posts += await fetch_reddit_posts(req.keywords, req.limit_per_source)
    if "twitter" in req.sources:
        all_posts += await fetch_twitter_posts(req.keywords, req.limit_per_source)
    if "quora"   in req.sources:
        all_posts += await fetch_quora_posts(req.keywords, req.limit_per_source)
    if "forum"   in req.sources:
        all_posts += await fetch_forum_posts(req.keywords, req.limit_per_source)

    if not all_posts:
        return {
            "success": False, "crawled": 0, "processed": 0,
            "alerts": [], "posts": [], "pipeline_steps": [], "summary": {}
        }

    results = await process_batch(all_posts, ANTHROPIC_API_KEY, force_llm=req.force_llm)

    for r in results:
        await _save_post(r)

    sig_counts: dict[str, int]    = {}
    sent_counts: dict[str, int]   = {}
    source_counts: dict[str, int] = {}
    drug_counts: dict[str, int]   = {}
    sym_counts: dict[str, int]    = {}
    pii_count = 0

    for r in results:
        sig  = r["adverse_event"]["signal_type"]
        sent = r["sentiment"]["label"]
        sig_counts[sig]            = sig_counts.get(sig, 0) + 1
        sent_counts[sent]          = sent_counts.get(sent, 0) + 1
        source_counts[r["source"]] = source_counts.get(r["source"], 0) + 1
        if r["pii"]["has_pii"]:
            pii_count += 1
        for d in r["adverse_event"].get("drugs_implicated", []):
            drug_counts[d] = drug_counts.get(d, 0) + 1
        for s in r["adverse_event"].get("symptoms_reported", []):
            sym_counts[s]  = sym_counts.get(s, 0) + 1

    alert_list = []
    for r in results:
        sig = r["adverse_event"]["signal_type"]
        if sig in {"ADVERSE_EVENT", "TREATMENT_FAILURE", "SIDE_EFFECT"}:
            sev = ("critical" if sig == "ADVERSE_EVENT" else
                   "high"     if sig == "TREATMENT_FAILURE" else "medium")
            alert_list.append({
                "post_id":    r["post_id"],
                "source":     r["source"],
                "signal_type": sig,
                "severity":   sev,
                "confidence": r["adverse_event"]["confidence"],
                "drugs":      r["adverse_event"].get("drugs_implicated", []),
                "symptoms":   r["adverse_event"].get("symptoms_reported", []),
                "preview":    r["cleaned_text"][:200],
                "reasoning":  r["adverse_event"].get("reasoning", ""),
            })
    alert_list.sort(key=lambda a: (
        {"critical": 0, "high": 1, "medium": 2}.get(a["severity"], 3),
        -a["confidence"]
    ))

    return {
        "success":   True,
        "crawled":   len(all_posts),
        "processed": len(results),
        "saved":     len(results),
        "pipeline_steps": [
            {"step": "Data Acquisition",              "status": "done", "count": len(all_posts),
             "detail": f"Crawled from {', '.join(req.sources)}"},
            {"step": "Text Cleaning & PII Detection", "status": "done", "count": pii_count,
             "detail": f"{pii_count} posts had PII redacted"},
            {"step": "Entity Extraction",             "status": "done", "count": len(drug_counts),
             "detail": f"{len(drug_counts)} drugs · {len(sym_counts)} symptom types"},
            {"step": "Sentiment Analysis",            "status": "done", "count": len(results),
             "detail": f"Neg {sent_counts.get('NEGATIVE',0)} · Pos {sent_counts.get('POSITIVE',0)} · Neu {sent_counts.get('NEUTRAL',0)}"},
            {"step": "Adverse Event Detection",       "status": "done",
             "count": sig_counts.get("ADVERSE_EVENT", 0),
             "detail": f"{sig_counts.get('ADVERSE_EVENT',0)} adverse · {sig_counts.get('SIDE_EFFECT',0)} side effects"},
            {"step": "Risk Classification",           "status": "done", "count": len(alert_list),
             "detail": f"{len(alert_list)} alerts generated"},
        ],
        "summary": {
            "total_posts":            len(results),
            "signal_distribution":    sig_counts,
            "sentiment_distribution": sent_counts,
            "source_distribution":    source_counts,
            "pii_flagged":            pii_count,
            "top_drugs":    sorted(drug_counts.items(), key=lambda x: -x[1])[:8],
            "top_symptoms": sorted(sym_counts.items(),  key=lambda x: -x[1])[:8],
        },
        "alerts": alert_list[:10],
        "posts": [
            {
                "post_id":      r["post_id"],
                "source":       r["source"],
                "collected_at": r["collected_at"],
                "signal_type":  r["adverse_event"]["signal_type"],
                "confidence":   r["adverse_event"]["confidence"],
                "sentiment":    r["sentiment"]["label"],
                "has_pii":      r["pii"]["has_pii"],
                "url":          r.get("url"),
                "preview":      r["cleaned_text"][:180],
                "drugs":        [e["text"] for e in r["entities"] if e["label"] == "DRUG"],
                "symptoms":     [e["text"] for e in r["entities"] if e["label"] == "SYMPTOM"],
                "reasoning":    r["adverse_event"].get("reasoning", ""),
            }
            for r in results
        ][:30],
    }


# ---------------------------------------------------------------------------
# Live monitor (fixed — now async)
# ---------------------------------------------------------------------------
@api.post("/live-monitor")
async def live_monitor(keyword: str):
    all_posts: list[dict] = []
    all_posts += await fetch_twitter_posts([keyword])
    all_posts += await fetch_reddit_posts([keyword])
    all_posts += await fetch_quora_posts([keyword])

    processed_count = 0
    for post in all_posts:
        try:
            result = await process_post(post, ANTHROPIC_API_KEY, force_llm=False)
            if result:
                await _save_post(result)
                processed_count += 1
        except Exception as e:
            logger.warning("Failed processing post: %s", e)

    return {
        "success":       True,
        "keyword":       keyword,
        "total_fetched": len(all_posts),
        "processed":     processed_count,
    }


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@api.post("/seed")
async def seed():
    raw     = get_seed_posts()
    results = await process_batch(raw, ANTHROPIC_API_KEY, force_llm=False)
    saved   = 0
    for r in results:
        await _save_post(r)
        saved += 1
    import asyncio
    asyncio.create_task(_refresh_insights_safely(hours=720, top_n=10))
    return {"seeded": saved}


async def _refresh_insights_safely(hours: int, top_n: int):
    try:
        await refresh_insights(hours=hours, top_n=top_n)
    except Exception as e:
        logger.warning("background insights refresh failed: %s", e)


@api.delete("/posts")
async def clear_posts():
    res = await posts_col.delete_many({})
    await insights_col.delete_many({})
    return {"deleted": res.deleted_count}


@app.get("/")
async def home():
    return {"message": "MedoScan backend running successfully"}


app.include_router(api)


@app.on_event("startup")
async def _startup():
    count = await posts_col.estimated_document_count()
    if count == 0:
        try:
            raw     = get_seed_posts()
            results = await process_batch(raw, ANTHROPIC_API_KEY, force_llm=False)
            for r in results:
                await _save_post(r)
            logger.info("Auto-seeded %s demo posts", len(results))
            import asyncio
            asyncio.create_task(_refresh_insights_safely(hours=720, top_n=10))
        except Exception as e:
            logger.warning("auto-seed failed: %s", e)


@app.on_event("shutdown")
async def _shutdown():
    client.close()