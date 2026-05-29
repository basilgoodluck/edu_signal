import asyncio
import httpx
import os

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-3.1-flash-lite:generateContent"
)

CLUSTER_HYPOTHESES = {
    "seasonal_migration": "The district is underperforming due to seasonal agricultural migration pulling children out of school during harvest periods.",
    "teacher_shortage": "The district is underperforming due to long-term teacher vacancies and understaffing.",
    "language_barrier": "The district is underperforming due to a mismatch between the medium of instruction and the language spoken at home.",
    "infrastructure": "The district is underperforming due to damaged or inadequate school infrastructure (floods, no electricity, no toilets).",
    "pedagogical_failure": "The district is underperforming despite adequate staffing and infrastructure — the teaching methods themselves are ineffective.",
}

CLASSIFICATION_PROMPT = """You are classifying evidence for or against a district root cause hypothesis.

Show the raw source excerpt first. Then classify as Supporting, Contradicting, or Irrelevant.
Then one sentence of explanation. Irrelevant is a real option — use it liberally.
Never stretch weak signals into a classification they don't belong in.

Hypothesis: {hypothesis}

Evidence: {evidence}

Respond ONLY in this format, nothing else:
RAW: [exact quote or headline from the evidence]
CLASSIFICATION: Supporting | Contradicting | Irrelevant
REASON: [one sentence]"""


def parse_classification(text: str) -> dict:
    result = {"raw": "", "classification": "Irrelevant", "reason": ""}
    for line in text.strip().splitlines():
        if line.startswith("RAW:"):
            result["raw"] = line.removeprefix("RAW:").strip()
        elif line.startswith("CLASSIFICATION:"):
            result["classification"] = line.removeprefix("CLASSIFICATION:").strip()
        elif line.startswith("REASON:"):
            result["reason"] = line.removeprefix("REASON:").strip()
    return result


async def classify_evidence(evidence_text: str, cluster_type: str) -> dict:
    hypothesis = CLUSTER_HYPOTHESES.get(cluster_type, cluster_type)
    prompt = CLASSIFICATION_PROMPT.format(hypothesis=hypothesis, evidence=evidence_text)

    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(5):
            response = await client.post(
                GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"maxOutputTokens": 300, "temperature": 0.1},
                },
            )
            if response.status_code == 429:
                # cap individual backoff at 60s; caller also paces calls every 4s
                wait = min(2 ** attempt * 5, 60)
                await asyncio.sleep(wait)
                continue
            response.raise_for_status()
            break
        else:
            response.raise_for_status()

    data = response.json()
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = parse_classification(raw_text)
    parsed["cluster_type"] = cluster_type
    parsed["hypothesis"] = hypothesis
    return parsed
