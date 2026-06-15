import os
import re
import uuid
import hashlib
import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
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
    
    # Replace any non-alphanumeric, dash, or underscore characters in name
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
        # Check that it doesn't look like a binary file
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


async def store_file(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    content: bytes,
    mime_type: str
) -> UploadedFile:
    # Validate the file
    validate_file(filename, content, mime_type)

    sanitized = sanitize_filename(filename)
    file_hash = hashlib.sha256(content).hexdigest()

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

    # Create DB record
    db_file = UploadedFile(
        id=file_id,
        user_id=user_id,
        original_filename=filename,
        sanitized_filename=sanitized,
        file_hash=file_hash,
        mime_type=mime_type,
        file_size=len(content),
        file_path=file_path
    )
    
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)

    logger.info(f"File uploaded successfully: {filename} -> {file_path} (ID: {file_id})")
    return db_file
