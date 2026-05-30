import json
import os
import uuid
from datetime import datetime

import httpx
import redis.asyncio as redis
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from config import AIMLAPI_MODEL
from db.session import get_pool
from dto.mappers import map_district, map_intervention
from sse import REDIS_URL, publish_event

router = APIRouter()

AIMLAPI_CHAT_COMPLETIONS_URL = "https://api.aimlapi.com/chat/completions"

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


@router.get("/ai/insights")
async def insights(districtId: str | None = None, limit: int = Query(10, ge=1, le=25)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        districts = await conn.fetch(DISTRICT_BASE_SELECT + " ORDER BY d.name")
        cluster_counts = await conn.fetch("SELECT cluster_label, COUNT(*) AS count FROM cluster_assignments GROUP BY cluster_label ORDER BY count DESC")
        interventions = await conn.fetch(
            """
            SELECT i.*, ca.cluster_label
            FROM interventions i
            JOIN cluster_assignments ca ON ca.district_id = i.district_id
            ORDER BY i.aser_delta DESC NULLS LAST
            """
        )
        district_row = await conn.fetchrow(DISTRICT_BASE_SELECT + " WHERE d.id = $1", districtId) if districtId else None

    mapped = [map_district(row) for row in districts]
    lowest = sorted(mapped, key=lambda item: item["reading3"])[:3]
    items = []
    if district_row:
        district = map_district(district_row)
        items.append({
            "id": f"district-{district['id']}",
            "type": "critical" if district["reading3"] < 0.3 else "finding",
            "title": f"{district['name']} needs targeted review",
            "body": f"{district['name']} is assigned to {district['cluster']} with grade-3 reading at {district['reading3']}.",
            "sources": ["district_features", "cluster_assignments"],
            "districts": [district["id"]],
            "metric": {"label": "Reading 3", "value": str(district["reading3"]), "color": "red" if district["reading3"] < 0.3 else "blue"},
        })
    if lowest:
        items.append({
            "id": "lowest-reading",
            "type": "critical",
            "title": "Lowest reading districts need immediate FLN support",
            "body": ", ".join(item["name"] for item in lowest) + " sit at the bottom of the current reading distribution.",
            "sources": ["district_features"],
            "districts": [item["id"] for item in lowest],
            "metric": {"label": "Lowest reading", "value": str(lowest[0]["reading3"]), "color": "red"},
        })
    if cluster_counts:
        top = cluster_counts[0]
        items.append({
            "id": "dominant-cluster",
            "type": "finding",
            "title": "Dominant cluster concentration detected",
            "body": f"{top['count']} districts share the {top['cluster_label']} cause signature.",
            "sources": ["cluster_assignments"],
            "districts": [],
            "metric": {"label": "Districts", "value": str(top["count"]), "color": "blue"},
        })
    if interventions:
        best = map_intervention(interventions[0])
        items.append({
            "id": "best-intervention",
            "type": "opportunity",
            "title": "Highest lift intervention is ready to reuse",
            "body": f"{best['type']} has the strongest recorded ASER delta at {best['aserDelta']}.",
            "sources": ["interventions"],
            "districts": best["districts"],
            "metric": {"label": "ASER delta", "value": str(best["aserDelta"]), "color": "green"},
        })
    return {"items": items[:limit]}


async def store_chat_message(conversation_id: str, message: dict):
    client = redis.from_url(REDIS_URL)
    try:
        await client.rpush(f"ai_conversation_{conversation_id}", json.dumps(message, default=str))
        await client.expire(f"ai_conversation_{conversation_id}", 60 * 60 * 24)
    finally:
        await client.aclose()


async def load_chat_history(conversation_id: str):
    client = redis.from_url(REDIS_URL)
    try:
        rows = await client.lrange(f"ai_conversation_{conversation_id}", 0, -1)
        return [json.loads(row) for row in rows]
    finally:
        await client.aclose()


async def answer_chat(message_id: str, conversation_id: str, user_message: str, district_context: dict | None):
    channel = f"ai_chat_{message_id}"
    system = (
        "You are an education data analyst for India. Answer questions about "
        "district education outcomes, causes of learning gaps, and intervention effectiveness."
    )
    history = await load_chat_history(conversation_id)
    context = f"\nDistrict context: {json.dumps(district_context)}" if district_context else ""
    prompt = system + context + "\nRecent conversation:\n" + json.dumps(history[-8:]) + f"\nUser: {user_message}\nAssistant:"
    api_key = os.environ.get("AIMLAPI_API_KEY")
    text = ""
    try:
        if not api_key:
            text = "I can answer from the local EduSignal data, but AIMLAPI_API_KEY is not configured for generated chat."
        else:
            async with httpx.AsyncClient(timeout=45) as client:
                response = await client.post(
                    AIMLAPI_CHAT_COMPLETIONS_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": AIMLAPI_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 700,
                        "temperature": 0.2,
                    },
                )
                response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]

        emitted = ""
        for token in text.split(" "):
            piece = token + " "
            emitted += piece
            await publish_event(channel, {"type": "token", "messageId": message_id, "token": piece})
        assistant_message = {
            "id": message_id,
            "role": "ai",
            "text": emitted.strip(),
            "sources": ["district_features", "cluster_assignments", "interventions"],
            "createdAt": datetime.utcnow().isoformat(),
        }
        await store_chat_message(conversation_id, assistant_message)
        await publish_event(channel, {"type": "sources", "messageId": message_id, "sources": assistant_message["sources"]})
        await publish_event(channel, {"type": "done", "message": assistant_message})
    except Exception as exc:
        await publish_event(channel, {"type": "error", "message": str(exc)})


@router.post("/ai/chat")
async def chat(body: dict, background_tasks: BackgroundTasks):
    text = body.get("message")
    if not text:
        raise HTTPException(status_code=422, detail="message is required")
    conversation_id = body.get("conversationId") or str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    district_context = None
    pool = await get_pool()
    async with pool.acquire() as conn:
        if body.get("districtId"):
            district = await conn.fetchrow(DISTRICT_BASE_SELECT + " WHERE d.id = $1", body["districtId"])
            if not district:
                raise HTTPException(status_code=404, detail="District not found")
            district_context = map_district(district)

    user_payload = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "text": text,
        "createdAt": datetime.utcnow().isoformat(),
    }
    await store_chat_message(conversation_id, user_payload)
    background_tasks.add_task(answer_chat, message_id, conversation_id, text, district_context)
    return {
        "conversationId": conversation_id,
        "messageId": message_id,
        "streamUrl": f"/api/stream/ai/chat/{message_id}",
    }
