import pytest
import uuid
import socket
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, Response

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.user import User
from app.models.report import (
    DomainVerification,
    DomainVerificationBreakdown,
    DomainVerificationEvidence,
    DomainReputationSnapshot,
)
from app.services.domain_intelligence.crawler import (
    clean_url,
    extract_domain,
    check_dns_resolution,
    check_mx_records,
    check_spf_record,
    check_dmarc_record,
    check_dkim_record,
    fetch_ssl_certificate,
    run_domain_crawler,
)
from app.services.domain_intelligence.scoring import (
    calculate_domain_results,
    is_internal_domain,
)
from app.services.domain_intelligence.engine import (
    get_cached_domain_verification,
    start_domain_verification,
    execute_domain_verification_pipeline,
)


@pytest.mark.asyncio
async def test_domain_crawler_utilities():
    # clean_url
    assert clean_url("test.com") == "https://test.com"
    assert clean_url("http://test.com") == "http://test.com"

    # extract_domain
    assert extract_domain("https://sub.test.com/path") == "sub.test.com"
    assert extract_domain("user@test.co.in") == "test.co.in"
    assert extract_domain("invalid-domain") == "invalid-domain"


@pytest.mark.asyncio
async def test_domain_dns_checks():
    # Test bypasses
    assert await check_dns_resolution("localhost") is True
    assert await check_dns_resolution("test.local") is True
    assert await check_mx_records("test.test") is True

    # Test resolution failure
    with patch("asyncio.get_event_loop") as mock_get_loop:
        mock_loop = MagicMock()
        mock_loop.getaddrinfo = AsyncMock(side_effect=socket.gaierror())
        mock_get_loop.return_value = mock_loop
        assert await check_dns_resolution("notexist.xyz") is False

    # Test resolution success
    with patch("asyncio.get_event_loop") as mock_get_loop:
        mock_loop = MagicMock()
        mock_loop.getaddrinfo = AsyncMock(
            return_value=[
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80))
            ]
        )
        mock_get_loop.return_value = mock_loop
        assert await check_dns_resolution("resolves.com") is True


@pytest.mark.asyncio
async def test_domain_mx_records():
    with patch("dns.resolver.resolve", side_effect=Exception("No MX")):
        assert await check_mx_records("nomailexchanger.com") is False

    with patch("dns.resolver.resolve", return_value=["mx1.mail.com"]):
        assert await check_mx_records("validmail.com") is True


@pytest.mark.asyncio
async def test_domain_spf_record():
    # No SPF found
    with patch("dns.resolver.resolve", return_value=[]):
        assert await check_spf_record("nospf.com") is None

    # SPF found
    mock_txt = MagicMock()
    mock_txt.strings = [b"v=spf1 include:_spf.google.com ~all"]
    with patch("dns.resolver.resolve", return_value=[mock_txt]):
        assert (
            await check_spf_record("validspf.com")
            == "v=spf1 include:_spf.google.com ~all"
        )


@pytest.mark.asyncio
async def test_domain_dmarc_record():
    # No DMARC found
    with patch("dns.resolver.resolve", side_effect=Exception("No DMARC")):
        assert await check_dmarc_record("nodmarc.com") is None

    # DMARC found
    mock_txt = MagicMock()
    mock_txt.strings = [b"v=DMARC1; p=reject;"]
    with patch("dns.resolver.resolve", return_value=[mock_txt]):
        assert await check_dmarc_record("validdmarc.com") == "v=DMARC1; p=reject;"

    # Subdomain fallback inheritance
    with patch("dns.resolver.resolve") as mock_resolve:
        mock_resolve.side_effect = [
            Exception("Subdomain DMARC missing"),  # first call on subdomain
            [mock_txt],  # second call on parent
        ]
        res = await check_dmarc_record("sub.parent.com")
        assert "inherited from root" in res


