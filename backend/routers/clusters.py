from fastapi import APIRouter, HTTPException, Query

from db.session import get_pool
from dto.mappers import map_cluster, map_district, map_intervention, normalize_cluster

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


def cluster_filter_sql():
    return "(ca.cluster_label = $1 OR ca.cluster_label = 'pedagogical_failure' AND $1 = 'pedagogical')"


async def cluster_summary(conn, cluster_id: str):
    cluster_id = normalize_cluster(cluster_id)
    cluster = await conn.fetchrow("SELECT * FROM cluster_metadata WHERE id = $1", cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    districts = await conn.fetch(
        DISTRICT_BASE_SELECT + f" WHERE {cluster_filter_sql()} ORDER BY ca.confidence DESC NULLS LAST, d.name",
        cluster_id,
    )
    interventions = await conn.fetch(
        """
        SELECT i.*, ca.cluster_label
        FROM interventions i
        JOIN cluster_assignments ca ON ca.district_id = i.district_id
        WHERE ca.cluster_label = $1 OR ca.cluster_label = 'pedagogical_failure' AND $1 = 'pedagogical'
        ORDER BY i.aser_delta DESC NULLS LAST
        """,
        cluster_id,
    )
    mapped_districts = [map_district(row) for row in districts]
    avg = round(sum(d["reading3"] for d in mapped_districts) / len(mapped_districts), 3) if mapped_districts else 0
    return {
        "cluster": map_cluster(cluster),
        "districtCount": len(mapped_districts),
        "avgReading3": avg,
        "districts": [
            {
                "id": d["id"],
                "name": d["name"],
                "reading3": d["reading3"],
                "cluster": d["cluster"],
            }
            for d in mapped_districts
        ],
        "bestIntervention": map_intervention(interventions[0]) if interventions else None,
    }


@router.get("")
async def list_clusters():
    pool = await get_pool()
    async with pool.acquire() as conn:
        clusters = await conn.fetch("SELECT * FROM cluster_metadata ORDER BY array_position($1::text[], id)", [
            "seasonal_migration",
            "language_barrier",
            "teacher_shortage",
            "infrastructure",
            "pedagogical",
            "noise",
        ])
        items = [await cluster_summary(conn, row["id"]) for row in clusters]
    return {"items": items}


@router.get("/{cluster_id}")
async def get_cluster(cluster_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await cluster_summary(conn, cluster_id)


@router.get("/{cluster_id}/districts")
async def get_cluster_districts(cluster_id: str):
    cluster_id = normalize_cluster(cluster_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            DISTRICT_BASE_SELECT + f" WHERE {cluster_filter_sql()} ORDER BY ca.confidence DESC NULLS LAST, d.name",
            cluster_id,
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return [
        {
            "id": district["id"],
            "name": district["name"],
            "reading3": district["reading3"],
            "cluster": district["cluster"],
        }
        for district in [map_district(row) for row in rows]
    ]


@router.get("/{cluster_id}/peers")
async def get_legacy_cluster_peers(cluster_id: str):
    return await get_cluster_districts(cluster_id)


@router.get("/{cluster_id}/interventions")
async def get_cluster_interventions(
    cluster_id: str,
    sort: str = "aserDelta",
    limit: int = Query(50, ge=1, le=100),
):
    cluster_id = normalize_cluster(cluster_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT i.*, ca.cluster_label
            FROM interventions i
            JOIN cluster_assignments ca ON ca.district_id = i.district_id
            WHERE ca.cluster_label = $1 OR ca.cluster_label = 'pedagogical_failure' AND $1 = 'pedagogical'
            ORDER BY i.aser_delta DESC NULLS LAST
            LIMIT $2
            """,
            cluster_id,
            limit,
        )
    return [map_intervention(row) for row in rows]
