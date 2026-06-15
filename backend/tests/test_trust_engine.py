import os
import tempfile
import zipfile
import uuid
import pytest
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.scan import Scan
from app.models.report import Report, EvidenceItem, TrustScoreBreakdown
from app.services.trust_engine.extractor import extract_text
from app.services.trust_engine.rules import (
    extract_domain,
    check_domain_dns_resolves,
    ScannedSignals,
    run_rule_evaluation,
)
from app.services.trust_engine.scoring import calculate_scores, generate_summary
from app.services.trust_engine.recommendations import generate_recommendations
from app.services.trust_engine.engine import run_trust_analysis


@pytest.fixture
def sample_text():
    return (
        "Offer letter from TechCorp Pvt Ltd. "
        "Send registration fee of $100 immediately to reserve training materials. "
        "Recruiter email: hr@gmail.com. Company website: http://techcorp-scam.xyz. "
        "No headquarters address provided. Join immediately."
    )


def test_domain_extraction():
    assert extract_domain("https://example.com/careers") == "example.com"
    assert extract_domain("hr@corporate-jobs.co.uk") == "corporate-jobs.co.uk"
    assert extract_domain("http://www.sub.google.com:8080/path") == "sub.google.com"
    assert extract_domain(None) is None


def test_domain_dns_resolver():
    # Well-known local test domains should resolve without network calls
    assert check_domain_dns_resolves("localhost") is True
    assert check_domain_dns_resolves("test.local") is True
    # Fake domain DNS resolve check should fail (using real DNS resolution in try/except)
    assert check_domain_dns_resolves("nonexistent-domain-fake-12345.xyz") is False
    assert check_domain_dns_resolves(None) is False


def test_extractor_utilities():
    # 1. Test txt extraction
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as f:
        f.write("Hello Text Extractor!")
        txt_path = f.name
    try:
        assert extract_text(txt_path) == "Hello Text Extractor!"
    finally:
        os.remove(txt_path)

    # 2. Test docx paragraph extraction (standard zip/xml)
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
        docx_path = f.name
    try:
        with zipfile.ZipFile(docx_path, "w") as z:
            xml_content = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
                '  <w:body>\n'
                '    <w:p><w:r><w:t>Hello docx xml paragraphs!</w:t></w:r></w:p>\n'
                '  </w:body>\n'
                '</w:document>'
            )
            z.writestr("word/document.xml", xml_content)
        
        extracted = extract_text(docx_path)
        assert "Hello docx xml paragraphs!" in extracted
    finally:
        os.remove(docx_path)


def test_rules_evaluation(sample_text):
    signals = ScannedSignals(sample_text)
    assert "hr@gmail.com" in signals.emails
    assert "http://techcorp-scam.xyz" in signals.urls
    
    rules = run_rule_evaluation(signals)
    rule_names = {r["rule_name"] for r in rules}

    # Verify that targeted rules fired correctly
    assert "HTTPS_MISSING" in rule_names
    assert "RARE_TLD" in rule_names
    assert "FREE_EMAIL_RECRUITER" in rule_names
    assert "PAYMENT_REQUESTED" in rule_names
    assert "URGENT_LANGUAGE_DETECTED" in rule_names
    assert "DOMAIN_AGE_UNKNOWN" in rule_names


