import httpx
import os
from typing import Optional

BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_SERP_URL = "https://api.brightdata.com/serp"

SIGNAL_KEYWORDS = {
    "migration": "school attendance migration harvest",
    "flood": "school flood infrastructure damage",
    "teacher": "school teacher vacancy absent",
    "language": "school language barrier medium instruction",
}

LANGUAGE_BY_STATE = {
    "Bihar": "hi",
    "Uttar Pradesh": "hi",
    "Rajasthan": "hi",
    "Tamil Nadu": "ta",
    "Andhra Pradesh": "te",
    "Telangana": "te",
    "default": "hi",
}


async def scrape_news_serp(
    district_name: str,
    state: str,
    signal_type: str,
    year_range: str = "2024 2025",
    num_results: int = 10,
) -> list[dict]:
    keywords = SIGNAL_KEYWORDS.get(signal_type, signal_type)
    query = f'"{district_name}" {keywords} {year_range}'
    language = LANGUAGE_BY_STATE.get(state, LANGUAGE_BY_STATE["default"])

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            BRIGHTDATA_SERP_URL,
            headers={"Authorization": f"Bearer {BRIGHTDATA_API_KEY}"},
            json={
                "engine": "google",
                "query": query,
                "country": "in",
                "language": language,
                "num": num_results,
            },
        )
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("organic", []):
        results.append({
            "title": item.get("title"),
            "snippet": item.get("snippet"),
            "url": item.get("link"),
            "source": item.get("displayed_link"),
            "district": district_name,
            "signal_type": signal_type,
            "query": query,
        })

    return results


async def scrape_all_signals(district_name: str, state: str) -> list[dict]:
    all_results = []
    for signal_type in SIGNAL_KEYWORDS:
        results = await scrape_news_serp(district_name, state, signal_type)
        all_results.extend(results)
    return all_results
