import pytest
import uuid
import socket
import httpx
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, Response

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.user import User
from app.models.report import (
    CompanyVerification,
    CompanyVerificationBreakdown,
    CompanyVerificationEvidence,
)
from app.services.company_verification.crawler import (
    clean_url,
    extract_domain,
    check_dns_resolution,
    check_mx_records,
    fetch_website_details,
    run_company_verification_crawler,
)
from app.services.company_verification.scoring import calculate_verification_results
from app.services.company_verification.engine import (
    get_cached_verification,
    start_company_verification,
    execute_verification_pipeline,
)

@pytest.mark.asyncio
async def test_crawler_utilities():
    # Test clean_url
    assert clean_url("google.com") == "https://google.com"
    assert clean_url("http://google.com") == "http://google.com"
    assert clean_url("https://google.com") == "https://google.com"

    # Test extract_domain
    assert extract_domain("https://www.google.com") == "google.com"
    assert extract_domain("http://mail.google.com") == "mail.google.com"
    assert extract_domain("google.com") == "google.com"
    assert extract_domain("invalid-url") == "invalid-url"

@pytest.mark.asyncio
async def test_dns_checks():
    # Test skips for test/local domains
    assert await check_dns_resolution("localhost") is True
    assert await check_dns_resolution("test.local") is True
    assert await check_mx_records("test.test") is True

    # Test check_dns_resolution with mock gaierror
    with patch("asyncio.get_event_loop") as mock_get_loop:
        mock_loop = MagicMock()
        mock_loop.getaddrinfo = AsyncMock(side_effect=socket.gaierror())
        mock_get_loop.return_value = mock_loop
        assert await check_dns_resolution("realdomain.com") is False

    # Test check_dns_resolution with success
    with patch("asyncio.get_event_loop") as mock_get_loop:
        mock_loop = MagicMock()
        mock_loop.getaddrinfo = AsyncMock(return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80))])
        mock_get_loop.return_value = mock_loop
        assert await check_dns_resolution("realdomain.com") is True

    # Test check_mx_records when dnspython throws exception
    with patch("dns.resolver.resolve", side_effect=Exception("resolve failed")):
        assert await check_mx_records("realdomain.com") is False

@pytest.mark.asyncio
async def test_fetch_website_details_success():
    # Test success responses and parsing of content keywords
    html_content = """
    html
    <html>
      <head><title>My Test Company LLC</title></head>
      <body>
        <h1>Welcome to My Test Company</h1>
        <p>For job openings, visit our <a href="/careers">careers page</a>.</p>
        <p>View our <a href="/privacy-policy">Privacy Statement</a> and <a href="/terms-of-use">Terms of Service</a>.</p>
        <p>Contact us at support@mycompany.com or call 987-654-3210.</p>
        <p>Our office is located at Street Block B, Phase 2, Bangalore, India.</p>
        <p>Who we are: read more on our <a href="/about">about us</a> page.</p>
      </body>
    </html>
    """
    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.text = html_content
    mock_resp.headers = {"Content-Type": "text/html"}
    mock_resp.url = MagicMock()
    mock_resp.url.startswith = MagicMock(side_effect=lambda x: str(mock_resp.url).startswith(x))
    mock_resp.url.__str__ = MagicMock(return_value="https://mycompany.com")

    # Mock AsyncClient.get to return this mock response
    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        details = await fetch_website_details("mycompany.com")
        assert details["reachable"] is True
        assert details["https_enabled"] is True
        assert details["ssl_valid"] is True
        assert details["careers_page_exists"] is True
        assert details["privacy_policy_exists"] is True
        assert details["terms_exists"] is True
        assert details["contact_page_exists"] is True  # contact us was matched in text
        assert details["about_page_exists"] is True
        assert "987-654-3210" in details["extracted_phones"]
        assert "support@mycompany.com" in details["extracted_emails"]
        assert any("Bangalore" in line for line in details["extracted_addresses"])

@pytest.mark.asyncio
async def test_fetch_website_details_ssl_error():
    # Verify fallback to insecure client on SSL errors
    import ssl
    with patch("httpx.AsyncClient.get", side_effect=ssl.SSLError("Verification failed")):
        details = await fetch_website_details("https://mycompany.com")
        assert details["ssl_valid"] is False