def test_scoring_principles_and_clamps():
    # Test base score clamp
    assert calculate_scores([]) == (100.0, 0.0, "low", 90)

    # Test scoring deductions accumulation
    fired_rules = [
        {"rule_name": "FREE_EMAIL_RECRUITER", "score_change": -15.0, "confidence": "MEDIUM"},
        {"rule_name": "RARE_TLD", "score_change": -5.0, "confidence": "LOW"}
    ]
    trust, risk, level, conf = calculate_scores(fired_rules)
    assert trust == 80.0
    assert risk == 20.0
    assert level == "low"
    assert conf == 62  # Average of 75 (Medium) and 50 (Low) -> 62.5 -> 62

    # Test clamping bottom floor at 0
    clamped_rules = [
        {"rule_name": "PAYMENT_REQUESTED", "score_change": -60.0, "confidence": "HIGH"},
        {"rule_name": "TRAINING_FEE", "score_change": -50.0, "confidence": "HIGH"}
    ]
    trust, risk, level, conf = calculate_scores(clamped_rules)
    assert trust == 0.0
    assert risk == 100.0
    assert level == "critical"

    # Test Scoring Hardening Principle: Never classify as High/Critical Risk from a single LOW confidence signal
    single_low_signal = [
        {"rule_name": "URGENT_LANGUAGE", "score_change": -90.0, "confidence": "LOW"}
    ]
    trust, risk, level, conf = calculate_scores(single_low_signal)
    assert trust == 10.0
    assert risk == 90.0
    assert level == "medium"  # Overridden from "critical" due to single low-confidence signal rule!


def test_recommendations_and_summaries():
    # Test recommendations generator
    rules = [{
        "rule_name": "PAYMENT_REQUESTED",
        "score_change": -40.0,
        "confidence": "HIGH",
        "reason": "Payment was explicitly requested"
    }]
    recs = generate_recommendations(rules, 60.0)
    assert any("Do not send any payment" in r for r in recs)

    # Test summary formatting
    summary = generate_summary(rules, 60.0, "medium")
    assert "trust score of **60.0/100**" in summary
    assert "Payment Requested" in summary


# Helper database utilities similar to other test suites
async def get_user_headers_and_db(client: AsyncClient, email: str) -> dict:
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Admin@1234"},
    )
    token = login_response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_trust_analyze_endpoint(client: AsyncClient, db: AsyncSession):
    # Setup test authorization headers using the pre-seeded admin user
    headers = await get_user_headers_and_db(client, "admin@legitify.io")

    # 1. Create a dummy scan to analyze
    scan_response = await client.post(
        "/api/v1/scan/create",
        json={
            "scan_type": "text",
            "scan_source": "TEXT",
            "raw_input_text": (
                "Company offer. Free recruitment email address recruiter@gmail.com. "
                "Requires a registration fee deposit payment of $200."
            ),
        },
        headers=headers,
    )
    assert scan_response.status_code == 201
    scan_data = scan_response.json()
    scan_id = scan_data["data"]["id"]

    # 2. Call /api/v1/trust/analyze endpoint
    analyze_response = await client.post(
        "/api/v1/trust/analyze",
        json={"scan_id": scan_id},
        headers=headers,
    )
    assert analyze_response.status_code == 200
    res = analyze_response.json()
    assert res["success"] is True
    assert "trust_score" in res["data"]
    assert "risk_score" in res["data"]
    assert "evidence" in res["data"]
    assert "score_breakdown" in res["data"]

    # Verify scores are updated in DB
    report_res = await db.execute(
        select(Report).where(Report.scan_id == uuid.UUID(scan_id))
    )
    report = report_res.scalars().first()
    assert report is not None
    assert report.report_status == "COMPLETED"
    assert report.trust_score < 70.0  # Should be penalized for gmail and payment request

    # Verify score breakdowns exist in DB
    bd_res = await db.execute(
        select(TrustScoreBreakdown).where(TrustScoreBreakdown.report_id == report.id)
    )
    breakdowns = bd_res.scalars().all()
    assert len(breakdowns) > 0
    rule_names = {b.rule_name for b in breakdowns}
    assert "PAYMENT_REQUESTED" in rule_names
    assert "FREE_EMAIL_RECRUITER" in rule_names

    # Verify confidence column is populated
    assert all(b.confidence in {"LOW", "MEDIUM", "HIGH"} for b in breakdowns)

    # 3. Call GET /api/v1/report/{report_id}/breakdown endpoint
    breakdown_response = await client.get(
        f"/api/v1/report/{report.id}/breakdown",
        headers=headers,
    )
    assert breakdown_response.status_code == 200
    bd_data = breakdown_response.json()
    assert bd_data["success"] is True
    assert bd_data["data"]["total"] == len(breakdowns)
    assert "breakdown" in bd_data["data"]