@pytest.mark.asyncio
async def test_domain_dkim_record():
    # DKIM Present
    mock_txt = MagicMock()
    mock_txt.strings = [b"v=DKIM1; k=rsa;"]
    with patch("dns.resolver.resolve", return_value=[mock_txt]):
        assert await check_dkim_record("active-dkim.com") == "PRESENT"

    # DKIM Absent
    import dns.resolver

    with patch(
        "dns.resolver.resolve",
        side_effect=dns.resolver.NXDOMAIN(qnames=["default._domainkey.domain.com"]),
    ):
        assert await check_dkim_record("no-dkim.com") == "ABSENT"

    # DKIM Unknown
    with patch("dns.resolver.resolve", side_effect=Exception("Servfail")):
        assert await check_dkim_record("error-dkim.com") == "UNKNOWN"


@pytest.mark.asyncio
async def test_ssl_certificate_validations():
    # Test valid cert mock
    cert_res = await fetch_ssl_certificate("test.local")
    assert cert_res["ssl_status"] == "VALID"
    cert_expiry = cert_res["certificate_expiry"]
    assert cert_expiry is not None
    assert cert_expiry > datetime.now(timezone.utc)

    # Test expired cert handshake
    with patch("asyncio.open_connection"), patch("asyncio.wait_for") as mock_wait:
        mock_sock = MagicMock()
        mock_sock.getpeercert.return_value = {
            "notAfter": "Jan 01 00:00:00 2026 GMT",
            "subject": [[("commonName", "testdomain.com")]],
            "issuer": [[("commonName", "Let's Encrypt Authority")]],
        }
        mock_writer = MagicMock()
        mock_writer.get_extra_info.return_value = mock_sock
        mock_writer.wait_closed = AsyncMock()
        mock_wait.return_value = (None, mock_writer)

        expired_res = await fetch_ssl_certificate("expired-cert.com")
        assert expired_res["ssl_status"] == "EXPIRED"

    # Test invalid self-signed fallback cert retrieval
    with patch("asyncio.open_connection"), patch("asyncio.wait_for") as mock_wait:
        # First secure call fails with SSLError
        import ssl

        mock_writer_fallback = MagicMock()
        mock_sock_fallback = MagicMock()
        mock_sock_fallback.getpeercert.return_value = b"binary_cert_data"
        mock_writer_fallback.get_extra_info.return_value = mock_sock_fallback
        mock_writer_fallback.wait_closed = AsyncMock()
        mock_wait.side_effect = [
            ssl.SSLError("Verification failed"),  # first call raises SSLError
            (None, mock_writer_fallback),  # fallback returns writer
        ]
        with patch("ssl.DER_cert_to_PEM_cert", return_value="PEM_CERT"):
            invalid_res = await fetch_ssl_certificate("self-signed.com")
            assert invalid_res["ssl_status"] == "INVALID"


