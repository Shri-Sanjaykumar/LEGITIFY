import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

# ──────────────────────────────────────────────
#  Request Schemas
# ──────────────────────────────────────────────


class ReportCreate(BaseModel):
    scan_id: uuid.UUID
    trust_score: float = Field(default=0.0, ge=0.0, le=100.0)
    risk_score: float = Field(default=0.0, ge=0.0, le=100.0)
    confidence_score: int = Field(default=0, ge=0, le=100)
    risk_level: str = Field(default="low")
    summary: str = Field(default="")
    recommendation: Optional[str] = None
    generated_by: str = Field(default="HUMAN")
    generation_engine: Optional[str] = None
    generation_version: Optional[str] = None

    @field_validator("risk_level")
    @classmethod
    def validate_risk_level(cls, v: str) -> str:
        allowed = {"low", "medium", "high", "critical"}
        if v.lower() not in allowed:
            raise ValueError(f"risk_level must be one of {allowed}")
        return v.lower()

    @field_validator("generated_by")
    @classmethod
    def validate_generated_by(cls, v: str) -> str:
        allowed = {"AI", "HUMAN", "SYSTEM"}
        if v.upper() not in allowed:
            raise ValueError(f"generated_by must be one of {allowed}")
        return v.upper()


class ReportStatusPatch(BaseModel):
    report_id: uuid.UUID
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"DRAFT", "GENERATING", "COMPLETED", "FAILED", "ARCHIVED"}
        if v.upper() not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v.upper()


class EvidenceItemCreate(BaseModel):
    evidence_type: str
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    severity: str
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    source: str = Field(..., min_length=1, max_length=100)
    source_reference: Optional[str] = Field(default=None, max_length=512)

    @field_validator("evidence_type")
    @classmethod
    def validate_evidence_type(cls, v: str) -> str:
        allowed = {
            "DOCUMENT",
            "DOMAIN",
            "COMPANY",
            "RECRUITER",
            "EMAIL",
            "LINKEDIN",
            "MANUAL",
        }
        if v.upper() not in allowed:
            raise ValueError(f"evidence_type must be one of {allowed}")
        return v.upper()

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        allowed = {"INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"}
        if v.upper() not in allowed:
            raise ValueError(f"severity must be one of {allowed}")
        return v.upper()


# ──────────────────────────────────────────────
#  Response Schemas
# ──────────────────────────────────────────────


class EvidenceItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    evidence_type: str
    title: str
    description: str
    severity: str
    confidence: float
    source: str
    source_reference: Optional[str]
    created_at: datetime
    is_deleted: bool


class ReportHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    from_status: str
    to_status: str
    changed_by: Optional[uuid.UUID]
    changed_at: datetime


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    scan_id: uuid.UUID
    report_version: str
    report_status: str
    trust_score: float
    risk_score: float
    confidence_score: int
    risk_level: str
    summary: str
    recommendation: Optional[str]
    generated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime]
    generated_by: str
    generation_engine: Optional[str]
    generation_version: Optional[str]


class ReportHistoryPage(BaseModel):
    total: int
    page: int
    limit: int
    reports: List[Dict[str, Any]]


class TimelineEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    created_at: datetime
    payload: Optional[Dict[str, Any]] = None
