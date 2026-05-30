from fastapi import APIRouter

from sse import sse_stream

router = APIRouter()


@router.get("/stream/app-summary")
async def app_summary_stream():
    return await sse_stream("app_summary")


@router.get("/stream/overview")
async def overview_stream():
    return await sse_stream("overview")


@router.get("/stream/pipeline")
async def pipeline_stream():
    return await sse_stream("pipeline")


@router.get("/stream/scans/{scan_id}")
async def scan_stream(scan_id: str):
    return await sse_stream(f"scan_{scan_id}")


@router.get("/stream/model-status")
async def model_status_stream():
    return await sse_stream("model_status")


@router.get("/stream/intervention-tracker")
async def intervention_tracker_stream():
    return await sse_stream("intervention_tracker")


@router.get("/stream/alerts")
async def alerts_stream():
    return await sse_stream("alerts")


@router.get("/stream/ai/chat/{message_id}")
async def ai_chat_stream(message_id: str):
    return await sse_stream(f"ai_chat_{message_id}", timeout=300)