@pytest.mark.asyncio
async def test_scoring_system():
    # 1. Internal domain classification
    assert is_internal_domain("corp.local") is True
    assert is_internal_domain("vpn.mycompany.com") is True

    internal_res = calculate_domain_results({"domain": "corp.local"})
    assert internal_res["level"] == "INTERNAL_DOMAIN"
    assert internal_res["score"] == 90.0

    # 2. Perfect DNS/MX/SPF/DMARC/SSL configuration
    crawl_data = {
        "domain": "healthy.com",
        "dns_resolved": True,
        "mx_records_present": True,
        "spf_record": "v=spf1 include:_spf.google.com ~all",
        "dmarc_record": "v=DMARC1; p=reject;",
        "dkim_status": "PRESENT",
        "ssl_details": {
            "ssl_status": "VALID",
            "certificate_expiry": datetime.now(timezone.utc) + timedelta(days=120),
        },
        "website_reachable": True,
    }
    healthy_res = calculate_domain_results(crawl_data)
    assert healthy_res["score"] >= 80.0
    assert healthy_res["level"] == "VERIFIED"
    assert healthy_res["confidence"] == "HIGH"

    # 3. 90-Day Informational warning test
    crawl_data["ssl_details"]["certificate_expiry"] = datetime.now(
        timezone.utc
    ) + timedelta(days=60)
    warning_res = calculate_domain_results(crawl_data)
    # Expiry in 60 days should keep score high, but insert informational evidence
    assert warning_res["score"] >= 80.0
    assert any(ev["severity"] == "INFO" for ev in warning_res["evidence"])

    # 4. Critical SSL Expiry deductions checks
    crawl_data["ssl_details"]["certificate_expiry"] = datetime.now(
        timezone.utc
    ) + timedelta(days=5)
    critical_res = calculate_domain_results(crawl_data)
    assert critical_res["score"] < healthy_res["score"]  # deduction applied

    # 5. Missing DMARC/SPF/MX combination scoring suspicious classification
    suspicious_crawl = {
        "domain": "suspicious-spam.com",
        "dns_resolved": True,
        "mx_records_present": False,
        "spf_record": None,
        "dmarc_record": None,
        "dkim_status": "ABSENT",
        "ssl_details": {"ssl_status": "INVALID"},
        "website_reachable": False,
    }
    suspicious_res = calculate_domain_results(suspicious_crawl)
    assert suspicious_res["level"] in ["SUSPICIOUS", "UNVERIFIED"]

    # 6. Additional SSL Expiry ranges and level boundaries
    # 15-30 days
    crawl_data["ssl_details"]["certificate_expiry"] = datetime.now(
        timezone.utc
    ) + timedelta(days=20)
    res_soon = calculate_domain_results(crawl_data)
    assert any(b["rule_name"] == "SSL_EXPIRING_SOON" for b in res_soon["breakdowns"])

    # 7-15 days
    crawl_data["ssl_details"]["certificate_expiry"] = datetime.now(
        timezone.utc
    ) + timedelta(days=10)
    res_urgent = calculate_domain_results(crawl_data)
    assert any(
        b["rule_name"] == "SSL_EXPIRING_URGENT" for b in res_urgent["breakdowns"]
    )

    # <= 7 days
    crawl_data["ssl_details"]["certificate_expiry"] = datetime.now(
        timezone.utc
    ) + timedelta(days=2)
    res_crit = calculate_domain_results(crawl_data)
    assert any(
        b["rule_name"] == "SSL_EXPIRING_CRITICAL" for b in res_crit["breakdowns"]
    )

    # Expired SSL
    crawl_data["ssl_details"]["ssl_status"] = "EXPIRED"
    res_expired = calculate_domain_results(crawl_data)
    assert any(b["rule_name"] == "SSL_EXPIRED" for b in res_expired["breakdowns"])

    # Level checks: PARTIALLY_VERIFIED
    partially_crawl = {
        "domain": "partial.com",
        "dns_resolved": True,
        "mx_records_present": True,
        "spf_record": None,
        "dmarc_record": None,
        "dkim_status": "ABSENT",
        "ssl_details": {
            "ssl_status": "VALID",
            "certificate_expiry": datetime.now(timezone.utc) + timedelta(days=2),
        },
        "website_reachable": False,
    }
    res_partial = calculate_domain_results(partially_crawl)
    assert res_partial["level"] == "PARTIALLY_VERIFIED"

    # Level checks: SUSPICIOUS
    suspicious_crawl_2 = {
        "domain": "suspicious2.com",
        "dns_resolved": True,
        "mx_records_present": False,
        "spf_record": None,
        "dmarc_record": None,
        "dkim_status": "ABSENT",
        "ssl_details": {"ssl_status": "INVALID"},
        "website_reachable": False,
    }
    res_susp = calculate_domain_results(suspicious_crawl_2)
    assert res_susp["level"] == "SUSPICIOUS"

    # Level checks: UNVERIFIED
    unverified_crawl = {
        "domain": "unverified2.com",
        "dns_resolved": False,
        "mx_records_present": False,
        "spf_record": None,
        "dmarc_record": None,
        "dkim_status": "ABSENT",
        "ssl_details": {"ssl_status": "INVALID"},
        "website_reachable": False,
    }
    res_unver = calculate_domain_results(unverified_crawl)
    assert res_unver["level"] == "UNVERIFIED"

    # Confidence check: MEDIUM when SSL unknown
    medium_conf_crawl = {
        "domain": "medconf.com",
        "dns_resolved": True,
        "mx_records_present": True,
        "spf_record": "v=spf1",
        "dmarc_record": "v=DMARC1",
        "dkim_status": "PRESENT",
        "ssl_details": {"ssl_status": "UNKNOWN"},
        "website_reachable": True,
    }
    res_med = calculate_domain_results(medium_conf_crawl)
    assert res_med["confidence"] == "MEDIUM"

    # Confidence check: LOW when DNS not resolved
    assert res_unver["confidence"] == "LOW"

    # is_internal_domain empty check
    assert is_internal_domain("") is False


