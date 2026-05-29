import httpx
import os
import urllib.parse
from typing import Optional

BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_ZONE = os.environ.get("BRIGHTDATA_ZONE", "serp_api3")
BRIGHTDATA_URL = "https://api.brightdata.com/request"

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
    raw_query = f'"{district_name}" {keywords} {year_range}'
    query = urllib.parse.quote(raw_query)
    language = LANGUAGE_BY_STATE.get(state, LANGUAGE_BY_STATE["default"])

    google_url = (
        f"https://www.google.com/search"
        f"?q={query}&gl=in&hl={language}&num={num_results}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            BRIGHTDATA_URL,
            headers={
                "Authorization": f"Bearer {BRIGHTDATA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"zone": BRIGHTDATA_ZONE, "url": google_url, "format": "raw"},
        )
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("organic", []):
        results.append({
            "title": item.get("title", ""),
            # Bright Data SERP returns "description", not "snippet"
            "snippet": item.get("description", ""),
            "url": item.get("link", ""),
            "source": item.get("source", ""),
            "district": district_name,
            "signal_type": signal_type,
            "query": raw_query,
            "source_type": "news",
        })

    return results


async def scrape_all_signals(district_name: str, state: str) -> list[dict]:
    all_results = []
    for signal_type in SIGNAL_KEYWORDS:
        try:
            results = await scrape_news_serp(district_name, state, signal_type)
            all_results.extend(results)
        except Exception as exc:
            all_results.append({"error": str(exc), "signal_type": signal_type})
    return all_results
