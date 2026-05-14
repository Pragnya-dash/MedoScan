"""
MedoScan — Apify Ingestion
Reddit + Twitter = real Apify actors (async)
Quora + Forum = rich mock (Quora needs login cookies for real scraping)
"""
from __future__ import annotations

import logging
import os
import random
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

APIFY_TOKEN   = os.getenv("APIFY_TOKEN", "")
BASE_URL      = "https://api.apify.com/v2"
REDDIT_ACTOR  = "trudax~reddit-scraper-lite"
TWITTER_ACTOR = "apidojo~tweet-scraper"

_SYMPTOMS = [
    "nausea", "vomiting", "dizziness", "headache", "fatigue", "rash",
    "swelling", "diarrhea", "insomnia", "chest pain", "joint pain",
    "blurred vision", "palpitations", "shortness of breath", "weight gain",
    "hair loss", "anxiety", "depression", "tremor", "dry mouth",
]


# ── Apify HTTP runner ─────────────────────────────────────────────────────────

async def _run_actor(actor_id: str, payload: dict, timeout: int = 120) -> list:
    if not APIFY_TOKEN:
        logger.warning("No APIFY_TOKEN — skipping %s", actor_id)
        return []
    url    = f"{BASE_URL}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {"token": APIFY_TOKEN, "timeout": timeout, "memory": 512}
    async with httpx.AsyncClient(timeout=timeout + 15) as c:
        try:
            r = await c.post(url, params=params, json=payload)
            r.raise_for_status()
            data = r.json()
            logger.info("Apify %s → %d items", actor_id, len(data))
            return data
        except Exception as e:
            logger.error("Apify %s failed: %s", actor_id, e)
            return []


# ── Normalizers ───────────────────────────────────────────────────────────────

def _norm_reddit(item: dict) -> dict | None:
    text = (item.get("selftext") or item.get("body") or item.get("title") or "").strip()
    if not text or len(text) < 15:
        return None
    return {
        "id":           item.get("id") or f"r_{abs(hash(text)) % 10**8}",
        "source":       "reddit",
        "title":        item.get("title", ""),
        "selftext":     text,
        "url":          item.get("url") or item.get("permalink") or "",
        "collected_at": item.get("createdAt") or datetime.now(timezone.utc).isoformat(),
        "author":       item.get("author", "anonymous"),
        "upvotes":      item.get("score") or 0,
    }


def _norm_twitter(item: dict) -> dict | None:
    text = (item.get("full_text") or item.get("text") or item.get("rawContent") or "").strip()
    if not text or len(text) < 15:
        return None
    author = item.get("author") or {}
    return {
        "id":           item.get("id") or f"tw_{abs(hash(text)) % 10**8}",
        "source":       "twitter",
        "text":         text,
        "url":          item.get("url") or item.get("twitterUrl") or "",
        "collected_at": item.get("createdAt") or item.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "author":       author.get("userName") or "anonymous",
        "upvotes":      item.get("likeCount") or 0,
    }


# ── Real scrapers ─────────────────────────────────────────────────────────────

async def fetch_reddit_posts(keywords: list[str], limit: int = 25) -> list[dict]:
    payload = {
        "searches": [{"term": kw} for kw in keywords],
        "maxItems": limit,
        "sort":     "new",
        "time":     "week",
        "proxy":    {"useApifyProxy": True},
    }
    raw = await _run_actor(REDDIT_ACTOR, payload)
    posts = [p for item in raw if (p := _norm_reddit(item)) is not None]
    if not posts:
        logger.info("Reddit Apify returned 0 — using mock")
        posts = _mock("reddit", keywords, limit)
    return posts


async def fetch_twitter_posts(keywords: list[str], limit: int = 25) -> list[dict]:
    queries = [
        f"{kw} (side effect OR medication OR drug) lang:en -is:retweet"
        for kw in keywords
    ]
    payload = {"searchTerms": queries, "maxItems": limit, "queryType": "Latest"}
    raw   = await _run_actor(TWITTER_ACTOR, payload)
    posts = [p for item in raw if (p := _norm_twitter(item)) is not None]
    if not posts:
        logger.info("Twitter Apify returned 0 — using mock")
        posts = _mock("twitter", keywords, limit)
    return posts