@pytest.mark.asyncio
async def test_calculate_verification_results():
    crawl_data = {
        "website_domain": "techcorp.com",
        "dns_resolved": True,
        "mx_records_present": True,
        "provided_email": "hr@techcorp.com",
        "provided_phone": "+91 98765 43210",
        "provided_address": "123 Technology Park, Bangalore",
        "provided_name": "TechCorp Pvt Ltd",
        "website_details": {
            "reachable": True,
            "https_enabled": True,
            "ssl_valid": True,
            "careers_page_exists": True,
            "privacy_policy_exists": True,
            "terms_exists": True,
            "contact_page_exists": True,
            "about_page_exists": True,
            "html_content": "<html><head><title>TechCorp Pvt Ltd</title></head></html>",
            "extracted_emails": ["hr@techcorp.com"],
            "extracted_phones": ["+91 98765 43210"],
            "extracted_addresses": ["123 Technology Park, Bangalore"]
        }
    }
    
    res = calculate_verification_results(crawl_data)
    assert res["score"] >= 80.0
    assert res["level"] == "VERIFIED"
    assert res["confidence"] == "HIGH"
    
    # Verify low scores
    crawl_data["website_details"]["reachable"] = False
    res_failed = calculate_verification_results(crawl_data)
    assert res_failed["score"] < 40.0
    assert res_failed["level"] in ["SUSPICIOUS", "UNVERIFIED"]
    assert res_failed["confidence"] == "LOW"

@pytest.mark.asyncio
async def test_engine_caching_and_lifecycle(db: AsyncSession):
    # Setup mock user and verification record
    company = "Google Inc"
    website = "google.com"
    
    cached = await get_cached_verification(db, company, website)
    assert cached is None

    # Insert verified record
    now = datetime.now(timezone.utc)
    expired_ver = CompanyVerification(
        company_name=company,
        website=website,
        verification_status="COMPLETED",
        verification_expires_at=now - timedelta(hours=1),
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(days=1),
    )
    db.add(expired_ver)
    await db.commit()

    # Cached check should return None for expired records
    assert await get_cached_verification(db, company, website) is None

    # Update to valid non-expired
    expired_ver.verification_expires_at = now + timedelta(hours=12)
    await db.commit()
    
    cached = await get_cached_verification(db, company, website)
    assert cached is not None
    assert cached.company_name == company

@pytest.mark.asyncio
async def test_verification_api_endpoints(client: AsyncClient, db: AsyncSession):
    # 1. Register and login student
    email = "verifystudent@vitstudent.ac.in"
    password = "SecurePassword123!"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Verify Student",
            "role": "student"
        }
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password}
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Mock crawler tasks to run instantly/without errors
    mock_crawl = {
        "website_domain": "vitstudent.ac.in",
        "dns_resolved": True,
        "mx_records_present": True,
        "provided_email": "support@vitstudent.ac.in",
        "provided_phone": "+91 44 2230 1122",
        "provided_address": "Vellore Campus, Tamil Nadu",
        "provided_name": "VIT University",
        "website_details": {
            "reachable": True,
            "https_enabled": True,
            "ssl_valid": True,
            "careers_page_exists": True,
            "privacy_policy_exists": True,
            "terms_exists": True,
            "contact_page_exists": True,
            "about_page_exists": True,
            "html_content": "<html><head><title>VIT University</title></head></html>",
            "extracted_emails": ["support@vitstudent.ac.in"],
            "extracted_phones": ["+91 44 2230 1122"],
            "extracted_addresses": ["Vellore Campus, Tamil Nadu"]
        }
    }

    with patch("app.services.company_verification.engine.run_company_verification_crawler", return_value=mock_crawl):
        # 2. Test Post Verify
        verify_res = await client.post(
            "/api/v1/company/verify",
            json={
                "company_name": "VIT University",
                "website": "vitstudent.ac.in",
                "company_email": "support@vitstudent.ac.in",
                "contact_number": "+91 44 2230 1122",
                "address": "Vellore Campus, Tamil Nadu",
            },
            headers=headers
        )
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["success"] is True
        verification_id = verify_data["data"]["id"]

        # Run background pipeline directly to populate database
        class MockSessionFactory:
            def __init__(self, db_session):
                self.session = db_session
            def __call__(self):
                # Returns session directly wrapped as context
                # Need async context manager mockup
                return self
            async def __aenter__(self):
                return self.session
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        await execute_verification_pipeline(MockSessionFactory(db), uuid.UUID(verification_id))

        # 3. Test Get Summary
        summary_res = await client.get(
            f"/api/v1/company/{verification_id}",
            headers=headers
        )
        assert summary_res.status_code == 200
        assert summary_res.json()["data"]["verification_status"] == "COMPLETED"

        # 4. Test Get Breakdown & Evidence
        breakdown_res = await client.get(
            f"/api/v1/company/{verification_id}/breakdown",
            headers=headers
        )
        assert breakdown_res.status_code == 200
        breakdown_data = breakdown_res.json()["data"]
        assert len(breakdown_data["breakdowns"]) > 0
        assert len(breakdown_data["evidence"]) > 0

        # 5. Test History
        history_res = await client.get(
            "/api/v1/company/history",
            headers=headers
        )
        assert history_res.status_code == 200
        assert len(history_res.json()["data"]) > 0


