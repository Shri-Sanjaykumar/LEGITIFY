import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.models.scan import Scan
from app.models.file import UploadedFile
from app.models.report import Report, EvidenceItem, TrustScoreBreakdown, ReportHistory
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
