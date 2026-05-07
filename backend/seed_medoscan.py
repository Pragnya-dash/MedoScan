"""
seed_medoscan.py
────────────────
Populates MongoDB Atlas with 97 realistic posts matching the MedoScan
dashboard exactly as shown in the Emergent AI preview screenshots.

Usage:
    cd C:\MedoScan\backend
    venv\Scripts\activate
    python seed_medoscan.py

Requirements: pymongo, python-dotenv  (already installed in your venv)
"""

from __future__ import annotations
import os
import random
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL") or os.getenv("DATABASE_URL") or os.getenv("MONGO_URI")
if not MONGO_URL:
    raise RuntimeError(
        "Could not find MongoDB URL in .env — "
        "set MONGODB_URL, DATABASE_URL, or MONGO_URI"
    )

client = MongoClient(MONGO_URL)
db = client.get_default_database()          # uses DB name from the connection string
collection = db["posts"]                    # adjust if your collection is named differently

print(f"Connected → {db.name}.posts")

# ── Wipe existing seed data so re-runs are idempotent ──────────────────────────
result = collection.delete_many({"pipeline_version": "1.0.0"})
print(f"Cleared {result.deleted_count} existing seeded posts")


# ── Helpers ────────────────────────────────────────────────────────────────────

START = datetime(2026, 4, 30, tzinfo=timezone.utc)
END   = datetime(2026, 5, 7, 23, 59, 59, tzinfo=timezone.utc)

def rand_dt(start: datetime = START, end: datetime = END) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

SOURCES = ["twitter", "quora", "reddit", "forum"]

# ── Drug catalogue with realistic symptom mappings ────────────────────────────

DRUG_PROFILES = {
    "Mounjaro": {
        "symptoms": ["memory loss", "vomiting", "joint pain", "drowsiness", "nausea"],
        "conditions": ["type 2 diabetes", "obesity", "weight management"],
        "signal_weights": {"side_effect": 4, "positive_outcome": 3, "general": 2, "adverse_event": 0, "treatment_failure": 0},
    },
    "Trulicity": {
        "symptoms": ["memory loss", "nausea", "diarrhea", "fatigue"],
        "conditions": ["type 2 diabetes", "cardiovascular disease"],
        "signal_weights": {"side_effect": 3, "positive_outcome": 3, "general": 2, "adverse_event": 1, "treatment_failure": 0},
    },
    "Prozac": {
        "symptoms": ["suicidal thoughts", "suicidal ideation", "fatigue", "headache"],
        "conditions": ["depression", "OCD", "anxiety", "panic disorder"],
        "signal_weights": {"adverse_event": 3, "side_effect": 3, "general": 2, "positive_outcome": 1, "treatment_failure": 0},
    },
    "Cymbalta": {
        "symptoms": ["vomiting", "fatigue", "dizziness", "nausea", "drowsiness"],
        "conditions": ["depression", "fibromyalgia", "nerve pain", "anxiety"],
        "signal_weights": {"side_effect": 4, "positive_outcome": 2, "general": 2, "adverse_event": 1, "treatment_failure": 0},
    },
    "Metformin": {
        "symptoms": ["diarrhea", "dizziness", "nausea", "metallic taste", "fatigue"],
        "conditions": ["type 2 diabetes", "prediabetes", "PCOS"],
        "signal_weights": {"side_effect": 3, "adverse_event": 2, "general": 2, "positive_outcome": 1, "treatment_failure": 1},
    },
    "Zoloft": {
        "symptoms": ["heartburn", "nausea", "drowsiness", "insomnia", "dizziness"],
        "conditions": ["depression", "PTSD", "social anxiety", "OCD"],
        "signal_weights": {"side_effect": 3, "adverse_event": 1, "general": 3, "positive_outcome": 2, "treatment_failure": 0},
    },
    "Humira": {
        "symptoms": ["joint pain", "headache", "injection site reaction", "fatigue"],
        "conditions": ["rheumatoid arthritis", "psoriasis", "Crohn's disease", "ankylosing spondylitis"],
        "signal_weights": {"side_effect": 3, "treatment_failure": 2, "general": 2, "positive_outcome": 2, "adverse_event": 1},
    },
    "Ozempic": {
        "symptoms": ["vomiting", "nausea", "diarrhea", "dizziness", "fatigue"],
        "conditions": ["type 2 diabetes", "obesity", "cardiovascular disease"],
        "signal_weights": {"side_effect": 4, "positive_outcome": 2, "general": 2, "adverse_event": 1, "treatment_failure": 0},
    },
    "Lipitor": {
        "symptoms": ["muscle pain", "joint pain", "fatigue", "memory issues", "dizziness"],
        "conditions": ["high cholesterol", "cardiovascular disease", "heart disease"],
        "signal_weights": {"side_effect": 3, "general": 3, "positive_outcome": 2, "adverse_event": 1, "treatment_failure": 0},
    },
    "Gabapentin": {
        "symptoms": ["suicidal thoughts", "dizziness", "drowsiness", "fatigue", "nausea"],
        "conditions": ["nerve pain", "epilepsy", "fibromyalgia", "restless leg syndrome"],
        "signal_weights": {"adverse_event": 2, "side_effect": 3, "general": 2, "positive_outcome": 1, "treatment_failure": 1},
    },
}

