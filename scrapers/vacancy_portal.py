import httpx
import os

BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_UNLOCKER_URL = "https://api.brightdata.com/request"

STATE_PORTAL_URLS = {
    "Bihar": "https://bpsc.bih.nic.in/teacher-vacancy",
    "Uttar Pradesh": "https://upsessb.pariksha.nic.in/vacancy",
    "Rajasthan": "https://rsmssb.rajasthan.gov.in/vacancy",
    "Madhya Pradesh": "https://mpesb.mp.gov.in/vacancy",
    "Jharkhand": "https://jssc.nic.in/teacher-vacancy",
}


async def fetch_portal_page(url: str) -> str:
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


async def scrape_vacancy_portal(state: str, district: str) -> dict:
    url = STATE_PORTAL_URLS.get(state)
    if not url:
        return {"error": f"No portal URL configured for state: {state}", "district": district}

    raw_html = await fetch_portal_page(url)

    return {
        "district": district,
        "state": state,
        "portal_url": url,
        "raw_html": raw_html,
    }
