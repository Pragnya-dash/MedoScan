import os
from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()

client = ApifyClient(os.getenv("APIFY_TOKEN"))


# ---------------- TWITTER/X ----------------
def fetch_twitter_posts(keyword):
    try:
        run = client.actor("apidojo/tweet-scraper").call(run_input={
            "searchTerms": [keyword],
            "maxItems": 20,
        })
        posts = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            posts.append({
                "id": item.get("id"),
                "source": "twitter",
                "text": item.get("text") or item.get("full_text"),
                "url": item.get("url"),
            })
        return posts
    except Exception as e:
        print(f"[Twitter] fetch failed: {e}")
        return []


# ---------------- REDDIT ----------------
def fetch_reddit_posts(keyword):
    try:
        run = client.actor("trudax/reddit-scraper-lite").call(run_input={
            "searches": [keyword],
            "maxItems": 20,
        })
        posts = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            posts.append({
                "id": item.get("id"),
                "source": "reddit",
                "title": item.get("title"),
                "selftext": item.get("body") or item.get("selftext") or item.get("text"),
                "url": item.get("url"),
            })
        return posts
    except Exception as e:
        print(f"[Reddit] fetch failed: {e}")
        return []


# ---------------- QUORA ----------------
def fetch_quora_posts(keyword):
    try:
        run = client.actor("apify/quora-scraper").call(run_input={
            "searchTerms": [keyword],
            "maxItems": 20,
        })
        posts = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            posts.append({
                "id": item.get("id"),
                "source": "quora",
                "text": item.get("text") or item.get("answer"),
                "url": item.get("url"),
            })
        return posts
    except Exception as e:
        print(f"[Quora] fetch failed: {e}")
        return []