# ── Post templates per signal type ────────────────────────────────────────────

TEMPLATES = {
    "adverse_event": [
        ("My {relative} had a dangerous reaction to {drug}. ER visit, IV epinephrine. Anaphylaxis is no joke.",
         "forum", "negative", 0.88, False),
        ("Please be careful with {drug}. Started it for {condition} and began having {symptom} within 48 hours. Hospitalized.",
         "forum", "negative", 0.91, True),
        ("{drug} warning! My {relative} is in the hospital after starting this for {condition}. {symptom} within days.",
         "reddit", "negative", 0.85, False),
        ("Serious adverse reaction to {drug}. Rushed to ER — {symptom}. Doctor said it was drug-induced.",
         "twitter", "negative", 0.87, False),
        ("Has anyone else had a severe reaction to {drug}? I ended up with {symptom} and had to stop immediately.",
         "quora", "negative", 0.82, False),
        ("{drug} nearly killed me. Developed {symptom} after just one week. ICU for 3 days.",
         "forum", "negative", 0.93, True),
        ("Filing a report with my doctor — {drug} caused {symptom} severe enough to require emergency care.",
         "reddit", "negative", 0.86, False),
        ("ADR alert: {drug} + {condition} patient developed {symptom}. Needs more black-box warnings.",
         "forum", "negative", 0.89, False),
    ],
    "side_effect": [
        ("Day 4 on {drug} — woke up with brutal {symptom}. Worst medication experience.",
         "twitter", "negative", 0.79, False),
        ("I started {drug} last week. Since then I've had constant {symptom} and {symptom2}.",
         "twitter", "neutral", 0.74, True),
        ("{drug} is making me so sick. Constant {symptom} for 3 days straight. Is this normal?",
         "twitter", "negative", 0.81, False),
        ("Week 2 on {drug} for {condition}. The {symptom} is brutal but the drug seems to be working.",
         "reddit", "neutral", 0.72, False),
        ("Anyone else experience {symptom} on {drug}? Been dealing with it since I started {condition} treatment.",
         "quora", "neutral", 0.68, False),
        ("Side effect check: {drug} causing {symptom} and {symptom2}. My doctor says push through it.",
         "reddit", "negative", 0.76, False),
        ("{drug} works for my {condition} but the {symptom} side effect is really affecting my quality of life.",
         "forum", "negative", 0.73, False),
        ("Update on {drug}: {symptom} got worse in week 3. Considering switching. Anyone had similar?",
         "quora", "neutral", 0.70, False),
        ("Just started {drug} — mild {symptom} so far but manageable. Hoping it settles down.",
         "twitter", "neutral", 0.65, False),
        ("{drug} giving me {symptom} every morning. Taking it at night now to see if it helps.",
         "reddit", "neutral", 0.71, False),
    ],
    "positive_outcome": [
        ("Cannot recommend {drug} enough. Six months in, perfect control. Worth it.",
         "twitter", "positive", 0.88, False),
        ("{drug} has been life-changing for me. Down 18 lbs, zero issues. Highly recommend.",
         "reddit", "positive", 0.91, False),
        ("After trying 5 different meds, {drug} is finally working for my {condition} with zero side effects. I feel great!",
         "reddit", "positive", 0.85, False),
        ("3 months on {drug} for {condition}. My numbers are perfect. Doctor is thrilled. No side effects at all.",
         "forum", "positive", 0.87, False),
        ("{drug} changed my life. {condition} completely under control. Have so much more energy now!",
         "quora", "positive", 0.83, False),
        ("Finally found relief with {drug}! After years of struggling with {condition}, this is amazing.",
         "twitter", "positive", 0.89, False),
        ("{drug} success story: 6 months in, {condition} in remission. Life is genuinely better.",
         "reddit", "positive", 0.84, False),
        ("Switched to {drug} after {condition} wasn't responding to other meds. Best decision I've made.",
         "quora", "positive", 0.80, False),
        ("{drug} review: 10/10. {condition} managed, energy back, no side effects. Stick with it!",
         "forum", "positive", 0.82, False),
    ],
    "treatment_failure": [
        ("Has {drug} stopped working for anyone else? Been on it 2 years for {condition} but it's failing me now.",
         "quora", "negative", 0.78, False),
        ("{drug} was working great for my {condition} but after 18 months it just stopped. Switching to a new biological soon.",
         "reddit", "negative", 0.75, False),
        ("My {condition} is back even though I'm on {drug}. Doctor thinks I've developed resistance. Devastating.",
         "forum", "negative", 0.81, False),
        ("Treatment failure with {drug} — {condition} not responding anymore after a good 12-month run.",
         "twitter", "negative", 0.77, False),
    ],
    "general": [
        ("What's the typical dose of {drug}? Just starting out.",
         "quora", "neutral", 0.55, False),
        ("Anyone here on {drug} for {condition}? Looking for experiences and advice.",
         "reddit", "neutral", 0.52, False),
        ("Just got prescribed {drug} for my {condition}. A bit nervous. Any tips?",
         "twitter", "neutral", 0.58, False),
        ("My {relative} was just put on {drug} — anyone have experience with it for {condition}?",
         "quora", "neutral", 0.54, False),
        ("How long does {drug} take to work for {condition}? Been on it 3 weeks.",
         "reddit", "neutral", 0.56, False),
        ("Can {drug} be taken with other meds? My doctor prescribed it alongside {condition} treatment.",
         "forum", "neutral", 0.53, False),
        ("{drug} update: still adjusting. {condition} improving slowly but no major complaints.",
         "twitter", "neutral", 0.60, False),
        ("Research question: what's the mechanism of action for {drug} in treating {condition}?",
         "quora", "neutral", 0.51, False),
        ("Insurance finally approved {drug} for my {condition}. Hoping it works as well as people say.",
         "reddit", "neutral", 0.57, False),
        ("My {relative} update: Zoloft causing constant heartburn. I'm exhausted. Anyone with a similar story?",
         "reddit", "neutral", 0.59, True),
    ],
}

