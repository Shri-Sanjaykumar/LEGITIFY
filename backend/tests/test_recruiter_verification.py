import pytest
import uuid
import re
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.user import User
from app.models.recruiter import (
    RecruiterVerification,
    RecruiterVerificationBreakdown,
    RecruiterVerificationEvidence,
    RecruiterReputationSnapshot,
)
from app.models.report import CompanyVerification, DomainVerification
from app.services.recruiter_verification.crawler import (
    clean_url,
    extract_domain,
    is_internal_domain,
    claims_major_brand,
    run_recruiter_verification_crawler,
)
from app.services.recruiter_verification.scoring import (
    calculate_recruiter_verification_results,
)
from app.services.recruiter_verification.engine import (
    get_cached_verification,
    start_recruiter_verification,
    execute_verification_pipeline,
)


@pytest.mark.asyncio
async def test_crawler_utilities():
    # clean_url
    assert clean_url("google.com") == "https://google.com"
    assert clean_url("http://google.com") == "http://google.com"

    # extract_domain
    assert extract_domain("test@gmail.com") == "gmail.com"
    assert extract_domain("https://microsoft.com/careers") == "microsoft.com"
    assert extract_domain("   ") is None
    assert extract_domain("") is None
    # Test invalid url exception in extract_domain
    with patch("app.services.recruiter_verification.crawler.clean_url", side_effect=Exception("URL error")):
        assert extract_domain("some-bad-url") is None

    # is_internal_domain
    assert is_internal_domain("test.local") is True
    assert is_internal_domain("corp.company.com") is True
    assert is_internal_domain("vpn.secure.net") is True
    assert is_internal_domain("internal.site.org") is True
    assert is_internal_domain("gmail.com") is False
    assert is_internal_domain("") is False

    # claims_major_brand
    assert claims_major_brand("Google") is True
    assert claims_major_brand("Google India") is True
    assert claims_major_brand("Amazon AWS") is True
    assert claims_major_brand("Infosys Technologies") is True
    assert claims_major_brand("TCS Placement") is True
    assert claims_major_brand("My Startup") is False
    assert claims_major_brand("") is False


@pytest.mark.asyncio
async def test_run_recruiter_verification_crawler():
    # Free email checks
    res = await run_recruiter_verification_crawler(
        recruiter_name="John Doe",
        recruiter_email="john@gmail.com",
        claimed_company="Google",
    )
    assert res["is_free_email"] is True
    assert res["free_email_authority_mismatch"] is True

    # Corporate matches
    res2 = await run_recruiter_verification_crawler(
        recruiter_name="Jane Doe",
        recruiter_email="jane@microsoft.com",
        claimed_company="Microsoft",
        company_website="https://microsoft.com",
    )
    assert res2["is_free_email"] is False
    assert res2["email_domain_matches_company"] is True

    # Mismatch corporate email
    res_mismatch = await run_recruiter_verification_crawler(
        recruiter_name="Jane Doe",
        recruiter_email="jane@netflix.com",
        claimed_company="Microsoft",
        company_website="https://microsoft.com",
    )
    assert res_mismatch["email_domain_matches_company"] is False

    # Reply-to checks
    res3 = await run_recruiter_verification_crawler(
        recruiter_name="Jane Doe",
        recruiter_email="jane@microsoft.com",
        claimed_company="Microsoft",
        reply_to="scammer@gmail.com",
    )
    assert res3["reply_to_mismatch"] is True

    # Display name checks
    res4 = await run_recruiter_verification_crawler(
        recruiter_name="Jane Doe",
        recruiter_email="jane@gmail.com",
        claimed_company="Microsoft",
        display_name="Microsoft Recruiter",
    )
    assert res4["display_name_mismatch"] is True

    # Phone/Role check
    res5 = await run_recruiter_verification_crawler(
        recruiter_name="Jane Doe",
        recruiter_email="jane@microsoft.com",
        claimed_company="Microsoft",
        recruiter_role="Scammer Consultant",
        recruiter_phone="invalid-phone-num",
    )
    assert res5["role_consistent"] is False
    assert res5["phone_valid"] is False


