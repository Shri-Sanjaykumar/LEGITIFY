import uuid
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.scan import Scan
from app.models.audit import AuditLog
from app.models.user import User


async def get_user_headers_and_db(client: AsyncClient, email: str, role: str = "student") -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePassword123!",
            "full_name": "Test User",
            "role": role
        }
    )
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": "SecurePassword123!"
        }
    )
    token = login_response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_scan_success(client: AsyncClient, db: AsyncSession):
    headers = await get_user_headers_and_db(client, "student_scan1@vitstudent.ac.in")

    response = await client.post(
        "/api/v1/scan/create",
        json={
            "scan_type": "pdf",
            "scan_source": "FILE",
            "priority": "HIGH"
        },
        headers=headers
    )
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["message"] == "Scan record initialized."
    assert res_data["data"]["status"] == "PENDING"
    assert res_data["data"]["scan_version"] == "v1"
    assert res_data["data"]["priority"] == "HIGH"
    assert res_data["data"]["scan_source"] == "FILE"

    # Verify audit log creation
    scan_id = uuid.UUID(res_data["data"]["id"])
    audit_res = await db.execute(
        select(AuditLog).where(AuditLog.action == "SCAN_CREATED")
    )
    audits = audit_res.scalars().all()
    matching_audit = next((a for a in audits if a.payload.get("scan_id") == str(scan_id)), None)
    assert matching_audit is not None
    assert matching_audit.payload["new_status"] == "PENDING"


@pytest.mark.asyncio
async def test_get_scan_details_acl(client: AsyncClient, db: AsyncSession):
    headers_a = await get_user_headers_and_db(client, "usera_acl@vitstudent.ac.in")
    headers_b = await get_user_headers_and_db(client, "userb_acl@vitstudent.ac.in")
    headers_admin = await get_user_headers_and_db(client, "admin_acl@vitstudent.ac.in", role="admin")

    # User A creates scan
    create_res = await client.post(
        "/api/v1/scan/create",
        json={
            "scan_type": "url",
            "scan_source": "URL"
        },
        headers=headers_a
    )
    scan_id = create_res.json()["data"]["id"]

    # 1. User A retrieves own scan -> 200
    res_a = await client.get(f"/api/v1/scan/{scan_id}", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.json()["success"] is True

    # 2. User B retrieves User A scan -> 403
    res_b = await client.get(f"/api/v1/scan/{scan_id}", headers=headers_b)
    assert res_b.status_code == 403

    # 3. Admin retrieves User A scan -> 200
    res_admin = await client.get(f"/api/v1/scan/{scan_id}", headers=headers_admin)
    assert res_admin.status_code == 200
    assert res_admin.json()["success"] is True


@pytest.mark.asyncio
async def test_scan_status_transitions_and_timing(client: AsyncClient, db: AsyncSession):
    headers_student = await get_user_headers_and_db(client, "student_trans@vitstudent.ac.in")
    headers_admin = await get_user_headers_and_db(client, "admin_trans@vitstudent.ac.in", role="admin")

    # 1. Create Scan (PENDING)
    create_res = await client.post(
        "/api/v1/scan/create",
        json={
            "scan_type": "docx",
            "scan_source": "FILE"
        },
        headers=headers_student
    )
    scan_id = create_res.json()["data"]["id"]

    # 2. Student attempts transition -> 403 Forbidden
    patch_student = await client.patch(
        "/api/v1/scan/status",
        json={
            "scan_id": scan_id,
            "status": "QUEUED"
        },
        headers=headers_student
    )
    assert patch_student.status_code == 403

    # 3. Valid transition: PENDING -> QUEUED -> 200
    patch_queued = await client.patch(
        "/api/v1/scan/status",
        json={
            "scan_id": scan_id,
            "status": "QUEUED"
        },
        headers=headers_admin
    )
    assert patch_queued.status_code == 200
    assert patch_queued.json()["data"]["status"] == "QUEUED"

    # Verify SCAN_QUEUED audit log
    audit_res = await db.execute(
        select(AuditLog).where(AuditLog.action == "SCAN_QUEUED")
    )
    assert audit_res.scalars().first() is not None

    # 4. Valid transition: QUEUED -> PROCESSING -> 200
    patch_proc = await client.patch(
        "/api/v1/scan/status",
        json={
            "scan_id": scan_id,
            "status": "PROCESSING"
        },
        headers=headers_admin
    )
    assert patch_proc.status_code == 200

    # Verify started_at is populated
    db_res = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id)))
    scan_db = db_res.scalars().first()
    assert scan_db.started_at is not None
    assert scan_db.completed_at is None

    # 5. Invalid transition: PROCESSING -> PENDING -> 400 Bad Request
    patch_invalid = await client.patch(
        "/api/v1/scan/status",
        json={
            "scan_id": scan_id,
            "status": "PENDING"
        },
        headers=headers_admin
    )
    assert patch_invalid.status_code == 400

    # 6. Valid transition: PROCESSING -> FAILED -> 200
    patch_fail = await client.patch(
        "/api/v1/scan/status",
        json={
            "scan_id": scan_id,
            "status": "FAILED",
            "error_code": "PROCESSING_TIMEOUT",
            "error_message": "Antivirus scanning engine timeout"
        },
        headers=headers_admin
    )
    assert patch_fail.status_code == 200

    # Verify timing and error persistence
    db_res2 = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id)))
    scan_db2 = db_res2.scalars().first()
    assert scan_db2.completed_at is not None
    assert scan_db2.error_code == "PROCESSING_TIMEOUT"
    assert scan_db2.error_message == "Antivirus scanning engine timeout"

    # Verify SCAN_FAILED audit log
    audit_res_fail = await db.execute(
        select(AuditLog).where(AuditLog.action == "SCAN_FAILED")
    )
    assert audit_res_fail.scalars().first() is not None


