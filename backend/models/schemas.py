from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class District(BaseModel):
    id: UUID
    name: str
    state: str
    census_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class DistrictListItem(District):
    cluster_label: Optional[str] = None
    confidence: Optional[float] = None


class ClusterAssignment(BaseModel):
    district_id: UUID
    cluster_id: int
    cluster_label: str
    confidence: float
    shap_values: dict
    assigned_at: datetime


class Evidence(BaseModel):
    id: UUID
    district_id: UUID
    raw_text: str
    source_url: Optional[str] = None
    source_type: str
    classification: str
    reason: str
    scraped_at: datetime


class DistrictFeatures(BaseModel):
    district_id: UUID
    year: int
    features: dict


class Intervention(BaseModel):
    id: UUID
    district_id: UUID
    intervention_type: str
    started_at: Optional[date] = None
    aser_delta: Optional[float] = None
    notes: Optional[str] = None


class DistrictDetail(BaseModel):
    district: District
    cluster: Optional[ClusterAssignment] = None
    features: Optional[DistrictFeatures] = None
    evidence: list[Evidence]
    peers: list[DistrictListItem]


class EvidenceClassifyRequest(BaseModel):
    evidence_text: str
    cluster_type: str


class AnalyzeRequest(BaseModel):
    district_id: str
