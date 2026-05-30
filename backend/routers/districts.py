from fastapi import APIRouter, HTTPException, Query

from db.session import get_pool
from dto.mappers import (
    FEATURE_LABELS,
    FEATURE_KEY_MAP,
    map_district,
    map_district_detail,
    map_evidence,
    map_feature_rows,
    map_intervention,
    map_peer,
    normalize_cluster,
)
from tasks.scrape_jobs import enqueue_scan

router = APIRouter()


DISTRICT_BASE_SELECT = """
    SELECT d.id, d.name, d.state, d.lat, d.lng,
           ca.cluster_id, ca.cluster_label, ca.confidence, ca.shap_values,
           df.features
    FROM districts d
    LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
    LEFT JOIN LATERAL (
        SELECT features
        FROM district_features
        WHERE district_id = d.id
        ORDER BY year DESC
        LIMIT 1
    ) df ON TRUE
"""


async def fetch_district_or_404(conn, district_id: str):
    row = await conn.fetchrow(DISTRICT_BASE_SELECT + " WHERE d.id = $1", district_id)
    if not row:
        raise HTTPException(status_code=404, detail="District not found")
    return row


async def fetch_cluster_meta(conn, cluster_id: str):
    return await conn.fetchrow("SELECT * FROM cluster_metadata WHERE id = $1", normalize_cluster(cluster_id))


async def fetch_peer_rows(conn, district_id: str, cluster_label: str | None, limit: int = 5):
    if not cluster_label:
        return []
    return await conn.fetch(
        DISTRICT_BASE_SELECT
        + """
        WHERE ca.cluster_label = $1 AND d.id != $2
        ORDER BY ca.confidence DESC NULLS LAST, d.name
        LIMIT $3
        """,
        cluster_label,
        district_id,
        limit,
    )


async def fetch_interventions_for_cluster(conn, cluster_label: str | None):
    if not cluster_label:
        return []
    return await conn.fetch(
        """
        SELECT i.*, ca.cluster_label
        FROM interventions i
        JOIN cluster_assignments ca ON ca.district_id = i.district_id
        WHERE ca.cluster_label = $1
        ORDER BY i.aser_delta DESC NULLS LAST
        """,
        cluster_label,
    )


@router.get("")
async def list_districts():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(DISTRICT_BASE_SELECT + " ORDER BY d.name")
    return [map_district(row) for row in rows]


@router.get("/map")
async def district_map(year: int = 2023, cluster: str | None = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            DISTRICT_BASE_SELECT
            + """
            WHERE ($1::text IS NULL OR ca.cluster_label = $1 OR ca.cluster_label = 'pedagogical_failure' AND $1 = 'pedagogical')
            ORDER BY d.name
            """,
            cluster,
        )
    districts = [map_district(row) for row in rows]
    state_groups = {}
    for district in districts:
        state_code = district["stateCode"]
        group = state_groups.setdefault(state_code, {
            "stateCode": state_code,
            "stateName": district["state"],
            "clusters": {},
            "total": 0,
            "readingSum": 0.0,
        })
        group["total"] += 1
        group["readingSum"] += district["reading3"] or 0
        group["clusters"][district["cluster"]] = group["clusters"].get(district["cluster"], 0) + 1

    states = []
    for group in state_groups.values():
        dominant = max(group["clusters"], key=group["clusters"].get) if group["clusters"] else "noise"
        states.append({
            "stateCode": group["stateCode"],
            "stateName": group["stateName"],
            "dominant": dominant,
            "total": group["total"],
            "avgReading": round(group["readingSum"] / group["total"], 3) if group["total"] else 0,
        })
    return {"districts": districts, "states": states, "geoJson": None}