@pytest.mark.asyncio
async def test_engine_caching_and_reputation_snaps(db: AsyncSession):
    domain = "mycoolstart.com"

    # Cache hit check should yield None initially
    assert await get_cached_domain_verification(db, domain) is None

    # Initialize pending record
    pending = await start_domain_verification(db, domain)
    assert pending.verification_status == "PENDING"

    # Run verification pipeline background task
    db_session_factory = lambda: db
    with patch(
        "app.services.domain_intelligence.crawler.run_domain_crawler"
    ) as mock_crawl:
        mock_crawl.return_value = {
            "domain": domain,
            "dns_resolved": True,
            "mx_records_present": True,
            "spf_record": "v=spf1",
            "dmarc_record": None,
            "dkim_status": "ABSENT",
            "ssl_details": {
                "ssl_status": "VALID",
                "certificate_expiry": datetime.now(timezone.utc) + timedelta(days=60),
            },
            "website_reachable": True,
        }
        await execute_domain_verification_pipeline(db_session_factory, pending.id)

    # Check that caching works now
    cached = await get_cached_domain_verification(db, domain)
    assert cached is not None
    assert cached.verification_status == "COMPLETED"

    # Check that a reputation snapshot was saved
    stmt = select(DomainReputationSnapshot).where(
        DomainReputationSnapshot.domain == domain
    )
    res = await db.execute(stmt)
    snapshot = res.scalars().first()
    assert snapshot is not None
    assert snapshot.verification_score == cached.verification_score


@pytest.mark.asyncio
async def test_domain_api_endpoints(client: AsyncClient, db: AsyncSession):
    # 1. Register student
    email = "domainstudent@vitstudent.ac.in"
    password = "SecurePassword123!"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Domain Student",
            "role": "student",
        },
    )

    # Login
    res_login = await client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    token = res_login.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Trigger verification
    res_verify = await client.post(
        "/api/v1/domain/verify", json={"domain": "verifydomain.local"}, headers=headers
    )
    assert res_verify.status_code == 200
    assert "process initiated" in res_verify.json()["message"]
    ver_id = res_verify.json()["data"]["id"]

    # Manually execute the background task synchronously with the test session `db`
    class AsyncSessionContext:
        def __init__(self, session):
            self.session = session

        async def __aenter__(self):
            return self.session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    session_factory = lambda: AsyncSessionContext(db)
    await execute_domain_verification_pipeline(session_factory, uuid.UUID(ver_id))

    # 3. Get Details
    res_get = await client.get(f"/api/v1/domain/{ver_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["data"]["domain"] == "verifydomain.local"

    # 4. Get Breakdown
    res_bd = await client.get(f"/api/v1/domain/{ver_id}/breakdown", headers=headers)
    assert res_bd.status_code == 200
    assert "detailed verification logs retrieved" in res_bd.json()["message"].lower()

    # 5. Get History
    res_hist = await client.get("/api/v1/domain/history", headers=headers)
    assert res_hist.status_code == 200
    assert len(res_hist.json()["data"]) > 0

    # 6. Get Reputation snapshots
    res_rep = await client.get(
        "/api/v1/domain/reputation/verifydomain.local", headers=headers
    )
    assert res_rep.status_code == 200
    assert len(res_rep.json()["data"]) > 0


@pytest.mark.asyncio
async def test_crawler_edge_cases():
    # Empty inputs
    assert extract_domain("") is None
    assert extract_domain("   ") is None
    assert extract_domain("invalid@@@domain") is None

    assert await check_dns_resolution("") is False
    assert await check_mx_records("") is False
    assert await check_spf_record("") is None
    assert await check_dmarc_record("") is None
    assert await check_dkim_record("") == "UNKNOWN"

    empty_ssl = await fetch_ssl_certificate("")
    assert empty_ssl["ssl_status"] == "UNKNOWN"

    from app.services.domain_intelligence.crawler import fetch_website_reachability

    assert await fetch_website_reachability("") is False

    # check_spf_record empty TXT returns None
    mock_txt_empty = MagicMock()
    mock_txt_empty.strings = []
    with patch("dns.resolver.resolve", return_value=[mock_txt_empty]):
        assert await check_spf_record("empty.com") is None

    # check_dns_resolution local bypass
    assert await check_dns_resolution("myhost.local") is True

    # check_mx_records local bypass
    assert await check_mx_records("myhost.local") is True

    # check_spf_record local bypass
    assert (
        await check_spf_record("myhost.local") == "v=spf1 include:_spf.google.com ~all"
    )

    # check_dmarc_record local bypass
    assert await check_dmarc_record("myhost.local") == "v=DMARC1; p=reject;"

    # check_dkim_record local bypass
    assert await check_dkim_record("myhost.local") == "PRESENT"

    # fetch_ssl_certificate local bypass
    local_ssl = await fetch_ssl_certificate("myhost.local")
    assert local_ssl["ssl_status"] == "VALID"

    # fetch_website_reachability local bypass
    assert await fetch_website_reachability("myhost.local") is True

    # fetch_website_reachability HTTP client mocks (success and fail)
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200)
        assert await fetch_website_reachability("reachable.com") is True

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=500)
        assert await fetch_website_reachability("error500.com") is False

    with patch("httpx.AsyncClient.get", side_effect=Exception("Timeout")):
        assert await fetch_website_reachability("timeout.com") is False