@pytest.mark.asyncio
async def test_scoring_scenarios():
    # 1. Free email alone (-10 score, LOW confidence)
    crawl_data = {
        "is_free_email": True,
        "is_internal_email": False,
        "email_domain_matches_company": False,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": False,
        "display_name_mismatch": False,
        "role_consistent": True,
        "phone_valid": True,
        "recruiter_phone": None,
        "recruiter_role": "Recruitment Lead",
        "claimed_company": "Legit Startup",
    }
    res = calculate_recruiter_verification_results(crawl_data)
    assert res["score"] == 90.0
    assert res["confidence"] == "LOW"
    assert res["level"] == "VERIFIED"

    # 2. Free email claiming major corporate authority (-45 score, HIGH confidence mismatch)
    crawl_data["free_email_authority_mismatch"] = True
    crawl_data["claimed_company"] = "Google"
    res2 = calculate_recruiter_verification_results(crawl_data)
    assert res2["score"] == 55.0
    assert res2["level"] == "PARTIALLY_VERIFIED"

    # 3. Internal recruiter (score 100, level INTERNAL_RECRUITER, HIGH confidence)
    crawl_data_internal = {
        "is_free_email": False,
        "is_internal_email": True,
        "email_domain": "hr.corp.local",
        "email_domain_matches_company": False,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": False,
        "display_name_mismatch": False,
        "role_consistent": True,
        "phone_valid": True,
    }
    res3 = calculate_recruiter_verification_results(crawl_data_internal)
    assert res3["score"] == 100.0
    assert res3["level"] == "INTERNAL_RECRUITER"
    assert res3["confidence"] == "HIGH"

    # 4. Corporate domain matches verified company (Score 115 clamped to 100, HIGH confidence)
    crawl_data_corp_match = {
        "is_free_email": False,
        "is_internal_email": False,
        "email_domain_matches_company": True,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": False,
        "display_name_mismatch": False,
        "role_consistent": True,
        "phone_valid": True,
        "recruiter_phone": None,
        "company_website": "microsoft.com",
    }
    res4 = calculate_recruiter_verification_results(crawl_data_corp_match, company_verified=True, dns_mx_ssl_verified=True)
    assert res4["score"] == 100.0
    assert res4["confidence"] == "HIGH"
    assert res4["level"] == "VERIFIED"

    # 5. Corporate domain mismatches verified company (-45 score)
    crawl_data_corp_mismatch = {
        "is_free_email": False,
        "is_internal_email": False,
        "email_domain_matches_company": False,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": False,
        "display_name_mismatch": False,
        "role_consistent": True,
        "phone_valid": True,
        "recruiter_phone": None,
        "company_website": "microsoft.com",
    }
    res5 = calculate_recruiter_verification_results(crawl_data_corp_mismatch, company_verified=True)
    assert res5["score"] == 55.0

    # 6. Corporate domain but unverified claimed company (-20 score)
    crawl_data_unverified = {
        "is_free_email": False,
        "is_internal_email": False,
        "email_domain_matches_company": False,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": False,
        "display_name_mismatch": False,
        "role_consistent": True,
        "phone_valid": True,
        "recruiter_phone": None,
        "company_website": None,
    }
    res6 = calculate_recruiter_verification_results(crawl_data_unverified, company_verified=False)
    assert res6["score"] == 80.0

    # 7. Additional mismatches (Reply-to: -20, Display Name: -15, Phone: -5)
    crawl_data_extra = {
        "is_free_email": False,
        "is_internal_email": False,
        "email_domain_matches_company": True,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": True,
        "display_name_mismatch": True,
        "role_consistent": True,
        "phone_valid": False,
        "recruiter_phone": "+12345",
        "company_website": "microsoft.com",
    }
    res7 = calculate_recruiter_verification_results(crawl_data_extra, company_verified=True)
    # 100 + 15 (match) - 20 (reply_to) - 15 (display) - 5 (phone) = 75
    assert res7["score"] == 75.0
    assert res7["level"] == "LIKELY_VERIFIED"

    # 8. Score level ranges checking (SUSPICIOUS level)
    crawl_data_suspicious = {
        "is_free_email": False,
        "is_internal_email": False,
        "email_domain_matches_company": False,
        "free_email_authority_mismatch": False,
        "reply_to_mismatch": True,
        "display_name_mismatch": True,
        "role_consistent": True,
        "phone_valid": False,
        "recruiter_phone": "+12345",
        "company_website": "microsoft.com",
    }
    # 100 - 45 (mismatch) - 20 (reply) - 15 (display) - 5 (phone) = 15
    res8 = calculate_recruiter_verification_results(crawl_data_suspicious, company_verified=True)
    assert res8["score"] == 15.0
    assert res8["level"] == "UNVERIFIED"

    # Score between 20 and 40 (SUSPICIOUS level)
    crawl_data_suspicious["phone_valid"] = True
    res9 = calculate_recruiter_verification_results(crawl_data_suspicious, company_verified=True)
    assert res9["score"] == 20.0
    assert res9["level"] == "SUSPICIOUS"


