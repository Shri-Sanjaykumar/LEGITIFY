import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.models.report import (
    DomainVerification,
    DomainVerificationBreakdown,
    DomainVerificationEvidence,
    DomainReputationSnapshot,
)
from app.services.domain_intelligence.crawler import run_domain_crawler, extract_domain
from app.services.domain_intelligence.scoring import calculate_domain_results

logger = logging.getLogger("app.services.domain_intelligence.engine")


async def get_cached_domain_verification(
    db: AsyncSession, domain: str
) -> Optional[DomainVerification]:
    """Retrieve non-expired completed verification from the cache."""
    try:
        domain = extract_domain(domain) or domain
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(DomainVerification).where(
                DomainVerification.domain == domain,
                DomainVerification.verification_status == "COMPLETED",
                DomainVerification.verification_expires_at > now,
            )
        )
        return result.scalars().first()
    except Exception as e:
        logger.error(f"Error checking domain verification cache: {e}")
        return None


async def start_domain_verification(
    db: AsyncSession,
    domain: str,
    verification_source: str = "API",
) -> DomainVerification:
    """Initialize a pending domain verification record in the database."""
    domain = extract_domain(domain) or domain

    stmt = select(DomainVerification).where(DomainVerification.domain == domain)
    res = await db.execute(stmt)
    verification = res.scalars().first()

    if not verification:
        verification = DomainVerification(
            id=uuid.uuid4(),
            domain=domain,
            verification_score=0.0,
            verification_status="PENDING",
            verification_level="UNVERIFIED",
            verification_confidence="LOW",
            dns_status="UNKNOWN",
            mx_status="UNKNOWN",
            spf_status="UNKNOWN",
            dmarc_status="UNKNOWN",
            dkim_status="UNKNOWN",
            ssl_status="UNKNOWN",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(verification)
    else:
        # Recycle existing record
        verification.verification_status = "PENDING"
        verification.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(verification)
    return verification


async def execute_domain_verification_pipeline(
    db_session_factory, verification_id: uuid.UUID
) -> None:
    """Asynchronous background worker executing crawl, scoring, and database persistence."""
    async with db_session_factory() as db:
        try:
            # 1. Fetch verification record
            stmt = select(DomainVerification).where(
                DomainVerification.id == verification_id
            )
            res = await db.execute(stmt)
            verification = res.scalars().first()
            if not verification:
                logger.error(
                    f"Domain verification record {verification_id} not found in background worker."
                )
                return

            verification.verification_status = "PROCESSING"
            await db.commit()

            # 2. Run crawler
            crawl_data = await run_domain_crawler(verification.domain)

            # 3. Calculate scores
            scored = calculate_domain_results(crawl_data)

            # 4. Clear old breakdowns and evidence
            await db.execute(
                delete(DomainVerificationBreakdown).where(
                    DomainVerificationBreakdown.verification_id == verification.id
                )
            )
            await db.execute(
                delete(DomainVerificationEvidence).where(
                    DomainVerificationEvidence.verification_id == verification.id
                )
            )

            # 5. Populate new breakdowns
            for bd in scored["breakdowns"]:
                db_bd = DomainVerificationBreakdown(
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

            # 6. Populate new evidence
            for ev in scored["evidence"]:
                db_ev = DomainVerificationEvidence(
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

            # 7. Save domain reputation snapshot
            now = datetime.now(timezone.utc)
            snapshot = DomainReputationSnapshot(
                id=uuid.uuid4(),
                domain=verification.domain,
                verification_score=scored["score"],
                verification_level=scored["level"],
                captured_at=now,
            )
            db.add(snapshot)

            # 8. Update verification details
            verification.verification_score = scored["score"]
            verification.verification_level = scored["level"]
            verification.verification_confidence = scored["confidence"]
            verification.dns_status = (
                "RESOLVED" if crawl_data.get("dns_resolved") else "BROKEN"
            )
            verification.mx_status = (
                "CONFIGURED" if crawl_data.get("mx_records_present") else "MISSING"
            )
            verification.spf_status = (
                "VALID" if crawl_data.get("spf_record") else "MISSING"
            )
            verification.dmarc_status = (
                "VALID" if crawl_data.get("dmarc_record") else "MISSING"
            )
            verification.dkim_status = crawl_data.get("dkim_status", "UNKNOWN")

            ssl_det = crawl_data.get("ssl_details", {})
            verification.ssl_status = ssl_det.get("ssl_status", "UNKNOWN")
            verification.certificate_expiry = ssl_det.get("certificate_expiry")

            verification.verification_status = "COMPLETED"
            verification.last_verified_at = now
            verification.verification_expires_at = now + timedelta(hours=24)
            verification.updated_at = now

            await db.commit()
            logger.info(
                f"Domain verification {verification_id} completed successfully. Score: {scored['score']}"
            )

        except Exception as e:
            logger.error(
                f"Error executing domain verification pipeline for {verification_id}: {e}",
                exc_info=True,
            )
            try:
                verification.verification_status = "FAILED"
                verification.updated_at = datetime.now(timezone.utc)
                await db.commit()
            except Exception as rollback_err:
                logger.error(
                    f"Could not mark domain verification as FAILED: {rollback_err}"
                )