@pytest.mark.asyncio
async def test_scan_history_pagination_and_filtering(client: AsyncClient, db: AsyncSession):
    headers = await get_user_headers_and_db(client, "student_hist@vitstudent.ac.in")
    headers_admin = await get_user_headers_and_db(client, "admin_hist@vitstudent.ac.in", role="admin")

    # Create 5 scans
    # 2 PDF scans
    for _ in range(2):
        await client.post(
            "/api/v1/scan/create",
            json={"scan_type": "pdf", "scan_source": "FILE"},
            headers=headers
        )
    # 2 URL scans
    for _ in range(2):
        res = await client.post(
            "/api/v1/scan/create",
            json={"scan_type": "url", "scan_source": "URL"},
            headers=headers
        )
        # Transition to COMPLETED
        scan_id = res.json()["data"]["id"]
        await client.patch(
            "/api/v1/scan/status",
            json={"scan_id": scan_id, "status": "PROCESSING"},
            headers=headers_admin
        )
        await client.patch(
            "/api/v1/scan/status",
            json={"scan_id": scan_id, "status": "COMPLETED"},
            headers=headers_admin
        )

    # 1 TXT scan
    res_txt = await client.post(
        "/api/v1/scan/create",
        json={"scan_type": "txt", "scan_source": "TEXT"},
        headers=headers
    )
    # Transition to FAILED
    scan_id_txt = res_txt.json()["data"]["id"]
    await client.patch(
        "/api/v1/scan/status",
        json={"scan_id": scan_id_txt, "status": "PROCESSING"},
        headers=headers_admin
    )
    await client.patch(
        "/api/v1/scan/status",
        json={"scan_id": scan_id_txt, "status": "FAILED", "error_code": "INVALID_DOCUMENT", "error_message": "Empty file"},
        headers=headers_admin
    )

    # 1. Test Filter: scan_type=pdf -> Should return 2 scans
    hist_pdf = await client.get("/api/v1/scan/history?scan_type=pdf", headers=headers)
    assert hist_pdf.status_code == 200
    assert hist_pdf.json()["data"]["total"] == 2
    assert len(hist_pdf.json()["data"]["scans"]) == 2

    # 2. Test Filter: status=COMPLETED -> Should return 2 scans
    hist_completed = await client.get("/api/v1/scan/history?status=COMPLETED", headers=headers)
    assert hist_completed.status_code == 200
    assert hist_completed.json()["data"]["total"] == 2

    # 3. Test Pagination: page=1, limit=2 -> Should return 2 scans, total 5
    hist_page1 = await client.get("/api/v1/scan/history?page=1&limit=2", headers=headers)
    assert hist_page1.status_code == 200
    assert len(hist_page1.json()["data"]["scans"]) == 2
    assert hist_page1.json()["data"]["total"] == 5

    # 4. Test Sorting: sort=created_at&order=asc
    hist_sort = await client.get("/api/v1/scan/history?sort=created_at&order=asc", headers=headers)
    assert hist_sort.status_code == 200
    scans_sorted = hist_sort.json()["data"]["scans"]
    assert len(scans_sorted) == 5
    # First is PDF scan (created first), last is TXT scan (created last)
    assert scans_sorted[0]["scan_type"] == "pdf"
    assert scans_sorted[-1]["scan_type"] == "txt"
