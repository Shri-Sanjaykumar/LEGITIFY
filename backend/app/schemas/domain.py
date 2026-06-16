import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class DomainVerifyRequest(BaseModel):
    domain: str
    verification_source: Optional[str] = "API"


class DomainVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain: str
    verification_score: float
    verification_status: str
    verification_level: str
    verification_confidence: str
    dns_status: str
    mx_status: str
    spf_status: str
    dmarc_status: str
    dkim_status: str
    ssl_status: str
    certificate_expiry: Optional[datetime] = None
    last_verified_at: Optional[datetime] = None
    next_verification_at: Optional[datetime] = None
    verification_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class DomainVerificationBreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    verification_id: uuid.UUID
    rule_name: str
    category: str
    confidence: str
    source_reliability: str
    score_change: float
    reason: str
    source: str
    timestamp: datetime


class DomainVerificationEvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    verification_id: uuid.UUID
    evidence_type: str
    severity: str
    confidence: str
    description: str
    source: str
    timestamp: datetime


class DomainReputationSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain: str
    verification_score: float
    verification_level: str
    captured_at: datetime


class DomainVerificationDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    verification: DomainVerificationOut
    breakdowns: List[DomainVerificationBreakdownOut]
    evidence: List[DomainVerificationEvidenceOut]
