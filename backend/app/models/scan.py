import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=False
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploaded_files.id", ondelete="SET NULL"), 
        nullable=True
    )
    input_type: Mapped[str] = mapped_column(
        String(50), 
        CheckConstraint(
            "input_type IN ('pdf', 'docx', 'txt', 'url', 'linkedin', 'email', 'text')", 
            name="check_scan_input_type"
        ),
        nullable=False
    )
    raw_input_text: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), 
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')", 
            name="check_scan_status"
        ),
        nullable=False, 
        default="PENDING"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="scans")
    file = relationship("UploadedFile", back_populates="scans")
    report = relationship("Report", back_populates="scan", cascade="all, delete-orphan", uselist=False)
