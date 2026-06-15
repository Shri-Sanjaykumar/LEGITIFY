import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
    Text,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Performance Index on user_id
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True
    )

    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True
    )

    # Performance Index on scan_type
    scan_type: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "scan_type IN ('pdf', 'docx', 'txt', 'url', 'linkedin', 'email', 'text')",
            name="check_scan_type",
        ),
        nullable=False,
        index=True,
    )

    raw_input_text: Mapped[str] = mapped_column(Text, nullable=True)

    # Performance Index on status
    status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "status IN ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')",
            name="check_scan_status",
        ),
        nullable=False,
        default="PENDING",
        index=True,
    )

    # Approval Addendum Metadata
    scan_version: Mapped[str] = mapped_column(String(10), default="v1", nullable=False)
    scan_source: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "scan_source IN ('FILE', 'EMAIL', 'LINKEDIN', 'URL', 'TEXT')",
            name="check_scan_source",
        ),
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "priority IN ('LOW', 'NORMAL', 'HIGH')", name="check_scan_priority"
        ),
        nullable=False,
        default="NORMAL",
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timing and Failure Tracking
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_code: Mapped[str] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    # Performance Index on created_at
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
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="scans")
    file = relationship("UploadedFile", back_populates="scans")
    report = relationship(
        "Report", back_populates="scan", cascade="all, delete-orphan", uselist=False
    )
