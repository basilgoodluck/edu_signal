from fastapi import APIRouter, HTTPException

from db.session import get_pool
from dto.mappers import map_evidence
from tasks.scrape_jobs import enqueue_scan

router = APIRouter()


def map_step(row):
    return {
        "index": row["step_index"],
        "label": row["label"],
        "source": row["source"],
        "status": row["status"],
    }


async def scan_status_payload(conn, scan_id: str):
    scan = await conn.fetchrow("SELECT * FROM scan_runs WHERE id = $1", scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    steps = await conn.fetch(
        "SELECT * FROM scan_steps WHERE scan_id = $1 ORDER BY step_index",
        scan_id,
    )
    found = await conn.fetch(
        """
        SELECT * FROM evidence
        WHERE district_id = $1 AND scraped_at >= $2
        ORDER BY scraped_at DESC
        LIMIT 50
        """,
        scan["district_id"],
        scan["created_at"],
    )
    return {
        "scanId": str(scan["id"]),
        "districtId": str(scan["district_id"]),
        "status": scan["status"],
        "steps": [map_step(row) for row in steps],
        "found": [map_evidence(row) for row in found],
    }


@router.post("")
async def create_scan(body: dict):
    district_id = body.get("districtId") or body.get("district_id")
    if not district_id:
        raise HTTPException(status_code=422, detail="districtId is required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await conn.fetchrow("SELECT * FROM districts WHERE id = $1", district_id)
        if not district:
            raise HTTPException(status_code=404, detail="District not found")

    scan = await enqueue_scan(str(district["id"]), district["name"], district["state"], sources=body.get("sources"))
    async with pool.acquire() as conn:
        return await scan_status_payload(conn, scan["scanId"])


@router.get("/{scan_id}")
async def get_scan(scan_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await scan_status_payload(conn, scan_id)
