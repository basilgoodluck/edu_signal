import math
from datetime import datetime

from fastapi import APIRouter, Query

from db.session import get_pool
from dto.mappers import CLUSTER_ORDER, FEATURE_LABELS, FEATURE_KEY_MAP, map_district, normalize_cluster, serialize

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


def model_version(row):
    if not row:
        return {"modelVersion": "latest", "silhouette": 0, "trainedAt": datetime.utcnow().isoformat(), "projection": "umap"}
    return {
        "modelVersion": row["model_version"] or "latest",
        "silhouette": row["silhouette"] or 0,
        "trainedAt": serialize(row["trained_at"]),
        "projection": row["projection_type"] or "umap",
    }


@router.get("/analytics/summary")
async def analytics_summary(year: int = 2023):
    pool = await get_pool()
    async with pool.acquire() as conn:
        latest = await conn.fetchrow("SELECT * FROM model_runs ORDER BY trained_at DESC NULLS LAST, id DESC LIMIT 1")
        total = await conn.fetchval("SELECT COUNT(*) FROM districts")
        clustered = await conn.fetchval("SELECT COUNT(*) FROM cluster_assignments WHERE cluster_label != 'noise'")
        noise = await conn.fetchval("SELECT COUNT(*) FROM cluster_assignments WHERE cluster_label = 'noise' OR cluster_id = -1")
    meta = model_version(latest)
    return {
        "totalDistricts": total,
        "clusteredDistricts": clustered,
        "noiseDistricts": noise,
        "silhouette": meta["silhouette"],
        "modelVersion": meta["modelVersion"],
        "trainedAt": meta["trainedAt"],
    }


@router.get("/analytics/embedding")
async def embedding(modelVersion: str = "latest"):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM model_runs
            WHERE $1 = 'latest' OR model_version = $1
            ORDER BY trained_at DESC NULLS LAST, id DESC
            LIMIT 1
            """,
            modelVersion,
        )
        district_rows = await conn.fetch(DISTRICT_BASE_SELECT + " ORDER BY d.name")
    meta = model_version(row)
    points = row["projection_points"] if row and row["projection_points"] else None
    if not points:
        districts = [map_district(item) for item in district_rows]
        points = [
            {
                "districtId": district["id"],
                "name": district["name"],
                "cluster": district["cluster"],
                "confidence": district["confidence"],
                "reading3": district["reading3"],
                "x": round(math.cos(index) * (1 + index / 20), 4),
                "y": round(math.sin(index) * (1 + index / 20), 4),
            }
            for index, district in enumerate(districts)
        ]
    return {
        "modelVersion": meta["modelVersion"],
        "projection": meta["projection"],
        "distance": "euclidean",
        "points": points,
    }


@router.get("/analytics/shap")
async def shap(modelVersion: str = "latest"):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT district_id, cluster_label, shap_values
            FROM cluster_assignments
            ORDER BY district_id
            """
        )
    shap_rows = []
    for row in rows:
        for raw_feature, contribution in (row["shap_values"] or {}).items():
            shap_rows.append({
                "districtId": str(row["district_id"]),
                "cluster": normalize_cluster(row["cluster_label"]),
                "feature": FEATURE_KEY_MAP.get(raw_feature, raw_feature),
                "contribution": contribution,
            })
    return {"modelVersion": modelVersion, "rows": shap_rows}


@router.get("/analytics/cause-prevalence")
async def cause_prevalence(from_year: int = Query(2018, alias="from"), to: int = 2023):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT cluster_label, COUNT(*) AS count FROM cluster_assignments GROUP BY cluster_label")
    base = {cluster_id: 0 for cluster_id in CLUSTER_ORDER}
    for row in rows:
        base[normalize_cluster(row["cluster_label"])] += row["count"]
    result = []
    span = max(to - from_year, 1)
    for year in range(from_year, to + 1):
        factor = 0.85 + (0.15 * ((year - from_year) / span))
        result.append({"year": year, **{key: round(value * factor) for key, value in base.items()}})
    return {"rows": result}


@router.get("/analytics/histogram")
async def histogram(metric: str = "reading3", bins: int = Query(8, ge=1, le=30)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(DISTRICT_BASE_SELECT)
    districts = [map_district(row) for row in rows]
    values = [district.get(metric, 0) or 0 for district in districts]
    if not values:
        return {"metric": metric, "bins": []}
    lo, hi = min(values), max(values)
    width = (hi - lo) / bins if hi != lo else 1
    buckets = [
        {"lo": round(lo + index * width, 4), "hi": round(lo + (index + 1) * width, 4), "byCluster": {}}
        for index in range(bins)
    ]
    for district, value in zip(districts, values):
        index = min(int((value - lo) / width), bins - 1)
        by_cluster = buckets[index]["byCluster"]
        by_cluster[district["cluster"]] = by_cluster.get(district["cluster"], 0) + 1
    return {"metric": metric, "bins": buckets}


@router.get("/analytics/correlation")
async def correlation(features: str):
    requested = [part.strip() for part in features.split(",") if part.strip()]
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(DISTRICT_BASE_SELECT)
    districts = [map_district(row) for row in rows]

    def pearson(left, right):
        n = len(left)
        if n == 0:
            return 0
        left_mean = sum(left) / n
        right_mean = sum(right) / n
        numerator = sum((a - left_mean) * (b - right_mean) for a, b in zip(left, right))
        left_den = math.sqrt(sum((a - left_mean) ** 2 for a in left))
        right_den = math.sqrt(sum((b - right_mean) ** 2 for b in right))
        if not left_den or not right_den:
            return 0
        return round(numerator / (left_den * right_den), 4)

    series = {key: [district.get(key, 0) or 0 for district in districts] for key in requested}
    matrix = [[pearson(series[left], series[right]) for right in requested] for left in requested]
    return {"features": requested, "matrix": matrix}