# PII templates for the 7 flagged posts
PII_TEMPLATES = [
    "I started {drug} and {drug2} last week. Since then I've had constant {symptom}. "
    "My doctor, Dr. Smith, says it's normal but I feel terrible. Contact me at john.doe@email.com if you had this too.",
    "Had a reaction to {drug} — please call 555-0199 if you know more about this.",
    "My son started {drug} for his {condition}. He's in the hospital in New York. So scared. "
    "Dr. Williams at NYU said it was drug-induced. Email me at sarah.m@gmail.com",
    "WARNING about {drug}! I'm Jane from Chicago. This drug made my {condition} so much worse. Call us at 312-555-0188.",
    "Update on {drug}: still dealing with {symptom}. My email is patient92@yahoo.com if anyone wants to connect.",
    "Has anyone in Houston had {symptom} from {drug}? Please reach out — my phone is 713-555-0231. Desperate for answers.",
    "{drug} adverse event — I need legal help. Contact Mike at mike.attorney@lawfirm.com. Living in Dallas.",
]

RELATIVES = ["brother", "mother", "father", "grandmother", "sister", "husband", "wife", "aunt"]

def pick_weighted_signal(profile: dict) -> str:
    weights = profile["signal_weights"]
    options = list(weights.keys())
    wvals   = list(weights.values())
    return random.choices(options, weights=wvals, k=1)[0]

def build_entity(text: str, label: str, start: int, confidence: float) -> dict:
    return {
        "text": text,
        "label": label,
        "start": start,
        "end": start + len(text),
        "confidence": round(confidence, 3),
        "source_model": "en_ner_bc5cdr",
    }

def build_sentiment(label: str, score: float) -> dict:
    if label == "positive":
        raw = {"positive": score, "neutral": round((1 - score) * 0.6, 3), "negative": round((1 - score) * 0.4, 3)}
    elif label == "negative":
        raw = {"negative": score, "neutral": round((1 - score) * 0.6, 3), "positive": round((1 - score) * 0.4, 3)}
    else:
        raw = {"neutral": score, "negative": round((1 - score) * 0.5, 3), "positive": round((1 - score) * 0.5, 3)}
    return {
        "label": label,
        "score": round(score, 3),
        "raw_scores": raw,
        "model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
    }

