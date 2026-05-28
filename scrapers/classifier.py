import httpx
import os

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

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

Format your response exactly as:
RAW: [exact quote or headline from the evidence]
CLASSIFICATION: Supporting | Contradicting | Irrelevant
REASON: [one sentence]"""


def parse_classification(response_text: str) -> dict:
    lines = response_text.strip().splitlines()
    result = {"raw": "", "classification": "Irrelevant", "reason": ""}
    for line in lines:
        if line.startswith("RAW:"):
            result["raw"] = line.replace("RAW:", "").strip()
        elif line.startswith("CLASSIFICATION:"):
            result["classification"] = line.replace("CLASSIFICATION:", "").strip()
        elif line.startswith("REASON:"):
            result["reason"] = line.replace("REASON:", "").strip()
    return result


async def classify_evidence(evidence_text: str, cluster_type: str) -> dict:
    hypothesis = CLUSTER_HYPOTHESES.get(cluster_type, cluster_type)
    prompt = CLASSIFICATION_PROMPT.format(hypothesis=hypothesis, evidence=evidence_text)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 300,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        data = response.json()

    raw_text = data["content"][0]["text"]
    parsed = parse_classification(raw_text)
    parsed["cluster_type"] = cluster_type
    parsed["hypothesis"] = hypothesis
    return parsed
