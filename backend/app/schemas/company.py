import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CompanyVerifyRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    website: str = Field(..., min_length=1, max_length=255)
    company_email: Optional[str] = Field(default=None, max_length=255)
    contact_number: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None)
    verification_source: Optional[str] = Field(default="API", max_length=100)


class CompanyVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    website: str
    company_email: Optional[str]
    contact_number: Optional[str]
    address: Optional[str]
    verification_score: float
    verification_status: str
    verification_level: str
    verification_confidence: str
    verification_version: str
    verification_source: str
    last_verified_at: Optional[datetime]
    next_verification_at: Optional[datetime]
    verification_expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class CompanyVerificationBreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    verification_id: uuid.UUID
    rule_name: str
    category: str
    score_change: float
    confidence: str
    source_reliability: str
    reason: str
    source: str
    created_at: datetime


class CompanyVerificationEvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    verification_id: uuid.UUID
    evidence_type: str
    description: str
    source: str
    severity: str
    confidence: str
    created_at: datetime


class CompanyVerificationDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    verification: CompanyVerificationOut
    breakdowns: List[CompanyVerificationBreakdownOut]
    evidence: List[CompanyVerificationEvidenceOut]
