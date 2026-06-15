"""
tests/test_report.py – Enterprise Report Persistence Tests

Covers:
- Report creation & versioning
- ACL / ownership enforcement
- State machine transitions (valid & invalid)
- COMPLETED report immutability
- History tracking (report_history + audit_log)
- Evidence CRUD with ACL
- Soft delete behaviour
- History endpoint pagination, sorting, filtering
- Constraint validation (trust_score, risk_score, confidence, evidence enums)
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.report import EvidenceItem, Report, ReportHistory
from app.models.audit import AuditLog


# ──────────────────────────────────────────────
#  Auth helpers
# ──────────────────────────────────────────────


async def _register_and_login(client: AsyncClient, email: str, role: str = "student") -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass123!", "full_name": "Test User", "role": role},
    )
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "SecurePass123!"},
    )
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_scan(client: AsyncClient, headers: dict) -> str:
    res = await client.post(
        "/api/v1/scan/create",
        json={"scan_type": "pdf", "scan_source": "FILE"},
        headers=headers,
    )
    return res.json()["data"]["id"]


async def _create_report(client: AsyncClient, headers: dict, scan_id: str) -> dict:
    res = await client.post(
        "/api/v1/report/create",
        json={
            "scan_id": scan_id,
            "trust_score": 72.5,
            "risk_score": 27.5,
            "confidence_score": 85,
            "risk_level": "medium",
            "summary": "Initial analysis complete.",
            "recommendation": "Review recruiter credentials.",
            "generated_by": "HUMAN",
        },
        headers=headers,
    )
    return res.json()


# ──────────────────────────────────────────────
#  Tests: Report Creation
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_report_success(client: AsyncClient, db: AsyncSession):
    headers = await _register_and_login(client, "create_report@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers)

    res = await client.post(
        "/api/v1/report/create",
        json={
            "scan_id": scan_id,
            "trust_score": 80.0,
            "risk_score": 20.0,
            "confidence_score": 90,
            "risk_level": "low",
            "summary": "Document appears legitimate.",
            "generated_by": "HUMAN",
        },
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["data"]["report_status"] == "DRAFT"
    assert data["data"]["report_version"] == "v1"
    assert data["data"]["trust_score"] == 80.0
    assert data["data"]["risk_level"] == "low"

    # Verify audit log created
    audit_res = await db.execute(
        select(AuditLog).where(AuditLog.action == "REPORT_CREATED")
    )
    assert audit_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_create_report_scan_not_found(client: AsyncClient, db: AsyncSession):
    headers = await _register_and_login(client, "notfound_report@vitstudent.ac.in")
    res = await client.post(
        "/api/v1/report/create",
        json={"scan_id": str(uuid.uuid4()), "trust_score": 50.0, "risk_score": 50.0,
              "confidence_score": 50, "risk_level": "medium", "summary": "test"},
        headers=headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_create_report_acl_other_user_scan(client: AsyncClient, db: AsyncSession):
    """User B should not be able to create a report for User A's scan."""
    headers_a = await _register_and_login(client, "owner_scan_a@vitstudent.ac.in")
    headers_b = await _register_and_login(client, "other_user_b@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers_a)

    res = await client.post(
        "/api/v1/report/create",
        json={"scan_id": scan_id, "trust_score": 50.0, "risk_score": 50.0,
              "confidence_score": 50, "risk_level": "medium", "summary": "Unauthorized"},
        headers=headers_b,
    )
    assert res.status_code == 403


# ──────────────────────────────────────────────
#  Tests: Report Versioning
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_report_versioning(client: AsyncClient, db: AsyncSession):
    """Creating multiple reports for the same scan increments version."""
    headers = await _register_and_login(client, "versioning_report@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers)

    # v1
    r1 = await client.post(
        "/api/v1/report/create",
        json={"scan_id": scan_id, "trust_score": 60.0, "risk_score": 40.0,
              "confidence_score": 70, "risk_level": "medium", "summary": "v1 analysis"},
        headers=headers,
    )
    assert r1.status_code == 201
    assert r1.json()["data"]["report_version"] == "v1"

    # v2
    r2 = await client.post(
        "/api/v1/report/create",
        json={"scan_id": scan_id, "trust_score": 75.0, "risk_score": 25.0,
              "confidence_score": 80, "risk_level": "low", "summary": "v2 analysis"},
        headers=headers,
    )
    assert r2.status_code == 201
    assert r2.json()["data"]["report_version"] == "v2"

    # v3
    r3 = await client.post(
        "/api/v1/report/create",
        json={"scan_id": scan_id, "trust_score": 85.0, "risk_score": 15.0,
              "confidence_score": 90, "risk_level": "low", "summary": "v3 analysis"},
        headers=headers,
    )
    assert r3.status_code == 201
    assert r3.json()["data"]["report_version"] == "v3"


# ──────────────────────────────────────────────
#  Tests: Get Report (ACL)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_report_owner_access(client: AsyncClient, db: AsyncSession):
    headers = await _register_and_login(client, "get_report_owner@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers)
    create_data = await _create_report(client, headers, scan_id)
    report_id = create_data["data"]["id"]

    res = await client.get(f"/api/v1/report/{report_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert res.json()["data"]["id"] == report_id

    # Verify REPORT_VIEWED audit log
    audit_res = await db.execute(select(AuditLog).where(AuditLog.action == "REPORT_VIEWED"))
    assert audit_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_get_report_forbidden_for_other_user(client: AsyncClient, db: AsyncSession):
    headers_a = await _register_and_login(client, "rpt_acl_a@vitstudent.ac.in")
    headers_b = await _register_and_login(client, "rpt_acl_b@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers_a)
    create_data = await _create_report(client, headers_a, scan_id)
    report_id = create_data["data"]["id"]

    res = await client.get(f"/api/v1/report/{report_id}", headers=headers_b)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_report_admin_access(client: AsyncClient, db: AsyncSession):
    """Admin can view any user's report."""
    headers_student = await _register_and_login(client, "rpt_student@vitstudent.ac.in")
    headers_admin = await _register_and_login(client, "rpt_admin@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_student)
    create_data = await _create_report(client, headers_student, scan_id)
    report_id = create_data["data"]["id"]

    res = await client.get(f"/api/v1/report/{report_id}", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["success"] is True


@pytest.mark.asyncio
async def test_get_report_not_found(client: AsyncClient, db: AsyncSession):
    headers = await _register_and_login(client, "notfound_get@vitstudent.ac.in")
    res = await client.get(f"/api/v1/report/{uuid.uuid4()}", headers=headers)
    assert res.status_code == 404


# ──────────────────────────────────────────────
#  Tests: Status Machine Transitions
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_report_status_transitions_valid(client: AsyncClient, db: AsyncSession):
    """DRAFT -> GENERATING -> COMPLETED -> ARCHIVED"""
    headers_student = await _register_and_login(client, "rpt_trans_s@vitstudent.ac.in")
    headers_admin = await _register_and_login(client, "rpt_trans_a@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_student)
    create_data = await _create_report(client, headers_student, scan_id)
    report_id = create_data["data"]["id"]

    # DRAFT -> GENERATING
    r1 = await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "GENERATING"},
        headers=headers_admin,
    )
    assert r1.status_code == 200
    assert r1.json()["data"]["report_status"] == "GENERATING"

    # GENERATING -> COMPLETED (sets generated_at)
    r2 = await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "COMPLETED"},
        headers=headers_admin,
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["report_status"] == "COMPLETED"
    assert r2.json()["data"]["generated_at"] is not None

    # Verify report_history has 3 rows (DRAFT creation + GENERATING + COMPLETED)
    hist_res = await db.execute(
        select(ReportHistory).where(ReportHistory.report_id == uuid.UUID(report_id))
    )
    history = hist_res.scalars().all()
    assert len(history) == 3  # initial DRAFT creation + two transitions

    # Verify REPORT_COMPLETED audit log
    audit_res = await db.execute(
        select(AuditLog).where(AuditLog.action == "REPORT_COMPLETED")
    )
    assert audit_res.scalars().first() is not None

    # COMPLETED -> ARCHIVED
    r3 = await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "ARCHIVED"},
        headers=headers_admin,
    )
    assert r3.status_code == 200
    assert r3.json()["data"]["report_status"] == "ARCHIVED"


@pytest.mark.asyncio
async def test_report_status_invalid_transition(client: AsyncClient, db: AsyncSession):
    """DRAFT -> ARCHIVED is not allowed."""
    headers_student = await _register_and_login(client, "rpt_inv_s@vitstudent.ac.in")
    headers_admin = await _register_and_login(client, "rpt_inv_a@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_student)
    create_data = await _create_report(client, headers_student, scan_id)
    report_id = create_data["data"]["id"]

    res = await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "ARCHIVED"},
        headers=headers_admin,
    )
    assert res.status_code == 400
    assert "Invalid status transition" in res.json()["message"]


@pytest.mark.asyncio
async def test_report_status_forbidden_for_student(client: AsyncClient, db: AsyncSession):
    """Students cannot update report status."""
    headers_student = await _register_and_login(client, "rpt_stu_rbac@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers_student)
    create_data = await _create_report(client, headers_student, scan_id)
    report_id = create_data["data"]["id"]

    res = await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "GENERATING"},
        headers=headers_student,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_report_failed_retry(client: AsyncClient, db: AsyncSession):
    """FAILED -> GENERATING is a valid retry path."""
    headers_s = await _register_and_login(client, "rpt_retry_s@vitstudent.ac.in")
    headers_a = await _register_and_login(client, "rpt_retry_a@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_s)
    create_data = await _create_report(client, headers_s, scan_id)
    report_id = create_data["data"]["id"]

    # Move to FAILED
    await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "FAILED"},
        headers=headers_a,
    )

    # Retry -> GENERATING
    res = await client.patch(
        "/api/v1/report/status",
        json={"report_id": report_id, "status": "GENERATING"},
        headers=headers_a,
    )
    assert res.status_code == 200
    assert res.json()["data"]["report_status"] == "GENERATING"


# ──────────────────────────────────────────────
#  Tests: COMPLETED Immutability
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_completed_report_state_machine_immutability(client: AsyncClient, db: AsyncSession):
    """
    A COMPLETED report cannot be transitioned to any state except ARCHIVED.
    This verifies that the state machine blocks the COMPLETED -> GENERATING path.
    """
    headers_s = await _register_and_login(client, "imm_student@vitstudent.ac.in")
    headers_a = await _register_and_login(client, "imm_admin@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_s)
    data = await _create_report(client, headers_s, scan_id)
    report_id = data["data"]["id"]

    # Advance to COMPLETED
    await client.patch("/api/v1/report/status", json={"report_id": report_id, "status": "GENERATING"}, headers=headers_a)
    await client.patch("/api/v1/report/status", json={"report_id": report_id, "status": "COMPLETED"}, headers=headers_a)

    # Try invalid transitions from COMPLETED
    for invalid_status in ["DRAFT", "GENERATING", "FAILED"]:
        res = await client.patch(
            "/api/v1/report/status",
            json={"report_id": report_id, "status": invalid_status},
            headers=headers_a,
        )
        assert res.status_code == 400, f"Expected 400 for COMPLETED -> {invalid_status}"


# ──────────────────────────────────────────────
#  Tests: Evidence CRUD
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_and_get_evidence(client: AsyncClient, db: AsyncSession):
    headers_s = await _register_and_login(client, "ev_student@vitstudent.ac.in")
    headers_a = await _register_and_login(client, "ev_admin@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_s)
    rpt_data = await _create_report(client, headers_s, scan_id)
    report_id = rpt_data["data"]["id"]

    # Add evidence (admin only)
    add_res = await client.post(
        f"/api/v1/report/{report_id}/evidence",
        json={
            "evidence_type": "DOMAIN",
            "title": "Suspicious WHOIS registration",
            "description": "Domain registered 3 days before offer letter.",
            "severity": "HIGH",
            "confidence": 0.92,
            "source": "WHOIS",
            "source_reference": "https://whois.example.com/domain",
        },
        headers=headers_a,
    )
    assert add_res.status_code == 201
    ev_data = add_res.json()["data"]
    assert ev_data["evidence_type"] == "DOMAIN"
    assert ev_data["severity"] == "HIGH"
    assert ev_data["confidence"] == 0.92

    # Verify EVIDENCE_ADDED audit log
    audit_res = await db.execute(select(AuditLog).where(AuditLog.action == "EVIDENCE_ADDED"))
    assert audit_res.scalars().first() is not None

    # Get evidence – owner can view
    get_res = await client.get(f"/api/v1/report/{report_id}/evidence", headers=headers_s)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["total"] == 1
    assert get_res.json()["data"]["evidence"][0]["title"] == "Suspicious WHOIS registration"


@pytest.mark.asyncio
async def test_evidence_student_cannot_add(client: AsyncClient, db: AsyncSession):
    """Students cannot add evidence – privilege required."""
    headers_s = await _register_and_login(client, "ev_stu_add@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers_s)
    rpt_data = await _create_report(client, headers_s, scan_id)
    report_id = rpt_data["data"]["id"]

    res = await client.post(
        f"/api/v1/report/{report_id}/evidence",
        json={
            "evidence_type": "MANUAL",
            "title": "Test",
            "description": "Unauthorized add attempt",
            "severity": "LOW",
            "confidence": 0.5,
            "source": "manual",
        },
        headers=headers_s,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_evidence_acl_other_user_cannot_view(client: AsyncClient, db: AsyncSession):
    """User B cannot view User A's report evidence."""
    headers_a = await _register_and_login(client, "ev_acl_a@vitstudent.ac.in")
    headers_b = await _register_and_login(client, "ev_acl_b@vitstudent.ac.in")
    headers_admin = await _register_and_login(client, "ev_acl_adm@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_a)
    rpt_data = await _create_report(client, headers_a, scan_id)
    report_id = rpt_data["data"]["id"]

    res = await client.get(f"/api/v1/report/{report_id}/evidence", headers=headers_b)
    assert res.status_code == 403

    # Admin can view
    res_admin = await client.get(f"/api/v1/report/{report_id}/evidence", headers=headers_admin)
    assert res_admin.status_code == 200


@pytest.mark.asyncio
async def test_evidence_archived_report_blocks_addition(client: AsyncClient, db: AsyncSession):
    """Adding evidence to an ARCHIVED report is blocked."""
    headers_s = await _register_and_login(client, "ev_arch_s@vitstudent.ac.in")
    headers_a = await _register_and_login(client, "ev_arch_a@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_s)
    rpt_data = await _create_report(client, headers_s, scan_id)
    report_id = rpt_data["data"]["id"]

    # Drive to ARCHIVED
    await client.patch("/api/v1/report/status", json={"report_id": report_id, "status": "GENERATING"}, headers=headers_a)
    await client.patch("/api/v1/report/status", json={"report_id": report_id, "status": "COMPLETED"}, headers=headers_a)
    await client.patch("/api/v1/report/status", json={"report_id": report_id, "status": "ARCHIVED"}, headers=headers_a)

    # Try to add evidence
    res = await client.post(
        f"/api/v1/report/{report_id}/evidence",
        json={"evidence_type": "MANUAL", "title": "T", "description": "D",
              "severity": "INFO", "confidence": 0.5, "source": "manual"},
        headers=headers_a,
    )
    assert res.status_code == 400
    assert "ARCHIVED" in res.json()["message"]


# ──────────────────────────────────────────────
#  Tests: History Pagination & Filtering
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_report_history_pagination_and_filters(client: AsyncClient, db: AsyncSession):
    headers_s = await _register_and_login(client, "hist_student@vitstudent.ac.in")
    headers_a = await _register_and_login(client, "hist_admin@vitstudent.ac.in", role="admin")

    # Create 4 reports for distinct scans
    scan_ids = [await _create_scan(client, headers_s) for _ in range(4)]

    # Reports 1 & 2: low risk, default DRAFT
    for i in range(2):
        await client.post(
            "/api/v1/report/create",
            json={"scan_id": scan_ids[i], "trust_score": 80.0, "risk_score": 20.0,
                  "confidence_score": 90, "risk_level": "low", "summary": f"low risk report {i}"},
            headers=headers_s,
        )

    # Reports 3 & 4: high risk, advance to COMPLETED
    for i in range(2, 4):
        rpt = await client.post(
            "/api/v1/report/create",
            json={"scan_id": scan_ids[i], "trust_score": 30.0, "risk_score": 70.0,
                  "confidence_score": 60, "risk_level": "high", "summary": f"high risk report {i}"},
            headers=headers_s,
        )
        rid = rpt.json()["data"]["id"]
        await client.patch("/api/v1/report/status", json={"report_id": rid, "status": "GENERATING"}, headers=headers_a)
        await client.patch("/api/v1/report/status", json={"report_id": rid, "status": "COMPLETED"}, headers=headers_a)

    # 1. Total count
    all_res = await client.get("/api/v1/report/", headers=headers_s)
    assert all_res.status_code == 200
    assert all_res.json()["data"]["total"] == 4

    # 2. Filter by report_status=COMPLETED
    comp_res = await client.get("/api/v1/report/?report_status=COMPLETED", headers=headers_s)
    assert comp_res.status_code == 200
    assert comp_res.json()["data"]["total"] == 2

    # 3. Filter by risk_level=low
    low_res = await client.get("/api/v1/report/?risk_level=low", headers=headers_s)
    assert low_res.status_code == 200
    assert low_res.json()["data"]["total"] == 2

    # 4. Filter by trust_score range
    ts_res = await client.get("/api/v1/report/?min_trust_score=75", headers=headers_s)
    assert ts_res.status_code == 200
    assert ts_res.json()["data"]["total"] == 2

    # 5. Pagination
    page_res = await client.get("/api/v1/report/?page=1&limit=2", headers=headers_s)
    assert page_res.status_code == 200
    assert len(page_res.json()["data"]["reports"]) == 2
    assert page_res.json()["data"]["total"] == 4

    # 6. Sort ascending by created_at
    sort_res = await client.get("/api/v1/report/?sort=created_at&order=asc", headers=headers_s)
    reports_sorted = sort_res.json()["data"]["reports"]
    assert reports_sorted[0]["risk_level"] == "low"


# ──────────────────────────────────────────────
#  Tests: Admin sees all reports
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_can_see_all_users_reports(client: AsyncClient, db: AsyncSession):
    headers_s1 = await _register_and_login(client, "s1_admin_hist@vitstudent.ac.in")
    headers_s2 = await _register_and_login(client, "s2_admin_hist@vitstudent.ac.in")
    headers_admin = await _register_and_login(client, "adm_admin_hist@vitstudent.ac.in", role="admin")

    sid1 = await _create_scan(client, headers_s1)
    sid2 = await _create_scan(client, headers_s2)
    await _create_report(client, headers_s1, sid1)
    await _create_report(client, headers_s2, sid2)

    # s1 sees only their own
    s1_res = await client.get("/api/v1/report/", headers=headers_s1)
    assert s1_res.json()["data"]["total"] == 1

    # admin sees both
    admin_res = await client.get("/api/v1/report/", headers=headers_admin)
    assert admin_res.json()["data"]["total"] >= 2


# ──────────────────────────────────────────────
#  Tests: History tracking
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_report_history_records_all_transitions(client: AsyncClient, db: AsyncSession):
    headers_s = await _register_and_login(client, "hist_trans_s@vitstudent.ac.in")
    headers_a = await _register_and_login(client, "hist_trans_a@vitstudent.ac.in", role="admin")
    scan_id = await _create_scan(client, headers_s)
    data = await _create_report(client, headers_s, scan_id)
    report_id = uuid.UUID(data["data"]["id"])

    await client.patch("/api/v1/report/status", json={"report_id": str(report_id), "status": "GENERATING"}, headers=headers_a)
    await client.patch("/api/v1/report/status", json={"report_id": str(report_id), "status": "FAILED"}, headers=headers_a)
    await client.patch("/api/v1/report/status", json={"report_id": str(report_id), "status": "GENERATING"}, headers=headers_a)
    await client.patch("/api/v1/report/status", json={"report_id": str(report_id), "status": "COMPLETED"}, headers=headers_a)

    hist = await db.execute(select(ReportHistory).where(ReportHistory.report_id == report_id))
    rows = hist.scalars().all()
    # 1 initial DRAFT creation + 4 transitions = 5 history rows
    assert len(rows) == 5

    statuses = [(r.from_status, r.to_status) for r in rows]
    assert ("", "DRAFT") in statuses
    assert ("DRAFT", "GENERATING") in statuses
    assert ("GENERATING", "FAILED") in statuses
    assert ("FAILED", "GENERATING") in statuses
    assert ("GENERATING", "COMPLETED") in statuses


# ──────────────────────────────────────────────
#  Tests: Soft Delete
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_soft_delete_report_not_returned(client: AsyncClient, db: AsyncSession):
    """Soft-deleted reports should not appear in history or direct GET."""
    headers_s = await _register_and_login(client, "softdel_s@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers_s)
    data = await _create_report(client, headers_s, scan_id)
    report_id = uuid.UUID(data["data"]["id"])

    # Soft-delete directly at DB level
    report_row = await db.get(Report, report_id)
    from datetime import timezone
    report_row.is_deleted = True
    report_row.deleted_at = __import__("datetime").datetime.now(timezone.utc)
    await db.commit()

    # GET should 404
    res = await client.get(f"/api/v1/report/{report_id}", headers=headers_s)
    assert res.status_code == 404

    # History should not include it
    hist_res = await client.get("/api/v1/report/", headers=headers_s)
    ids = [r["id"] for r in hist_res.json()["data"]["reports"]]
    assert str(report_id) not in ids


# ──────────────────────────────────────────────
#  Tests: Export Extension Points
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_export_endpoint_placeholder(client: AsyncClient, db: AsyncSession):
    """Export endpoints exist and return not-implemented correctly."""
    headers = await _register_and_login(client, "export_test@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers)
    data = await _create_report(client, headers, scan_id)
    report_id = data["data"]["id"]

    for fmt in ["pdf", "json", "audit"]:
        res = await client.get(f"/api/v1/report/{report_id}/export?format={fmt}", headers=headers)
        assert res.status_code == 200
        assert res.json()["success"] is False
        assert "not yet implemented" in res.json()["message"]


@pytest.mark.asyncio
async def test_export_invalid_format(client: AsyncClient, db: AsyncSession):
    headers = await _register_and_login(client, "export_invalid@vitstudent.ac.in")
    scan_id = await _create_scan(client, headers)
    data = await _create_report(client, headers, scan_id)
    report_id = data["data"]["id"]

    res = await client.get(f"/api/v1/report/{report_id}/export?format=docx", headers=headers)
    assert res.status_code == 400
