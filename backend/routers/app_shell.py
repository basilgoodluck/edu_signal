from fastapi import APIRouter, Query

from db.session import get_pool
from dto.mappers import (
    CLUSTER_ORDER,
    FEATURE_LABELS,
    SCAN_STEPS_TEMPLATE,
    SOURCE_META,
    map_cluster,
    map_district,
    map_full_district,
    map_intervention,
    normalize_cluster,
    serialize,
)

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

NAV_VIEWS = [
    {"id": "overview", "label": "Overview", "path": "/", "icon": "layout-dashboard"},
    {"id": "analytics", "label": "Signal Lab", "path": "/analytics", "icon": "scatter-chart"},
    {"id": "pipeline", "label": "Pipeline", "path": "/pipeline", "icon": "activity"},
    {"id": "clusters", "label": "Cause Clusters", "path": "/clusters", "icon": "component"},
    {"id": "district", "label": "District Detail", "path": "/districts", "icon": "map-pin"},
    {"id": "evidence", "label": "Evidence Engine", "path": "/evidence", "icon": "scan-search"},
    {"id": "workflow", "label": "Workflow", "path": "/workflow", "icon": "workflow"},
    {"id": "ai", "label": "AI Analyst", "path": "/ai", "icon": "sparkles"},
]


@router.get("/me")
async def me():
    return {
        "id": "default",
        "name": "R. Kulkarni",
        "initials": "RK",
        "role": "District Education Officer",
    }


@router.get("/navigation/summary")
async def navigation_summary():
    pool = await get_pool()
    async with pool.acquire() as conn:
        high_alert_count = await conn.fetchval(
            "SELECT COUNT(*) FROM alerts WHERE level = 'high' AND status = 'open'"
        )
        rows = await conn.fetch(
            "SELECT cluster_label, COUNT(*) AS count FROM cluster_assignments GROUP BY cluster_label"
        )
    cluster_counts = {cluster_id: 0 for cluster_id in CLUSTER_ORDER}
    for row in rows:
        cluster_counts[normalize_cluster(row["cluster_label"])] += row["count"]
    return {
        "highAlertCount": high_alert_count,
        "clusterCounts": cluster_counts,
        "pipeline": {
            "status": "live",
            "label": "Pipeline live",
            "sourcesLabel": "5 sources active",
        },
    }


@router.get("/search")
async def search(q: str = "", types: str = "district,view,cluster"):
    selected = {part.strip() for part in types.split(",") if part.strip()}
    pattern = f"%{q}%"
    pool = await get_pool()
    async with pool.acquire() as conn:
        district_rows = await conn.fetch(
            DISTRICT_BASE_SELECT + " WHERE d.name ILIKE $1 ORDER BY d.name LIMIT 10",
            pattern,
        ) if "district" in selected else []
        cluster_rows = await conn.fetch(
            "SELECT * FROM cluster_metadata WHERE label ILIKE $1 ORDER BY label LIMIT 10",
            pattern,
        ) if "cluster" in selected else []
    views = [
        view for view in NAV_VIEWS
        if "view" in selected and q.lower() in view["label"].lower()
    ]
    return {
        "query": q,
        "districts": [
            {
                "id": item["id"],
                "name": item["name"],
                "state": item["state"],
                "cluster": item["cluster"],
            }
            for item in [map_district(row) for row in district_rows]
        ],
        "clusters": [map_cluster(row) for row in cluster_rows],
        "views": views,
    }


@router.get("/bootstrap")
async def bootstrap():
    pool = await get_pool()
    async with pool.acquire() as conn:
        cluster_rows = await conn.fetch("SELECT * FROM cluster_metadata")
        district_rows = await conn.fetch(DISTRICT_BASE_SELECT + " ORDER BY d.name")
        intervention_rows = await conn.fetch(
            """
            SELECT i.*, ca.cluster_label
            FROM interventions i
            LEFT JOIN cluster_assignments ca ON ca.district_id = i.district_id
            ORDER BY i.aser_delta DESC NULLS LAST
            """
        )
        tracker_rows = await conn.fetch(
            """
            SELECT ti.*, d.name AS district_name, ca.cluster_label
            FROM tracker_items ti
            JOIN districts d ON d.id = ti.district_id
            LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
            ORDER BY ti.started_at DESC
            """
        )
        alert_rows = await conn.fetch(
            """
            SELECT a.*, d.name AS district_name
            FROM alerts a
            JOIN districts d ON d.id = a.district_id
            ORDER BY a.when_ts DESC
            """
        )

    clusters = {row["id"]: map_cluster(row) for row in cluster_rows}
    interventions = {cluster_id: [] for cluster_id in CLUSTER_ORDER}
    for row in intervention_rows:
        item = map_intervention(row)
        interventions[item["cluster"]].append(item)

    tracker = [
        {
            "id": str(row["id"]),
            "district": str(row["district_id"]),
            "districtName": row["district_name"],
            "cluster": normalize_cluster(row["cluster_label"]),
            "type": row["intervention_type"],
            "started": serialize(row["started_at"]),
            "status": row["status"],
            "baseline": row["baseline"],
            "latest": row["latest"],
            "target": row["target"],
            "note": row["note"],
        }
        for row in tracker_rows
    ]
    alerts = [
        {
            "id": str(row["id"]),
            "level": row["level"],
            "district": str(row["district_id"]),
            "title": row["title"],
            "body": row["body"],
            "when": serialize(row["when_ts"]),
            "cluster": normalize_cluster(row["cluster_id"]),
        }
        for row in alert_rows
    ]
    return {
        "clusters": clusters,
        "featureLabels": FEATURE_LABELS,
        "districts": [map_full_district(row) for row in district_rows],
        "interventions": interventions,
        "tracker": tracker,
        "alerts": alerts,
        "scanSteps": [{"label": step["label"], "source": step["source"]} for step in SCAN_STEPS_TEMPLATE],
        "sourceMeta": SOURCE_META,
        "clusterOrder": CLUSTER_ORDER,
    }


@router.get("/overview")
async def overview(year: int = 2023):
    pool = await get_pool()
    async with pool.acquire() as conn:
        cluster_rows = await conn.fetch("SELECT * FROM cluster_metadata")
        district_rows = await conn.fetch(DISTRICT_BASE_SELECT)
        evidence_count = await conn.fetchval("SELECT COUNT(*) FROM evidence")

    clusters = {row["id"]: map_cluster(row) for row in cluster_rows}
    districts = [map_district(row) for row in district_rows]
    cluster_counts = {cluster_id: 0 for cluster_id in CLUSTER_ORDER}
    for district in districts:
        cluster_counts[district["cluster"]] += 1
    dominant_cluster = max(cluster_counts, key=cluster_counts.get) if cluster_counts else "noise"
    avg_reading = round(sum(d["reading3"] for d in districts) / len(districts), 3) if districts else 0
    return {
        "year": str(year),
        "totals": {
            "districtsAnalyzed": len(districts),
            "statesCovered": len({d["stateCode"] for d in districts}),
            "avgReading3": avg_reading,
            "decliningYoyCount": len([d for d in districts if d["yoyReading"] < 0]),
            "dominantCluster": dominant_cluster,
            "dominantClusterLabel": clusters.get(dominant_cluster, {}).get("label", dominant_cluster),
            "dominantClusterDistricts": cluster_counts.get(dominant_cluster, 0),
            "liveEvidenceCount": evidence_count,
        },
        "clusterCounts": cluster_counts,
        "clusters": clusters,
    }
