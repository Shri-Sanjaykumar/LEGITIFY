import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.models.recruiter import (
    RecruiterVerification,
    RecruiterVerificationBreakdown,
    RecruiterVerificationEvidence,
    RecruiterReputationSnapshot,
)
from app.models.report import (
    CompanyVerification,
    DomainVerification,
)
from app.services.recruiter_verification.crawler import (
    run_recruiter_verification_crawler,
    extract_domain,
)
from app.services.recruiter_verification.scoring import (
    calculate_recruiter_verification_results,
)

logger = logging.getLogger("app.services.recruiter_verification.engine")


async def get_cached_verification(
    db: AsyncSession, recruiter_email: str, claimed_company: str
) -> Optional[RecruiterVerification]:
    """Retrieve non-expired completed recruiter verification from cache."""
    try:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(RecruiterVerification).where(
                RecruiterVerification.recruiter_email == recruiter_email,
                RecruiterVerification.claimed_company == claimed_company,
                RecruiterVerification.verification_status == "COMPLETED",
                RecruiterVerification.verification_expires_at > now,
            )
        )
        return result.scalars().first()
    except Exception as e:
        logger.error(f"Error checking recruiter verification cache: {e}")
        return None


async def start_recruiter_verification(
    db: AsyncSession,
    recruiter_name: str,
    recruiter_email: str,
    claimed_company: str,
    recruiter_phone: Optional[str] = None,
    recruiter_role: Optional[str] = None,
    linkedin_profile_url: Optional[str] = None,
    verification_source: str = "API",
) -> RecruiterVerification:
    """Initialize a pending recruiter verification record in the database."""
    stmt = select(RecruiterVerification).where(
        RecruiterVerification.recruiter_email == recruiter_email,
        RecruiterVerification.claimed_company == claimed_company,
    )
    res = await db.execute(stmt)
    verification = res.scalars().first()

    if not verification:
        verification = RecruiterVerification(
            id=uuid.uuid4(),
            recruiter_name=recruiter_name,
            recruiter_email=recruiter_email,
            claimed_company=claimed_company,
            recruiter_phone=recruiter_phone,
            recruiter_role=recruiter_role,
            linkedin_profile_url=linkedin_profile_url,
            linkedin_validation_status="UNKNOWN",
            verification_score=0.0,
            verification_status="PENDING",
            verification_level="UNVERIFIED",
            verification_confidence="LOW",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(verification)
    else:
        # Recycle existing record
        verification.verification_status = "PENDING"
        verification.recruiter_name = recruiter_name
        if recruiter_phone:
            verification.recruiter_phone = recruiter_phone
        if recruiter_role:
            verification.recruiter_role = recruiter_role
        if linkedin_profile_url:
            verification.linkedin_profile_url = linkedin_profile_url
        verification.linkedin_validation_status = "UNKNOWN"
        verification.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(verification)
    return verification


async def execute_verification_pipeline(
    db_session_factory, verification_id: uuid.UUID
) -> None:
    """Asynchronous background worker executing recruiter audits and caching results."""
    async with db_session_factory() as db:
        try:
            # 1. Fetch verification record
            stmt = select(RecruiterVerification).where(
                RecruiterVerification.id == verification_id
            )
            res = await db.execute(stmt)
            verification = res.scalars().first()
            if not verification:
                logger.error(
                    f"Recruiter verification record {verification_id} not found in background worker."
                )
                return

            verification.verification_status = "PROCESSING"
            await db.commit()

            # 2. Check if claimed company is verified in Legitify database
            company_stmt = select(CompanyVerification).where(
                CompanyVerification.company_name.ilike(verification.claimed_company),
                CompanyVerification.verification_status == "COMPLETED",
            )
            comp_res = await db.execute(company_stmt)
            company_ver = comp_res.scalars().first()

            company_website = company_ver.website if company_ver else None
            company_verified = (
                company_ver.verification_level in ("VERIFIED", "LIKELY_VERIFIED")
                if company_ver
                else False
            )

            # 3. Check if domain has secure DNS/MX/SSL configurations in Legitify
            email_domain = extract_domain(verification.recruiter_email)
            dns_mx_ssl_verified = False
            if email_domain:
                dom_stmt = select(DomainVerification).where(
                    DomainVerification.domain == email_domain,
                    DomainVerification.verification_status == "COMPLETED",
                )
                dom_res = await db.execute(dom_stmt)
                dom_ver = dom_res.scalars().first()
                if dom_ver:
                    dns_mx_ssl_verified = (
                        dom_ver.dns_status == "RESOLVED"
                        and dom_ver.mx_status == "CONFIGURED"
                        and dom_ver.ssl_status == "VALID"
                    )

            # 4. Run crawler check
            crawl_data = await run_recruiter_verification_crawler(
                recruiter_name=verification.recruiter_name,
                recruiter_email=verification.recruiter_email,
                claimed_company=verification.claimed_company,
                recruiter_phone=verification.recruiter_phone,
                recruiter_role=verification.recruiter_role,
                company_website=company_website,
            )

            # 5. Calculate results
            scored = calculate_recruiter_verification_results(
                crawl_data=crawl_data,
                company_verified=company_verified,
                dns_mx_ssl_verified=dns_mx_ssl_verified,
            )

            # 6. Clear old breakdowns and evidence
            await db.execute(
                delete(RecruiterVerificationBreakdown).where(
                    RecruiterVerificationBreakdown.verification_id == verification.id
                )
            )
            await db.execute(
                delete(RecruiterVerificationEvidence).where(
                    RecruiterVerificationEvidence.verification_id == verification.id
                )
            )

            # 7. Populate new breakdowns
            for bd in scored["breakdowns"]:
                db_bd = RecruiterVerificationBreakdown(
                    id=uuid.uuid4(),
                    verification_id=verification.id,
                    rule_name=bd["rule_name"],
                    category=bd["category"],
                    score_change=bd["score_change"],
                    confidence=bd["confidence"],
                    source_reliability=bd["source_reliability"],
                    reason=bd["reason"],
                    source=bd["source"],
                    timestamp=datetime.now(timezone.utc),
                )
                db.add(db_bd)

            # 8. Populate new evidence
            for ev in scored["evidence"]:
                db_ev = RecruiterVerificationEvidence(
                    id=uuid.uuid4(),
                    verification_id=verification.id,
                    evidence_type=ev["evidence_type"],
                    description=ev["description"],
                    source=ev["source"],
                    severity=ev["severity"],
                    confidence=ev["confidence"],
                    timestamp=datetime.now(timezone.utc),
                )
                db.add(db_ev)

            # 9. Update LinkedIn Validation Status Placeholder
            if verification.linkedin_profile_url:
                url_lower = verification.linkedin_profile_url.lower()
                if "linkedin.com/in/" in url_lower:
                    verification.linkedin_validation_status = "VALID"
                else:
                    verification.linkedin_validation_status = "INVALID"
            else:
                verification.linkedin_validation_status = "UNKNOWN"

            # 10. Update verification record properties
            now = datetime.now(timezone.utc)
            verification.verification_score = scored["score"]
            verification.verification_level = scored["level"]
            verification.verification_confidence = scored["confidence"]
            verification.email_domain_status = scored["email_domain_status"]
            verification.company_match_status = scored["company_match_status"]
            verification.phone_match_status = scored["phone_match_status"]
            verification.verification_status = "COMPLETED"
            verification.last_verified_at = now
            verification.verification_expires_at = now + timedelta(hours=24)
            verification.updated_at = now

            await db.commit()

            # 11. Log Recruiter Reputation Snapshot
            # Fetch all completed verifications for this email to update metrics
            history_stmt = select(RecruiterVerification).where(
                RecruiterVerification.recruiter_email == verification.recruiter_email,
                RecruiterVerification.verification_status == "COMPLETED",
            )
            history_res = await db.execute(history_stmt)
            history_records = history_res.scalars().all()

            count = len(history_records)
            successful_count = sum(
                1
                for r in history_records
                if r.verification_level in ("VERIFIED", "LIKELY_VERIFIED")
            )
            success_rate = successful_count / count if count > 0 else 1.0

            snapshot = RecruiterReputationSnapshot(
                id=uuid.uuid4(),
                recruiter_email=verification.recruiter_email,
                claimed_company=verification.claimed_company,
                verification_score=scored["score"],
                verification_level=scored["level"],
                recruiter_verification_count=count,
                recruiter_success_rate=success_rate,
                captured_at=now,
            )
            db.add(snapshot)
            await db.commit()

            logger.info(
                f"Recruiter verification {verification_id} completed. Score: {scored['score']}"
            )

        except Exception as e:
            logger.error(
                f"Error executing recruiter verification pipeline for {verification_id}: {e}",
                exc_info=True,
            )
            try:
                verification.verification_status = "FAILED"
                verification.updated_at = datetime.now(timezone.utc)
                await db.commit()
            except Exception as rollback_err:
                logger.error(f"Could not mark verification as FAILED: {rollback_err}")
