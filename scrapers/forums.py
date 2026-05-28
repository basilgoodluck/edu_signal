import httpx
import os

BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_UNLOCKER_URL = "https://api.brightdata.com/request"

FORUM_SOURCES = [
    {
        "name": "LocalCircles",
        "url_template": "https://www.localcircles.com/a/community/{district_slug}#school",
    },
]

GRIEVANCE_PORTAL_URLS = {
    "Bihar": "https://grievance.bihar.gov.in/",
    "Uttar Pradesh": "https://jansunwai.up.nic.in/",
    "Rajasthan": "https://sampark.rajasthan.gov.in/",
    "Madhya Pradesh": "https://samadhan.mp.gov.in/",
    "Jharkhand": "https://grievance.jharkhand.gov.in/",
}


def slugify(district: str) -> str:
    return district.lower().replace(" ", "-")


async def fetch_page(url: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            BRIGHTDATA_UNLOCKER_URL,
            headers={"Authorization": f"Bearer {BRIGHTDATA_API_KEY}"},
            json={
                "zone": "web_unlocker",
                "url": url,
                "format": "raw",
            },
        )
        response.raise_for_status()
        return response.text


async def scrape_forums(district: str) -> list[dict]:
    results = []
    district_slug = slugify(district)

    for source in FORUM_SOURCES:
        url = source["url_template"].format(district_slug=district_slug)
        raw_html = await fetch_page(url)
        results.append({
            "source_name": source["name"],
            "source_url": url,
            "district": district,
            "raw_html": raw_html,
            "source_type": "forum",
        })

    return results


async def scrape_grievance_portal(state: str, district: str) -> dict:
    url = GRIEVANCE_PORTAL_URLS.get(state)
    if not url:
        return {"error": f"No grievance portal configured for state: {state}"}

    raw_html = await fetch_page(url)
    return {
        "source_name": f"{state} Grievance Portal",
        "source_url": url,
        "district": district,
        "state": state,
        "raw_html": raw_html,
        "source_type": "grievance_portal",
    }
