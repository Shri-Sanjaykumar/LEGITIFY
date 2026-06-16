import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status

from app.models.report import Report
from app.models.scan import Scan
from app.models.audit import AuditLog


async def get_report_timeline(
    db: AsyncSession,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
) -> List[AuditLog]:
    """
    Generates a chronological list of timeline audit logs for a given report.
    Pulls audit logs linked by scan_id, report_id, or uploaded file_id.
    """
    # 1. Fetch report to verify ownership and find scan_id
    report_res = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_deleted.is_(False))
    )
    report = report_res.scalars().first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    if report.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this report timeline",
        )

    scan_id = report.scan_id

    # Fetch scan details to get file_id
    scan_res = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = scan_res.scalars().first()
    file_id = scan.file_id if scan else None

    # 2. Query all audit logs for this user to keep it fully db-agnostic (avoiding custom jsonb operators)
    stmt = (
        select(AuditLog)
        .where(AuditLog.user_id == user_id)
        .order_by(AuditLog.created_at.asc())
    )
    res = await db.execute(stmt)
    logs = res.scalars().all()

    timeline_events = []

    # Actions we are interested in for the timeline
    interested_actions = {
        "FILE_UPLOADED",
        "SCAN_CREATED",
        "TRUST_ANALYSIS_STARTED",
        "COMPANY_VERIFIED",
        "DOMAIN_VERIFIED",
        "RECRUITER_VERIFIED",
        "REPORT_CREATED",
        "REPORT_COMPLETED",
    }

    for log in logs:
        if log.action not in interested_actions:
            continue

        payload = log.payload or {}
        if not isinstance(payload, dict):
            continue

        is_related = False

        # Match by scan_id
        if "scan_id" in payload and str(payload["scan_id"]) == str(scan_id):
            is_related = True
        # Match by report_id
        elif "report_id" in payload and str(payload["report_id"]) == str(report_id):
            is_related = True
        # Match by file_id if it's FILE_UPLOADED
        elif (
            log.action == "FILE_UPLOADED"
            and file_id
            and "file_id" in payload
            and str(payload["file_id"]) == str(file_id)
        ):
            is_related = True

        if is_related:
            timeline_events.append(log)

    return timeline_events
