from fastapi import APIRouter, HTTPException
from db.session import get_pool
from models.schemas import District, Intervention

router = APIRouter()


@router.get("/{cluster_id}/peers", response_model=list[District])
async def get_cluster_peers(cluster_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT d.* FROM districts d
            JOIN cluster_assignments ca ON ca.district_id = d.id
            WHERE ca.cluster_id = $1
            ORDER BY ca.confidence DESC
            """,
            cluster_id,
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return [dict(r) for r in rows]


@router.get("/{cluster_id}/interventions", response_model=list[Intervention])
async def get_cluster_interventions(cluster_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT i.* FROM interventions i
            JOIN cluster_assignments ca ON ca.district_id = i.district_id
            WHERE ca.cluster_id = $1
            ORDER BY i.aser_delta DESC NULLS LAST
            """,
            cluster_id,
        )
    return [dict(r) for r in rows]
