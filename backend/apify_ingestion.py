import os
from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()

client = ApifyClient(os.getenv("APIFY_TOKEN"))


# ---------------- TWITTER/X ----------------
def fetch_twitter_posts(keyword):
    run_input = {
        "searchTerms": [keyword],
        "maxItems": 20
    }

    run = client.actor("quacker/twitter-scraper").call(
        run_input=run_input
    )

    dataset = client.dataset(run["defaultDatasetId"])

    posts = []

    for item in dataset.iterate_items():
        posts.append({
            "id": item.get("id"),
            "source": "twitter",
            "text": item.get("text"),
            "url": item.get("url")
        })

    return posts


# ---------------- REDDIT ----------------
def fetch_reddit_posts(keyword):
    run_input = {
        "searches": [keyword],
        "maxItems": 20
    }

    run = client.actor("trudax/reddit-scraper").call(
        run_input=run_input
    )

    dataset = client.dataset(run["defaultDatasetId"])

    posts = []

    for item in dataset.iterate_items():
        posts.append({
            "id": item.get("id"),
            "source": "reddit",
            "title": item.get("title"),
            "selftext": item.get("text"),
            "url": item.get("url")
        })

    return posts


# ---------------- QUORA ----------------
def fetch_quora_posts(keyword):
    run_input = {
        "searchTerms": [keyword],
        "maxItems": 20
    }

    run = client.actor("apify/quora-scraper").call(
        run_input=run_input
    )

    dataset = client.dataset(run["defaultDatasetId"])

    posts = []

    for item in dataset.iterate_items():
        posts.append({
            "id": item.get("id"),
            "source": "quora",
            "text": item.get("text"),
            "url": item.get("url")
        })

    return posts