from fastapi import APIRouter, HTTPException, Query

from db.session import get_pool
from dto.mappers import SOURCE_META, map_evidence_feed, normalize_source_type
from models.schemas import EvidenceClassifyRequest

router = APIRouter()
internal_router = APIRouter()


@router.get("")
async def evidence_feed(
    districtId: str | None = None,
    classification: str | None = None,
    sourceType: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = None,
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT e.*, d.name AS district_name, d.state AS district_state, ca.cluster_label
            FROM evidence e
            JOIN districts d ON d.id = e.district_id
            LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
            WHERE ($1::uuid IS NULL OR e.district_id = $1::uuid)
              AND ($2::text IS NULL OR e.classification = $2)
              AND ($3::text IS NULL OR e.source_type = $3)
              AND ($4::uuid IS NULL OR e.id < $4::uuid)
            ORDER BY e.scraped_at DESC, e.id DESC
            LIMIT $5
            """,
            districtId,
            classification,
            sourceType,
            cursor,
            limit + 1,
        )
    items = [map_evidence_feed(row) for row in rows[:limit]]
    return {"items": items, "nextCursor": str(rows[limit]["id"]) if len(rows) > limit else None}


@router.get("/summary")
async def evidence_summary():
    pool = await get_pool()
    async with pool.acquire() as conn:
        classification_rows = await conn.fetch(
            "SELECT classification, COUNT(*) AS count FROM evidence GROUP BY classification"
        )
        source_rows = await conn.fetch(
            "SELECT source_type, COUNT(*) AS count FROM evidence GROUP BY source_type"
        )
    classification_counts = {"Supporting": 0, "Contradicting": 0, "Irrelevant": 0}
    for row in classification_rows:
        classification_counts[row["classification"]] = row["count"]

    source_counts = {}
    for row in source_rows:
        source = normalize_source_type(row["source_type"])
        source_counts[source] = source_counts.get(source, 0) + row["count"]

    return {
        "classificationCounts": classification_counts,
        "sourceCounts": source_counts,
        "sourceMeta": SOURCE_META,
    }


@internal_router.post("/classify")
async def classify_evidence_endpoint(request: EvidenceClassifyRequest):
    from scrapers.classifier import classify_evidence

    try:
        result = await classify_evidence(request.evidence_text, request.cluster_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Classification failed: {exc}") from exc
    return result
