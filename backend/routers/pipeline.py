from datetime import datetime, timezone

from fastapi import APIRouter

from db.session import get_pool
from dto.mappers import SOURCE_META, normalize_source_type, serialize

router = APIRouter()

PIPELINE_SOURCES = [
    {"id": "news", "label": "News SERP", "via": "Bright Data Google SERP", "kind": "news"},
    {"id": "satellite", "label": "Satellite signals", "via": "Bhuvan/NDVI references", "kind": "satellite"},
    {"id": "vacancy_portal", "label": "Teacher vacancies", "via": "State recruitment portals", "kind": "vacancy_portal"},
    {"id": "forum", "label": "Community forums", "via": "Forums and grievance portals", "kind": "forum"},
    {"id": "ngo_report", "label": "NGO reports", "via": "NGO and department pages", "kind": "ngo_report"},
]


async def source_rows(conn):
    counts = await conn.fetch(
        """
        SELECT source_type, COUNT(*) AS count, MAX(scraped_at) AS last_seen
        FROM evidence
        GROUP BY source_type
        """
    )
    grouped = {}
    for row in counts:
        source = normalize_source_type(row["source_type"])
        entry = grouped.setdefault(source, {"count": 0, "last_seen": None})
        entry["count"] += row["count"]
        if not entry["last_seen"] or (row["last_seen"] and row["last_seen"] > entry["last_seen"]):
            entry["last_seen"] = row["last_seen"]
    return grouped


def freshness_minutes(last_seen):
    if not last_seen:
        return 9999
    now = datetime.now(timezone.utc)
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return max(int((now - last_seen).total_seconds() / 60), 0)


@router.get("/pipeline/sources")
async def pipeline_sources():
    pool = await get_pool()
    async with pool.acquire() as conn:
        grouped = await source_rows(conn)
    items = []
    for source in PIPELINE_SOURCES:
        meta = grouped.get(source["kind"], {"count": 0, "last_seen": None})
        fresh = freshness_minutes(meta["last_seen"])
        items.append({
            "id": source["id"],
            "label": source["label"],
            "via": source["via"],
            "records": str(meta["count"]),
            "freshMin": fresh,
            "rate": round(meta["count"] / 24, 2),
            "kind": source["kind"],
            "status": "healthy" if meta["count"] > 0 and fresh < 10080 else "degraded",
        })
    return items


@router.get("/pipeline/stages")
async def pipeline_stages():
    pool = await get_pool()
    async with pool.acquire() as conn:
        latest_scan = await conn.fetchrow("SELECT * FROM scan_runs ORDER BY created_at DESC LIMIT 1")
        latest_model = await conn.fetchrow("SELECT * FROM model_runs ORDER BY trained_at DESC NULLS LAST LIMIT 1")
    scan_status = latest_scan["status"] if latest_scan else "waiting"
    model_status = "complete" if latest_model else "waiting"
    return [
        {"id": "ingest", "title": "Ingest", "sub": "Source discovery", "detail": "Configured source inventory is active.", "metric": "5", "metricLabel": "sources", "status": "running"},
        {"id": "scrape", "title": "Scrape", "sub": "Document capture", "detail": "On-demand district scans collect source evidence.", "metric": scan_status, "metricLabel": "latest scan", "status": "running" if scan_status == "running" else "complete"},
        {"id": "classify", "title": "Classify", "sub": "Evidence labeling", "detail": "Gemini classifies source snippets against cluster hypotheses.", "metric": scan_status, "metricLabel": "classifier", "status": "running" if scan_status == "running" else "complete"},
        {"id": "cluster", "title": "Cluster", "sub": "Root-cause model", "detail": "District features are clustered into cause signatures.", "metric": model_status, "metricLabel": "model", "status": model_status},
        {"id": "shap", "title": "SHAP", "sub": "Feature attribution", "detail": "Model attributions are stored with each district assignment.", "metric": model_status, "metricLabel": "explainability", "status": model_status},
        {"id": "publish", "title": "Publish", "sub": "API and streams", "detail": "REST and SSE endpoints expose current signals.", "metric": "live", "metricLabel": "API", "status": "running"},
    ]


@router.get("/pipeline/overview")
async def pipeline_overview():
    pool = await get_pool()
    async with pool.acquire() as conn:
        evidence_count = await conn.fetchval("SELECT COUNT(*) FROM evidence")
        scan_count = await conn.fetchval("SELECT COUNT(*) FROM scan_runs")
        last_scan = await conn.fetchrow("SELECT * FROM scan_runs ORDER BY created_at DESC LIMIT 1")
        classified = await conn.fetchval("SELECT COUNT(*) FROM evidence WHERE classification IS NOT NULL")
        throughput_rows = await conn.fetch(
            """
            SELECT date_trunc('minute', updated_at) AS bucket, COUNT(*) AS count
            FROM scan_steps
            GROUP BY bucket
            ORDER BY bucket DESC
            LIMIT 20
            """
        )
    sources = await pipeline_sources()
    stages = await pipeline_stages()
    last_scan_label = serialize(last_scan["created_at"]) if last_scan else "never"
    return {
        "status": "running",
        "stats": [
            {"label": "Evidence records", "value": str(evidence_count), "accent": "blue", "sub": "classified source snippets"},
            {"label": "Scan runs", "value": str(scan_count), "accent": "green", "sub": f"last scan {last_scan_label}"},
            {"label": "Classifier outputs", "value": str(classified), "accent": "purple", "sub": "Gemini-labeled records"},
            {"label": "Sources live", "value": str(len([s for s in sources if s["status"] == "healthy"])), "accent": "teal", "sub": "configured evidence sources"},
        ],
        "throughput": [
            {"timestamp": serialize(row["bucket"]), "docsPerMin": row["count"]}
            for row in reversed(throughput_rows)
        ],
        "sources": sources,
        "stages": stages,
    }
