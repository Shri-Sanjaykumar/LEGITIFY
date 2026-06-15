import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.models.report import (
    CompanyVerification,
    CompanyVerificationBreakdown,
    CompanyVerificationEvidence,
)
from app.services.company_verification.crawler import run_company_verification_crawler
from app.services.company_verification.scoring import calculate_verification_results

logger = logging.getLogger("app.services.company_verification.engine")


async def get_cached_verification(
    db: AsyncSession, company_name: str, website: str
) -> Optional[CompanyVerification]:
    """Retrieve non-expired completed verification from the cache."""
    try:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(CompanyVerification).where(
                CompanyVerification.company_name == company_name,
                CompanyVerification.website == website,
                CompanyVerification.verification_status == "COMPLETED",
                CompanyVerification.verification_expires_at > now,
            )
        )
        return result.scalars().first()
    except Exception as e:
        logger.error(f"Error checking verification cache: {e}")
        return None


async def start_company_verification(
    db: AsyncSession,
    company_name: str,
    website: str,
    company_email: Optional[str] = None,
    contact_number: Optional[str] = None,
    address: Optional[str] = None,
    verification_source: str = "API",
) -> CompanyVerification:
    """Initialize a pending company verification record in the database."""
    # Check if a pending or completed record already exists for name + website
    stmt = select(CompanyVerification).where(
        CompanyVerification.company_name == company_name,
        CompanyVerification.website == website,
    )
    res = await db.execute(stmt)
    verification = res.scalars().first()

    if not verification:
        verification = CompanyVerification(
            id=uuid.uuid4(),
            company_name=company_name,
            website=website,
            company_email=company_email,
            contact_number=contact_number,
            address=address,
            verification_score=0.0,
            verification_status="PENDING",
            verification_level="UNVERIFIED",
            verification_confidence="LOW",
            verification_source=verification_source,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(verification)
    else:
        # Recycle existing record
        verification.verification_status = "PENDING"
        if company_email:
            verification.company_email = company_email
        if contact_number:
            verification.contact_number = contact_number
        if address:
            verification.address = address
        verification.verification_source = verification_source
        verification.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(verification)
    return verification


async def execute_verification_pipeline(
    db_session_factory, verification_id: uuid.UUID
) -> None:
    """Asynchronous background worker executing crawl, scoring, and database persistence."""
    # Use session factory for background execution safety
    async with db_session_factory() as db:
        try:
            # 1. Fetch verification record
            stmt = select(CompanyVerification).where(
                CompanyVerification.id == verification_id
            )
            res = await db.execute(stmt)
            verification = res.scalars().first()
            if not verification:
                logger.error(
                    f"Verification record {verification_id} not found in background worker."
                )
                return

            verification.verification_status = "PROCESSING"
            await db.commit()

            # 2. Run crawler
            crawl_data = await run_company_verification_crawler(
                company_name=verification.company_name,
                website=verification.website,
                company_email=verification.company_email,
                contact_number=verification.contact_number,
                address=verification.address,
            )

            # 3. Calculate scores
            scored = calculate_verification_results(crawl_data)

            # 4. Clear old breakdowns and evidence
            await db.execute(
                delete(CompanyVerificationBreakdown).where(
                    CompanyVerificationBreakdown.verification_id == verification.id
                )
            )
            await db.execute(
                delete(CompanyVerificationEvidence).where(
                    CompanyVerificationEvidence.verification_id == verification.id
                )
            )

            # 5. Populate new breakdowns
            for bd in scored["breakdowns"]:
                db_bd = CompanyVerificationBreakdown(
                    id=uuid.uuid4(),
                    verification_id=verification.id,
                    rule_name=bd["rule_name"],
                    category=bd["category"],
                    score_change=bd["score_change"],
                    confidence=bd["confidence"],
                    source_reliability=bd["source_reliability"],
                    reason=bd["reason"],
                    source=bd["source"],
                    created_at=datetime.now(timezone.utc),
                )
                db.add(db_bd)

            # 6. Populate new evidence
            for ev in scored["evidence"]:
                db_ev = CompanyVerificationEvidence(
                    id=uuid.uuid4(),
                    verification_id=verification.id,
                    evidence_type=ev["evidence_type"],
                    description=ev["description"],
                    source=ev["source"],
                    severity=ev["severity"],
                    confidence=ev["confidence"],
                    created_at=datetime.now(timezone.utc),
                )
                db.add(db_ev)

            # 7. Update verification details
            now = datetime.now(timezone.utc)
            verification.verification_score = scored["score"]
            verification.verification_level = scored["level"]
            verification.verification_confidence = scored["confidence"]
            verification.verification_status = "COMPLETED"
            verification.last_verified_at = now
            verification.verification_expires_at = now + timedelta(hours=24)
            verification.updated_at = now

            await db.commit()
            logger.info(
                f"Verification {verification_id} completed successfully. Score: {scored['score']}"
            )

        except Exception as e:
            logger.error(
                f"Error executing verification pipeline for {verification_id}: {e}",
                exc_info=True,
            )
            try:
                verification.verification_status = "FAILED"
                verification.updated_at = datetime.now(timezone.utc)
                await db.commit()
            except Exception as rollback_err:
                logger.error(f"Could not mark verification as FAILED: {rollback_err}")
