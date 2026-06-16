import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.models.report import (
    DomainVerification,
    DomainVerificationBreakdown,
    DomainVerificationEvidence,
    DomainReputationSnapshot,
)
from app.schemas.domain import (
    DomainVerifyRequest,
    DomainVerificationOut,
    DomainVerificationBreakdownOut,
    DomainVerificationEvidenceOut,
    DomainReputationSnapshotOut,
    DomainVerificationDetailOut,
)
from app.schemas.base import StandardResponse
from app.api.dependencies import get_current_user
from app.services.domain_intelligence.engine import (
    get_cached_domain_verification,
    start_domain_verification,
    execute_domain_verification_pipeline,
)
from app.middleware.logging import request_id_var
from app.core.rate_limit import rate_limit

router = APIRouter()
logger = logging.getLogger("app.api.domain")


@router.post(
    "/verify",
    response_model=StandardResponse,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def verify_domain(
    request: Request,
    body: DomainVerifyRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiates domain intelligence check or serves cached result."""
    req_id = request_id_var.get()
    try:
        # 1. Check Cache
        cached = await get_cached_domain_verification(db, body.domain)
        if cached:
            return StandardResponse(
                success=True,
                message="Domain verification retrieved from cache.",
                data=DomainVerificationOut.model_validate(cached),
                request_id=req_id,
            )

        # 2. Start new pending check
        verification = await start_domain_verification(
            db=db,
            domain=body.domain,
            verification_source=body.verification_source or "API",
        )

        # 3. Queue crawler task
        background_tasks.add_task(
            execute_domain_verification_pipeline,
            SessionLocal,
            verification.id,
        )

        return StandardResponse(
            success=True,
            message="Domain verification process initiated.",
            data=DomainVerificationOut.model_validate(verification),
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to verify domain: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification initialization failed: {str(e)}",
        )


@router.get("/history", response_model=StandardResponse)
async def get_domain_history(
    request: Request,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    level_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated search audit history of domain verifications."""
    req_id = request_id_var.get()
    try:
        query = select(DomainVerification)
        if status_filter:
            query = query.where(
                DomainVerification.verification_status == status_filter.upper()
            )
        if level_filter:
            query = query.where(
                DomainVerification.verification_level == level_filter.upper()
            )
        if search:
            query = query.where(DomainVerification.domain.like(f"%{search}%"))

        offset = (page - 1) * limit
        query = (
            query.order_by(DomainVerification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        res = await db.execute(query)
        verifications = res.scalars().all()
        data_out = [DomainVerificationOut.model_validate(v) for v in verifications]

        return StandardResponse(
            success=True,
            message="Domain verification history retrieved.",
            data=data_out,
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to fetch domain history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve history.",
        )


@router.get("/{verification_id}", response_model=StandardResponse)
async def get_domain_by_id(
    verification_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve specific domain verification summary by ID."""
    req_id = request_id_var.get()
    res = await db.execute(
        select(DomainVerification).where(DomainVerification.id == verification_id)
    )
    verification = res.scalars().first()
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification record not found.",
        )
    return StandardResponse(
        success=True,
        message="Verification summary retrieved.",
        data=DomainVerificationOut.model_validate(verification),
        request_id=req_id,
    )


@router.get("/{verification_id}/breakdown", response_model=StandardResponse)
async def get_domain_breakdown(
    verification_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed score breakdowns and evidence list."""
    req_id = request_id_var.get()

    # 1. Fetch verification
    res = await db.execute(
        select(DomainVerification).where(DomainVerification.id == verification_id)
    )
    verification = res.scalars().first()
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification record not found.",
        )

    # 2. Fetch breakdowns
    bd_res = await db.execute(
        select(DomainVerificationBreakdown).where(
            DomainVerificationBreakdown.verification_id == verification_id
        )
    )
    breakdowns = bd_res.scalars().all()

    # 3. Fetch evidence
    ev_res = await db.execute(
        select(DomainVerificationEvidence).where(
            DomainVerificationEvidence.verification_id == verification_id
        )
    )
    evidence = ev_res.scalars().all()

    detail = DomainVerificationDetailOut(
        verification=DomainVerificationOut.model_validate(verification),
        breakdowns=[
            DomainVerificationBreakdownOut.model_validate(b) for b in breakdowns
        ],
        evidence=[DomainVerificationEvidenceOut.model_validate(e) for e in evidence],
    )

    return StandardResponse(
        success=True,
        message="Detailed verification logs retrieved.",
        data=detail,
        request_id=req_id,
    )


@router.get("/reputation/{domain}", response_model=StandardResponse)
async def get_domain_reputation_history(
    domain: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve historical reputation snapshots for trend analysis."""
    req_id = request_id_var.get()
    try:
        stmt = (
            select(DomainReputationSnapshot)
            .where(DomainReputationSnapshot.domain == domain)
            .order_by(DomainReputationSnapshot.captured_at.desc())
        )
        res = await db.execute(stmt)
        snapshots = res.scalars().all()
        data_out = [DomainReputationSnapshotOut.model_validate(s) for s in snapshots]

        return StandardResponse(
            success=True,
            message="Domain reputation snapshot history retrieved.",
            data=data_out,
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to fetch reputation history for {domain}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reputation trend logs.",
        )
