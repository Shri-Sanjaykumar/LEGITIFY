import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.models.report import (
    CompanyVerification,
    CompanyVerificationBreakdown,
    CompanyVerificationEvidence,
)
from app.schemas.company import (
    CompanyVerifyRequest,
    CompanyVerificationOut,
    CompanyVerificationBreakdownOut,
    CompanyVerificationEvidenceOut,
    CompanyVerificationDetailOut,
)
from app.schemas.base import StandardResponse
from app.api.dependencies import get_current_user
from app.services.company_verification.engine import (
    get_cached_verification,
    start_company_verification,
    execute_verification_pipeline,
)
from app.middleware.logging import request_id_var
from app.core.rate_limit import rate_limit

router = APIRouter()
logger = logging.getLogger("app.api.company")


@router.post(
    "/verify",
    response_model=StandardResponse,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def verify_company(
    request: Request,
    body: CompanyVerifyRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiates company verification check or serves cached result."""
    req_id = request_id_var.get()
    try:
        # 1. Check Cache
        cached = await get_cached_verification(db, body.company_name, body.website)
        if cached:
            return StandardResponse(
                success=True,
                message="Company verification retrieved from cache.",
                data=CompanyVerificationOut.model_validate(cached),
                request_id=req_id,
            )

        # 2. Start new pending check
        verification = await start_company_verification(
            db=db,
            company_name=body.company_name,
            website=body.website,
            company_email=body.company_email,
            contact_number=body.contact_number,
            address=body.address,
            verification_source=body.verification_source or "API",
        )

        # 3. Queue crawler task
        background_tasks.add_task(
            execute_verification_pipeline,
            SessionLocal,
            verification.id,
        )

        return StandardResponse(
            success=True,
            message="Company verification process initiated.",
            data=CompanyVerificationOut.model_validate(verification),
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to verify company: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification initialization failed: {str(e)}",
        )


@router.get("/history", response_model=StandardResponse)
async def get_verification_history(
    request: Request,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    level_filter: Optional[str] = None,
    search: Optional[str] = None,
    website: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated search audit history of company verifications."""
    req_id = request_id_var.get()
    try:
        query = select(CompanyVerification)
        if status_filter:
            query = query.where(
                CompanyVerification.verification_status == status_filter.upper()
            )
        if level_filter:
            query = query.where(
                CompanyVerification.verification_level == level_filter.upper()
            )
        if website:
            query = query.where(CompanyVerification.website.like(f"%{website}%"))
        if search:
            query = query.where(
                (CompanyVerification.company_name.like(f"%{search}%"))
                | (CompanyVerification.website.like(f"%{search}%"))
            )

        # Pagination offsets
        offset = (page - 1) * limit
        query = (
            query.order_by(CompanyVerification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        res = await db.execute(query)
        verifications = res.scalars().all()

        data_out = [CompanyVerificationOut.model_validate(v) for v in verifications]

        return StandardResponse(
            success=True,
            message="Verification history retrieved successfully.",
            data=data_out,
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve verification history.",
        )


@router.get("/{verification_id}", response_model=StandardResponse)
async def get_verification_by_id(
    verification_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve specific company verification summary by ID."""
    req_id = request_id_var.get()
    res = await db.execute(
        select(CompanyVerification).where(CompanyVerification.id == verification_id)
    )
    verification = res.scalars().first()
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification record not found.",
        )
    return StandardResponse(
        success=True,
        message="Verification summary retrieved successfully.",
        data=CompanyVerificationOut.model_validate(verification),
        request_id=req_id,
    )


@router.get("/{verification_id}/breakdown", response_model=StandardResponse)
async def get_verification_breakdown(
    verification_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full audit logs, breakdowns, and evidence items for compliance analysis."""
    req_id = request_id_var.get()

    # 1. Fetch verification
    res = await db.execute(
        select(CompanyVerification).where(CompanyVerification.id == verification_id)
    )
    verification = res.scalars().first()
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification record not found.",
        )

    # 2. Fetch breakdowns
    bd_res = await db.execute(
        select(CompanyVerificationBreakdown).where(
            CompanyVerificationBreakdown.verification_id == verification_id
        )
    )
    breakdowns = bd_res.scalars().all()

    # 3. Fetch evidence
    ev_res = await db.execute(
        select(CompanyVerificationEvidence).where(
            CompanyVerificationEvidence.verification_id == verification_id
        )
    )
    evidence = ev_res.scalars().all()

    detail = CompanyVerificationDetailOut(
        verification=CompanyVerificationOut.model_validate(verification),
        breakdowns=[
            CompanyVerificationBreakdownOut.model_validate(b) for b in breakdowns
        ],
        evidence=[CompanyVerificationEvidenceOut.model_validate(e) for e in evidence],
    )

    return StandardResponse(
        success=True,
        message="Detailed verification logs retrieved.",
        data=detail,
        request_id=req_id,
    )
