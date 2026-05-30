import asyncio
import json
import os

import redis.asyncio as redis
from fastapi.responses import StreamingResponse


REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


async def sse_stream(channel: str, timeout: int = 60):
    async def event_generator():
        client = redis.from_url(REDIS_URL)
        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(channel)
            loop = asyncio.get_running_loop()
            deadline = loop.time() + timeout if timeout else None
            last_keepalive = loop.time()

            while True:
                if deadline and loop.time() >= deadline:
                    break

                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if message and message.get("type") == "message":
                    data = message.get("data")
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"

                now = loop.time()
                if now - last_keepalive >= 15:
                    yield ": keepalive\n\n"
                    last_keepalive = now
        except asyncio.CancelledError:
            raise
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await client.aclose()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def publish_event(channel: str, event_dict: dict):
    client = redis.from_url(REDIS_URL)
    try:
        await client.publish(channel, json.dumps(event_dict, default=str))
    finally:
        await client.aclose()
