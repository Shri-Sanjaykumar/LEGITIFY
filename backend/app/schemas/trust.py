import uuid
from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict
from app.schemas.report import EvidenceItemOut


class TrustAnalysisRequest(BaseModel):
    scan_id: uuid.UUID


class TrustScoreBreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    rule_name: str
    rule_category: str
    weight: float
    score_change: float
    confidence: str
    reason: str
    source: str
    created_at: datetime


class TrustAnalysisOut(BaseModel):
    trust_score: float
    risk_score: float
    risk_level: str
    evidence: List[EvidenceItemOut]
    recommendations: List[str]
    score_breakdown: List[TrustScoreBreakdownOut]
