import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, asc, desc

from app.api.dependencies import RoleChecker
from app.db.session import get_db
from app.middleware.logging import request_id_var
from app.models.report import EvidenceItem, Report, ReportHistory, TrustScoreBreakdown
from app.models.scan import Scan
from app.models.user import User
from app.schemas.trust import TrustScoreBreakdownOut
from app.schemas.base import StandardResponse
from app.schemas.report import (
    EvidenceItemCreate,
    EvidenceItemOut,
    ReportCreate,
    ReportOut,
    ReportStatusPatch,
)
from app.services.audit import create_audit_log
from app.services.report_state_machine import validate_transition

logger = logging.getLogger("app.endpoints.report")
router = APIRouter()

# RBAC role sets
_ALL_ROLES = ["student", "faculty", "admin", "investigator"]
_PRIVILEGED_ROLES = ["admin", "investigator"]

require_any_role = RoleChecker(_ALL_ROLES)
require_privileged = RoleChecker(_PRIVILEGED_ROLES)


# ──────────────────────────────────────────────────────────────────────────────
# Helper – resolve next report version string
# ──────────────────────────────────────────────────────────────────────────────


async def _next_version(db: AsyncSession, scan_id: uuid.UUID) -> str:
    """Return the next version string (v1, v2, v3 …) for a scan's reports."""
    result = await db.execute(
        select(func.count()).where(
            Report.scan_id == scan_id, Report.is_deleted.is_(False)
        )
    )
    count: int = result.scalar() or 0
    return f"v{count + 1}"


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/v1/report/create
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/create", response_model=StandardResponse, status_code=status.HTTP_201_CREATED
)
async def create_report(
    body: ReportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    """
    Initialise a new DRAFT report linked to a scan.
    If the scan already has reports, a new version (v2, v3, …) is created.
    Completed reports are never overwritten.
    """
    req_id = request_id_var.get()

    # Verify the scan exists and the caller owns it (or is privileged)
    scan_res = await db.execute(
        select(Scan).where(Scan.id == body.scan_id, Scan.is_deleted.is_(False))
    )
    scan = scan_res.scalars().first()
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found."
        )
    if scan.user_id != current_user.id and current_user.role not in _PRIVILEGED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized."
        )

    version = await _next_version(db, body.scan_id)

    report = Report(
        user_id=current_user.id,
        scan_id=body.scan_id,
        report_version=version,
        report_status="DRAFT",
        trust_score=body.trust_score,
        risk_score=body.risk_score,
        confidence_score=body.confidence_score,
        risk_level=body.risk_level,
        summary=body.summary,
        recommendation=body.recommendation,
        generated_by=body.generated_by,
        generation_engine=body.generation_engine,
        generation_version=body.generation_version,
    )
    db.add(report)
    await db.flush()  # obtain report.id before history insert

    # Create initial history record
    history = ReportHistory(
        report_id=report.id,
        from_status="",
        to_status="DRAFT",
        changed_by=current_user.id,
    )
    db.add(history)
    await db.commit()
    await db.refresh(report)

    # Audit log
    ip = request.client.host if request.client else "unknown"
    await create_audit_log(
        db=db,
        action="REPORT_CREATED",
        ip_address=ip,
        user_id=current_user.id,
        payload={
            "report_id": str(report.id),
            "scan_id": str(report.scan_id),
            "version": version,
        },
    )

    return StandardResponse(
        success=True,
        message="Report record initialised.",
        data=ReportOut.model_validate(report).model_dump(mode="json"),
        request_id=req_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/v1/report/{id}
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/{report_id}", response_model=StandardResponse)
async def get_report(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    req_id = request_id_var.get()

    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_deleted.is_(False))
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    # ACL: only owner, admin, or investigator may view
    if report.user_id != current_user.id and current_user.role not in _PRIVILEGED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized."
        )

    ip = request.client.host if request.client else "unknown"
    await create_audit_log(
        db=db,
        action="REPORT_VIEWED",
        ip_address=ip,
        user_id=current_user.id,
        payload={"report_id": str(report.id)},
    )

    return StandardResponse(
        success=True,
        message="Report retrieved.",
        data=ReportOut.model_validate(report).model_dump(mode="json"),
        request_id=req_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/v1/report/history
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/", response_model=StandardResponse)
async def get_report_history(
    request: Request,
    page: int = 1,
    limit: int = 20,
    sort: str = "created_at",
    order: str = "desc",
    report_status: Optional[str] = None,
    risk_level: Optional[str] = None,
    min_trust_score: Optional[float] = None,
    max_trust_score: Optional[float] = None,
    min_risk_score: Optional[float] = None,
    max_risk_score: Optional[float] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    req_id = request_id_var.get()

    query = select(Report).where(Report.is_deleted.is_(False))

    # Admins and investigators see all reports; students see only own
    if current_user.role not in _PRIVILEGED_ROLES:
        query = query.where(Report.user_id == current_user.id)

    # Filters
    if report_status:
        query = query.where(Report.report_status == report_status.upper())
    if risk_level:
        query = query.where(Report.risk_level == risk_level.lower())
    if min_trust_score is not None:
        query = query.where(Report.trust_score >= min_trust_score)
    if max_trust_score is not None:
        query = query.where(Report.trust_score <= max_trust_score)
    if min_risk_score is not None:
        query = query.where(Report.risk_score >= min_risk_score)
    if max_risk_score is not None:
        query = query.where(Report.risk_score <= max_risk_score)
    if start_date:
        query = query.where(Report.created_at >= start_date)
    if end_date:
        query = query.where(Report.created_at <= end_date)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar() or 0

    # Sorting
    sort_col = getattr(Report, sort, Report.created_at)
    order_fn = asc if order.lower() == "asc" else desc
    query = query.order_by(order_fn(sort_col))

    # Pagination
    query = query.offset((page - 1) * limit).limit(limit)
    rows = await db.execute(query)
    reports = rows.scalars().all()

    return StandardResponse(
        success=True,
        message="Report history retrieved.",
        data={
            "total": total,
            "page": page,
            "limit": limit,
            "reports": [
                ReportOut.model_validate(r).model_dump(mode="json") for r in reports
            ],
        },
        request_id=req_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# PATCH /api/v1/report/status
# ──────────────────────────────────────────────────────────────────────────────


@router.patch("/status", response_model=StandardResponse)
async def patch_report_status(
    body: ReportStatusPatch,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_privileged),
) -> StandardResponse:
    """Update report status – admin / investigator only."""
    req_id = request_id_var.get()

    result = await db.execute(
        select(Report).where(Report.id == body.report_id, Report.is_deleted.is_(False))
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    try:
        validate_transition(report.report_status, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    old_status = report.report_status
    report.report_status = body.status

    if body.status == "COMPLETED":
        report.generated_at = datetime.now(timezone.utc)

    # Write report_history row
    history = ReportHistory(
        report_id=report.id,
        from_status=old_status,
        to_status=body.status,
        changed_by=current_user.id,
    )
    db.add(history)
    await db.commit()
    await db.refresh(report)

    # Map status to audit event
    _audit_event_map = {
        "GENERATING": "REPORT_GENERATED",
        "COMPLETED": "REPORT_COMPLETED",
        "FAILED": "REPORT_FAILED",
        "ARCHIVED": "REPORT_ARCHIVED",
    }
    audit_action = _audit_event_map.get(body.status, "REPORT_STATUS_CHANGED")

    ip = request.client.host if request.client else "unknown"
    await create_audit_log(
        db=db,
        action=audit_action,
        ip_address=ip,
        user_id=current_user.id,
        payload={
            "report_id": str(report.id),
            "from_status": old_status,
            "to_status": body.status,
        },
    )

    return StandardResponse(
        success=True,
        message=f"Report status updated to {body.status}.",
        data=ReportOut.model_validate(report).model_dump(mode="json"),
        request_id=req_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/v1/report/{id}/evidence
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/{report_id}/evidence", response_model=StandardResponse)
async def get_evidence(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    req_id = request_id_var.get()

    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_deleted.is_(False))
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    if report.user_id != current_user.id and current_user.role not in _PRIVILEGED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized."
        )

    ev_result = await db.execute(
        select(EvidenceItem).where(
            EvidenceItem.report_id == report_id,
            EvidenceItem.is_deleted.is_(False),
        )
    )
    items = ev_result.scalars().all()

    return StandardResponse(
        success=True,
        message="Evidence items retrieved.",
        data={
            "report_id": str(report_id),
            "total": len(items),
            "evidence": [
                EvidenceItemOut.model_validate(e).model_dump(mode="json") for e in items
            ],
        },
        request_id=req_id,
    )


@router.get("/{report_id}/breakdown", response_model=StandardResponse)
async def get_breakdown(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    """Retrieve the Trust Score audit breakdown rules for a report."""
    req_id = request_id_var.get()

    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_deleted.is_(False))
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    if report.user_id != current_user.id and current_user.role not in _PRIVILEGED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized."
        )

    bd_result = await db.execute(
        select(TrustScoreBreakdown).where(TrustScoreBreakdown.report_id == report_id)
    )
    items = bd_result.scalars().all()

    return StandardResponse(
        success=True,
        message="Report score breakdown retrieved.",
        data={
            "report_id": str(report_id),
            "total": len(items),
            "breakdown": [
                TrustScoreBreakdownOut.model_validate(b).model_dump(mode="json")
                for b in items
            ],
        },
        request_id=req_id,
    )


@router.get("/{report_id}/timeline", response_model=StandardResponse)
async def get_timeline(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    """Retrieve the chronological audit-trail timeline events for a report."""
    req_id = request_id_var.get()
    from app.services.timeline.service import get_report_timeline
    from app.schemas.report import TimelineEventOut

    events = await get_report_timeline(db, report_id, current_user.id)
    serialized_events = [
        TimelineEventOut.model_validate(e).model_dump(mode="json") for e in events
    ]

    return StandardResponse(
        success=True,
        message="Report timeline retrieved.",
        data={
            "report_id": str(report_id),
            "total": len(serialized_events),
            "timeline": serialized_events,
        },
        request_id=req_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/v1/report/{id}/evidence
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/{report_id}/evidence",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_evidence(
    report_id: uuid.UUID,
    body: EvidenceItemCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_privileged),
) -> StandardResponse:
    """Add evidence to a report – admin / investigator only."""
    req_id = request_id_var.get()

    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_deleted.is_(False))
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    # Block evidence additions to ARCHIVED reports
    if report.report_status == "ARCHIVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add evidence to an ARCHIVED report.",
        )

    evidence = EvidenceItem(
        report_id=report_id,
        evidence_type=body.evidence_type,
        title=body.title,
        description=body.description,
        severity=body.severity,
        confidence=body.confidence,
        source=body.source,
        source_reference=body.source_reference,
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)

    ip = request.client.host if request.client else "unknown"
    await create_audit_log(
        db=db,
        action="EVIDENCE_ADDED",
        ip_address=ip,
        user_id=current_user.id,
        payload={
            "report_id": str(report_id),
            "evidence_id": str(evidence.id),
            "severity": body.severity,
        },
    )

    return StandardResponse(
        success=True,
        message="Evidence item added.",
        data=EvidenceItemOut.model_validate(evidence).model_dump(mode="json"),
        request_id=req_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# EXPORT EXTENSION POINTS (architecture placeholders)
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/{report_id}/export", response_model=StandardResponse)
async def export_report(
    report_id: uuid.UUID,
    format: str = "json",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any_role),
) -> StandardResponse:
    """
    Export extension point – not yet implemented.
    Supports format: pdf | json | audit
    """
    if format not in {"pdf", "json", "audit"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="format must be one of: pdf, json, audit",
        )
    return StandardResponse(
        success=False,
        message=f"Export format '{format}' is not yet implemented. Extension point reserved.",
        data={"report_id": str(report_id), "format": format},
    )