@pytest.mark.asyncio
async def test_engine_edge_cases(db: AsyncSession):
    # Cache hit error logging
    with patch.object(db, "execute", side_effect=Exception("Database error")):
        res = await get_cached_domain_verification(db, "errordomain.com")
        assert res is None

    # Recycling of pending record
    v1 = await start_domain_verification(db, "recycle.com")
    assert v1.verification_status == "PENDING"

    v2 = await start_domain_verification(db, "recycle.com")
    assert v2.id == v1.id
    assert v2.verification_status == "PENDING"


@pytest.mark.asyncio
async def test_extra_coverage_edge_cases(db: AsyncSession):
    # 1. Pipeline execution failure
    pending = await start_domain_verification(db, "failpipeline.com")
    assert pending.verification_status == "PENDING"

    class AsyncSessionContext:
        def __init__(self, session):
            self.session = session

        async def __aenter__(self):
            return self.session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    session_factory = lambda: AsyncSessionContext(db)
    with patch(
        "app.services.domain_intelligence.engine.run_domain_crawler",
        side_effect=Exception("Crawler exception"),
    ):
        await execute_domain_verification_pipeline(session_factory, pending.id)

    await db.refresh(pending)
    assert pending.verification_status == "FAILED"

    # 2. extract_domain exception check
    with patch(
        "app.services.domain_intelligence.crawler.clean_url",
        side_effect=Exception("Clean URL failed"),
    ):
        assert extract_domain("https://error.com") is None

    # 3. check_spf_record no match txt
    mock_txt_no_spf = MagicMock()
    mock_txt_no_spf.strings = [b"some-other-txt-record"]
    with patch("dns.resolver.resolve", return_value=[mock_txt_no_spf]):
        assert await check_spf_record("nospf.com") is None

    # 4. fetch_ssl_certificate complete handshake failure
    with patch("asyncio.open_connection"), patch("asyncio.wait_for") as mock_wait:
        import ssl

        mock_wait.side_effect = ssl.SSLError("Verification failed")
        res = await fetch_ssl_certificate("completely-failed.com")
        assert res["ssl_status"] == "INVALID"
