import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Float, Integer, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    scan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), 
        unique=True,
        nullable=False
    )
    trust_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    scan = relationship("Scan", back_populates="report")
    trust_scores = relationship("TrustScore", back_populates="report", cascade="all, delete-orphan", uselist=False)
    evidence_items = relationship("EvidenceItem", back_populates="report", cascade="all, delete-orphan")


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), 
        unique=True, 
        nullable=False
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
        nullable=False
    )

    # Relationships
    report = relationship("Report", back_populates="trust_scores")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), 
        nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50), 
        CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="check_evidence_severity"),
        nullable=False
    )
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        nullable=False
    )

    # Relationships
    report = relationship("Report", back_populates="evidence_items")
