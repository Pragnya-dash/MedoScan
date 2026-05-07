"""Realistic demo posts. Generates ~120 posts across 14 days, multiple drugs and signals."""
from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

# (drug, source-skewing, weight) — weight = relative volume of mentions
DRUGS = [
    "Metformin", "Lisinopril", "Ozempic", "Humira", "Gabapentin",
    "Jardiance", "Lipitor", "Wegovy", "Mounjaro", "Prozac",
    "Zoloft", "Xanax", "Adderall", "Atorvastatin", "Amoxicillin",
    "Cymbalta", "Lyrica", "Synthroid", "Trulicity", "Plavix",
]

NEGATIVE_TEMPLATES = [
    ("twitter", "{drug} is making me so sick. Constant {sym} for days. Anyone else???"),
    ("reddit", "Started {drug} two weeks ago and now I have terrible {sym}. Should I stop?"),
    ("forum", "{drug} gave me severe {sym}. Doctor switching me off it."),
    ("quora", "Has anyone experienced {sym} on {drug}? It's unbearable."),
    ("twitter", "Day 4 on {drug} — woke up with brutal {sym}. Worst medication experience."),
    ("reddit", "{drug} causing constant {sym}. I'm exhausted. Anyone with a similar story?"),
]

ADVERSE_TEMPLATES = [
    ("forum", "Please be careful with {drug}. My brother started it and developed suicidal thoughts within 48 hours. Hospitalized last week."),
    ("reddit", "Severe allergic reaction to {drug} — hives everywhere, rushed to ER. Be careful."),
    ("twitter", "Started {drug} and now having seizures. Doctor calling it a serious adverse event."),
    ("forum", "My grandmother had a dangerous reaction to {drug}. ER visit, IV epinephrine. Anaphylaxis is no joke."),
    ("reddit", "Hospitalized after starting {drug}. Severe chest pain and shortness of breath."),
    ("quora", "Is {drug} dangerous? I had life-threatening swelling and rushed to emergency room."),
]

FAILURE_TEMPLATES = [
    ("quora", "Has {drug} stopped working for anyone else? I've been on it 2 years and suddenly it's useless."),
    ("reddit", "{drug} is no longer effective for my condition. Breakthrough symptoms returning every week."),
    ("forum", "After 18 months on {drug}, I've become resistant. Doctor switching me to something else."),
    ("twitter", "{drug} just isn't working anymore. Relapse symptoms are awful."),
]

POSITIVE_TEMPLATES = [
    ("reddit", "After trying 5 different meds, {drug} is finally working with zero side effects. I feel great and have so much more energy now!"),
    ("twitter", "Week 3 on {drug} — game changer honestly. No nausea, just results."),
    ("forum", "{drug} has been life-changing for me. Down 18 lbs, zero issues. Highly recommend."),
    ("quora", "{drug} works perfectly. Best medication I've tried. Sleeping great, no side effects."),
    ("twitter", "Cannot recommend {drug} enough. Six months in, perfect control. Worth it."),
    ("reddit", "Finally a drug that works! {drug} kept my levels normal for 6 months and I feel amazing."),
]

NEUTRAL_TEMPLATES = [
    ("twitter", "Just got my {drug} prescription filled. Will report back in a few weeks."),
    ("reddit", "Anyone here on {drug} for diabetes? Looking for general advice."),
    ("quora", "What's the typical dose of {drug}? Just starting out."),
    ("forum", "Any tips on taking {drug} with food vs without?"),
]

SYMPTOMS = [
    "nausea", "vomiting", "dizziness", "headache", "fatigue",
    "rash", "swelling", "diarrhea", "insomnia", "drowsiness",
    "metallic taste", "blurred vision", "joint pain", "muscle pain",
    "heartburn", "palpitations", "tremor", "memory loss", "tingling",
]


def _rid(prefix: str, *parts) -> str:
    return prefix + "_" + hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()[:10]


def get_seed_posts() -> list[dict]:
    rng = random.Random(42)  # deterministic
    now = datetime.now(timezone.utc)

    posts: list[dict] = []

    # 1) Iterate drugs, give each a realistic number of mentions across 14 days
    for drug in DRUGS:
        # weight: ozempic / wegovy / mounjaro / humira are hot drugs
        n = rng.choices(
            [3, 5, 7, 10],
            weights=[3, 4, 2, 1] if drug not in {"Ozempic", "Humira", "Gabapentin", "Wegovy", "Mounjaro"} else [1, 2, 4, 4],
        )[0]
        for _ in range(n):
            mix = rng.choices(
                ["NEGATIVE", "ADVERSE", "FAILURE", "POSITIVE", "NEUTRAL"],
                weights=[0.30, 0.10, 0.12, 0.32, 0.16],
            )[0]
            tpl_set = {
                "NEGATIVE": NEGATIVE_TEMPLATES,
                "ADVERSE": ADVERSE_TEMPLATES,
                "FAILURE": FAILURE_TEMPLATES,
                "POSITIVE": POSITIVE_TEMPLATES,
                "NEUTRAL": NEUTRAL_TEMPLATES,
            }[mix]
            source, template = rng.choice(tpl_set)
            sym = rng.choice(SYMPTOMS)
            text = template.format(drug=drug, sym=sym)

            # Spread evenly across 14 days with mild recency bias
            day_offset = rng.choices(range(14), weights=[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])[0]
            hour_jitter = rng.uniform(0, 23.5)
            collected = (now - timedelta(days=day_offset, hours=hour_jitter)).isoformat()

            pid = _rid(source, drug, mix, len(posts))
            field_key = "selftext" if source == "reddit" else ("text" if source == "twitter" else "content")
            entry: dict = {
                "id": pid,
                "source": source,
                "url": f"https://example.com/{source}/{pid}",
                "collected_at": collected,
            }
            if source == "reddit":
                entry["title"] = f"My {drug} experience"
                entry["selftext"] = text
            else:
                entry[field_key] = text
            posts.append(entry)

    # 2) Sprinkle a few PII posts to populate the PII KPI
    pii_inserts = [
        ("forum", "Email me at help@example.com if you've had similar issues with Gabapentin."),
        ("reddit", "Call me at 555-321-9981 to discuss Ozempic dosing."),
        ("forum", "I'm Sarah Johnson and I had a horrible reaction to Humira."),
    ]
    for src, txt in pii_inserts:
        pid = _rid(src, "pii", txt[:8])
        hours_ago = rng.uniform(2, 48)
        entry = {
            "id": pid,
            "source": src,
            "url": f"https://example.com/{src}/{pid}",
            "collected_at": (now - timedelta(hours=hours_ago)).isoformat(),
        }
        entry["content" if src != "reddit" else "selftext"] = txt
        if src == "reddit":
            entry["title"] = "Heads up"
        posts.append(entry)

    return posts
