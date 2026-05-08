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
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from pipeline import aggregate_posts, process_batch, process_post
from insights import generate_narrative
from seed_data import get_seed_posts


# ---------------------------------------------------
# Environment Setup
# ---------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s"
)
logger = logging.getLogger("medoscan")


# ---------------------------------------------------
# Database Setup
# ---------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)

db = client[os.environ["DB_NAME"]]

posts_col = db.medoscan_posts
reports_col = db.medoscan_reports
insights_col = db.medoscan_insights

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


# ---------------------------------------------------
# FastAPI App
# ---------------------------------------------------
app = FastAPI(
    title="MedoScan API",
    version="1.0.0"
)

api = APIRouter(prefix="/api")


# ---------------------------------------------------
# CORS FIX (IMPORTANT)
# ---------------------------------------------------
cors_origins = os.environ.get("CORS_ORIGINS")

if cors_origins:
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]
    allow_credentials = True
else:
    # fallback for local/dev testing
    allowed_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------
# Request Schemas
# ---------------------------------------------------
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


# ---------------------------------------------------
# Helper Functions
# ---------------------------------------------------
async def _save_post(doc: dict[str, Any]) -> None:
    try:
        await posts_col.replace_one(
            {"post_id": doc["post_id"]},
            doc,
            upsert=True
        )
    except Exception as e:
        logger.warning("save_post failed: %s", e)


async def _recent_posts(
    hours: int,
    source: str | None = None,
    signal_type: str | None = None,
    limit: int = 200
):
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=hours)
    ).isoformat()

    query = {
        "collected_at": {"$gte": cutoff}
    }

    if source:
        query["source"] = source

    if signal_type:
        query["adverse_event.signal_type"] = signal_type

    cursor = (
        posts_col
        .find(query, {"_id": 0})
        .sort("collected_at", -1)
        .limit(limit)
    )

    return await cursor.to_list(length=limit)


def _strip_id(data: dict[str, Any]):
    data.pop("_id", None)
    return data


# ---------------------------------------------------
# Root Route
# ---------------------------------------------------
@app.get("/")
async def home():
    return {
        "message": "MedoScan backend running successfully"
    }


# ---------------------------------------------------
# Health Check
# ---------------------------------------------------
@api.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }


# ---------------------------------------------------
# Analyze Single Post
# ---------------------------------------------------
@api.post("/analyze")
async def analyze(req: AnalyzeRequest):
    raw_input = {
        "id": None,
        "source": req.source,
        "text": req.text,
        "title": req.title,
        "url": req.url
    }

    result = await process_post(
        raw_input,
        ANTHROPIC_API_KEY,
        force_llm=req.force_llm
    )

    if result is None:
        raise HTTPException(
            status_code=422,
            detail="No text to analyze"
        )

    await _save_post(result)

    return {
        "success": True,
        "post_id": result["post_id"],
        "signal_type": result["adverse_event"]["signal_type"],
        "confidence": result["adverse_event"]["confidence"],
        "has_pii": result["pii"]["has_pii"],
        "entities": result["entities"],
        "sentiment": result["sentiment"]["label"],
        "reasoning": result["adverse_event"]["reasoning"],
    }


# ---------------------------------------------------
# Batch Analyze
# ---------------------------------------------------
@api.post("/analyze/batch")
async def analyze_batch(body: BatchInput):
    raw_posts = [p.model_dump() for p in body.posts]

    results = await process_batch(
        raw_posts,
        ANTHROPIC_API_KEY,
        force_llm=body.force_llm
    )

    for r in results:
        await _save_post(r)

    return {
        "processed": len(results),
        "saved_to_db": len(results)
    }


# ---------------------------------------------------
# Get Posts
# ---------------------------------------------------
@api.get("/posts")
async def list_posts(
    hours: int = Query(168, ge=1, le=720),
    source: Optional[str] = None,
    signal_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500)
):
    records = await _recent_posts(
        hours,
        source,
        signal_type,
        limit
    )

    return {
        "count": len(records),
        "posts": records
    }


# ---------------------------------------------------
# Stats Endpoint
# ---------------------------------------------------
@api.get("/stats")
async def stats(
    hours: int = Query(168, ge=1, le=720)
):
    records = await _recent_posts(
        hours,
        limit=2000
    )

    total = len(records)
    signal_counts = {}
    pii_count = 0

    for r in records:
        signal = r["adverse_event"]["signal_type"]

        signal_counts[signal] = (
            signal_counts.get(signal, 0) + 1
        )

        if r["pii"]["has_pii"]:
            pii_count += 1

    return {
        "total_posts": total,
        "signal_distribution": signal_counts,
        "pii_flagged": pii_count,
        "window_hours": hours
    }


# ---------------------------------------------------
# Report Endpoint
# ---------------------------------------------------
@api.get("/report")
async def get_report(
    hours: int = Query(24, ge=1, le=720)
):
    records = await _recent_posts(
        hours,
        limit=500
    )

    if not records:
        return {
            "message": "no posts found"
        }

    report = aggregate_posts(
        records,
        window_hours=hours
    )

    return _strip_id(report)


# ---------------------------------------------------
# Seed Demo Data
# ---------------------------------------------------
@api.post("/seed")
async def seed():
    raw = get_seed_posts()

    results = await process_batch(
        raw,
        ANTHROPIC_API_KEY,
        force_llm=False
    )

    saved = 0

    for r in results:
        await _save_post(r)
        saved += 1

    return {
        "seeded": saved
    }


# ---------------------------------------------------
# Delete All Posts
# ---------------------------------------------------
@api.delete("/posts")
async def clear_posts():
    res = await posts_col.delete_many({})
    await insights_col.delete_many({})

    return {
        "deleted": res.deleted_count
    }


# ---------------------------------------------------
# Include Router AFTER Middleware
# ---------------------------------------------------
app.include_router(api)


# ---------------------------------------------------
# Startup Event
# ---------------------------------------------------
@app.on_event("startup")
async def startup():
    count = await posts_col.estimated_document_count()

    if count == 0:
        try:
            raw = get_seed_posts()

            results = await process_batch(
                raw,
                ANTHROPIC_API_KEY,
                force_llm=False
            )

            for r in results:
                await _save_post(r)

            logger.info(
                "Auto-seeded %s demo posts",
                len(results)
            )

        except Exception as e:
            logger.warning(
                "Auto-seed failed: %s",
                e
            )


# ---------------------------------------------------
# Shutdown Event
# ---------------------------------------------------
@app.on_event("shutdown")
async def shutdown():
    client.close()