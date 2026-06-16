import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.models.recruiter import (
    RecruiterVerification,
    RecruiterVerificationBreakdown,
    RecruiterVerificationEvidence,
    RecruiterReputationSnapshot,
)
from app.schemas.recruiter import (
    RecruiterVerifyRequest,
    RecruiterVerificationOut,
    RecruiterVerificationBreakdownOut,
    RecruiterVerificationEvidenceOut,
    RecruiterReputationSnapshotOut,
    RecruiterVerificationDetailOut,
)
from app.schemas.base import StandardResponse
from app.api.dependencies import get_current_user
from app.services.recruiter_verification.engine import (
    get_cached_verification,
    start_recruiter_verification,
    execute_verification_pipeline,
)
from app.middleware.logging import request_id_var
from app.core.rate_limit import rate_limit

router = APIRouter()
logger = logging.getLogger("app.api.recruiter")


@router.post(
    "/verify",
    response_model=StandardResponse,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def verify_recruiter(
    request: Request,
    body: RecruiterVerifyRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiates recruiter verification audit or serves cached result."""
    req_id = request_id_var.get()
    try:
        # 1. Check Cache
        cached = await get_cached_verification(
            db, body.recruiter_email, body.claimed_company
        )
        if cached:
            return StandardResponse(
                success=True,
                message="Recruiter verification retrieved from cache.",
                data=RecruiterVerificationOut.model_validate(cached),
                request_id=req_id,
            )

        # 2. Start new pending check
        verification = await start_recruiter_verification(
            db=db,
            recruiter_name=body.recruiter_name,
            recruiter_email=body.recruiter_email,
            claimed_company=body.claimed_company,
            recruiter_phone=body.recruiter_phone,
            recruiter_role=body.recruiter_role,
            linkedin_profile_url=body.linkedin_profile_url,
            verification_source=body.verification_source or "API",
        )

        # 3. Queue verification task
        background_tasks.add_task(
            execute_verification_pipeline,
            SessionLocal,
            verification.id,
        )

        return StandardResponse(
            success=True,
            message="Recruiter verification process initiated.",
            data=RecruiterVerificationOut.model_validate(verification),
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to verify recruiter: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification initialization failed: {str(e)}",
        )


@router.get("/history", response_model=StandardResponse)
async def get_recruiter_history(
    request: Request,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    level_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated search audit history of recruiter verifications."""
    req_id = request_id_var.get()
    try:
        query = select(RecruiterVerification)
        if status_filter:
            query = query.where(
                RecruiterVerification.verification_status == status_filter.upper()
            )
        if level_filter:
            query = query.where(
                RecruiterVerification.verification_level == level_filter.upper()
            )
        if search:
            query = query.where(
                (RecruiterVerification.recruiter_name.ilike(f"%{search}%"))
                | (RecruiterVerification.recruiter_email.ilike(f"%{search}%"))
                | (RecruiterVerification.claimed_company.ilike(f"%{search}%"))
            )

        offset = (page - 1) * limit
        query = (
            query.order_by(RecruiterVerification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        res = await db.execute(query)
        verifications = res.scalars().all()
        data_out = [RecruiterVerificationOut.model_validate(v) for v in verifications]

        return StandardResponse(
            success=True,
            message="Recruiter verification history retrieved.",
            data=data_out,
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to fetch recruiter history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve history.",
        )


@router.get("/{verification_id}", response_model=StandardResponse)
async def get_recruiter_by_id(
    verification_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve specific recruiter verification summary by ID."""
    req_id = request_id_var.get()
    res = await db.execute(
        select(RecruiterVerification).where(RecruiterVerification.id == verification_id)
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
        data=RecruiterVerificationOut.model_validate(verification),
        request_id=req_id,
    )


@router.get("/{verification_id}/breakdown", response_model=StandardResponse)
async def get_recruiter_breakdown(
    verification_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed score breakdowns and evidence list."""
    req_id = request_id_var.get()

    # 1. Fetch verification
    res = await db.execute(
        select(RecruiterVerification).where(RecruiterVerification.id == verification_id)
    )
    verification = res.scalars().first()
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification record not found.",
        )

    # 2. Fetch breakdowns
    bd_res = await db.execute(
        select(RecruiterVerificationBreakdown).where(
            RecruiterVerificationBreakdown.verification_id == verification_id
        )
    )
    breakdowns = bd_res.scalars().all()

    # 3. Fetch evidence
    ev_res = await db.execute(
        select(RecruiterVerificationEvidence).where(
            RecruiterVerificationEvidence.verification_id == verification_id
        )
    )
    evidence = ev_res.scalars().all()

    detail = RecruiterVerificationDetailOut(
        verification=RecruiterVerificationOut.model_validate(verification),
        breakdowns=[
            RecruiterVerificationBreakdownOut.model_validate(b) for b in breakdowns
        ],
        evidence=[RecruiterVerificationEvidenceOut.model_validate(e) for e in evidence],
    )

    return StandardResponse(
        success=True,
        message="Detailed verification logs retrieved.",
        data=detail,
        request_id=req_id,
    )


@router.get("/reputation/{email}", response_model=StandardResponse)
async def get_recruiter_reputation_history(
    email: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve historical reputation snapshots for trend analysis."""
    req_id = request_id_var.get()
    try:
        stmt = (
            select(RecruiterReputationSnapshot)
            .where(RecruiterReputationSnapshot.recruiter_email == email)
            .order_by(RecruiterReputationSnapshot.captured_at.desc())
        )
        res = await db.execute(stmt)
        snapshots = res.scalars().all()
        data_out = [RecruiterReputationSnapshotOut.model_validate(s) for s in snapshots]

        return StandardResponse(
            success=True,
            message="Recruiter reputation snapshot history retrieved.",
            data=data_out,
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to fetch reputation history for {email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reputation trend logs.",
        )
