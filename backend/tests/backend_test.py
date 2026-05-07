"""MedoScan backend API tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
def test_health(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


# --- Seed ---
def test_seed(session):
    r = session.post(f"{API}/seed", timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["seeded"] >= 15


# --- Stats ---
def test_stats(session):
    r = session.get(f"{API}/stats?hours=168", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_posts", "signal_distribution", "sentiment_distribution",
              "source_distribution", "timeline", "top_drugs", "pii_flagged"]:
        assert k in d, f"missing {k}"
    assert d["total_posts"] >= 15
    # Distribution should include diverse signals
    assert "ADVERSE_EVENT" in d["signal_distribution"]
    assert "POSITIVE_OUTCOME" in d["signal_distribution"]


# --- Posts list ---
def test_list_posts(session):
    r = session.get(f"{API}/posts?hours=720&limit=50", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["count"] >= 15
    p = d["posts"][0]
    for k in ["post_id", "source", "signal_type", "sentiment", "preview", "drugs"]:
        assert k in p


# --- Post detail ---
def test_post_detail(session):
    r = session.get(f"{API}/posts?hours=720&limit=5", timeout=30)
    pid = r.json()["posts"][0]["post_id"]
    r2 = session.get(f"{API}/posts/{pid}", timeout=30)
    assert r2.status_code == 200
    detail = r2.json()
    for k in ["entities", "sentiment", "pii", "adverse_event", "cleaned_text"]:
        assert k in detail


def test_post_detail_404(session):
    r = session.get(f"{API}/posts/does-not-exist-xyz", timeout=15)
    assert r.status_code == 404


# --- Alerts ---
def test_alerts(session):
    r = session.get(f"{API}/alerts?hours=720", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "alerts" in d
    if d["alerts"]:
        a = d["alerts"][0]
        assert a["signal_type"] in {"ADVERSE_EVENT", "TREATMENT_FAILURE"}
        assert a["severity"] in {"critical", "high"}


# --- Report ---
def test_report(session):
    r = session.get(f"{API}/report?hours=720", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "trending_signals" in d
    assert "top_drugs" in d


# --- Signals ---
def test_signals(session):
    r = session.get(f"{API}/signals?hours=720", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "signals" in d
    assert isinstance(d["signals"], dict)


# --- Analyze ---
def test_analyze_positive(session):
    payload = {"text": "Jardiance has been amazing for my diabetes, my A1C dropped from 9.2 to 6.5 in three months and I feel great!"}
    r = session.post(f"{API}/analyze", json=payload, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["success"] is True
    assert d["signal_type"] in {"POSITIVE_OUTCOME", "GENERAL"}
    # ideally POSITIVE_OUTCOME
    assert d["sentiment"] in {"POSITIVE", "NEUTRAL"}


def test_analyze_adverse(session):
    payload = {"text": "Started Gabapentin last week and now I'm having severe suicidal thoughts and want to harm myself. This medication is dangerous."}
    r = session.post(f"{API}/analyze", json=payload, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["signal_type"] == "ADVERSE_EVENT", f"expected ADVERSE_EVENT, got {d['signal_type']}"


def test_analyze_pii_redaction(session):
    payload = {"text": "Contact me at john.doe@example.com about my Lipitor reaction please."}
    r = session.post(f"{API}/analyze", json=payload, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["has_pii"] is True
    redacted = d["full_result"].get("redacted_text", "")
    assert "john.doe@example.com" not in redacted


def test_analyze_no_text(session):
    r = session.post(f"{API}/analyze", json={"text": ""}, timeout=15)
    assert r.status_code in (400, 422)


# --- Analyze batch ---
def test_analyze_batch(session):
    payload = {
        "posts": [
            {"id": "TEST_b1", "source": "manual", "text": "Metformin caused severe nausea and stomach pain."},
            {"id": "TEST_b2", "source": "manual", "text": "Ozempic worked great, lost 30 pounds and feel healthy!"},
            {"id": "TEST_b3", "source": "manual", "text": "Lipitor stopped working, my cholesterol is back up."},
        ]
    }
    r = session.post(f"{API}/analyze/batch", json=payload, timeout=120)
    assert r.status_code == 200
    d = r.json()
    assert d["processed"] == 3
    assert "signal_counts" in d
    assert len(d["results"]) == 3