def build_pii(has_pii: bool, text: str) -> dict:
    if not has_pii:
        return {"has_pii": False, "spans": [], "redacted_text": None}
    # Pick a realistic PII type to redact
    pii_types = [
        ("EMAIL_ADDRESS", "john.doe@email.com"),
        ("PHONE_NUMBER", "555-0199"),
        ("LOCATION", "New York"),
        ("EMAIL_ADDRESS", "sarah.m@gmail.com"),
        ("PHONE_NUMBER", "312-555-0188"),
    ]
    ptype, pval = random.choice(pii_types)
    redacted = text.replace(pval, f"<{ptype}>") if pval in text else text + f" [<{ptype}> redacted]"
    return {
        "has_pii": True,
        "spans": [{
            "text": pval,
            "pii_type": ptype,
            "start": text.find(pval) if pval in text else 0,
            "end": text.find(pval) + len(pval) if pval in text else len(pval),
            "score": round(random.uniform(0.82, 0.97), 3),
        }],
        "redacted_text": redacted,
    }

def build_adverse_event(signal_type: str, drug: str, symptoms: list, confidence: float) -> dict:
    reasonings = {
        "adverse_event": [
            f"Post explicitly mentions hospitalisation and {symptoms[0]} after drug initiation. Classic ADR.",
            f"Patient describes emergency intervention following {drug} use. High-severity adverse event confirmed.",
            f"Temporal link between {drug} start and {symptoms[0]} onset. Causality assessment: probable.",
        ],
        "side_effect": [
            f"Patient self-reports {symptoms[0]} as a side effect of {drug}. Rule-based NLP confirmed.",
            f"Temporal association between {drug} initiation and symptom onset is clear.",
            f"Side effect cluster around {symptoms[0]} matches known {drug} pharmacology.",
        ],
        "positive_outcome": [
            f"Patient reports successful management of condition with {drug}. Positive signal confirmed.",
            f"High confidence positive outcome: patient describes zero side effects and improved wellbeing.",
            f"Treatment success: {drug} achieving therapeutic goals per patient report.",
        ],
        "treatment_failure": [
            f"Patient describes loss of efficacy for {drug} after extended use. Treatment failure signal.",
            f"Secondary treatment failure: {drug} no longer controlling symptoms after initial success.",
        ],
        "general": [
            f"No specific safety signal detected. General inquiry about {drug}.",
            f"Informational post — no adverse event language detected.",
            f"Patient seeking general information about {drug}. Baseline monitoring.",
        ],
    }
    return {
        "signal_type": signal_type,
        "confidence": round(confidence, 3),
        "reasoning": random.choice(reasonings[signal_type]),
        "drugs_implicated": [drug],
        "symptoms_reported": symptoms[:2],
        "classified_by": "rule-based-nlp",
    }


# ── Build the 97 posts ────────────────────────────────────────────────────────

# Target distribution from screenshots:
# signal:  general·34, positive_outcome·23, side_effect·28, adverse_event·8, treatment_failure·4
# drug mentions: Mounjaro~9, Trulicity~9, Prozac~9, Cymbalta~8, Metformin~8, Zoloft~7, Humira~7, Ozempic~7, Lipitor~7, Gabapentin~6
# sources: Twitter~27, Quora~17, Reddit~26, Forum~27 (roughly even, ~24 each)
# PII: 7 posts

DRUG_COUNTS = {
    "Mounjaro": 10, "Trulicity": 10, "Prozac": 10, "Cymbalta": 9,
    "Metformin": 9, "Zoloft": 8, "Humira": 8, "Ozempic": 8,
    "Lipitor": 8, "Gabapentin": 7,
}  # total = 87, we'll fill remaining 10 by doubling some

# Expand to exactly 97 entries
drug_list: list[str] = []
for drug, count in DRUG_COUNTS.items():
    drug_list.extend([drug] * count)

# Add 10 more to hit 97
extras = ["Mounjaro", "Trulicity", "Prozac", "Metformin", "Cymbalta",
          "Zoloft", "Humira", "Ozempic", "Lipitor", "Gabapentin"]
drug_list.extend(extras)

random.shuffle(drug_list)
assert len(drug_list) == 97, f"Drug list length {len(drug_list)} != 97"

# Force the signal distribution
SIGNAL_PLAN = (
    ["general"] * 34 +
    ["positive_outcome"] * 23 +
    ["side_effect"] * 28 +
    ["adverse_event"] * 8 +
    ["treatment_failure"] * 4
)
random.shuffle(SIGNAL_PLAN)

# Force PII into 7 posts — pick indices
PII_INDICES = set(random.sample(range(97), 7))

posts = []
pii_template_idx = 0

