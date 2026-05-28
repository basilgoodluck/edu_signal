import httpx
import os

BRIGHTDATA_API_KEY = os.environ["BRIGHTDATA_API_KEY"]
BRIGHTDATA_UNLOCKER_URL = "https://api.brightdata.com/request"

NGO_SOURCES = [
    {"name": "Pratham", "url": "https://www.pratham.org/media/press-releases"},
    {"name": "Room to Read", "url": "https://www.roomtoread.org/media-center/press-releases"},
    {"name": "Teach For India", "url": "https://www.teachforindia.org/news"},
]

STATE_EDU_DEPT_URLS = {
    "Bihar": "https://state.bihar.gov.in/educationDept/CitizenHome.html",
    "Uttar Pradesh": "https://upedu.gov.in/",
    "Rajasthan": "https://rajshaladarpan.nic.in/",
    "Madhya Pradesh": "https://educationportal.mp.gov.in/",
    "Jharkhand": "https://jac.jharkhand.gov.in/jac/",
}


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


async def scrape_ngo_reports(district: str) -> list[dict]:
    results = []
    for source in NGO_SOURCES:
        raw_html = await fetch_page(source["url"])
        results.append({
            "source_name": source["name"],
            "source_url": source["url"],
            "district": district,
            "raw_html": raw_html,
            "source_type": "ngo_report",
        })
    return results


async def scrape_state_edu_dept(state: str, district: str) -> dict:
    url = STATE_EDU_DEPT_URLS.get(state)
    if not url:
        return {"error": f"No education dept URL configured for state: {state}"}

    raw_html = await fetch_page(url)
    return {
        "source_name": f"{state} Education Department",
        "source_url": url,
        "district": district,
        "state": state,
        "raw_html": raw_html,
        "source_type": "govt_press_release",
    }
