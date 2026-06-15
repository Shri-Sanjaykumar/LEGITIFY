import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.models.user import User
from app.models.scan import Scan
from app.models.report import EvidenceItem, TrustScoreBreakdown
from app.schemas.trust import (
    TrustAnalysisRequest,
    TrustAnalysisOut,
    TrustScoreBreakdownOut,
)
from app.schemas.report import EvidenceItemOut
from app.schemas.base import StandardResponse
from app.api.dependencies import get_current_user
from app.services.trust_engine.engine import run_trust_analysis
from app.middleware.logging import request_id_var

router = APIRouter()
logger = logging.getLogger("app.api.trust")


@router.post("/analyze", response_model=StandardResponse)
async def analyze_trust(
    request: Request,
    body: TrustAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Executes the rule-based trust analysis on a specific scan record."""
    req_id = request_id_var.get()

    # 1. Fetch scan and run access validation
    scan_res = await db.execute(
        select(Scan).where(Scan.id == body.scan_id, Scan.is_deleted.is_(False))
    )
    scan = scan_res.scalars().first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found.",
        )

    if scan.user_id != current_user.id and current_user.role not in {
        "admin",
        "investigator",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to analyze this scan.",
        )

    try:
        # 2. Execute rule analysis pipeline
        report = await run_trust_analysis(db, body.scan_id, current_user.id)

        # 3. Retrieve database evidence logs and audit breakdowns
        ev_res = await db.execute(
            select(EvidenceItem).where(
                EvidenceItem.report_id == report.id,
                EvidenceItem.is_deleted.is_(False),
            )
        )
        evidence = ev_res.scalars().all()

        bd_res = await db.execute(
            select(TrustScoreBreakdown).where(
                TrustScoreBreakdown.report_id == report.id
            )
        )
        breakdowns = bd_res.scalars().all()

        # Parse recommendations back to a list
        recs = report.recommendation.split("\n") if report.recommendation else []
        recs = [r.strip() for r in recs if r.strip()]

        analysis_out = TrustAnalysisOut(
            trust_score=report.trust_score,
            risk_score=report.risk_score,
            risk_level=report.risk_level,
            evidence=[EvidenceItemOut.model_validate(e) for e in evidence],
            recommendations=recs,
            score_breakdown=[
                TrustScoreBreakdownOut.model_validate(b) for b in breakdowns
            ],
        )

        return StandardResponse(
            success=True,
            message="Trust analysis completed successfully.",
            data=analysis_out,
            request_id=req_id,
        )
    except Exception as e:
        logger.error(f"Trust analysis failed on scan {body.scan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Trust analysis execution failed: {str(e)}",
        )
