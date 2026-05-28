from fastapi import APIRouter, HTTPException
from models.schemas import AnalyzeRequest
from tasks.scrape_jobs import run_scrape_job
from db.session import get_pool

router = APIRouter()


@router.post("")
async def trigger_analyze(request: AnalyzeRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        district = await conn.fetchrow(
            "SELECT * FROM districts WHERE id = $1", request.district_id
        )
        if not district:
            raise HTTPException(status_code=404, detail="District not found")

    job = run_scrape_job.delay(request.district_id, district["name"], district["state"])
    return {"job_id": job.id, "status": "queued"}


@router.get("/{job_id}")
async def poll_job(job_id: str):
    from tasks.scrape_jobs import celery_app
    result = celery_app.AsyncResult(job_id)

    if result.state == "PENDING":
        return {"job_id": job_id, "status": "pending"}
    elif result.state == "STARTED":
        return {"job_id": job_id, "status": "running"}
    elif result.state == "SUCCESS":
        return {"job_id": job_id, "status": "complete", "result": result.result}
    elif result.state == "FAILURE":
        return {"job_id": job_id, "status": "failed", "error": str(result.result)}
    else:
        return {"job_id": job_id, "status": result.state.lower()}
