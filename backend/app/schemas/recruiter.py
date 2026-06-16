import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RecruiterVerifyRequest(BaseModel):
    recruiter_name: str = Field(..., max_length=255)
    recruiter_email: str = Field(..., max_length=255)
    claimed_company: str = Field(..., max_length=255)
    recruiter_phone: Optional[str] = Field(None, max_length=50)
    recruiter_role: Optional[str] = Field(None, max_length=100)
    linkedin_profile_url: Optional[str] = Field(None, max_length=500)
    verification_source: Optional[str] = "API"


class RecruiterVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recruiter_name: str
    recruiter_email: str
    claimed_company: str
    recruiter_phone: Optional[str]
    recruiter_role: Optional[str]
    linkedin_profile_url: Optional[str]
    linkedin_validation_status: str
    verification_score: float
    verification_status: str
    verification_level: str
    verification_confidence: str
    email_domain_status: str
    company_match_status: str
    phone_match_status: str
    last_verified_at: Optional[datetime]
    verification_expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class RecruiterVerificationBreakdownOut(BaseModel):
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


class RecruiterVerificationEvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    verification_id: uuid.UUID
    evidence_type: str
    severity: str
    confidence: str
    description: str
    source: str
    timestamp: datetime


class RecruiterReputationSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recruiter_email: str
    claimed_company: str
    verification_score: float
    verification_level: str
    recruiter_verification_count: int
    recruiter_success_rate: float
    captured_at: datetime


class RecruiterVerificationDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    verification: RecruiterVerificationOut
    breakdowns: List[RecruiterVerificationBreakdownOut]
    evidence: List[RecruiterVerificationEvidenceOut]
