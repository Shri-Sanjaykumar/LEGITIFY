import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.models.user import User
from app.models.file import UploadedFile
from app.schemas.file import UploadedFileOut
from app.schemas.base import StandardResponse
from app.services.file import store_file
from app.services.audit import create_audit_log
from app.middleware.logging import request_id_var
from app.api.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger("app.api.scan")


@router.post("/upload", response_model=StandardResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    try:
        content = await file.read()
    except Exception as e:
        logger.error(f"Failed to read upload file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded file content"
        )

    # Store file using service (validates size, ext, mime type, magic bytes)
    db_file = await store_file(
        db=db,
        user_id=current_user.id,
        filename=file.filename or "unknown",
        content=content,
        mime_type=file.content_type or "application/octet-stream"
    )

    # Create audit log
    await create_audit_log(
        db=db,
        action="FILE_UPLOAD",
        ip_address=client_ip,
        user_id=current_user.id,
        payload={"file_id": str(db_file.id), "filename": db_file.original_filename}
    )

    file_out = UploadedFileOut.model_validate(db_file)
    return StandardResponse(
        success=True,
        message="File uploaded successfully.",
        data=file_out,
        request_id=req_id
    )


@router.get("/file/{id}")
async def get_file(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == id, UploadedFile.is_deleted == False)
    )
    db_file = result.scalars().first()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    if db_file.user_id != current_user.id and current_user.role not in {"admin", "investigator"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this file"
        )

    return FileResponse(
        path=db_file.file_path,
        media_type=db_file.mime_type,
        filename=db_file.original_filename
    )
