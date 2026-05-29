import httpx
import os

BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_ZONE = os.environ.get("BRIGHTDATA_ZONE", "serp_api3")
BRIGHTDATA_URL = "https://api.brightdata.com/request"

STATE_PORTAL_URLS = {
    "Bihar": "https://bpsc.bih.nic.in/teacher-vacancy",
    "Uttar Pradesh": "https://upsessb.pariksha.nic.in/vacancy",
    "Rajasthan": "https://rsmssb.rajasthan.gov.in/vacancy",
    "Madhya Pradesh": "https://mpesb.mp.gov.in/vacancy",
    "Jharkhand": "https://jssc.nic.in/teacher-vacancy",
}


async def fetch_page(url: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            BRIGHTDATA_URL,
            headers={
                "Authorization": f"Bearer {BRIGHTDATA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"zone": BRIGHTDATA_ZONE, "url": url, "format": "raw"},
        )
        response.raise_for_status()
        data = response.json()
        # For non-SERP URLs the zone returns raw HTML in the response body
        if isinstance(data, str):
            return data
        return data.get("body", str(data))


async def scrape_vacancy_portal(state: str, district: str) -> dict:
    url = STATE_PORTAL_URLS.get(state)
    if not url:
        return {"error": f"No portal URL configured for state: {state}", "district": district}

    try:
        raw_html = await fetch_page(url)
    except Exception as exc:
        return {"error": str(exc), "district": district, "state": state}

    return {
        "district": district,
        "state": state,
        "portal_url": url,
        "raw_html": raw_html,
        "source_type": "vacancy_portal",
        "source_url": url,
    }