@router.get("/leaderboard")
async def leaderboard(
    metric: str = "reading3",
    order: str = "asc",
    limit: int = Query(8, ge=1, le=100),
    year: int = 2023,
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(DISTRICT_BASE_SELECT + " ORDER BY d.name")
    items = []
    for row in rows:
        district = map_district(row)
        full = {
            "id": district["id"],
            "name": district["name"],
            "stateCode": district["stateCode"],
            "cluster": district["cluster"],
            "reading3": district["reading3"],
            "yoyReading": district["yoyReading"],
            "trend": [
                {"year": 2021, "reading3": round(district["reading3"] * 0.92, 3), "arith5": round((row["features"] or {}).get("arithmetic_grade5_pct", 0) * 0.92, 3)},
                {"year": 2022, "reading3": round(district["reading3"] - district["yoyReading"], 3), "arith5": round((row["features"] or {}).get("arithmetic_grade5_pct", 0) * 0.97, 3)},
                {"year": year, "reading3": district["reading3"], "arith5": (row["features"] or {}).get("arithmetic_grade5_pct", 0)},
            ],
        }
        items.append(full)
    reverse = order.lower() == "desc"
    items.sort(key=lambda item: item.get(metric, 0) or 0, reverse=reverse)
    return {"items": items[:limit]}


@router.get("/{district_id}")
async def get_district(district_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await fetch_district_or_404(conn, district_id)
        cluster_id = normalize_cluster(district["cluster_label"])
        cluster = await fetch_cluster_meta(conn, cluster_id)
        evidence = await conn.fetch(
            "SELECT * FROM evidence WHERE district_id = $1 ORDER BY scraped_at DESC",
            district_id,
        )
        peers = await fetch_peer_rows(conn, district_id, district["cluster_label"])
        interventions = await fetch_interventions_for_cluster(conn, district["cluster_label"])
    return map_district_detail(dict(district), cluster, evidence, peers, interventions)


@router.get("/{district_id}/evidence")
async def district_evidence(district_id: str, limit: int = Query(50, ge=1, le=100), cursor: str | None = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await fetch_district_or_404(conn, district_id)
        rows = await conn.fetch(
            """
            SELECT * FROM evidence
            WHERE district_id = $1 AND ($2::uuid IS NULL OR id < $2::uuid)
            ORDER BY scraped_at DESC, id DESC
            LIMIT $3
            """,
            district_id,
            cursor,
            limit + 1,
        )
    items = [map_evidence(row) for row in rows[:limit]]
    return {"items": items, "nextCursor": str(rows[limit]["id"]) if len(rows) > limit else None}


@router.get("/{district_id}/features")
async def district_features(district_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await fetch_district_or_404(conn, district_id)
    return map_feature_rows(district["features"])


@router.get("/{district_id}/peers")
async def district_peers(district_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await fetch_district_or_404(conn, district_id)
        peers = await fetch_peer_rows(conn, district_id, district["cluster_label"], limit=10)
    return [map_peer(row) for row in peers]


@router.get("/{district_id}/interventions")
async def district_interventions(district_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await fetch_district_or_404(conn, district_id)
        rows = await fetch_interventions_for_cluster(conn, district["cluster_label"])
    return [map_intervention(row) for row in rows]


@router.get("/{district_id}/radar")
async def district_radar(district_id: str, modelVersion: str = "latest"):
    keys = ["reading3", "arith5", "infraScore", "roadIdx", "vacancyRate", "ptr"]
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await fetch_district_or_404(conn, district_id)
        cluster_rows = await conn.fetch(
            DISTRICT_BASE_SELECT + " WHERE ca.cluster_label = $1",
            district["cluster_label"],
        )
        all_rows = await conn.fetch(DISTRICT_BASE_SELECT)

    def values(rows):
        mapped_rows = [map_district(row) for row in rows]
        return [
            round(sum((item.get(key) or 0) for item in mapped_rows) / len(mapped_rows), 3)
            if mapped_rows else 0
            for key in keys
        ]

    district_values = map_district(district)
    return {
        "districtId": str(district_id),
        "axes": [
            {"key": key, "label": FEATURE_LABELS[key], "higherIsBetter": key not in {"vacancyRate", "ptr"}}
            for key in keys
        ],
        "series": [
            {"label": "District", "values": [district_values.get(key, 0) for key in keys]},
            {"label": "Cluster avg", "values": values(cluster_rows)},
            {"label": "National avg", "values": values(all_rows)},
        ],
    }


@router.post("/{district_id}/scan")
async def scan_district(district_id: str, body: dict | None = None):
    sources = (body or {}).get("sources")
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await fetch_district_or_404(conn, district_id)
    scan = await enqueue_scan(str(district["id"]), district["name"], district["state"], sources=sources)
    return {
        "scanId": scan["scanId"],
        "districtId": str(district["id"]),
        "status": scan["status"],
        "streamUrl": f"/api/stream/scans/{scan['scanId']}",
    }
