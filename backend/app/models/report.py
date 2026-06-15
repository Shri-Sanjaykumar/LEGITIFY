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
