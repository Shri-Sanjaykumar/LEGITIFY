import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.models.scan import Scan
from app.models.file import UploadedFile
from app.models.report import (
    Report,
    EvidenceItem,
    TrustScoreBreakdown,
    ReportHistory,
    CompanyVerification,
    CompanyVerificationBreakdown,
    DomainVerification,
)
from app.models.recruiter import RecruiterVerification
from app.services.audit import create_audit_log
from app.services.trust_engine.extractor import extract_text
from app.services.trust_engine.rules import ScannedSignals, run_rule_evaluation
from app.services.trust_engine.scoring import calculate_scores, generate_summary
from app.services.trust_engine.recommendations import generate_recommendations

logger = logging.getLogger("app.services.trust_engine.engine")


async def run_trust_analysis(
    db: AsyncSession, scan_id: uuid.UUID, current_user_id: uuid.UUID
) -> Report:
    """Orchestrates the entire trust intelligence workflow for a given scan_id."""
    # 1. Fetch scan record
    scan_res = await db.execute(
        select(Scan).where(Scan.id == scan_id, Scan.is_deleted.is_(False))
    )
    scan = scan_res.scalars().first()
    if not scan:
        raise ValueError(f"Scan record not found for ID: {scan_id}")

    # Update scan status to PROCESSING
    scan.status = "PROCESSING"
    scan.started_at = datetime.now(timezone.utc)
    await db.flush()

    # Log TRUST_ANALYSIS_STARTED
    await create_audit_log(
        db=db,
        action="TRUST_ANALYSIS_STARTED",
        ip_address="system",
        user_id=current_user_id,
        payload={"scan_id": str(scan_id)},
    )

    # 2. Extract input text
    text_content = ""
    if scan.raw_input_text:
        text_content += scan.raw_input_text + "\n"

    if scan.file_id:
        file_res = await db.execute(
            select(UploadedFile).where(
                UploadedFile.id == scan.file_id, UploadedFile.is_deleted.is_(False)
            )
        )
        uploaded_file = file_res.scalars().first()
        if uploaded_file and uploaded_file.file_path:
            extracted = extract_text(uploaded_file.file_path)
            if extracted:
                text_content += extracted + "\n"

    # 3. Parse content & evaluate rules
    signals = ScannedSignals(text_content)
    fired_rules = run_rule_evaluation(signals)

    # 3.5 Inject Company Verification signals into fired rules
    comp_ver_logged = False
    for domain in signals.domains:
        if not domain:
            continue
        comp_res = await db.execute(
            select(CompanyVerification).where(
                CompanyVerification.website.like(f"%{domain}%"),
                CompanyVerification.verification_status == "COMPLETED",
            )
        )
        comp_ver = comp_res.scalars().first()
        if comp_ver:
            await create_audit_log(
                db=db,
                action="COMPANY_VERIFIED",
                ip_address="system",
                user_id=current_user_id,
                payload={
                    "scan_id": str(scan_id),
                    "company_name": comp_ver.company_name,
                    "website": comp_ver.website,
                    "verification_level": comp_ver.verification_level,
                    "verification_status": comp_ver.verification_status,
                },
            )
            comp_ver_logged = True
            # Query breakdowns
            bd_res = await db.execute(
                select(CompanyVerificationBreakdown).where(
                    CompanyVerificationBreakdown.verification_id == comp_ver.id
                )
            )
            comp_bds = bd_res.scalars().all()
            comp_rules = {b.rule_name for b in comp_bds}

            # Map company verification signals to Trust Engine rules
            if comp_ver.verification_level in ["VERIFIED", "LIKELY_VERIFIED"]:
                fired_rules.append(
                    {
                        "rule_name": "COMPANY_VERIFIED",
                        "rule_category": "COMPANY_SIGNALS",
                        "weight": 10.0,
                        "score_change": 10.0,
                        "confidence": comp_ver.verification_confidence,
                        "source": "Company Verification Engine",
                        "reason": f"Company {comp_ver.company_name} is verified on the LEGITIFY engine.",
                    }
                )

            if "CORPORATE_EMAIL" in comp_rules:
                fired_rules.append(
                    {
                        "rule_name": "CORPORATE_EMAIL_VERIFIED",
                        "rule_category": "RECRUITER_SIGNALS",
                        "weight": 10.0,
                        "score_change": 10.0,
                        "confidence": "HIGH",
                        "source": "Company Verification Engine",
                        "reason": "Official corporate email domain has been verified.",
                    }
                )

            if "ADDRESS_PRESENT" in comp_rules:
                fired_rules.append(
                    {
                        "rule_name": "PHYSICAL_ADDRESS_VERIFIED",
                        "rule_category": "CONTACT_SIGNALS",
                        "weight": 5.0,
                        "score_change": 5.0,
                        "confidence": "HIGH",
                        "source": "Company Verification Engine",
                        "reason": "Headquarters physical address has been verified.",
                    }
                )

            if "CAREERS_PAGE_EXISTS" in comp_rules:
                fired_rules.append(
                    {
                        "rule_name": "CAREERS_PAGE_VERIFIED",
                        "rule_category": "COMPANY_SIGNALS",
                        "weight": 5.0,
                        "score_change": 5.0,
                        "confidence": "HIGH",
                        "source": "Company Verification Engine",
                        "reason": "Careers and recruitment page availability has been verified.",
                    }
                )
            break

    if not comp_ver_logged:
        await create_audit_log(
            db=db,
            action="COMPANY_VERIFIED",
            ip_address="system",
            user_id=current_user_id,
            payload={
                "scan_id": str(scan_id),
                "verification_status": "NOT_FOUND",
                "verification_level": "UNVERIFIED",
            },
        )

    # 3.6 Inject Domain Verification signals into fired rules
    dom_ver_logged = False
    for domain in signals.domains:
        if not domain:
            continue
        dom_res = await db.execute(
            select(DomainVerification).where(
                DomainVerification.domain == domain,
                DomainVerification.verification_status == "COMPLETED",
            )
        )
        dom_ver = dom_res.scalars().first()
        if dom_ver:
            await create_audit_log(
                db=db,
                action="DOMAIN_VERIFIED",
                ip_address="system",
                user_id=current_user_id,
                payload={
                    "scan_id": str(scan_id),
                    "domain": dom_ver.domain,
                    "dns_status": dom_ver.dns_status,
                    "mx_status": dom_ver.mx_status,
                    "spf_status": dom_ver.spf_status,
                    "dmarc_status": dom_ver.dmarc_status,
                    "ssl_status": dom_ver.ssl_status,
                    "verification_status": dom_ver.verification_status,
                },
            )
            dom_ver_logged = True
            # 1. DNS Status
            if dom_ver.dns_status == "RESOLVED":
                fired_rules.append(
                    {
                        "rule_name": "DNS_RESOLVED",
                        "rule_category": "DOMAIN_SIGNALS",
                        "weight": 5.0,
                        "score_change": 5.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Domain {domain} successfully resolves on public DNS nameservers.",
                    }
                )
            else:
                fired_rules.append(
                    {
                        "rule_name": "NO_DNS_RECORDS",
                        "rule_category": "DOMAIN_SIGNALS",
                        "weight": -35.0,
                        "score_change": -35.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Domain {domain} has no active public DNS resolution records.",
                    }
                )

            # 2. MX Status
            if dom_ver.mx_status == "CONFIGURED":
                fired_rules.append(
                    {
                        "rule_name": "MX_INFRASTRUCTURE_VALID",
                        "rule_category": "EMAIL_SIGNALS",
                        "weight": 10.0,
                        "score_change": 10.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Domain {domain} configuration lists active MX mail exchangers.",
                    }
                )
            else:
                fired_rules.append(
                    {
                        "rule_name": "NO_MX_RECORDS",
                        "rule_category": "EMAIL_SIGNALS",
                        "weight": -25.0,
                        "score_change": -25.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Domain {domain} lacks mail exchange servers.",
                    }
                )

            # 3. SPF / DMARC Status
            if dom_ver.spf_status == "VALID":
                fired_rules.append(
                    {
                        "rule_name": "EMAIL_SECURE_SPF",
                        "rule_category": "EMAIL_SIGNALS",
                        "weight": 5.0,
                        "score_change": 5.0,
                        "confidence": "MEDIUM",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Sender Policy Framework (SPF) restricts spoofing on {domain}.",
                    }
                )
            if dom_ver.dmarc_status == "VALID":
                fired_rules.append(
                    {
                        "rule_name": "EMAIL_SECURE_DMARC",
                        "rule_category": "EMAIL_SIGNALS",
                        "weight": 5.0,
                        "score_change": 5.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Domain-based Message Authentication (DMARC) alignment enabled on {domain}.",
                    }
                )

            # 4. SSL Status
            if dom_ver.ssl_status == "VALID":
                fired_rules.append(
                    {
                        "rule_name": "SSL_CERTIFICATE_VALID",
                        "rule_category": "SSL_SIGNALS",
                        "weight": 10.0,
                        "score_change": 10.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"Valid TLS/SSL certificate trust chain established for {domain}.",
                    }
                )
            elif dom_ver.ssl_status in ["EXPIRED", "INVALID"]:
                fired_rules.append(
                    {
                        "rule_name": "SSL_INVALID_CHAIN",
                        "rule_category": "SSL_SIGNALS",
                        "weight": -30.0,
                        "score_change": -30.0,
                        "confidence": "HIGH",
                        "source": "Domain Intelligence Engine",
                        "reason": f"TLS/SSL certificate for {domain} is expired or handshake failed.",
                    }
                )
            break

    if not dom_ver_logged:
        await create_audit_log(
            db=db,
            action="DOMAIN_VERIFIED",
            ip_address="system",
            user_id=current_user_id,
            payload={
                "scan_id": str(scan_id),
                "verification_status": "NOT_FOUND",
            },
        )

    # 3.7 Inject Recruiter Verification signals into fired rules
    rec_ver_logged = False
    for email in signals.emails:
        if not email:
            continue
        rec_res = await db.execute(
            select(RecruiterVerification).where(
                RecruiterVerification.recruiter_email == email,
                RecruiterVerification.verification_status == "COMPLETED",
            )
        )
        rec_ver = rec_res.scalars().first()
        if rec_ver:
            await create_audit_log(
                db=db,
                action="RECRUITER_VERIFIED",
                ip_address="system",
                user_id=current_user_id,
                payload={
                    "scan_id": str(scan_id),
                    "recruiter_email": rec_ver.recruiter_email,
                    "verification_level": rec_ver.verification_level,
                    "verification_status": rec_ver.verification_status,
                },
            )
            rec_ver_logged = True
            if rec_ver.verification_level == "VERIFIED":
                fired_rules.append(
                    {
                        "rule_name": "RECRUITER_VERIFIED",
                        "rule_category": "RECRUITER_SIGNALS",
                        "weight": 15.0,
                        "score_change": 15.0,
                        "confidence": rec_ver.verification_confidence,
                        "source": "Recruiter Verification Engine",
                        "reason": f"Recruiter email {email} is verified on LEGITIFY.",
                    }
                )
            elif rec_ver.verification_level == "LIKELY_VERIFIED":
                fired_rules.append(
                    {
                        "rule_name": "RECRUITER_LIKELY_VERIFIED",
                        "rule_category": "RECRUITER_SIGNALS",
                        "weight": 10.0,
                        "score_change": 10.0,
                        "confidence": rec_ver.verification_confidence,
                        "source": "Recruiter Verification Engine",
                        "reason": f"Recruiter email {email} is classified as likely verified.",
                    }
                )
            elif rec_ver.verification_level == "SUSPICIOUS":
                fired_rules.append(
                    {
                        "rule_name": "RECRUITER_SUSPICIOUS",
                        "rule_category": "RECRUITER_SIGNALS",
                        "weight": -30.0,
                        "score_change": -30.0,
                        "confidence": rec_ver.verification_confidence,
                        "source": "Recruiter Verification Engine",
                        "reason": f"Recruiter email {email} has triggered suspicious domain or mismatch patterns.",
                    }
                )
            elif rec_ver.verification_level == "UNVERIFIED":
                fired_rules.append(
                    {
                        "rule_name": "RECRUITER_UNVERIFIED",
                        "rule_category": "RECRUITER_SIGNALS",
                        "weight": -45.0,
                        "score_change": -45.0,
                        "confidence": rec_ver.verification_confidence,
                        "source": "Recruiter Verification Engine",
                        "reason": f"Recruiter email {email} fails identity/domain verification checks.",
                    }
                )
            elif rec_ver.verification_level == "INTERNAL_RECRUITER":
                fired_rules.append(
                    {
                        "rule_name": "INTERNAL_RECRUITER_DETECTED",
                        "rule_category": "RECRUITER_SIGNALS",
                        "weight": 10.0,
                        "score_change": 10.0,
                        "confidence": rec_ver.verification_confidence,
                        "source": "Recruiter Verification Engine",
                        "reason": f"Recruiter email {email} is hosted on a secure internal corporate domain.",
                    }
                )

    if not rec_ver_logged:
        await create_audit_log(
            db=db,
            action="RECRUITER_VERIFIED",
            ip_address="system",
            user_id=current_user_id,
            payload={
                "scan_id": str(scan_id),
                "verification_status": "NOT_FOUND",
            },
        )

    # 4. Calculate scores & generate report content
    trust_score, risk_score, risk_level, confidence_score = calculate_scores(
        fired_rules
    )
    recommendations = generate_recommendations(fired_rules, trust_score)
    summary = generate_summary(fired_rules, trust_score, risk_level)

    # Convert recommendations to a single newline-separated block
    recommendations_str = "\n".join(recommendations)

    # 5. Fetch or create Report record
    report_res = await db.execute(
        select(Report).where(Report.scan_id == scan_id, Report.is_deleted.is_(False))
    )
    report = report_res.scalars().first()

    is_new_report = False
    if not report:
        is_new_report = True
        # Fetch next version for the scan's reports
        count_res = await db.execute(
            select(Report).where(
                Report.scan_id == scan_id, Report.is_deleted.is_(False)
            )
        )
        version_count = len(count_res.scalars().all())
        version = f"v{version_count + 1}"

        report = Report(
            id=uuid.uuid4(),
            user_id=scan.user_id,
            scan_id=scan_id,
            report_version=version,
            report_status="DRAFT",
            trust_score=0.0,
            risk_score=0.0,
            confidence_score=0,
            risk_level="low",
            summary="",
            recommendation="",
            generated_by="AI",
            generation_engine="LEGITIFY Trust Engine V1",
            generation_version="1.0.0",
        )
        db.add(report)
        await db.flush()

        await create_audit_log(
            db=db,
            action="REPORT_CREATED",
            ip_address="system",
            user_id=current_user_id,
            payload={
                "scan_id": str(scan_id),
                "report_id": str(report.id),
                "report_version": report.report_version,
            },
        )

    previous_status = report.report_status

    # Update report metrics and mark as COMPLETED
    report.trust_score = trust_score
    report.risk_score = risk_score
    report.confidence_score = confidence_score
    report.risk_level = risk_level
    report.summary = summary
    report.recommendation = recommendations_str
    report.report_status = "COMPLETED"
    report.generated_at = datetime.now(timezone.utc)
    report.updated_at = datetime.now(timezone.utc)

    # 6. Insert Report History transition
    history = ReportHistory(
        id=uuid.uuid4(),
        report_id=report.id,
        from_status=previous_status if not is_new_report else "",
        to_status="COMPLETED",
        changed_by=current_user_id,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(history)

    # 7. Clean up existing evidence and breakdowns if re-running
    await db.execute(delete(EvidenceItem).where(EvidenceItem.report_id == report.id))
    await db.execute(
        delete(TrustScoreBreakdown).where(TrustScoreBreakdown.report_id == report.id)
    )

    # 8. Save new evidence items
    from app.services.trust_engine.evidence import compile_evidence

    compiled_ev = compile_evidence(fired_rules)
    for ev in compiled_ev:
        db_ev = EvidenceItem(
            id=uuid.uuid4(),
            report_id=report.id,
            evidence_type=ev["evidence_type"],
            title=ev["title"],
            description=ev["description"],
            severity=ev["severity"],
            confidence=ev["confidence"],
            source=ev["source"],
            created_at=datetime.now(timezone.utc),
        )
        db.add(db_ev)

    # 9. Save new trust score breakdowns
    for rule in fired_rules:
        db_breakdown = TrustScoreBreakdown(
            id=uuid.uuid4(),
            report_id=report.id,
            rule_name=rule["rule_name"],
            rule_category=rule["rule_category"],
            weight=rule["weight"],
            score_change=rule["score_change"],
            confidence=rule["confidence"],
            reason=rule["reason"],
            source=rule["source"],
            created_at=datetime.now(timezone.utc),
        )
        db.add(db_breakdown)

    # Update scan status to COMPLETED
    scan.status = "COMPLETED"
    scan.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(report)

    # 10. Audit logging
    await create_audit_log(
        db=db,
        action="REPORT_COMPLETED",
        ip_address="system",
        user_id=current_user_id,
        payload={
            "report_id": str(report.id),
            "scan_id": str(scan_id),
            "trust_score": trust_score,
            "risk_level": risk_level,
        },
    )

    return report
