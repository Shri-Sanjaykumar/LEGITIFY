import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1)
    role: str = Field(default="student")

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "@$!%*?&" for c in v):
            raise ValueError(
                "Password must contain at least one special character (@$!%*?&)"
            )
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = ["student", "faculty", "admin", "investigator"]
        if v not in allowed:
            raise ValueError(f"Role must be one of {allowed}")
        return v


class UserLogin(BaseModel):
    username: EmailStr
    password: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
