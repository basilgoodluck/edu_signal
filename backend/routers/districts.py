from fastapi import APIRouter, HTTPException
from db.session import get_pool
from models.schemas import District, DistrictListItem, DistrictDetail

router = APIRouter()


@router.get("", response_model=list[DistrictListItem])
async def list_districts():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT d.id, d.name, d.state, d.census_code, d.lat, d.lng,
                   ca.cluster_label, ca.confidence
            FROM districts d
            LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
            ORDER BY d.name
        """)
    return [dict(r) for r in rows]


@router.get("/{district_id}", response_model=DistrictDetail)
async def get_district(district_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await conn.fetchrow(
            "SELECT * FROM districts WHERE id = $1", district_id
        )
        if not district:
            raise HTTPException(status_code=404, detail="District not found")

        cluster = await conn.fetchrow(
            "SELECT * FROM cluster_assignments WHERE district_id = $1", district_id
        )

        features = await conn.fetchrow(
            "SELECT * FROM district_features WHERE district_id = $1 ORDER BY year DESC LIMIT 1",
            district_id,
        )

        evidence = await conn.fetch(
            "SELECT * FROM evidence WHERE district_id = $1 ORDER BY scraped_at DESC",
            district_id,
        )

        peers = []
        if cluster:
            peer_rows = await conn.fetch(
                """
                SELECT d.* FROM districts d
                JOIN cluster_assignments ca ON ca.district_id = d.id
                WHERE ca.cluster_label = $1 AND d.id != $2
                LIMIT 5
                """,
                cluster["cluster_label"],
                district_id,
            )
            peers = [dict(r) for r in peer_rows]

    return {
        "district": dict(district),
        "cluster": dict(cluster) if cluster else None,
        "features": dict(features) if features else None,
        "evidence": [dict(e) for e in evidence],
        "peers": peers,
    }