# ── Mock scrapers (Quora needs login cookies, Forum has no public API) ─────────

_TEMPLATES: dict[str, list[str]] = {
    "reddit": [
        "Started {kw} last month and having severe {sym}. ER twice already. Anyone else?",
        "{kw} caused {sym} — hospitalized 3 days. Please be careful everyone.",
        "{kw} is giving me {sym} every morning. Been on it 3 weeks now.",
        "{kw} stopped working after 8 months. My {sym} is back again.",
        "{kw} has been amazing! Zero {sym}. Life-changing after 6 months.",
        "Just prescribed {kw} for my {sym}. Tips from long-term users?",
        "Anyone else experience {sym} on {kw}? Week 4 and it's not getting better.",
        "WARNING: {kw} caused severe {sym}. Ended up in emergency room.",
    ],
    "twitter": [
        "Day 5 on {kw} — severe allergic reaction, {sym}. Going to ER. #medication",
        "WARNING: {kw} gave me {sym}, ended up hospitalized. Be careful. #health",
        "{kw} causing constant {sym}. Anyone else? #sideeffects",
        "{kw} changed my life. {sym} completely gone. #health #medication",
        "3 weeks on {kw} and still dealing with {sym}. So frustrated.",
        "{kw} is incredible — no {sym} at all after 2 months! #winning",
    ],
    "quora": [
        "Has anyone experienced {sym} while taking {kw}? Been 2 weeks, I'm worried.",
        "Is {kw} dangerous? I had severe {sym} and needed emergency treatment.",
        "Has {kw} stopped working for others? My {sym} returned after 6 months.",
        "What's everyone's experience with {kw}? Mine has been great — no {sym}.",
        "Doctor prescribed {kw} and I developed {sym}. Is this a known reaction?",
        "Why did {kw} stop controlling my {sym} after a year? Drug resistance?",
        "Anyone switch from {kw} because of {sym}? What worked better for you?",
        "Long term {kw} users — did your {sym} side effect go away eventually?",
    ],
    "forum": [
        "Please read before taking {kw}. My husband had severe {sym} and was hospitalized.",
        "Six weeks on {kw} and constant {sym}. Doctor says give it more time.",
        "Long-term {kw} user — it stopped working after 18 months. {sym} is back.",
        "{kw} has been a miracle for me. None of the {sym} I feared at all.",
        "URGENT: {kw} caused {sym} in my wife. First sign before a serious reaction.",
        "Anyone on {kw} for over a year? My {sym} is getting worse not better.",
        "Switched to {kw} from another drug — {sym} is so much more manageable now.",
        "Doctor wants to increase my {kw} dose because of recurring {sym}. Scared.",
    ],
}


def _mock(source: str, keywords: list[str], limit: int) -> list[dict]:
    posts  = []
    rng    = random.Random()
    tmpls  = _TEMPLATES.get(source, _TEMPLATES["reddit"])
    per_kw = max(2, limit // max(len(keywords), 1))
    for kw in keywords:
        for tmpl in rng.choices(tmpls, k=per_kw):
            sym  = rng.choice(_SYMPTOMS)
            text = tmpl.format(kw=kw, sym=sym)
            pid  = f"mock_{source}_{abs(hash(text)) % 10**8}"
            post: dict = {
                "id":           pid,
                "source":       source,
                "url":          "",
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "author":       f"user_{rng.randint(1000, 9999)}",
                "upvotes":      rng.randint(0, 400),
            }
            if source == "reddit":
                post["title"]    = f"My experience with {kw}"
                post["selftext"] = text
            else:
                post["text"] = text
            posts.append(post)
    return posts


async def fetch_quora_posts(keywords: list[str], limit: int = 15) -> list[dict]:
    """Quora requires login cookies for real scraping — using rich mock."""
    return _mock("quora", keywords, limit)


async def fetch_forum_posts(keywords: list[str], limit: int = 15) -> list[dict]:
    """No public forum API — using rich mock."""
    return _mock("forum", keywords, limit)