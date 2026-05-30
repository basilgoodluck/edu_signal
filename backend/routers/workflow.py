from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from db.session import get_pool
from dto.mappers import FEATURE_LABELS, map_district, map_full_district, map_intervention, normalize_cluster, serialize
from sse import publish_event

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


async def district_or_404(conn, district_id: str):
    row = await conn.fetchrow(DISTRICT_BASE_SELECT + " WHERE d.id = $1", district_id)
    if not row:
        raise HTTPException(status_code=404, detail="District not found")
    return row


def alert_payload(row):
    return {
        "id": str(row["id"]),
        "level": row["level"],
        "district": str(row["district_id"]),
        "title": row["title"],
        "body": row["body"],
        "when": serialize(row["when_ts"]),
        "cluster": normalize_cluster(row["cluster_id"]),
    }


def tracker_payload(row):
    return {
        "id": str(row["id"]),
        "district": str(row["district_id"]),
        "districtName": row.get("district_name"),
        "cluster": normalize_cluster(row.get("cluster_label")),
        "type": row["intervention_type"],
        "started": serialize(row["started_at"]),
        "status": row["status"],
        "baseline": row["baseline"],
        "latest": row["latest"],
        "target": row["target"],
        "note": row["note"] or "",
    }


@router.get("/peers")
async def peers(anchorId: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        anchor = await district_or_404(conn, anchorId)
        peer_rows = await conn.fetch(
            DISTRICT_BASE_SELECT
            + """
            WHERE ca.cluster_label = $1 AND d.id != $2
            ORDER BY ca.confidence DESC NULLS LAST, d.name
            LIMIT 10
            """,
            anchor["cluster_label"],
            anchorId,
        )
    return {
        "anchor": map_full_district(anchor, peers=[str(row["id"]) for row in peer_rows]),
        "peers": [map_full_district(row) for row in peer_rows],
    }


@router.get("/peer-network")
async def peer_network(anchorId: str | None = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if anchorId:
            anchor = await district_or_404(conn, anchorId)
            rows = await conn.fetch(
                DISTRICT_BASE_SELECT + " WHERE ca.cluster_label = $1 ORDER BY d.name",
                anchor["cluster_label"],
            )
        else:
            rows = await conn.fetch(DISTRICT_BASE_SELECT + " ORDER BY d.name")
    nodes = []
    grouped = {}
    for row in rows:
        district = map_district(row)
        grouped.setdefault(district["cluster"], []).append(district["id"])
        nodes.append({
            "id": district["id"],
            "name": district["name"],
            "cluster": district["cluster"],
            "reading3": district["reading3"],
            "peers": [],
        })

    edges = []
    node_by_id = {node["id"]: node for node in nodes}
    for cluster_id, ids in grouped.items():
        for index, source in enumerate(ids):
            for target in ids[index + 1:index + 4]:
                node_by_id[source]["peers"].append(target)
                node_by_id[target]["peers"].append(source)
                edges.append({
                    "source": source,
                    "target": target,
                    "weight": 1,
                    "reason": f"Shared {cluster_id} cluster",
                })
    return {"nodes": nodes, "edges": edges}


@router.get("/districts/{district_id}/comparison")
async def comparison(district_id: str, peerIds: str | None = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        anchor = await district_or_404(conn, district_id)
        ids = [part.strip() for part in (peerIds or "").split(",") if part.strip()]
        if not ids:
            peer_rows = await conn.fetch(
                DISTRICT_BASE_SELECT
                + " WHERE ca.cluster_label = $1 AND d.id != $2 ORDER BY ca.confidence DESC NULLS LAST LIMIT 5",
                anchor["cluster_label"],
                district_id,
            )
        else:
            peer_rows = await conn.fetch(
                DISTRICT_BASE_SELECT + " WHERE d.id = ANY($1::uuid[]) ORDER BY d.name",
                ids,
            )
        interventions = await conn.fetch(
            """
            SELECT i.*, ca.cluster_label
            FROM interventions i
            JOIN cluster_assignments ca ON ca.district_id = i.district_id
            WHERE ca.cluster_label = $1
            ORDER BY i.aser_delta DESC NULLS LAST
            """,
            anchor["cluster_label"],
        )

    metrics = [
        {"key": key, "label": FEATURE_LABELS[key], "better": "low" if key in {"ptr", "vacancyRate", "floodDays", "genderGap"} else "high"}
        for key in ["reading3", "arith5", "yoyReading", "ptr", "vacancyRate", "confidence"]
    ]
    return {
        "anchorId": str(district_id),
        "group": [map_full_district(anchor)] + [map_full_district(row) for row in peer_rows],
        "metrics": metrics,
        "interventions": [map_intervention(row) for row in interventions],
    }


@router.get("/intervention-tracker")
async def intervention_tracker():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ti.*, d.name AS district_name, ca.cluster_label
            FROM tracker_items ti
            JOIN districts d ON d.id = ti.district_id
            LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
            ORDER BY ti.started_at DESC, ti.id
            """
        )
    items = [tracker_payload(dict(row)) for row in rows]
    return {
        "summary": {
            "active": len([item for item in items if item["status"] == "active"]),
            "cumulativeLift": round(sum((item["latest"] or 0) - (item["baseline"] or 0) for item in items), 3),
            "districtsCovered": len({item["district"] for item in items}),
        },
        "items": items,
    }


@router.post("/intervention-tracker")
async def create_tracker(body: dict):
    district_id = body.get("district") or body.get("districtId")
    if not district_id:
        raise HTTPException(status_code=422, detail="district is required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        await district_or_404(conn, district_id)
        row = await conn.fetchrow(
            """
            INSERT INTO tracker_items
                (district_id, intervention_type, started_at, status, baseline, latest, target, note)
            VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7, $8)
            RETURNING *
            """,
            district_id,
            body.get("type"),
            body.get("started"),
            body.get("status", "active"),
            body.get("baseline", 0),
            body.get("latest", 0),
            body.get("target", 0),
            body.get("note", ""),
        )
        enriched = await conn.fetchrow(
            """
            SELECT ti.*, d.name AS district_name, ca.cluster_label
            FROM tracker_items ti
            JOIN districts d ON d.id = ti.district_id
            LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
            WHERE ti.id = $1
            """,
            row["id"],
        )
    item = tracker_payload(dict(enriched))
    await publish_event("intervention_tracker", {"type": "created", "item": item})
    return item


@router.patch("/intervention-tracker/{tracker_id}")
async def update_tracker(tracker_id: str, body: dict):
    pool = await get_pool()
    async with pool.acquire() as conn:
        current = await conn.fetchrow("SELECT * FROM tracker_items WHERE id = $1", tracker_id)
        if not current:
            raise HTTPException(status_code=404, detail="Tracker item not found")
        row = await conn.fetchrow(
            """
            UPDATE tracker_items
            SET intervention_type = COALESCE($2, intervention_type),
                started_at = COALESCE($3::date, started_at),
                status = COALESCE($4, status),
                baseline = COALESCE($5, baseline),
                latest = COALESCE($6, latest),
                target = COALESCE($7, target),
                note = COALESCE($8, note)
            WHERE id = $1
            RETURNING *
            """,
            tracker_id,
            body.get("type"),
            body.get("started"),
            body.get("status"),
            body.get("baseline"),
            body.get("latest"),
            body.get("target"),
            body.get("note"),
        )
        enriched = await conn.fetchrow(
            """
            SELECT ti.*, d.name AS district_name, ca.cluster_label
            FROM tracker_items ti
            JOIN districts d ON d.id = ti.district_id
            LEFT JOIN cluster_assignments ca ON ca.district_id = d.id
            WHERE ti.id = $1
            """,
            row["id"],
        )
    item = tracker_payload(dict(enriched))
    await publish_event("intervention_tracker", {"type": "updated", "item": item})
    return item


@router.get("/alerts")
async def alerts(level: str | None = None, status: str = "open", limit: int = Query(50, ge=1, le=100)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM alerts
            WHERE ($1::text IS NULL OR level = $1)
              AND ($2::text IS NULL OR status = $2)
            ORDER BY when_ts DESC
            LIMIT $3
            """,
            level,
            status,
            limit,
        )
    return {"items": [alert_payload(row) for row in rows]}


@router.patch("/alerts/{alert_id}")
async def update_alert(alert_id: str, body: dict):
    viewed_at = body.get("viewedAt") or body.get("viewed_at")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE alerts
            SET status = COALESCE($2, status),
                viewed_at = COALESCE($3::timestamptz, viewed_at)
            WHERE id = $1
            RETURNING *
            """,
            alert_id,
            body.get("status"),
            viewed_at or (datetime.utcnow().isoformat() if body.get("viewed") else None),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = alert_payload(row)
    await publish_event("alerts", {"type": "updated", "alert": alert})
    return alert
