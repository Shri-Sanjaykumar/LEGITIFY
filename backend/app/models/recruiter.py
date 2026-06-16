import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    DateTime,
    ForeignKey,
    Float,
    Integer,
    Text,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class RecruiterVerification(Base):
    __tablename__ = "recruiter_verifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recruiter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recruiter_email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    claimed_company: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    recruiter_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recruiter_role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # LinkedIn Placeholders (Phase 6 Hardening)
    linkedin_profile_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin_validation_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "linkedin_validation_status IN ('UNKNOWN', 'VALID', 'INVALID')",
            name="check_recruiter_linkedin_validation_status",
        ),
        default="UNKNOWN",
        nullable=False,
    )

    # Scoring & Rating
    verification_score: Mapped[float] = mapped_column(
        Float,
        CheckConstraint(
            "verification_score >= 0.0 AND verification_score <= 100.0",
            name="check_recruiter_verification_score_range",
        ),
        default=0.0,
    )
    verification_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "verification_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')",
            name="check_recruiter_verification_status",
        ),
        default="PENDING",
    )
    verification_level: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "verification_level IN ('VERIFIED', 'LIKELY_VERIFIED', 'PARTIALLY_VERIFIED', 'SUSPICIOUS', 'UNVERIFIED', 'INTERNAL_RECRUITER')",
            name="check_recruiter_verification_level",
        ),
        default="UNVERIFIED",
    )
    verification_confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "verification_confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_recruiter_verification_confidence",
        ),
        default="LOW",
    )

    # Diagnostic Sub-statuses
    email_domain_status: Mapped[str] = mapped_column(String(50), default="UNKNOWN")
    company_match_status: Mapped[str] = mapped_column(String(50), default="UNKNOWN")
    phone_match_status: Mapped[str] = mapped_column(String(50), default="UNKNOWN")

    # Cache lifecycle
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    breakdowns = relationship(
        "RecruiterVerificationBreakdown",
        back_populates="verification",
        cascade="all, delete-orphan",
    )
    evidence = relationship(
        "RecruiterVerificationEvidence",
        back_populates="verification",
        cascade="all, delete-orphan",
    )


class RecruiterVerificationBreakdown(Base):
    __tablename__ = "recruiter_verification_breakdowns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recruiter_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_recruiter_breakdown_confidence",
        ),
        nullable=False,
    )
    source_reliability: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "source_reliability IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_recruiter_breakdown_source_reliability",
        ),
        nullable=False,
    )
    score_change: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    verification = relationship("RecruiterVerification", back_populates="breakdowns")


class RecruiterVerificationEvidence(Base):
    __tablename__ = "recruiter_verification_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recruiter_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="check_recruiter_evidence_severity",
        ),
        nullable=False,
    )
    confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_recruiter_evidence_confidence",
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    verification = relationship("RecruiterVerification", back_populates="evidence")


class RecruiterReputationSnapshot(Base):
    __tablename__ = "recruiter_reputation_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recruiter_email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    claimed_company: Mapped[str] = mapped_column(String(255), nullable=False)
    verification_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    verification_level: Mapped[str] = mapped_column(String(50), nullable=False)

    # Reputation metrics (Phase 6 Hardening)
    recruiter_verification_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )
    recruiter_success_rate: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0
    )

    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
