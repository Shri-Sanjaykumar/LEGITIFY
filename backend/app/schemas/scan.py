import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScanCreate(BaseModel):
    scan_type: str = Field(..., min_length=1)
    scan_source: str = Field(..., min_length=1)
    file_id: Optional[uuid.UUID] = None
    raw_input_text: Optional[str] = None
    priority: Optional[str] = "NORMAL"

    @field_validator("scan_type")
    @classmethod
    def validate_scan_type(cls, v: str) -> str:
        allowed = {"pdf", "docx", "txt", "url", "linkedin", "email", "text"}
        if v.lower() not in allowed:
            raise ValueError(f"scan_type must be one of {allowed}")
        return v.lower()

    @field_validator("scan_source")
    @classmethod
    def validate_scan_source(cls, v: str) -> str:
        allowed = {"FILE", "EMAIL", "LINKEDIN", "URL", "TEXT"}
        if v.upper() not in allowed:
            raise ValueError(f"scan_source must be one of {allowed}")
        return v.upper()

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = {"LOW", "NORMAL", "HIGH"}
        if v.upper() not in allowed:
            raise ValueError(f"priority must be one of {allowed}")
        return v.upper()


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    file_id: Optional[uuid.UUID]
    scan_type: str
    raw_input_text: Optional[str]
    status: str
    scan_version: str
    scan_source: str
    priority: str
    retry_count: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_code: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime


class ScanStatusPatch(BaseModel):
    scan_id: uuid.UUID
    status: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"PENDING", "QUEUED", "PROCESSING", "COMPLETED", "FAILED"}
        if v.upper() not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v.upper()
