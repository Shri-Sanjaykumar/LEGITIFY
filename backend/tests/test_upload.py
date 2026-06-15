import os
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def get_auth_headers(client: AsyncClient, email: str, role: str = "student") -> dict:
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
async def test_upload_file_pdf(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "student1@vitstudent.ac.in")
    
    files = {"file": ("offer.pdf", b"%PDF-1.5\nhello pdf content", "application/pdf")}
    response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["message"] == "File uploaded successfully."
    assert "id" in res_data["data"]
    assert res_data["data"]["original_filename"] == "offer.pdf"
    assert res_data["data"]["mime_type"] == "application/pdf"
    
    # Check that file exists on disk (clean up later)
    file_id = res_data["data"]["id"]
    from app.core.config import settings
    # Locate files in settings.UPLOAD_DIR
    files_in_dir = os.listdir(settings.UPLOAD_DIR)
    matching = [f for f in files_in_dir if str(file_id) in f]
    assert len(matching) == 1
    
    # Cleanup file
    filepath = os.path.join(settings.UPLOAD_DIR, matching[0])
    if os.path.exists(filepath):
        os.remove(filepath)


@pytest.mark.asyncio
async def test_upload_file_docx(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "student2@vitstudent.ac.in")
    
    files = {"file": ("letter.docx", b"PK\x03\x04\x00\x00word content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    
    # Cleanup
    file_id = res_data["data"]["id"]
    from app.core.config import settings
    files_in_dir = os.listdir(settings.UPLOAD_DIR)
    matching = [f for f in files_in_dir if str(file_id) in f]
    if matching:
        os.remove(os.path.join(settings.UPLOAD_DIR, matching[0]))


@pytest.mark.asyncio
async def test_upload_file_txt(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "student3@vitstudent.ac.in")
    
    files = {"file": ("notes.txt", b"Plain text notes", "text/plain")}
    response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    
    # Cleanup
    file_id = res_data["data"]["id"]
    from app.core.config import settings
    files_in_dir = os.listdir(settings.UPLOAD_DIR)
    matching = [f for f in files_in_dir if str(file_id) in f]
    if matching:
        os.remove(os.path.join(settings.UPLOAD_DIR, matching[0]))


@pytest.mark.asyncio
async def test_upload_file_forbidden_extension(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "student4@vitstudent.ac.in")
    
    files = {"file": ("malware.exe", b"MZ\x90\x00executable content", "application/octet-stream")}
    response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    res_data = response.json()
    assert res_data["success"] is False
    assert "forbidden" in res_data["errors"][0] or "MIME" in res_data["errors"][0]


@pytest.mark.asyncio
async def test_upload_file_magic_bytes_mismatch(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "student5@vitstudent.ac.in")
    
    # Named pdf but starts with plain text (not %PDF)
    files = {"file": ("fake.pdf", b"Plain text content", "application/pdf")}
    response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    res_data = response.json()
    assert res_data["success"] is False
    assert "magic bytes mismatch" in res_data["errors"][0]


@pytest.mark.asyncio
async def test_upload_file_size_exceeded(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "student6@vitstudent.ac.in")
    
    # 11MB file
    huge_content = b"%PDF-1.5\n" + (b"A" * 11 * 1024 * 1024)
    files = {"file": ("huge.pdf", huge_content, "application/pdf")}
    response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    res_data = response.json()
    assert res_data["success"] is False
    assert "size exceeds limit" in res_data["errors"][0]


@pytest.mark.asyncio
async def test_download_file_flow(client: AsyncClient, db: AsyncSession):
    headers_a = await get_auth_headers(client, "usera@vitstudent.ac.in")
    headers_b = await get_auth_headers(client, "userb@vitstudent.ac.in")
    
    # User A uploads file
    files = {"file": ("offer_a.pdf", b"%PDF-1.4\nuser A file content", "application/pdf")}
    upload_response = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers_a
    )
    
    assert upload_response.status_code == 201
    file_id = upload_response.json()["data"]["id"]
    
    # 1. User A downloads their own file -> Should succeed
    download_response = await client.get(
        f"/api/v1/scan/file/{file_id}",
        headers=headers_a
    )
    assert download_response.status_code == 200
    assert download_response.content == b"%PDF-1.4\nuser A file content"
    
    # 2. User B tries to download User A's file -> Should fail (403)
    unauthorized_response = await client.get(
        f"/api/v1/scan/file/{file_id}",
        headers=headers_b
    )
    assert unauthorized_response.status_code == 403
    
    # Cleanup file on disk
    from app.core.config import settings
    files_in_dir = os.listdir(settings.UPLOAD_DIR)
    matching = [f for f in files_in_dir if str(file_id) in f]
    if matching:
        os.remove(os.path.join(settings.UPLOAD_DIR, matching[0]))


@pytest.mark.asyncio
async def test_download_file_not_found(client: AsyncClient, db: AsyncSession):
    headers = await get_auth_headers(client, "userc@vitstudent.ac.in")
    random_id = uuid.uuid4()
    
    response = await client.get(
        f"/api/v1/scan/file/{random_id}",
        headers=headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_file_duplicate_deduplication(client: AsyncClient, db: AsyncSession):
    headers_a = await get_auth_headers(client, "usera_dup@vitstudent.ac.in")
    headers_b = await get_auth_headers(client, "userb_dup@vitstudent.ac.in")
    
    file_content = b"%PDF-1.4\nUnique content for deduplication test"
    files = {"file": ("original.pdf", file_content, "application/pdf")}
    response_orig = await client.post(
        "/api/v1/scan/upload",
        files=files,
        headers=headers_a
    )
    assert response_orig.status_code == 201
    orig_data = response_orig.json()["data"]
    orig_id = orig_data["id"]
    
    from app.models.file import UploadedFile
    from sqlalchemy.future import select
    res = await db.execute(select(UploadedFile).where(UploadedFile.id == uuid.UUID(orig_id)))
    orig_db = res.scalars().first()
    assert orig_db.document_type == "PDF"
    assert orig_db.duplicate_of is None
    assert orig_db.virus_scan_status == "PENDING"
    assert orig_db.integrity_status == "VERIFIED"
    assert orig_db.sha256 == orig_db.file_hash
    assert orig_db.upload_timestamp is not None
    
    response_dup = await client.post(
        "/api/v1/scan/upload",
        files={"file": ("duplicate.pdf", file_content, "application/pdf")},
        headers=headers_b
    )
    assert response_dup.status_code == 201
    dup_data = response_dup.json()["data"]
    dup_id = dup_data["id"]
    
    res_dup = await db.execute(select(UploadedFile).where(UploadedFile.id == uuid.UUID(dup_id)))
    dup_db = res_dup.scalars().first()
    assert dup_db.duplicate_of == uuid.UUID(orig_id)
    assert dup_db.file_path == orig_db.file_path
    
    from app.core.config import settings
    files_in_dir = os.listdir(settings.UPLOAD_DIR)
    matching = [f for f in files_in_dir if str(orig_id) in f]
    if matching:
        os.remove(os.path.join(settings.UPLOAD_DIR, matching[0]))
