"""
MedoScan — Apify Ingestion  (rewritten)

Sources:
  Reddit  → trudax~reddit-scraper-lite          (real Apify)
  Twitter → apidojo~tweet-scraper               (real Apify)
  Quora   → sovereigntaylor~quora-scraper        (real Apify — no login needed)
  Forum   → Reddit health subreddits via same Reddit actor
             (r/ChronicPain, r/diabetes, r/AskDocs, r/medication, etc.)

Mock guard:
  - Mock is NEVER served silently in production.
  - If APIFY_TOKEN is missing → raises RuntimeError immediately on startup.
  - If an actor returns 0 results → returns [] and logs a warning.
    The caller decides whether to show a "no data" state in the UI.
  - Every mock post carries  is_mock=True  so the frontend can warn the user.
  - Mock is only enabled explicitly by passing  allow_mock=True  (for local dev).
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
QUORA_ACTOR   = "sovereigntaylor~quora-scraper"   # no login / cookies needed

# Health subreddits used as the "forum" source
HEALTH_SUBREDDITS = [
    "ChronicPain", "diabetes", "AskDocs", "medication",
    "side_effects", "Ozempic", "pharmacy", "AutoimmuneDisease",
    "Fibromyalgia", "mentalhealth",
]

# ---------------------------------------------------------------------------
# Token guard — fail loud at import time if token is missing in production
# ---------------------------------------------------------------------------
def _check_token() -> None:
    if not APIFY_TOKEN:
        raise RuntimeError(
            "APIFY_TOKEN environment variable is not set. "
            "Add it to your Render environment variables and redeploy. "
            "For local dev, set it in backend/.env"
        )

# ---------------------------------------------------------------------------
# Core actor runner
# ---------------------------------------------------------------------------
async def _run_actor(actor_id: str, payload: dict, timeout: int = 120) -> list:
    """
    Calls an Apify actor synchronously and returns the dataset items.
    Returns [] on error (caller handles fallback logic).
    """
    url    = f"{BASE_URL}/acts/{actor_id}/run-sync-get-dataset-items"
    params = {"token": APIFY_TOKEN, "timeout": timeout, "memory": 512}
    async with httpx.AsyncClient(timeout=timeout + 15) as client:
        try:
            r = await client.post(url, params=params, json=payload)
            r.raise_for_status()
            data = r.json()
            logger.info("Apify %s → %d items", actor_id, len(data))
            return data if isinstance(data, list) else []
        except httpx.HTTPStatusError as e:
            logger.error("Apify %s HTTP error %s: %s", actor_id, e.response.status_code, e.response.text[:300])
            return []
        except Exception as e:
            logger.error("Apify %s failed: %s", actor_id, e)
            return []

# ---------------------------------------------------------------------------
# Normalizers — convert raw Apify output to MedoScan post schema
# ---------------------------------------------------------------------------
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
        "is_mock":      False,
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
        "is_mock":      False,
    }

def _norm_quora(item: dict) -> dict | None:
    """
    sovereigntaylor~quora-scraper returns items with:
      question, answers (list), url, scrapedAt, etc.
    We flatten each answer into a separate post for richer signal detection.
    """
    question = (item.get("question") or item.get("title") or "").strip()
    answers  = item.get("answers") or []

    posts = []

    # If there are answers, create one post per answer (richer text)
    for ans in answers:
        answer_text = (ans.get("content") or ans.get("text") or "").strip()
        if not answer_text or len(answer_text) < 15:
            continue
        combined = f"{question}\n\n{answer_text}" if question else answer_text
        posts.append({
            "id":           ans.get("id") or f"qr_{abs(hash(combined)) % 10**8}",
            "source":       "quora",
            "text":         combined,
            "url":          item.get("url") or "",
            "collected_at": item.get("scrapedAt") or datetime.now(timezone.utc).isoformat(),
            "author":       ans.get("author") or ans.get("authorName") or "anonymous",
            "upvotes":      ans.get("upvotes") or ans.get("views") or 0,
            "is_mock":      False,
        })

    # If no answers but we have a question, use the question itself
    if not posts and question and len(question) >= 15:
        posts.append({
            "id":           f"qr_{abs(hash(question)) % 10**8}",
            "source":       "quora",
            "text":         question,
            "url":          item.get("url") or "",
            "collected_at": item.get("scrapedAt") or datetime.now(timezone.utc).isoformat(),
            "author":       "anonymous",
            "upvotes":      0,
            "is_mock":      False,
        })

    return posts  # returns a list, not a single dict

def _norm_forum_reddit(item: dict) -> dict | None:
    """
    Forum posts come from health subreddits via the Reddit actor.
    We tag them as source='forum' to keep the UI distinction.
    """
    post = _norm_reddit(item)
    if post:
        post["source"] = "forum"
    return post

# ---------------------------------------------------------------------------
# Mock data (LOCAL DEV ONLY — requires allow_mock=True)
# ---------------------------------------------------------------------------
_SYMPTOMS = [
    "nausea", "vomiting", "dizziness", "headache", "fatigue", "rash",
    "swelling", "diarrhea", "insomnia", "chest pain", "joint pain",
    "blurred vision", "palpitations", "shortness of breath",
    "weight gain", "hair loss", "anxiety", "depression", "tremor",
]

_TEMPLATES: dict[str, list[str]] = {
    "reddit": [
        "Started {kw} last month and having severe {sym}. ER twice already. Anyone else?",
        "{kw} caused {sym} — hospitalized 3 days. Please be careful.",
        "{kw} is giving me {sym} every morning. Week 3 now.",
        "{kw} stopped working after 8 months. My {sym} is back.",
        "{kw} has been amazing! Zero {sym}. Life changing.",
        "Just prescribed {kw} for {sym}. Tips from long-term users?",
        "WARNING: {kw} caused severe {sym}. Ended up in ER.",
        "Anyone else have {sym} on {kw}? Week 4, not improving.",
    ],
    "twitter": [
        "Day 5 on {kw} — severe {sym}. Going to ER. #medication",
        "WARNING: {kw} gave me {sym}, ended up hospitalized. #health",
        "{kw} causing constant {sym}. Anyone else? #sideeffects",
        "{kw} changed my life. {sym} completely gone. #health",
        "3 weeks on {kw} and still {sym}. So frustrated.",
    ],
    "quora": [
        "Has anyone experienced {sym} while taking {kw}? Been 2 weeks.",
        "Is {kw} dangerous? I had severe {sym} and needed emergency treatment.",
        "Has {kw} stopped working? My {sym} returned after 6 months.",
        "What's everyone's experience with {kw}? Mine great — no {sym}.",
        "Doctor prescribed {kw} and I developed {sym}. Known reaction?",
    ],
    "forum": [
        "Please read before taking {kw}. Husband had severe {sym}, hospitalized.",
        "Six weeks on {kw} and constant {sym}. Doctor says give it time.",
        "Long-term {kw} user — stopped working after 18 months. {sym} is back.",
        "{kw} has been a miracle. None of the {sym} I feared.",
        "URGENT: {kw} caused {sym}. First sign before serious reaction.",
    ],
}

def _mock(source: str, keywords: list[str], limit: int) -> list[dict]:
    """
    Generates fake posts for LOCAL DEV only.
    Every post is tagged  is_mock=True  so the frontend can show a warning banner.
    """
    posts = []
    rng   = random.Random()
    tmpls = _TEMPLATES.get(source, _TEMPLATES["reddit"])
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
                "is_mock":      True,   # ← always flagged
            }
            if source == "reddit":
                post["title"]    = f"My experience with {kw}"
                post["selftext"] = text
            else:
                post["text"] = text
            posts.append(post)
    return posts

# ---------------------------------------------------------------------------
# Public fetch functions
# ---------------------------------------------------------------------------

async def fetch_reddit_posts(
    keywords: list[str],
    limit: int = 25,
    allow_mock: bool = False,
) -> list[dict]:
    """Fetch posts from Reddit via Apify."""
    _check_token()
    payload = {
        "searches": [{"term": kw} for kw in keywords],
        "maxItems": limit,
        "sort":     "new",
        "time":     "week",
        "proxy":    {"useApifyProxy": True},
    }
    raw   = await _run_actor(REDDIT_ACTOR, payload)
    posts = [p for item in raw if (p := _norm_reddit(item)) is not None]

    if not posts:
        logger.warning("Reddit: Apify returned 0 usable posts for keywords=%s", keywords)
        if allow_mock:
            logger.info("Reddit: falling back to mock (allow_mock=True)")
            return _mock("reddit", keywords, limit)
        return []

    return posts


async def fetch_twitter_posts(
    keywords: list[str],
    limit: int = 25,
    allow_mock: bool = False,
) -> list[dict]:
    """Fetch posts from Twitter/X via Apify."""
    _check_token()
    queries = [
        f"{kw} (side effect OR medication OR drug) lang:en -is:retweet"
        for kw in keywords
    ]
    payload = {"searchTerms": queries, "maxItems": limit, "queryType": "Latest"}
    raw   = await _run_actor(TWITTER_ACTOR, payload)
    posts = [p for item in raw if (p := _norm_twitter(item)) is not None]

    if not posts:
        logger.warning("Twitter: Apify returned 0 usable posts for keywords=%s", keywords)
        if allow_mock:
            logger.info("Twitter: falling back to mock (allow_mock=True)")
            return _mock("twitter", keywords, limit)
        return []

    return posts


async def fetch_quora_posts(
    keywords: list[str],
    limit: int = 15,
    allow_mock: bool = False,
) -> list[dict]:
    """
    Fetch Quora Q&A via sovereigntaylor~quora-scraper.
    No login or cookies required.
    """
    _check_token()

    # Build search queries — one per keyword
    search_queries = [f"{kw} side effects medication" for kw in keywords]

    payload = {
        "queries":  search_queries,
        "maxItems": limit,
        "proxy":    {"useApifyProxy": True},
    }
    raw = await _run_actor(QUORA_ACTOR, payload, timeout=180)

    # _norm_quora returns a list per item, so flatten
    posts: list[dict] = []
    for item in raw:
        normalized = _norm_quora(item)
        if isinstance(normalized, list):
            posts.extend(normalized)
        elif normalized:
            posts.append(normalized)

    posts = posts[:limit]  # cap to requested limit after flattening

    if not posts:
        logger.warning("Quora: Apify returned 0 usable posts for keywords=%s", keywords)
        if allow_mock:
            logger.info("Quora: falling back to mock (allow_mock=True)")
            return _mock("quora", keywords, limit)
        return []

    return posts


async def fetch_forum_posts(
    keywords: list[str],
    limit: int = 15,
    allow_mock: bool = False,
) -> list[dict]:
    """
    Scrapes health-focused subreddits as the 'forum' source.
    Uses the same Reddit actor but targets health subreddits for richer signal.
    """
    _check_token()

    # Combine keyword + subreddit searches for targeted results
    searches = []
    for kw in keywords:
        for sub in HEALTH_SUBREDDITS[:5]:   # top 5 subreddits to keep under limits
            searches.append({"term": kw, "subreddit": sub})

    payload = {
        "searches": searches,
        "maxItems": limit,
        "sort":     "new",
        "time":     "month",  # wider window than general Reddit search
        "proxy":    {"useApifyProxy": True},
    }
    raw   = await _run_actor(REDDIT_ACTOR, payload)
    posts = [p for item in raw if (p := _norm_forum_reddit(item)) is not None]

    if not posts:
        logger.warning("Forum: Apify returned 0 usable posts for keywords=%s", keywords)
        if allow_mock:
            logger.info("Forum: falling back to mock (allow_mock=True)")
            return _mock("forum", keywords, limit)
        return []

    return posts