for i, (drug, signal_type) in enumerate(zip(drug_list, SIGNAL_PLAN)):
    profile = DRUG_PROFILES[drug]
    symptoms = profile["symptoms"]
    conditions = profile["conditions"]
    has_pii = i in PII_INDICES

    # Choose template
    if has_pii and pii_template_idx < len(PII_TEMPLATES):
        raw_template = PII_TEMPLATES[pii_template_idx]
        pii_template_idx += 1
        # Fill the PII template
        drug2 = random.choice([d for d in DRUG_PROFILES if d != drug])
        raw_text = (raw_template
            .replace("{drug}", drug)
            .replace("{drug2}", drug2)
            .replace("{symptom}", random.choice(symptoms))
            .replace("{condition}", random.choice(conditions))
        )
        source = random.choice(SOURCES)
        sentiment_label = "negative"
        confidence = round(random.uniform(0.80, 0.93), 3)
    else:
        template_pool = TEMPLATES[signal_type]
        tmpl, preferred_source, sentiment_label, base_conf, _ = random.choice(template_pool)
        source = preferred_source
        confidence = round(base_conf + random.uniform(-0.06, 0.06), 3)
        confidence = max(0.50, min(0.97, confidence))

        sym1 = random.choice(symptoms)
        sym2 = random.choice([s for s in symptoms if s != sym1]) if len(symptoms) > 1 else sym1
        condition = random.choice(conditions)
        relative = random.choice(RELATIVES)

        raw_text = (tmpl
            .replace("{drug}", drug)
            .replace("{symptom2}", sym2)
            .replace("{symptom}", sym1)
            .replace("{condition}", condition)
            .replace("{relative}", relative)
        )

    # Spread timestamps realistically — more posts on recent days (matches the spike on 2026-05-05)
    day_weights = [3, 8, 10, 10, 8, 18, 22, 18]  # Apr30 through May07
    chosen_day = random.choices(range(8), weights=day_weights, k=1)[0]
    day_start = START + timedelta(days=chosen_day)
    day_end   = day_start + timedelta(hours=23, minutes=59)
    collected_at = rand_dt(day_start, day_end)

    # Sentiment score
    sentiment_score = round(random.uniform(0.65, 0.95), 3)

    # Entities
    drug_entity = build_entity(drug, "DRUG", raw_text.find(drug), round(random.uniform(0.88, 0.99), 3))
    entities = [drug_entity]
    if len(symptoms) > 0:
        sym = random.choice(symptoms)
        sym_start = raw_text.lower().find(sym.lower())
        if sym_start >= 0:
            entities.append(build_entity(sym, "SYMPTOM", sym_start, round(random.uniform(0.72, 0.92), 3)))
    if conditions:
        cond = random.choice(conditions)
        cond_start = raw_text.lower().find(cond.lower())
        if cond_start >= 0:
            entities.append(build_entity(cond, "DISEASE", cond_start, round(random.uniform(0.75, 0.93), 3)))

    post_id = make_id(source)
    processed_at = collected_at + timedelta(seconds=random.randint(2, 30))

    doc = {
        "post_id": post_id,
        "source": source,
        "url": f"https://{source}.com/post/{post_id}",
        "collected_at": collected_at,
        "raw_text": raw_text,
        "cleaned_text": raw_text,
        "entities": entities,
        "sentiment": build_sentiment(sentiment_label, sentiment_score),
        "pii": build_pii(has_pii, raw_text),
        "adverse_event": build_adverse_event(signal_type, drug, symptoms[:2], confidence),
        "processed_at": processed_at,
        "pipeline_version": "1.0.0",
    }
    posts.append(doc)


# ── Insert ─────────────────────────────────────────────────────────────────────

print(f"Inserting {len(posts)} posts…")
res = collection.insert_many(posts)
print(f"✅  Inserted {len(res.inserted_ids)} documents into '{db.name}.posts'")

# ── Verification summary ───────────────────────────────────────────────────────

from collections import Counter

signals = Counter(p["adverse_event"]["signal_type"] for p in posts)
drugs   = Counter(e["text"] for p in posts for e in p["entities"] if e["label"] == "DRUG")
sources = Counter(p["source"] for p in posts)
pii_ct  = sum(1 for p in posts if p["pii"]["has_pii"])

print("\n── Verification ──────────────────────────────────────")
print(f"  Total posts   : {len(posts)}")
print(f"  PII flagged   : {pii_ct}")
print(f"  Signal counts : {dict(signals)}")
print(f"  Source counts : {dict(sources)}")
print(f"  Top drugs     : {drugs.most_common(10)}")
print("──────────────────────────────────────────────────────")
print("\nDone! Restart your backend then refresh the dashboard.")
