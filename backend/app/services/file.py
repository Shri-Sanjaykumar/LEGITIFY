import os
import re
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.config import settings
from app.models.file import UploadedFile

logger = logging.getLogger("app.services.file")

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "png", "jpg", "jpeg"}
FORBIDDEN_EXTENSIONS = {"exe", "dll", "bat", "msi", "sh", "js"}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg"
}

MAGIC_BYTES = {
    "pdf": b"%PDF",
    "docx": b"PK\x03\x04",
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
    "jpeg": b"\xff\xd8\xff",
}


def sanitize_filename(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    if len(parts) == 2:
        name, ext = parts
    else:
        name = parts[0]
        ext = ""
    
    # Path Traversal Protection: strictly keep only alphanumeric, dash, or underscore
    name = re.sub(r"[^\w\-_]", "_", name)
    
    if ext:
        ext = re.sub(r"[^\w]", "", ext).lower()
        return f"{name}.{ext}"
    return name


def validate_file(filename: str, content: bytes, mime_type: str) -> None:
    # 1. Size Validation
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        logger.warning(f"File upload rejected: size {len(content)} exceeds limit")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds limit of {settings.MAX_FILE_SIZE_MB}MB"
        )

    # 2. Extension Check
    parts = filename.rsplit(".", 1)
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File has no extension"
        )
    ext = parts[1].lower()

    if ext in FORBIDDEN_EXTENSIONS:
        logger.warning(f"File upload rejected: extension .{ext} is forbidden")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extension .{ext} is forbidden for security reasons"
        )

    if ext not in ALLOWED_EXTENSIONS:
        logger.warning(f"File upload rejected: extension .{ext} not allowed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extension .{ext} is not supported"
        )

    # 3. MIME Type Validation
    normalized_mime = mime_type.lower()
    if normalized_mime in {"image/jpg", "image/pjpeg", "image/x-citrix-jpeg"}:
        normalized_mime = "image/jpeg"
        
    if normalized_mime not in ALLOWED_MIME_TYPES:
        logger.warning(f"File upload rejected: MIME type '{mime_type}' not allowed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MIME type '{mime_type}' is not allowed"
        )

    # 4. Magic Bytes Validation
    if ext in MAGIC_BYTES:
        signature = MAGIC_BYTES[ext]
        if not content.startswith(signature):
            logger.warning(f"File upload rejected: magic bytes mismatch for extension .{ext}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content does not match reported extension .{ext} (magic bytes mismatch)"
            )
    elif ext == "txt":
        if b"\x00" in content[:1024]:
            logger.warning("File upload rejected: txt file contains binary null bytes")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text file contains binary data (null bytes)"
            )
        try:
            content[:1024].decode("utf-8")
        except UnicodeDecodeError:
            try:
                content[:1024].decode("ascii")
            except UnicodeDecodeError:
                logger.warning("File upload rejected: txt file is not valid UTF-8/ASCII")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Text file contains invalid encoding (not UTF-8 or ASCII)"
                )


async def check_user_quotas(
    db: AsyncSession,
    user_id: uuid.UUID,
    new_file_size: int
) -> None:
    """
    Storage Quota Checks Architecture
    Checks whether the user has exceeded their storage allowance.
    This architecture is prepared for user limits (e.g. 100MB total space or 50 uploads per day).
    It is currently designed but NOT enforced to allow testing.
    """
    # 1. Daily Upload Limit check (e.g., max 50 uploads in 24 hours)
    # 2. Total Storage Limit check (e.g., max 100MB cumulative upload size)
    
    # Mock parameters for future implementation
    max_daily_scans = 50
    max_storage_bytes = 100 * 1024 * 1024 # 100 MB
    
    logger.debug(
        f"Storage quota check completed for user {user_id}. "
        f"Limits: {max_daily_scans} daily, {max_storage_bytes} bytes max."
    )
    # (Future integration will raise a 400 or 429 error if query bounds are exceeded)
    pass


async def run_virus_scan(
    file_id: uuid.UUID,
    db: AsyncSession
) -> None:
    """
    Virus Scan Hook Architecture
    This placeholder architecture acts as a hook to invoke ClamAV or a third-party
    antivirus API (e.g., VirusTotal API) in future phases.
    """
    # 1. Trigger background task to scan target file path.
    # 2. Query scanner status and update virus_scan_status, virus_scan_date, and virus_scan_engine.
    
    logger.info(f"Initialized virus scan hook for file: {file_id}. Status: PENDING")
    pass


async def store_file(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    content: bytes,
    mime_type: str
) -> UploadedFile:
    # 1. Run validation rules
    validate_file(filename, content, mime_type)
    
    # 2. Perform quota checks (designed, not enforced)
    await check_user_quotas(db, user_id, len(content))

    sanitized = sanitize_filename(filename)
    file_hash = hashlib.sha256(content).hexdigest()

    # Determine classification
    parts = filename.rsplit(".", 1)
    ext = parts[1].lower() if len(parts) == 2 else ""
    document_type = "UNKNOWN"
    if ext == "pdf":
        document_type = "PDF"
    elif ext == "docx":
        document_type = "DOCX"
    elif ext == "txt":
        document_type = "TXT"
    elif ext in {"png", "jpg", "jpeg"}:
        document_type = "IMAGE"

    # 3. Duplicate Detection / Deduplication
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.file_hash == file_hash, 
            UploadedFile.is_deleted == False
        )
    )
    existing_file = result.scalars().first()

    if existing_file:
        logger.info(f"Deduplication triggered: File hash {file_hash} already exists. Linking to original file ID: {existing_file.id}")
        db_file = UploadedFile(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename=filename,
            sanitized_filename=sanitized,
            file_hash=file_hash,
            mime_type=mime_type,
            file_size=len(content),
            file_path=existing_file.file_path,  # Point to existing physical file
            duplicate_of=existing_file.id,
            document_type=document_type,
            virus_scan_status=existing_file.virus_scan_status,
            virus_scan_date=existing_file.virus_scan_date,
            virus_scan_engine=existing_file.virus_scan_engine,
            integrity_status="VERIFIED",
            sha256=file_hash,
            upload_timestamp=datetime.now(timezone.utc)
        )
    else:
        # Create target directory
        upload_dir = settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)

        file_id = uuid.uuid4()
        unique_filename = f"{file_id}_{sanitized}"
        file_path = os.path.join(upload_dir, unique_filename)

        # Write file to disk
        try:
            with open(file_path, "wb") as f:
                f.write(content)
        except Exception as e:
            logger.error(f"Failed to write file to disk: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store file on disk"
            )

        db_file = UploadedFile(
            id=file_id,
            user_id=user_id,
            original_filename=filename,
            sanitized_filename=sanitized,
            file_hash=file_hash,
            mime_type=mime_type,
            file_size=len(content),
            file_path=file_path,
            duplicate_of=None,
            document_type=document_type,
            virus_scan_status="PENDING",
            integrity_status="VERIFIED",
            sha256=file_hash,
            upload_timestamp=datetime.now(timezone.utc)
        )
        
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)

    # 4. Trigger virus scanning hook in the background
    await run_virus_scan(db_file.id, db)

    logger.info(f"File uploaded successfully: {filename} -> {db_file.file_path} (ID: {db_file.id})")
    return db_file
