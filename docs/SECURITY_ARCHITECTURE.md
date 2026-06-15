# LEGITIFY Security Architecture Spec

This document details the security models, token lifecycle policies, upload sanitization checks, and authorization rules implemented in **LEGITIFY**.

---

## 1. Authentication Security

### 1.1 Password Requirements
User registration enforces the following complexity checks:
* Minimum Length: 8 characters.
* Must contain at least one uppercase letter.
* Must contain at least one lowercase letter.
* Must contain at least one numerical digit.
* Must contain at least one special character (e.g. `@`, `$`, `!`, `%`, `*`, `?`, `&`).

Passwords are hashed before database insertion using **bcrypt** with a salt round factor of 12 (via `passlib` or standard `bcrypt` libraries).

### 1.2 JWT Token Architecture
FastAPI signs and validates access and refresh tokens using HMAC SHA-256 (`HS256`).

* **Access Tokens**:
  * Lifespan: 15 minutes.
  * Contains user UUID, role, and expiration times.
* **Refresh Tokens**:
  * Lifespan: 7 days.
  * Contains user UUID and a session correlation ID.
* **Refresh Token Rotation (RTR)**:
  * When a client requests `/api/v1/auth/refresh` using a valid refresh token, the backend invalidates the old refresh token by blacklisting its session correlation ID in the database and returns a *new* access/refresh token pair.
  * If a blacklisted refresh token is presented (potential token theft), the backend immediately invalidates *all* active refresh tokens for that user session, forcing a full re-authentication.

---

## 2. File Upload Security (Multipart upload)

To mitigate remote code execution (RCE) and local file inclusion (LFI) attacks, the file upload service performs three validation checks:

### 2.1 File Size Validation
* Maximum allowed size: **10 MB**. Any file exceeding this limit is rejected with HTTP `413 Payload Too Large`.

### 2.2 Extension and MIME Type Checks
The uploaded file is matched against a strict whitelist. If the extension does not match the content type, the file is rejected with HTTP `400 Bad Request`.

| Allowed Extension | Allowed MIME Type |
| :--- | :--- |
| `.pdf` | `application/pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.txt` | `text/plain` |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |

All executable extensions (such as `.exe`, `.dll`, `.bat`, `.sh`, `.msi`, `.js`, `.py`) are explicitly blocked.

### 2.3 Magic Bytes Verification (Header Validation)
MIME headers can be easily spoofed. The backend reads the first 2048 bytes of every uploaded file and runs header verification (e.g. using `python-magic` or matching signature bytes manually):
* **PDF Signature**: starts with `%PDF-` (`25 50 44 46`).
* **DOCX Signature**: starts with `PK..` (`50 4B 03 04`).
* **PNG Signature**: starts with `\x89PNG\r\n\x1a\n` (`89 50 4E 47 0D 0A 1A 0A`).
* **JPEG Signature**: starts with `\xFF\xD8\xFF` (`FF D8 FF`).

### 2.4 File Sanitization
* The file is saved using a generated UUID name to prevent directory traversal attacks via names like `../../etc/passwd`.
* The SHA-256 hash of the file is calculated and stored in the database to prevent duplicate uploads and maintain file integrity check logs.

---

## 3. Role-Based Access Control (RBAC)

The system supports four distinct roles:
1. **`student`**: Can upload files, run scans, view own scan history, and view own reports.
2. **`faculty`**: Same as student, plus view dashboard metrics for placement cells.
3. **`investigator`**: Same as faculty, plus edit/override trust scores and evidence logs.
4. **`admin`**: Full access to all endpoints, configuration variables, and user management.

FastAPI dependencies enforce these roles by parsing the JWT payload and matching user roles against the route requirements.
For example, to access `PATCH /api/v1/scan/status` the handler enforces:
```python
current_user = Depends(get_current_active_user)
if current_user.role not in ["admin", "investigator"]:
    raise HTTPException(status_code=403, detail="Permission denied")
```