@pytest.mark.asyncio
async def test_crawler_failures():
    # Test connection timeouts and errors in fetch_website_details
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectTimeout("Connect timeout")):
        res = await fetch_website_details("https://timeoutdomain.com")
        assert res["reachable"] is False

    with patch("httpx.AsyncClient.get", side_effect=Exception("Generic error")):
        res = await fetch_website_details("https://errdomain.com")
        assert res["reachable"] is False

    # Test HTTP fallback success
    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.text = "<html><body>HTTP Fallback content</body></html>"
    mock_resp.headers = {}
    mock_resp.url = MagicMock()
    mock_resp.url.__str__ = MagicMock(return_value="http://fallback.com")

    async def mock_get(*args, **kwargs):
        # First call (HTTPS) throws ConnectError
        if "https://" in args[0] or kwargs.get("url", "").startswith("https://"):
            raise httpx.ConnectError("SSL/Connection failed")
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        res = await fetch_website_details("https://fallback.com")
        assert res["reachable"] is True
        assert res["https_enabled"] is False


@pytest.mark.asyncio
async def test_scoring_penalties():
    # Test scoring with free email and domain mismatches
    crawl_data = {
        "website_domain": "scamcompany.com",
        "dns_resolved": True,
        "mx_records_present": True,
        "provided_email": "scam@gmail.com", # Free email
        "provided_phone": None,
        "provided_address": None,
        "provided_name": "Scam Company",
        "website_details": {
            "reachable": True,
            "https_enabled": False, # Insecure HTTP
            "ssl_valid": False,
            "careers_page_exists": False,
            "privacy_policy_exists": False,
            "terms_exists": False,
            "contact_page_exists": False,
            "about_page_exists": False,
            "html_content": "<html><title>Other Name</title></html>",
            "extracted_emails": [],
            "extracted_phones": [],
            "extracted_addresses": []
        }
    }
    res = calculate_verification_results(crawl_data)
    assert res["score"] == 0.0 # Clamped at 0
    assert res["level"] == "UNVERIFIED"

    # Test mismatch website/email
    crawl_data["provided_email"] = "recruiter@anothercompany.com"
    crawl_data["provided_phone"] = "987-654-3210"
    res2 = calculate_verification_results(crawl_data)
    # Check that email mismatch did not fire match
    assert not any(b["rule_name"] == "EMAIL_DOMAIN_MATCH" for b in res2["breakdowns"])


@pytest.mark.asyncio
async def test_engine_record_recycling(db: AsyncSession):
    # Test recycling existing verification records
    now = datetime.now(timezone.utc)
    existing = CompanyVerification(
        id=uuid.uuid4(),
        company_name="RecycleCorp",
        website="recycle.com",
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        created_at=now,
        updated_at=now
    )
    db.add(existing)
    await db.commit()

    recycled = await start_company_verification(
        db=db,
        company_name="RecycleCorp",
        website="recycle.com",
        company_email="new@recycle.com"
    )
    assert recycled.id == existing.id
    assert recycled.verification_status == "PENDING"
    assert recycled.company_email == "new@recycle.com"


@pytest.mark.asyncio
async def test_engine_pipeline_failure(db: AsyncSession):
    # Test execute_verification_pipeline failure state handling
    # Create invalid UUID to trigger exception
    bad_id = uuid.uuid4()
    # Should not throw but handle gracefully
    await execute_verification_pipeline(lambda: db, bad_id)


