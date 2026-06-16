import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
    UploadFile,
    File,
    Query,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.file import UploadedFile
from app.models.scan import Scan
from app.schemas.file import UploadedFileOut
from app.schemas.scan import ScanCreate, ScanOut, ScanStatusPatch
from app.schemas.base import StandardResponse
from app.services.file import store_file
from app.services.audit import create_audit_log
from app.services.scan_state_machine import validate_transition
from app.middleware.logging import request_id_var
from app.api.dependencies import get_current_user
from app.core.rate_limit import rate_limit

router = APIRouter()
logger = logging.getLogger("app.api.scan")


@router.post(
    "/upload",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(20, 60))],
)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    try:
        content = await file.read()
    except Exception as e:
        logger.error(f"Failed to read upload file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded file content",
        )

    # Store file using service
    db_file = await store_file(
        db=db,
        user_id=current_user.id,
        filename=file.filename or "unknown",
        content=content,
        mime_type=file.content_type or "application/octet-stream",
    )

    # Create audit log
    await create_audit_log(
        db=db,
        action="FILE_UPLOADED",
        ip_address=client_ip,
        user_id=current_user.id,
        payload={"file_id": str(db_file.id), "filename": db_file.original_filename},
    )

    file_out = UploadedFileOut.model_validate(db_file)
    return StandardResponse(
        success=True,
        message="File uploaded successfully.",
        data=file_out,
        request_id=req_id,
    )


@router.get("/file/{id}")
async def get_file(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == id, UploadedFile.is_deleted.is_(False)
        )
    )
    db_file = result.scalars().first()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    if db_file.user_id != current_user.id and current_user.role not in {
        "admin",
        "investigator",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this file",
        )

    return FileResponse(
        path=db_file.file_path,
        media_type=db_file.mime_type,
        filename=db_file.original_filename,
    )


@router.post(
    "/create",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def create_scan(
    request: Request,
    scan_in: ScanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    # Validate file ownership if file_id is provided
    if scan_in.file_id:
        file_res = await db.execute(
            select(UploadedFile).where(
                UploadedFile.id == scan_in.file_id, UploadedFile.is_deleted.is_(False)
            )
        )
        db_file = file_res.scalars().first()
        if not db_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
            )
        if db_file.user_id != current_user.id and current_user.role not in {
            "admin",
            "investigator",
        }:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to use this file for scans",
            )

    # Initialize Scan
    scan = Scan(
        id=uuid.uuid4(),
        user_id=current_user.id,
        file_id=scan_in.file_id,
        scan_type=scan_in.scan_type,
        raw_input_text=scan_in.raw_input_text,
        status="PENDING",
        scan_version="v1",
        scan_source=scan_in.scan_source,
        priority=scan_in.priority or "NORMAL",
        retry_count=0,
    )

    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    # Audit logging
    await create_audit_log(
        db=db,
        action="SCAN_CREATED",
        ip_address=client_ip,
        user_id=current_user.id,
        payload={
            "scan_id": str(scan.id),
            "previous_status": None,
            "new_status": "PENDING",
            "user_id": str(scan.user_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    scan_out = ScanOut.model_validate(scan)
    return StandardResponse(
        success=True,
        message="Scan record initialized.",
        data=scan_out,
        request_id=req_id,
    )


@router.get("/history", response_model=StandardResponse)
async def get_scan_history(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    status: Optional[str] = Query(None),
    scan_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()

    # Form base query (Access Control: Users can only see their own scans)
    query = (
        select(Scan)
        .options(selectinload(Scan.report))
        .where(Scan.user_id == current_user.id, Scan.is_deleted.is_(False))
    )
    count_query = (
        select(func.count())
        .select_from(Scan)
        .where(Scan.user_id == current_user.id, Scan.is_deleted.is_(False))
    )

    # Filtering
    if status:
        query = query.where(Scan.status == status)
        count_query = count_query.where(Scan.status == status)
    if scan_type:
        query = query.where(Scan.scan_type == scan_type)
        count_query = count_query.where(Scan.scan_type == scan_type)
    if start_date:
        query = query.where(Scan.created_at >= start_date)
        count_query = count_query.where(Scan.created_at >= start_date)
    if end_date:
        query = query.where(Scan.created_at <= end_date)
        count_query = count_query.where(Scan.created_at <= end_date)

    # Sorting
    allowed_sorts = {"created_at", "status", "scan_type", "priority", "completed_at"}
    if sort not in allowed_sorts:
        sort = "created_at"
    sort_attr = getattr(Scan, sort)

    if order.lower() == "asc":
        query = query.order_by(sort_attr.asc())
    else:
        query = query.order_by(sort_attr.desc())

    # Pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    # Execute
    res = await db.execute(query)
    scans = res.scalars().all()

    count_res = await db.execute(count_query)
    total = count_res.scalar_one()

    scan_outs = [ScanOut.model_validate(s) for s in scans]
    return StandardResponse(
        success=True,
        message="Scan history retrieved.",
        data={"scans": scan_outs, "total": total, "page": page, "limit": limit},
        request_id=req_id,
    )


@router.patch("/status", response_model=StandardResponse)
async def patch_scan_status(
    request: Request,
    patch_in: ScanStatusPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    # RBAC Authorization Check: Admin or Investigator only
    if current_user.role not in {"admin", "investigator"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or investigators can update scan statuses",
        )

    # Fetch scan
    scan_res = await db.execute(
        select(Scan).where(Scan.id == patch_in.scan_id, Scan.is_deleted.is_(False))
    )
    scan = scan_res.scalars().first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan record not found"
        )

    prev_status = scan.status
    new_status = patch_in.status

    # Validate transition via centralized state machine
    validate_transition(prev_status, new_status)

    # Update timing and status details
    scan.status = new_status
    if new_status == "PROCESSING" and not scan.started_at:
        scan.started_at = datetime.now(timezone.utc)
    elif new_status in {"COMPLETED", "FAILED"}:
        scan.completed_at = datetime.now(timezone.utc)
        if new_status == "FAILED":
            scan.error_code = patch_in.error_code or "SYSTEM_ERROR"
            scan.error_message = patch_in.error_message or "Unknown failure"

    await db.commit()
    await db.refresh(scan)

    # Audit Logging
    action_map = {
        "QUEUED": "SCAN_QUEUED",
        "PROCESSING": "SCAN_STARTED",
        "COMPLETED": "SCAN_COMPLETED",
        "FAILED": "SCAN_FAILED",
    }
    action = action_map.get(new_status, "SCAN_STATUS_CHANGED")

    await create_audit_log(
        db=db,
        action=action,
        ip_address=client_ip,
        user_id=current_user.id,
        payload={
            "scan_id": str(scan.id),
            "previous_status": prev_status,
            "new_status": new_status,
            "user_id": str(scan.user_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return StandardResponse(
        success=True,
        message="Scan status updated.",
        data={"id": scan.id, "status": scan.status},
        request_id=req_id,
    )


@router.get("/{id}", response_model=StandardResponse)
async def get_scan_details(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.report))
        .where(Scan.id == id, Scan.is_deleted.is_(False))
    )
    scan = result.scalars().first()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan record not found"
        )

    # Access Control: Owner or elevated roles only
    if scan.user_id != current_user.id and current_user.role not in {
        "admin",
        "investigator",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this scan record",
        )

    scan_out = ScanOut.model_validate(scan)
    return StandardResponse(
        success=True,
        message="Scan status retrieved.",
        data=scan_out,
        request_id=request_id_var.get(),
    )
