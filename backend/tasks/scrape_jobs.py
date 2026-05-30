import os
import sys
import asyncio

from dotenv import load_dotenv
load_dotenv()

_tasks_dir = os.path.dirname(os.path.abspath(__file__))
# Add backend/ so `from db.xxx import` resolves
sys.path.insert(0, os.path.join(_tasks_dir, ".."))
# Add repo root so `from scrapers.xxx import` resolves
sys.path.insert(0, os.path.join(_tasks_dir, "../.."))

from celery import Celery
from dto.mappers import normalize_source_type
from sse import publish_event

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("edusignal", broker=REDIS_URL, backend=REDIS_URL)

SCAN_STEPS = [
    (0, "Search news signals", "news"),
    (1, "Check vacancy portals", "vacancy_portal"),
    (2, "Review NGO reports", "ngo_report"),
    (3, "Scan community forums", "forum"),
    (4, "Classify evidence", "classifier"),
]


async def enqueue_scan(district_id: str, district_name: str, state: str, sources: list[str] | None = None):
    from db.session import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO scan_runs (district_id, status, sources)
            VALUES ($1, 'queued', $2)
            RETURNING id
            """,
            district_id,
            sources or ["news", "vacancy_portal", "ngo_report", "forum"],
        )
        scan_id = str(row["id"])
        for index, label, source in SCAN_STEPS:
            await conn.execute(
                """
                INSERT INTO scan_steps (scan_id, step_index, label, source, status)
                VALUES ($1, $2, $3, $4, 'wait')
                """,
                scan_id,
                index,
                label,
                source,
            )

    run_scrape_job.delay(district_id, district_name, state, scan_id)
    return {"scanId": scan_id, "status": "queued"}


@celery_app.task(bind=True)
def run_scrape_job(self, district_id: str, district_name: str, state: str, scan_id: str | None = None):
    try:
        return asyncio.run(_run_scrape(district_id, district_name, state, scan_id))
    except Exception as exc:
        if scan_id:
            asyncio.run(mark_scan_failed(scan_id, str(exc)))
        raise


async def publish_scan_event(scan_id: str | None, event: dict):
    if not scan_id:
        return
    await publish_event(f"scan_{scan_id}", event)


async def mark_scan_failed(scan_id: str, message: str):
    from db.session import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE scan_runs SET status = 'failed', completed_at = NOW() WHERE id = $1",
            scan_id,
        )
        await conn.execute(
            """
            UPDATE scan_steps
            SET status = 'error', updated_at = NOW()
            WHERE scan_id = $1 AND status = 'run'
            """,
            scan_id,
        )
    await publish_scan_event(scan_id, {"type": "error", "message": message})


async def set_scan_step(conn, scan_id: str | None, step_index: int, status: str):
    if not scan_id:
        return
    row = await conn.fetchrow(
        """
        UPDATE scan_steps
        SET status = $3, updated_at = NOW()
        WHERE scan_id = $1 AND step_index = $2
        RETURNING step_index, label, source, status
        """,
        scan_id,
        step_index,
        status,
    )
    if row:
        await publish_scan_event(scan_id, {
            "type": "step",
            "step": {
                "index": row["step_index"],
                "label": row["label"],
                "source": row["source"],
                "status": row["status"],
            },
        })


async def _run_scrape(district_id: str, district_name: str, state: str, scan_id: str | None = None):
    from scrapers.news_serp import scrape_all_signals
    from scrapers.vacancy_portal import scrape_vacancy_portal
    from scrapers.ngo_reports import scrape_ngo_reports, scrape_state_edu_dept
    from scrapers.forums import scrape_forums, scrape_grievance_portal
    from scrapers.classifier import classify_evidence
    from db.session import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        if scan_id:
            await conn.execute(
                "UPDATE scan_runs SET status = 'running' WHERE id = $1",
                scan_id,
            )

    async with pool.acquire() as conn:
        await set_scan_step(conn, scan_id, 0, "run")
    news_results = await scrape_all_signals(district_name, state)
    async with pool.acquire() as conn:
        await set_scan_step(conn, scan_id, 0, "done")
        await set_scan_step(conn, scan_id, 1, "run")
    vacancy_result = await scrape_vacancy_portal(state, district_name)
    async with pool.acquire() as conn:
        await set_scan_step(conn, scan_id, 1, "done")
        await set_scan_step(conn, scan_id, 2, "run")
    ngo_results = await scrape_ngo_reports(district_name)
    edu_dept_result = await scrape_state_edu_dept(state, district_name)
    async with pool.acquire() as conn:
        await set_scan_step(conn, scan_id, 2, "done")
        await set_scan_step(conn, scan_id, 3, "run")
    forum_results = await scrape_forums(district_name)
    grievance_result = await scrape_grievance_portal(state, district_name)
    async with pool.acquire() as conn:
        await set_scan_step(conn, scan_id, 3, "done")
        await set_scan_step(conn, scan_id, 4, "run")

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

        # Limit to 10 items to stay within Gemini free-tier RPM (~15/min)
        candidates = [
            item for item in all_raw
            if "error" not in item
            and (item.get("snippet") or item.get("description") or item.get("raw_html"))
        ][:10]

        for item in candidates:
            # news_serp returns "snippet" (mapped from Bright Data's "description"); web scrapers return "raw_html"
            title = item.get("title", "")
            body = item.get("snippet") or item.get("description") or item.get("raw_html", "")[:2000]
            text = f"{title}. {body}".strip(" .")
            if not text.strip():
                continue

            try:
                classified = await classify_evidence(text, cluster_type)
                # 4s gap keeps us under the 15 RPM free-tier limit
                await asyncio.sleep(4)
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
            await publish_scan_event(scan_id, {
                "type": "evidence",
                "item": {
                    "districtId": district_id,
                    "raw": classified["raw"],
                    "sourceType": normalize_source_type(item.get("source_type", "news")),
                    "classification": classified["classification"],
                    "reason": classified["reason"],
                    "url": item.get("url") or item.get("source_url") or "",
                },
            })

        await set_scan_step(conn, scan_id, 4, "done")
        if scan_id:
            await conn.execute(
                "UPDATE scan_runs SET status = 'complete', completed_at = NOW() WHERE id = $1",
                scan_id,
            )

    await publish_scan_event(scan_id, {
        "type": "complete",
        "scan": {"scanId": scan_id, "districtId": district_id, "status": "complete"},
    })
    return {"district_id": district_id, "scan_id": scan_id, "evidence_saved": saved}
