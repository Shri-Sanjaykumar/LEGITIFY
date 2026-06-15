import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    sanitized_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True) # SHA-256
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Enterprise Hardening Fields
    virus_scan_status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)
    virus_scan_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    virus_scan_engine: Mapped[str] = mapped_column(String(100), nullable=True)
    duplicate_of: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("uploaded_files.id", ondelete="SET NULL"), 
        nullable=True
    )
    document_type: Mapped[str] = mapped_column(String(50), default="UNKNOWN", nullable=False)
    integrity_status: Mapped[str] = mapped_column(String(50), default="VERIFIED", nullable=False)

    # Evidence Integrity Fields
    sha256: Mapped[str] = mapped_column(String(64), nullable=True)
    upload_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="uploads")
    scans = relationship("Scan", back_populates="file")
    duplicate = relationship("UploadedFile", remote_side=[id])
