from fastapi import APIRouter
from models.schemas import EvidenceClassifyRequest
from scrapers.classifier import classify_evidence

router = APIRouter()


@router.post("/classify")
async def classify_evidence_endpoint(request: EvidenceClassifyRequest):
    result = await classify_evidence(request.evidence_text, request.cluster_type)
    return result
