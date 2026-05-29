from fastapi import APIRouter, HTTPException
from models.schemas import EvidenceClassifyRequest

router = APIRouter()


@router.post("/classify")
async def classify_evidence_endpoint(request: EvidenceClassifyRequest):
    from scrapers.classifier import classify_evidence

    try:
        result = await classify_evidence(request.evidence_text, request.cluster_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Classification failed: {exc}") from exc
    return result
