import os
import sys
import asyncio

from dotenv import load_dotenv
load_dotenv()

# Add repo root so `from scrapers.xxx import` resolves
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("edusignal", broker=REDIS_URL, backend=REDIS_URL)


@celery_app.task(bind=True)
def run_scrape_job(self, district_id: str, district_name: str, state: str):
    return asyncio.run(_run_scrape(district_id, district_name, state))


async def _run_scrape(district_id: str, district_name: str, state: str):
    from scrapers.news_serp import scrape_all_signals
    from scrapers.vacancy_portal import scrape_vacancy_portal
    from scrapers.ngo_reports import scrape_ngo_reports, scrape_state_edu_dept
    from scrapers.forums import scrape_forums, scrape_grievance_portal
    from scrapers.classifier import classify_evidence
    from db.session import get_pool

    pool = await get_pool()

    news_results = await scrape_all_signals(district_name, state)
    vacancy_result = await scrape_vacancy_portal(state, district_name)
    ngo_results = await scrape_ngo_reports(district_name)
    edu_dept_result = await scrape_state_edu_dept(state, district_name)
    forum_results = await scrape_forums(district_name)
    grievance_result = await scrape_grievance_portal(state, district_name)

    all_raw = (
        news_results
        + [vacancy_result]
        + ngo_results
        + [edu_dept_result]
        + forum_results
        + [grievance_result]
    )

    saved = 0
    async with pool.acquire() as conn:
        cluster_row = await conn.fetchrow(
            "SELECT cluster_label FROM cluster_assignments WHERE district_id = $1",
            district_id,
        )
        cluster_type = cluster_row["cluster_label"] if cluster_row else "seasonal_migration"

        for item in all_raw:
            if "error" in item:
                continue
            text = item.get("snippet") or item.get("raw_html", "")[:2000]
            if not text.strip():
                continue

            try:
                classified = await classify_evidence(text, cluster_type)
            except Exception:
                continue

            await conn.execute(
                """
                INSERT INTO evidence (district_id, raw_text, source_url, source_type, classification, reason)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                district_id,
                classified["raw"],
                item.get("url") or item.get("source_url"),
                item.get("source_type", "news"),
                classified["classification"],
                classified["reason"],
            )
            saved += 1

    return {"district_id": district_id, "evidence_saved": saved}