@pytest.mark.asyncio
async def test_trust_engine_company_integration(client: AsyncClient, db: AsyncSession):
    # 1. Register student and login to get auth token
    email = "truststudent@vitstudent.ac.in"
    password = "SecurePassword123!"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Trust Student",
            "role": "student"
        }
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password}
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Insert verified company record in database
    comp_ver = CompanyVerification(
        id=uuid.uuid4(),
        company_name="Verified University",
        website="verifieduni.edu",
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        verification_confidence="HIGH",
        verification_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(comp_ver)
    await db.flush()

    comp_bd = CompanyVerificationBreakdown(
        id=uuid.uuid4(),
        verification_id=comp_ver.id,
        rule_name="CORPORATE_EMAIL",
        category="EMAIL_SIGNALS",
        score_change=15.0,
        confidence="HIGH",
        source_reliability="HIGH",
        reason="Corporate email verified",
        source="EMAIL_CHECK",
        created_at=datetime.now(timezone.utc)
    )
    db.add(comp_bd)
    await db.commit()

    # 3. Create a scan referring to this company's domain
    from app.models.scan import Scan
    scan = Scan(
        id=uuid.uuid4(),
        user_id=uuid.UUID(login_res.json()["data"].get("user_id") or str(uuid.uuid4())),
        status="PENDING",
        scan_type="text",
        scan_source="TEXT",
        raw_input_text="Please verify https://verifieduni.edu",
        created_at=datetime.now(timezone.utc)
    )
    # Get actual user from database
    user_res = await db.execute(select(User).where(User.email == email))
    user = user_res.scalars().first()
    if user:
        scan.user_id = user.id
    
    db.add(scan)
    await db.commit()

    # 4. Trigger trust analysis on scan
    from app.services.trust_engine.engine import run_trust_analysis
    report = await run_trust_analysis(db, scan.id, scan.user_id)

    # 5. Verify that company verification rules were injected
    stmt = select(CompanyVerificationBreakdown).where(CompanyVerificationBreakdown.verification_id == comp_ver.id)
    # Check that the report has the injected breakdown items
    from app.models.report import TrustScoreBreakdown
    bd_res = await db.execute(select(TrustScoreBreakdown).where(TrustScoreBreakdown.report_id == report.id))
    breakdowns = bd_res.scalars().all()
    rule_names = {b.rule_name for b in breakdowns}

    assert "COMPANY_VERIFIED" in rule_names
    assert "CORPORATE_EMAIL_VERIFIED" in rule_names


@pytest.mark.asyncio
async def test_extra_scoring_branches():
    # Test LIKELY_VERIFIED score range [60, 80]
    crawl_data = {
        "website_domain": "likelycorp.com",
        "dns_resolved": True,
        "mx_records_present": True,
        "provided_email": "hr@likelycorp.com",
        "provided_phone": "987-654-3210", # Phone present
        "provided_address": None,         # Address missing (-15 penalty)
        "website_details": {
            "reachable": True,
            "https_enabled": True,
            "ssl_valid": True,
            "careers_page_exists": False,
            "privacy_policy_exists": False,
            "terms_exists": False,
            "contact_page_exists": False,
            "about_page_exists": False,
            "html_content": "<html></html>",
        }
    }
    # Score calculation: Reachable(+10) + HTTPS(+10) + SSL(+10) - Address(-15) + Phone(+10) + CorpEmail(+15) + MX(+10) + DomainMatch(+10) = 60
    res1 = calculate_verification_results(crawl_data)
    assert res1["level"] == "LIKELY_VERIFIED"

    # Test PARTIALLY_VERIFIED score range [40, 60)
    # Score calculation: 60 - SSL valid(+10 credit lost) = 50
    crawl_data["website_details"]["ssl_valid"] = False
    res2 = calculate_verification_results(crawl_data)
    assert res2["level"] == "PARTIALLY_VERIFIED"

    # Test complete lack of contact information (NO_CONTACT_INFO)
    crawl_data["provided_email"] = None
    crawl_data["provided_phone"] = None
    crawl_data["website_details"]["extracted_emails"] = []
    crawl_data["website_details"]["extracted_phones"] = []
    crawl_data["website_details"]["extracted_addresses"] = []
    res3 = calculate_verification_results(crawl_data)
    assert any(b["rule_name"] == "NO_CONTACT_INFO" for b in res3["breakdowns"])


@pytest.mark.asyncio
async def test_ssl_insecure_fallback():
    # Test that SSL errors fallback to secure=False httpx client gets the content
    import ssl
    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.text = "<html><body>Fallback Content</body></html>"
    mock_resp.headers = {}
    mock_resp.url = MagicMock()
    mock_resp.url.__str__ = MagicMock(return_value="https://sslfailcorp.com")

    call_count = 0
    async def mock_get(*args, **kwargs):
        nonlocal call_count
        if call_count == 0:
            call_count += 1
            raise ssl.SSLError("Verification failed")
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        res = await fetch_website_details("https://sslfailcorp.com")
        assert res["reachable"] is True
        assert res["ssl_valid"] is False
        assert "Fallback Content" in res["html_content"]


@pytest.mark.asyncio
async def test_crawler_edge_cases():
    # Cover parameter check lines
    assert await check_dns_resolution("") is False
    assert await check_mx_records("") is False
    
    # Cover extract_domain exception
    with patch("app.services.company_verification.crawler.clean_url", side_effect=Exception("clean error")):
        assert extract_domain("https://example.com") is None

    # Cover fetch_website_details empty check
    res = await fetch_website_details("")
    assert res["reachable"] is False

    # Cover run_company_verification_crawler empty website/domain skips
    res_crawl = await run_company_verification_crawler("company", "")
    assert res_crawl["website_domain"] is None

    # Cover skips in check_dns_resolution
    assert await check_dns_resolution("example.com") is True

    # Cover exception inside check_dns_resolution
    with patch("asyncio.wait_for", side_effect=Exception("generic error")):
        # Falls back to False or logs warning
        assert await check_dns_resolution("error-domain.com") is False


@pytest.mark.asyncio
async def test_engine_extra_recycling(db: AsyncSession):
    # Setup mock user and verification record
    company = "RecycleCorp2"
    website = "recycle2.com"
    now = datetime.now(timezone.utc)
    existing = CompanyVerification(
        id=uuid.uuid4(),
        company_name=company,
        website=website,
        verification_status="COMPLETED",
        verification_level="VERIFIED",
        created_at=now,
        updated_at=now
    )
    db.add(existing)
    await db.commit()

    # Pass all optional parameters to trigger all recycling branch updates
    recycled = await start_company_verification(
        db=db,
        company_name=company,
        website=website,
        company_email="new@recycle2.com",
        contact_number="+91 99999 88888",
        address="New Address Office"
    )
    assert recycled.company_email == "new@recycle2.com"
    assert recycled.contact_number == "+91 99999 88888"
    assert recycled.address == "New Address Office"


@pytest.mark.asyncio
async def test_engine_pipeline_db_failure(db: AsyncSession):
    # Test database exception handler inside execute_verification_pipeline
    company = "FailCorp"
    website = "failcorp.com"
    verification = await start_company_verification(
        db=db,
        company_name=company,
        website=website
    )

    class BadSession:
        def __init__(self, db_session):
            self.session = db_session
        def __call__(self):
            return self
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        async def execute(self, *args, **kwargs):
            return await self.session.execute(*args, **kwargs)
        async def commit(self):
            # Throw database exception on commit
            raise Exception("DB Write Failure")
        def add(self, *args, **kwargs):
            self.session.add(*args, **kwargs)
        async def flush(self):
            await self.session.flush()

    # Execute pipeline, it should catch DB commit exception and mark record as FAILED
    await execute_verification_pipeline(BadSession(db), verification.id)

    # Check status is FAILED
    stmt = select(CompanyVerification).where(CompanyVerification.id == verification.id)
    res = await db.execute(stmt)
    updated = res.scalars().first()
    assert updated.verification_status == "FAILED"


@pytest.mark.asyncio
async def test_get_cached_verification_exception(db: AsyncSession):
    # Cover exception block inside get_cached_verification
    with patch("sqlalchemy.ext.asyncio.AsyncSession.execute", side_effect=Exception("DB Error")):
        res = await get_cached_verification(db, "TestName", "test.com")
        assert res is None


@pytest.mark.asyncio
async def test_mx_check_success():
    # Cover line 108: dns.resolver.resolve returns valid list
    with patch("dns.resolver.resolve", return_value=["mail.google.com"]):
        assert await check_mx_records("google.com") is True


@pytest.mark.asyncio
async def test_http_fallback_failure():
    # Cover lines 179-180: HTTP fallback client throws an exception
    async def mock_get(*args, **kwargs):
        raise httpx.ConnectError("Connection failed completely")

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        res = await fetch_website_details("https://completelybroken.com")
        assert res["reachable"] is False