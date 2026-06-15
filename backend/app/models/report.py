import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Float,
    Integer,
    Text,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Ownership linkage
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scans.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )

    # Versioning — never overwrite; create new version instead
    report_version: Mapped[str] = mapped_column(
        String(10), nullable=False, default="v1"
    )

    # Status with strict enum constraint
    report_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "report_status IN ('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED')",
            name="check_report_status",
        ),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    # Scored metrics with range constraints
    trust_score: Mapped[float] = mapped_column(
        Float,
        CheckConstraint(
            "trust_score >= 0 AND trust_score <= 100",
            name="check_trust_score_range",
        ),
        nullable=False,
        default=0.0,
        index=True,
    )
    risk_score: Mapped[float] = mapped_column(
        Float,
        CheckConstraint(
            "risk_score >= 0 AND risk_score <= 100",
            name="check_risk_score_range",
        ),
        nullable=False,
        default=0.0,
        index=True,
    )
    confidence_score: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint(
            "confidence_score >= 0 AND confidence_score <= 100",
            name="check_confidence_score_range",
        ),
        nullable=False,
        default=0,
    )

    # Classification
    risk_level: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "risk_level IN ('low', 'medium', 'high', 'critical')",
            name="check_risk_level",
        ),
        nullable=False,
        default="low",
    )

    # Report content
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    recommendation: Mapped[str] = mapped_column(Text, nullable=True)

    # Timestamps
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Future AI readiness fields
    generated_by: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "generated_by IN ('AI', 'HUMAN', 'SYSTEM')",
            name="check_generated_by",
        ),
        nullable=False,
        default="HUMAN",
    )
    generation_engine: Mapped[str] = mapped_column(String(100), nullable=True)
    generation_version: Mapped[str] = mapped_column(String(50), nullable=True)

    # Relationships
    user = relationship("User", back_populates="reports")
    scan = relationship("Scan", back_populates="report")
    evidence_items = relationship(
        "EvidenceItem", back_populates="report", cascade="all, delete-orphan"
    )
    history = relationship(
        "ReportHistory", back_populates="report", cascade="all, delete-orphan"
    )
    trust_scores = relationship(
        "TrustScore",
        back_populates="report",
        cascade="all, delete-orphan",
        uselist=False,
    )
    score_breakdowns = relationship(
        "TrustScoreBreakdown",
        back_populates="report",
        cascade="all, delete-orphan",
    )

    # Composite performance indexes
    __table_args__ = (
        Index("idx_reports_user_created", "user_id", "created_at"),
        Index("idx_reports_status_created", "report_status", "created_at"),
        Index("idx_reports_scan_status", "scan_id", "report_status"),
    )


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    document_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    domain_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    company_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    recruiter_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    community_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    technical_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    report = relationship("Report", back_populates="trust_scores")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )

    # Evidence classification enums
    evidence_type: Mapped[str] = mapped_column(
        String(100),
        CheckConstraint(
            "evidence_type IN ('DOCUMENT', 'DOMAIN', 'COMPANY', 'RECRUITER', 'EMAIL', 'LINKEDIN', 'MANUAL')",
            name="check_evidence_type",
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Severity enum with INFO added
    severity: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="check_evidence_severity",
        ),
        nullable=False,
    )

    # Confidence range 0.0 - 1.0 enforced at DB level
    confidence: Mapped[float] = mapped_column(
        Float,
        CheckConstraint(
            "confidence >= 0.0 AND confidence <= 1.0",
            name="check_evidence_confidence",
        ),
        nullable=False,
        default=0.5,
    )

    source: Mapped[str] = mapped_column(String(100), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    report = relationship("Report", back_populates="evidence_items")


class ReportHistory(Base):
    __tablename__ = "report_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str] = mapped_column(String(50), nullable=False)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    report = relationship("Report", back_populates="history")


class TrustScoreBreakdown(Base):
    __tablename__ = "trust_score_breakdowns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_category: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_change: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_breakdown_confidence",
        ),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    report = relationship("Report", back_populates="score_breakdowns")


class CompanyVerification(Base):
    __tablename__ = "company_verifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str] = mapped_column(String(255), nullable=False)
    company_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_score: Mapped[float] = mapped_column(
        Float,
        CheckConstraint(
            "verification_score >= 0.0 AND verification_score <= 100.0",
            name="check_verification_score_range",
        ),
        default=0.0,
    )
    verification_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "verification_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')",
            name="check_verification_status",
        ),
        default="PENDING",
    )
    verification_level: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "verification_level IN ('VERIFIED', 'LIKELY_VERIFIED', 'PARTIALLY_VERIFIED', 'SUSPICIOUS', 'UNVERIFIED')",
            name="check_verification_level",
        ),
        default="UNVERIFIED",
    )
    verification_confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "verification_confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_verification_confidence",
        ),
        default="LOW",
    )
    verification_version: Mapped[str] = mapped_column(String(20), default="v1")
    verification_source: Mapped[str] = mapped_column(String(100), default="API")
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_verification_at: Mapped[datetime | None] = mapped_column(
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

    breakdowns = relationship(
        "CompanyVerificationBreakdown",
        back_populates="verification",
        cascade="all, delete-orphan",
    )
    evidence = relationship(
        "CompanyVerificationEvidence",
        back_populates="verification",
        cascade="all, delete-orphan",
    )


class CompanyVerificationBreakdown(Base):
    __tablename__ = "company_verification_breakdowns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("company_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    score_change: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_company_breakdown_confidence",
        ),
        nullable=False,
    )
    source_reliability: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "source_reliability IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_company_breakdown_source_reliability",
        ),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    verification = relationship("CompanyVerification", back_populates="breakdowns")


class CompanyVerificationEvidence(Base):
    __tablename__ = "company_verification_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("company_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="check_company_evidence_severity",
        ),
        nullable=False,
    )
    confidence: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "confidence IN ('LOW', 'MEDIUM', 'HIGH')",
            name="check_company_evidence_confidence",
        ),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    verification = relationship("CompanyVerification", back_populates="evidence")