@pytest.mark.asyncio
async def test_recruiter_engine_caching_and_recycling(db: AsyncSession):
    # Cache hit check
    now = datetime.now(timezone.utc)
    rec = RecruiterVerification(
        id=uuid.uuid4(),
        recruiter_name="Jane Doe",
        recruiter_email="jane@microsoft.com",
        claimed_company="Microsoft",
        verification_score=85.0,
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        verification_confidence="HIGH",
        email_domain_status="MATCHED",
        company_match_status="FOUND_VERIFIED",
        phone_match_status="NOT_PROVIDED",
        linkedin_validation_status="UNKNOWN",
        last_verified_at=now,
        verification_expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    db.add(rec)
    await db.commit()

    cached = await get_cached_verification(db, "jane@microsoft.com", "Microsoft")
    assert cached is not None
    assert cached.id == rec.id

    # Exception checking in cache hit
    with patch.object(db, "execute", side_effect=Exception("DB Cache Error")):
        assert await get_cached_verification(db, "jane@microsoft.com", "Microsoft") is None

    # Recycle checks
    recycled = await start_recruiter_verification(
        db, "Jane Updated", "jane@microsoft.com", "Microsoft"
    )
    assert recycled.id == rec.id
    assert recycled.verification_status == "PENDING"


@pytest.mark.asyncio
async def test_recruiter_pipeline_execution(db: AsyncSession):
    # Setup verified company
    comp = CompanyVerification(
        id=uuid.uuid4(),
        company_name="Microsoft",
        website="microsoft.com",
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        verification_confidence="HIGH",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(comp)

    # Setup Domain record
    dom = DomainVerification(
        id=uuid.uuid4(),
        domain="microsoft.com",
        dns_status="RESOLVED",
        mx_status="CONFIGURED",
        ssl_status="VALID",
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        verification_confidence="HIGH",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(dom)
    await db.commit()

    # Start pending verification
    ver = await start_recruiter_verification(
        db=db,
        recruiter_name="Jane HR",
        recruiter_email="jane@microsoft.com",
        claimed_company="Microsoft",
        linkedin_profile_url="https://linkedin.com/in/jane-hr",
    )

    class AsyncSessionContext:
        def __init__(self, session):
            self.session = session

        async def __aenter__(self):
            return self.session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    session_factory = lambda: AsyncSessionContext(db)
    await execute_verification_pipeline(session_factory, ver.id)

    await db.refresh(ver)
    assert ver.verification_status == "COMPLETED"
    assert ver.verification_score > 80.0
    assert ver.linkedin_validation_status == "VALID"

    # Verify snaphot logged
    snapshot_stmt = select(RecruiterReputationSnapshot).where(
        RecruiterReputationSnapshot.recruiter_email == "jane@microsoft.com"
    )
    snap_res = await db.execute(snapshot_stmt)
    snapshot = snap_res.scalars().first()
    assert snapshot is not None
    assert snapshot.recruiter_verification_count == 1
    assert snapshot.recruiter_success_rate == 1.0

    # Test pipeline graceful execution failure handling
    bad_id = uuid.uuid4()
    # Should not crash
    await execute_verification_pipeline(session_factory, bad_id)


@pytest.mark.asyncio
async def test_recruiter_endpoints(client: AsyncClient, db: AsyncSession):
    # 1. Register and login
    email = "recruiterstudent@vit.ac.in"
    password = "SecurePassword123!"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Recruiter Tester",
            "role": "student",
        },
    )
    login_res = await client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. POST verify recruiter
    res_verify = await client.post(
        "/api/v1/recruiter/verify",
        json={
            "recruiter_name": "Google HR",
            "recruiter_email": "googlehr@gmail.com",
            "claimed_company": "Google",
            "linkedin_profile_url": "https://linkedin.com/in/googlehr",
        },
        headers=headers,
    )
    assert res_verify.status_code == 200
    assert res_verify.json()["success"] is True
    rec_id = res_verify.json()["data"]["id"]

    # 3. GET specific recruiter
    res_get = await client.get(f"/api/v1/recruiter/{rec_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["data"]["recruiter_email"] == "googlehr@gmail.com"

    # 4. GET specific recruiter breakdown detail
    res_detail = await client.get(f"/api/v1/recruiter/{rec_id}/breakdown", headers=headers)
    assert res_detail.status_code == 200

    # 5. GET specific recruiter not found
    res_get_null = await client.get(f"/api/v1/recruiter/{uuid.uuid4()}", headers=headers)
    assert res_get_null.status_code == 404
    res_detail_null = await client.get(f"/api/v1/recruiter/{uuid.uuid4()}/breakdown", headers=headers)
    assert res_detail_null.status_code == 404

    # 6. GET history
    res_hist = await client.get("/api/v1/recruiter/history", headers=headers)
    assert res_hist.status_code == 200
    assert len(res_hist.json()["data"]) > 0

    # 7. GET reputation snapshot
    res_rep = await client.get("/api/v1/recruiter/reputation/googlehr@gmail.com", headers=headers)
    assert res_rep.status_code == 200


@pytest.mark.asyncio
async def test_recruiter_trust_engine_integration(
    client: AsyncClient, db: AsyncSession
):
    # 1. Register and login
    email = "recruiterstudent2@vit.ac.in"
    password = "SecurePassword123!"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Recruiter Tester 2",
            "role": "student",
        },
    )
    login_res = await client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Insert COMPLETED recruiter verifications for different levels to cover integration branches
    now = datetime.now(timezone.utc)
    
    # Recruiter 1: VERIFIED
    rec = RecruiterVerification(
        id=uuid.uuid4(),
        recruiter_name="Jane Doe",
        recruiter_email="jane@microsoft.com",
        claimed_company="Microsoft",
        verification_score=85.0,
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        verification_confidence="HIGH",
        email_domain_status="MATCHED",
        company_match_status="FOUND_VERIFIED",
        phone_match_status="NOT_PROVIDED",
        linkedin_validation_status="UNKNOWN",
        last_verified_at=now,
        verification_expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    db.add(rec)

    # Recruiter 2: SUSPICIOUS
    rec_susp = RecruiterVerification(
        id=uuid.uuid4(),
        recruiter_name="John Scam",
        recruiter_email="scam@gmail.com",
        claimed_company="Google",
        verification_score=25.0,
        verification_status="COMPLETED",
        verification_level="SUSPICIOUS",
        verification_confidence="HIGH",
        email_domain_status="FREE_EMAIL",
        company_match_status="FOUND_VERIFIED",
        phone_match_status="NOT_PROVIDED",
        linkedin_validation_status="UNKNOWN",
        last_verified_at=now,
        verification_expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    db.add(rec_susp)

    # Recruiter 3: INTERNAL_RECRUITER
    rec_int = RecruiterVerification(
        id=uuid.uuid4(),
        recruiter_name="Internal HR",
        recruiter_email="hr@corp.local",
        claimed_company="Local Corp",
        verification_score=100.0,
        verification_status="COMPLETED",
        verification_level="INTERNAL_RECRUITER",
        verification_confidence="HIGH",
        email_domain_status="INTERNAL",
        company_match_status="FOUND_VERIFIED",
        phone_match_status="NOT_PROVIDED",
        linkedin_validation_status="UNKNOWN",
        last_verified_at=now,
        verification_expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    db.add(rec_int)

    # Recruiter 4: UNVERIFIED
    rec_unv = RecruiterVerification(
        id=uuid.uuid4(),
        recruiter_name="Unverified Recruiter",
        recruiter_email="unverified@bad.com",
        claimed_company="Unknown Company",
        verification_score=10.0,
        verification_status="COMPLETED",
        verification_level="UNVERIFIED",
        verification_confidence="LOW",
        email_domain_status="MISMATCHED",
        company_match_status="NOT_FOUND",
        phone_match_status="NOT_PROVIDED",
        linkedin_validation_status="UNKNOWN",
        last_verified_at=now,
        verification_expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    db.add(rec_unv)

    # Recruiter 5: LIKELY_VERIFIED
    rec_likely = RecruiterVerification(
        id=uuid.uuid4(),
        recruiter_name="Likely Recruiter",
        recruiter_email="likely@company.com",
        claimed_company="Legit Company",
        verification_score=65.0,
        verification_status="COMPLETED",
        verification_level="LIKELY_VERIFIED",
        verification_confidence="MEDIUM",
        email_domain_status="MATCHED",
        company_match_status="FOUND_VERIFIED",
        phone_match_status="NOT_PROVIDED",
        linkedin_validation_status="UNKNOWN",
        last_verified_at=now,
        verification_expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    db.add(rec_likely)

    await db.commit()

    # 3. Create scan containing these emails
    from app.models.scan import Scan

    scan = Scan(
        id=uuid.uuid4(),
        user_id=uuid.UUID(login_res.json()["data"].get("user_id") or str(uuid.uuid4())),
        status="PENDING",
        scan_type="text",
        scan_source="TEXT",
        raw_input_text="Reach out to Jane at jane@microsoft.com, scam@gmail.com, hr@corp.local, unverified@bad.com, and likely@company.com.",
        created_at=datetime.now(timezone.utc),
    )
    # Get actual user from db
    user_res = await db.execute(select(User).where(User.email == email))
    user = user_res.scalars().first()
    if user:
        scan.user_id = user.id

    db.add(scan)
    await db.commit()

    # 4. Trigger trust analysis
    from app.services.trust_engine.engine import run_trust_analysis

    report = await run_trust_analysis(db, scan.id, scan.user_id)

    # Check breakdowns for recruiter rule injection
    from app.models.report import TrustScoreBreakdown

    bd_res = await db.execute(
        select(TrustScoreBreakdown).where(TrustScoreBreakdown.report_id == report.id)
    )
    breakdowns = bd_res.scalars().all()
    rule_names = {b.rule_name for b in breakdowns}

    assert "RECRUITER_VERIFIED" in rule_names
    assert "RECRUITER_SUSPICIOUS" in rule_names
    assert "INTERNAL_RECRUITER_DETECTED" in rule_names
    assert "RECRUITER_UNVERIFIED" in rule_names
    assert "RECRUITER_LIKELY_VERIFIED" in rule_names
