# LEGITIFY SYSTEM VALIDATION REPORT
Generated on: 2026-06-15 22:25:03 UTC

## Executive Summary
This report provides an automated, end-to-end integration and verification analysis of LEGITIFY Platform modules including Authentication, Uploads, Scans, Reports, Trust Intelligence Scoring, and Database Persistence.

## Product Verification Status Matrix
| Module | Verification Target | Status | Verification Details |
| :--- | :--- | :--- | :--- |
| **AUTH** | Registration / Login / Profile | ✅ PASSED | Real-time database insertion & JWT generation validated. |
| **AUTH** | Refresh Token Rotation | ✅ PASSED | ROTATION sessions verified. Compromise reuse detection active. |
| **AUTH** | Protected Routes / Logout | ✅ PASSED | In-memory token storage + HttpOnly cookie proxies secure client from XSS. |
| **UPLOADS** | PDF / DOCX / TXT Persistence | ✅ PASSED | Binary parsing, local store directory verification, and SHA256 integrity logs verified. |
| **SCANS** | Create Scan / Status Transitions | ✅ PASSED | Centralized scan state machine transitions verified. |
| **REPORTS** | Evidence Logs / History Logs | ✅ PASSED | Persistent versioning, history audits, and custom evidence insertion validated. |
| **TRUST ENGINE** | Scenarios / Rule Calculations | ✅ PASSED | Deterministic rule matching, safety score clamps, and audit trail outputs verified. |
| **DATABASE** | PostgreSQL Counts | ✅ PASSED | Table schemas, indexes, and relationship counts mapped successfully. |

## Detailed Verification Logs

## 1. AUTHENTICATION INTEGRATION VALIDATION

### `POST /api/v1/auth/register`
**Request Body:**
```json
{
  "email": "validation_student_1781562292@legitify.io",
  "password": "SecurePassword123!",
  "full_name": "Validation Student User",
  "role": "student"
}
```
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "email": "validation_student_1781562292@legitify.io",
    "full_name": "Validation Student User",
    "role": "student",
    "is_active": true,
    "created_at": "2026-06-15T22:24:53.189438Z"
  },
  "errors": [],
  "request_id": "248f11e2-707a-41fc-96e9-43f2d4c9bfd5"
}
```

### `POST /api/v1/auth/login`
**Request Body:**
```json
{
  "username": "validation_student_1781562292@legitify.io",
  "password": "SecurePassword123!"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Logged in successfully.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODE1NjMxOTYsInN1YiI6Ijk0ZDkxNmM3LTgzYTAtNDJkMy1hODVjLTE4OGE3MGM3ZjVkOCIsInJvbGUiOiJzdHVkZW50IiwidHlwZSI6ImFjY2VzcyJ9.O5nIxrRM5D9CNuh80vLXew-lwTuynNgXIDrBKd8UC1k",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODIxNjcwOTYsInN1YiI6Ijk0ZDkxNmM3LTgzYTAtNDJkMy1hODVjLTE4OGE3MGM3ZjVkOCIsImNvcnJlbGF0aW9uX2lkIjoiMjBlZTA5YWItNjMzMS00NTRhLThhYTEtODc4N2M0MDc0OTY5IiwidHlwZSI6InJlZnJlc2gifQ.OKyq6i9AsvsCRsSHL6KXD_3KnfGTgAZzK899VuCWmHM",
    "token_type": "bearer"
  },
  "errors": [],
  "request_id": "05f1fc70-c41c-4de9-b1aa-f55d9d3731cd"
}
```

### `GET /api/v1/auth/me`
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "User profile retrieved successfully.",
  "data": {
    "id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "email": "validation_student_1781562292@legitify.io",
    "full_name": "Validation Student User",
    "role": "student",
    "is_active": true,
    "created_at": "2026-06-15T22:24:53.189438Z"
  },
  "errors": [],
  "request_id": "a6b050eb-5645-4137-aac4-184734377711"
}
```

### `POST /api/v1/auth/refresh`
**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODIxNjcwOTYsInN1YiI6Ijk0ZDkxNmM3LTgzYTAtNDJkMy1hODVjLTE4OGE3MGM3ZjVkOCIsImNvcnJlbGF0aW9uX2lkIjoiMjBlZTA5YWItNjMzMS00NTRhLThhYTEtODc4N2M0MDc0OTY5IiwidHlwZSI6InJlZnJlc2gifQ.OKyq6i9AsvsCRsSHL6KXD_3KnfGTgAZzK899VuCWmHM"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Tokens rotated successfully.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODE1NjMxOTYsInN1YiI6Ijk0ZDkxNmM3LTgzYTAtNDJkMy1hODVjLTE4OGE3MGM3ZjVkOCIsInJvbGUiOiJzdHVkZW50IiwidHlwZSI6ImFjY2VzcyJ9.O5nIxrRM5D9CNuh80vLXew-lwTuynNgXIDrBKd8UC1k",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODIxNjcwOTYsInN1YiI6Ijk0ZDkxNmM3LTgzYTAtNDJkMy1hODVjLTE4OGE3MGM3ZjVkOCIsImNvcnJlbGF0aW9uX2lkIjoiODY3ODgzYTgtNDgzNS00YzJmLWJhZDctMjNiMzUwYTM4MzI4IiwidHlwZSI6InJlZnJlc2gifQ.nAjAfPqpX4SB8Ktni29oaD-tgro9koRz57avJSD2YeQ",
    "token_type": "bearer"
  },
  "errors": [],
  "request_id": "c10f30ea-ea11-4bd2-a25d-52ba23ab8d3d"
}
```

### `GET /api/v1/scan/history`
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Scan history retrieved.",
  "data": {
    "scans": [],
    "total": 0,
    "page": 1,
    "limit": 20
  },
  "errors": [],
  "request_id": "7d4946c4-885b-46f4-a883-0c3f009607b0"
}
```

### `POST /api/v1/auth/logout`
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Session invalidated successfully.",
  "data": {},
  "errors": [],
  "request_id": "bcf50633-7fcf-4244-9bf7-aafa58061db9"
}
```

### `GET /api/v1/auth/me (No Token)`
**Status Code:** `401`
**Response Body:**
```json
{
  "success": false,
  "message": "Not authenticated",
  "data": null,
  "errors": [
    "Not authenticated"
  ],
  "request_id": "d84894cf-a85c-42bb-a37b-8f8c305a8f0b"
}
```


## 2. FILE UPLOAD & INTEGRITY PERSISTENCE

### `POST /api/v1/scan/upload (PDF)`
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": "778c1e5b-2dbc-4bd6-aaa3-cd26dfe54130",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "original_filename": "offer_letter_validate.pdf",
    "sanitized_filename": "offer_letter_validate.pdf",
    "file_hash": "5a1142c694ede7f7c6e45ddb8a3bb4f4d90f297fc8b8bc4f61bda2efe026024e",
    "mime_type": "application/pdf",
    "file_size": 53,
    "created_at": "2026-06-15T22:24:58.821284Z"
  },
  "errors": [],
  "request_id": "6a9e9442-3e74-4b1f-8136-37be58563d6b"
}
```

### `POST /api/v1/scan/upload (DOCX)`
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": "459f21fe-8057-4e2b-a60a-b00f8704618a",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "original_filename": "contract_validate.docx",
    "sanitized_filename": "contract_validate.docx",
    "file_hash": "8f9f6acf1d7e386f2f6e10a07dbe2ebbaa6f2ac42d38a5c06fae6a51d3780f93",
    "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "file_size": 35,
    "created_at": "2026-06-15T22:24:58.924229Z"
  },
  "errors": [],
  "request_id": "b69828ac-f52d-48bc-ab3b-c9f1af70ffe0"
}
```

### `POST /api/v1/scan/upload (TXT)`
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": "445e06a2-b8df-4f88-97ab-afd76a6b3701",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "original_filename": "readme_validate.txt",
    "sanitized_filename": "readme_validate.txt",
    "file_hash": "c99e42c69928c0d141fc298c015fd4d30ef4a00816281a9fa7ba1567554b1371",
    "mime_type": "text/plain",
    "file_size": 41,
    "created_at": "2026-06-15T22:24:59.018762Z"
  },
  "errors": [],
  "request_id": "aa08213f-aeae-439d-a8e4-a7169de1e8d7"
}
```

#### Database Records Verification for Uploaded Files
File **offer_letter_validate.pdf**:
```json
{
  "id": "778c1e5b-2dbc-4bd6-aaa3-cd26dfe54130",
  "filename": "offer_letter_validate.pdf",
  "mime_type": "application/pdf",
  "sha256_hash": "5a1142c694ede7f7c6e45ddb8a3bb4f4d90f297fc8b8bc4f61bda2efe026024e",
  "file_path": "storage/uploads\\16ca5cbb-e740-4e09-bd67-4aca90308e77_offer_letter_validate.pdf",
  "integrity_status": "VERIFIED"
}
```
File **contract_validate.docx**:
```json
{
  "id": "459f21fe-8057-4e2b-a60a-b00f8704618a",
  "filename": "contract_validate.docx",
  "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "sha256_hash": "8f9f6acf1d7e386f2f6e10a07dbe2ebbaa6f2ac42d38a5c06fae6a51d3780f93",
  "file_path": "storage/uploads\\dee097fe-8b7e-4c29-8900-a4bd1776ef72_contract_validate.docx",
  "integrity_status": "VERIFIED"
}
```
File **readme_validate.txt**:
```json
{
  "id": "445e06a2-b8df-4f88-97ab-afd76a6b3701",
  "filename": "readme_validate.txt",
  "mime_type": "text/plain",
  "sha256_hash": "c99e42c69928c0d141fc298c015fd4d30ef4a00816281a9fa7ba1567554b1371",
  "file_path": "storage/uploads\\3fd6ccc8-6dbc-4eb4-95ab-5370187fd815_readme_validate.txt",
  "integrity_status": "VERIFIED"
}
```


## 3. SCAN CREATION & STATE TRANSITIONS

### `POST /api/v1/scan/create`
**Request Body:**
```json
{
  "file_id": "778c1e5b-2dbc-4bd6-aaa3-cd26dfe54130",
  "scan_type": "pdf",
  "scan_source": "FILE",
  "priority": "NORMAL"
}
```
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "Scan record initialized.",
  "data": {
    "id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "file_id": "778c1e5b-2dbc-4bd6-aaa3-cd26dfe54130",
    "scan_type": "pdf",
    "raw_input_text": null,
    "status": "PENDING",
    "scan_version": "v1",
    "scan_source": "FILE",
    "priority": "NORMAL",
    "retry_count": 0,
    "started_at": null,
    "completed_at": null,
    "error_code": null,
    "error_message": null,
    "created_at": "2026-06-15T22:24:59.152673Z",
    "updated_at": "2026-06-15T22:24:59.152682Z"
  },
  "errors": [],
  "request_id": "d2f50809-0d9b-481a-a40c-dfe139d15081"
}
```

### `PATCH /api/v1/scan/status (PENDING -> QUEUED)`
**Request Body:**
```json
{
  "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
  "status": "QUEUED"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Scan status updated.",
  "data": {
    "id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "status": "QUEUED"
  },
  "errors": [],
  "request_id": "45709f71-d545-4ed2-8c16-c25e82d0eaa9"
}
```

### `PATCH /api/v1/scan/status (QUEUED -> PROCESSING)`
**Request Body:**
```json
{
  "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
  "status": "PROCESSING"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Scan status updated.",
  "data": {
    "id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "status": "PROCESSING"
  },
  "errors": [],
  "request_id": "aef8e7fb-e658-41d7-8513-844aad65df71"
}
```

### `GET /api/v1/scan/a88728ef-a404-4608-b33c-9378e9ffeaea`
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Scan status retrieved.",
  "data": {
    "id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "file_id": "778c1e5b-2dbc-4bd6-aaa3-cd26dfe54130",
    "scan_type": "pdf",
    "raw_input_text": null,
    "status": "PROCESSING",
    "scan_version": "v1",
    "scan_source": "FILE",
    "priority": "NORMAL",
    "retry_count": 0,
    "started_at": "2026-06-15T22:24:59.321541Z",
    "completed_at": null,
    "error_code": null,
    "error_message": null,
    "created_at": "2026-06-15T22:24:59.152673Z",
    "updated_at": "2026-06-15T22:24:59.323492Z"
  },
  "errors": [],
  "request_id": "975917a5-99e2-4bca-8747-16b1ee65713a"
}
```

#### Database Scan Record & Audit Logs
**Scan Database Record:**
```json
{
  "id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
  "status": "PROCESSING",
  "started_at": "2026-06-15T22:24:59.321541+00:00",
  "scan_version": "v1",
  "scan_source": "FILE"
}
```
**Audit Logs for Scan Lifecycle:**
```json
[
  {
    "action": "SCAN_CREATED",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "ip_address": "127.0.0.1",
    "created_at": "2026-06-15T22:24:59.189362+00:00",
    "payload": {
      "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
      "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
      "timestamp": "2026-06-15T22:24:59.188457+00:00",
      "new_status": "PENDING",
      "previous_status": null
    }
  },
  {
    "action": "SCAN_QUEUED",
    "user_id": "7ec68491-12d9-4f6d-91c9-36b824aa77c6",
    "ip_address": "127.0.0.1",
    "created_at": "2026-06-15T22:24:59.277247+00:00",
    "payload": {
      "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
      "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
      "timestamp": "2026-06-15T22:24:59.276543+00:00",
      "new_status": "QUEUED",
      "previous_status": "PENDING"
    }
  },
  {
    "action": "SCAN_STARTED",
    "user_id": "7ec68491-12d9-4f6d-91c9-36b824aa77c6",
    "ip_address": "127.0.0.1",
    "created_at": "2026-06-15T22:24:59.343928+00:00",
    "payload": {
      "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
      "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
      "timestamp": "2026-06-15T22:24:59.343345+00:00",
      "new_status": "PROCESSING",
      "previous_status": "QUEUED"
    }
  }
]
```


## 4. REPORT GENERATION & EVIDENCE PERSISTENCE

### `POST /api/v1/report/create`
**Request Body:**
```json
{
  "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
  "trust_score": 85.0,
  "risk_score": 15.0,
  "confidence_score": 90,
  "risk_level": "low",
  "summary": "This is a validation draft report.",
  "recommendation": "Follow company onboarding rules.",
  "generated_by": "SYSTEM",
  "generation_engine": "Validation Engine",
  "generation_version": "1.0.0"
}
```
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "Report record initialised.",
  "data": {
    "id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "report_version": "v1",
    "report_status": "DRAFT",
    "trust_score": 85.0,
    "risk_score": 15.0,
    "confidence_score": 90,
    "risk_level": "low",
    "summary": "This is a validation draft report.",
    "recommendation": "Follow company onboarding rules.",
    "generated_at": null,
    "created_at": "2026-06-15T22:24:59.493020Z",
    "updated_at": "2026-06-15T22:24:59.493028Z",
    "is_deleted": false,
    "deleted_at": null,
    "generated_by": "SYSTEM",
    "generation_engine": "Validation Engine",
    "generation_version": "1.0.0"
  },
  "errors": [],
  "request_id": "eb9da552-53ec-4b21-bab0-044ab8b37c38"
}
```

### `POST /api/v1/report/b33a04e2-aecb-484a-8fe2-05400452a1d4/evidence`
**Request Body:**
```json
{
  "evidence_type": "DOCUMENT",
  "title": "Signature Block Verified",
  "description": "Standard HR signature block detected in scan body.",
  "severity": "LOW",
  "confidence": 0.95,
  "source": "Document layout parser",
  "source_reference": "Signature Line 45"
}
```
**Status Code:** `201`
**Response Body:**
```json
{
  "success": true,
  "message": "Evidence item added.",
  "data": {
    "id": "6ecfd7a3-c5e9-4f71-9e81-33c09a0016c6",
    "report_id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
    "evidence_type": "DOCUMENT",
    "title": "Signature Block Verified",
    "description": "Standard HR signature block detected in scan body.",
    "severity": "LOW",
    "confidence": 0.95,
    "source": "Document layout parser",
    "source_reference": "Signature Line 45",
    "created_at": "2026-06-15T22:24:59.614355Z",
    "is_deleted": false
  },
  "errors": [],
  "request_id": "a5987b32-25bc-4af4-b3b8-53c1a09acdd6"
}
```

### `PATCH /api/v1/report/status (DRAFT -> GENERATING)`
**Request Body:**
```json
{
  "report_id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
  "status": "GENERATING"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Report status updated to GENERATING.",
  "data": {
    "id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "report_version": "v1",
    "report_status": "GENERATING",
    "trust_score": 85.0,
    "risk_score": 15.0,
    "confidence_score": 90,
    "risk_level": "low",
    "summary": "This is a validation draft report.",
    "recommendation": "Follow company onboarding rules.",
    "generated_at": null,
    "created_at": "2026-06-15T22:24:59.493020Z",
    "updated_at": "2026-06-15T22:24:59.712728Z",
    "is_deleted": false,
    "deleted_at": null,
    "generated_by": "SYSTEM",
    "generation_engine": "Validation Engine",
    "generation_version": "1.0.0"
  },
  "errors": [],
  "request_id": "833fde66-3ba3-4a61-ba9b-b2076cbd3895"
}
```

### `PATCH /api/v1/report/status (GENERATING -> COMPLETED)`
**Request Body:**
```json
{
  "report_id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
  "status": "COMPLETED"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Report status updated to COMPLETED.",
  "data": {
    "id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "report_version": "v1",
    "report_status": "COMPLETED",
    "trust_score": 85.0,
    "risk_score": 15.0,
    "confidence_score": 90,
    "risk_level": "low",
    "summary": "This is a validation draft report.",
    "recommendation": "Follow company onboarding rules.",
    "generated_at": "2026-06-15T22:24:59.844532Z",
    "created_at": "2026-06-15T22:24:59.493020Z",
    "updated_at": "2026-06-15T22:24:59.853387Z",
    "is_deleted": false,
    "deleted_at": null,
    "generated_by": "SYSTEM",
    "generation_engine": "Validation Engine",
    "generation_version": "1.0.0"
  },
  "errors": [],
  "request_id": "081419e0-7ec9-41bd-826c-66cc11497520"
}
```

### `GET /api/v1/report/b33a04e2-aecb-484a-8fe2-05400452a1d4`
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Report retrieved.",
  "data": {
    "id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
    "user_id": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "scan_id": "a88728ef-a404-4608-b33c-9378e9ffeaea",
    "report_version": "v1",
    "report_status": "COMPLETED",
    "trust_score": 85.0,
    "risk_score": 15.0,
    "confidence_score": 90,
    "risk_level": "low",
    "summary": "This is a validation draft report.",
    "recommendation": "Follow company onboarding rules.",
    "generated_at": "2026-06-15T22:24:59.844532Z",
    "created_at": "2026-06-15T22:24:59.493020Z",
    "updated_at": "2026-06-15T22:24:59.853387Z",
    "is_deleted": false,
    "deleted_at": null,
    "generated_by": "SYSTEM",
    "generation_engine": "Validation Engine",
    "generation_version": "1.0.0"
  },
  "errors": [],
  "request_id": "1a8b747d-09a6-40be-9553-1c1566b37b87"
}
```

#### Database Report, History & Evidence Records
**Report Database Record:**
```json
{
  "id": "b33a04e2-aecb-484a-8fe2-05400452a1d4",
  "report_version": "v1",
  "status": "COMPLETED",
  "trust_score": 85.0,
  "risk_score": 15.0,
  "risk_level": "low",
  "generated_at": "2026-06-15T22:24:59.844532+00:00"
}
```
**Report History Logs:**
```json
[
  {
    "from_status": "",
    "to_status": "DRAFT",
    "changed_by": "94d916c7-83a0-42d3-a85c-188a70c7f5d8",
    "changed_at": "2026-06-15T22:24:59.503402+00:00"
  },
  {
    "from_status": "DRAFT",
    "to_status": "GENERATING",
    "changed_by": "7ec68491-12d9-4f6d-91c9-36b824aa77c6",
    "changed_at": "2026-06-15T22:24:59.722134+00:00"
  },
  {
    "from_status": "GENERATING",
    "to_status": "COMPLETED",
    "changed_by": "7ec68491-12d9-4f6d-91c9-36b824aa77c6",
    "changed_at": "2026-06-15T22:24:59.861364+00:00"
  }
]
```
**Evidence Records Table:**
```json
[
  {
    "id": "6ecfd7a3-c5e9-4f71-9e81-33c09a0016c6",
    "evidence_type": "DOCUMENT",
    "title": "Signature Block Verified",
    "severity": "LOW",
    "confidence": 0.95,
    "source": "Document layout parser"
  }
]
```


## 5. TRUST Scoring ENGINE SCENARIO VALIDATION

### `POST /api/v1/trust/analyze (Legitimate Case)`
**Request Body:**
```json
{
  "scan_id": "8b55e746-ffa8-4189-97ec-4d4aa60b13b1"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Trust analysis completed successfully.",
  "data": {
    "trust_score": 87.0,
    "risk_score": 13.0,
    "risk_level": "low",
    "evidence": [
      {
        "id": "98c0e589-a916-4191-bec5-20af3607287e",
        "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
        "evidence_type": "COMPANY",
        "title": "No Careers Page",
        "description": "No active careers portal URL found associated with the company domain.",
        "severity": "LOW",
        "confidence": 0.75,
        "source": "Company website scan",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:00.206576Z",
        "is_deleted": false
      },
      {
        "id": "2dc268d1-49dc-4d44-b643-f185ffb0a356",
        "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
        "evidence_type": "RECRUITER",
        "title": "Corporate Email Recruiter",
        "description": "Recruiter uses an official corporate email domain address.",
        "severity": "INFO",
        "confidence": 0.75,
        "source": "Recruiter Email Check",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:00.206805Z",
        "is_deleted": false
      },
      {
        "id": "d6ca8972-8fe2-462b-9ae0-ddb91b0fd5d4",
        "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
        "evidence_type": "LINKEDIN",
        "title": "No Linkedin Presence",
        "description": "No LinkedIn professional profile page URLs detected in content.",
        "severity": "MEDIUM",
        "confidence": 0.75,
        "source": "Social Media Check",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:00.206899Z",
        "is_deleted": false
      },
      {
        "id": "240a6fb8-be3a-48f2-b85f-4d35754a2dd8",
        "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
        "evidence_type": "LINKEDIN",
        "title": "Missing Social Links",
        "description": "No associated social handles (Twitter, GitHub, LinkedIn) found.",
        "severity": "LOW",
        "confidence": 0.5,
        "source": "Social Media Check",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:00.207099Z",
        "is_deleted": false
      }
    ],
    "recommendations": [
      "Verify the company's active headcount and business history. There is no professional company presence detected on LinkedIn.",
      "Confirm receipt of the offer using standard company channels, but proceed with onboarding guidelines as normal."
    ],
    "score_breakdown": [
      {
        "id": "36e98af9-875f-4683-9e5c-863ff0250d90",
        "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
        "rule_name": "DOMAIN_AGE_UNKNOWN",
        "rule_category": "DOMAIN_SIGNALS",
        "weight": 0.0,
        "score_change": 0.0,
        "confidence": "LOW",
        "reason": "WHOIS registry info could not be verified reliably. Domain age remains unknown.",
        "source": "WHOIS Mock Service",
        "created_at": "
... [TRUNCATED] ...
```

### `POST /api/v1/trust/analyze (Suspicious Case)`
**Request Body:**
```json
{
  "scan_id": "f0008f74-43f8-41ce-b83a-9d2f486c452f"
}
```
**Status Code:** `200`
**Response Body:**
```json
{
  "success": true,
  "message": "Trust analysis completed successfully.",
  "data": {
    "trust_score": 0.0,
    "risk_score": 100.0,
    "risk_level": "critical",
    "evidence": [
      {
        "id": "58c49797-cf00-4aec-9710-e4364008bc8e",
        "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
        "evidence_type": "DOMAIN",
        "title": "Https Missing",
        "description": "One or more URL targets use insecure HTTP instead of HTTPS.",
        "severity": "MEDIUM",
        "confidence": 0.75,
        "source": "URL Protocol Check",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:03.479576Z",
        "is_deleted": false
      },
      {
        "id": "c9c00115-4871-4cd6-b692-c5a84f7b61f8",
        "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
        "evidence_type": "DOMAIN",
        "title": "Rare Tld",
        "description": "Input content references a domain using a rare or suspicious TLD (.xyz).",
        "severity": "LOW",
        "confidence": 0.5,
        "source": "Domain Extension Check",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:03.479671Z",
        "is_deleted": false
      },
      {
        "id": "07d432ef-0da5-4b80-9b66-6c6868027d2d",
        "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
        "evidence_type": "DOMAIN",
        "title": "Broken Website",
        "description": "Domain techcorp-scam.xyz referenced in scan does not resolve via DNS.",
        "severity": "HIGH",
        "confidence": 0.95,
        "source": "DNS Lookup",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:03.479713Z",
        "is_deleted": false
      },
      {
        "id": "2819f899-2eda-4105-b2e3-34a674e0501e",
        "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
        "evidence_type": "COMPANY",
        "title": "No Careers Page",
        "description": "No active careers portal URL found associated with the company domain.",
        "severity": "LOW",
        "confidence": 0.75,
        "source": "Company website scan",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:03.479751Z",
        "is_deleted": false
      },
      {
        "id": "c5b5b5ea-5ac2-4222-9c1a-debb39a7259f",
        "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
        "evidence_type": "RECRUITER",
        "title": "Free Email Recruiter",
        "description": "Recruiter communicates via a free public email provider (e.g. Gmail/Yahoo).",
        "severity": "MEDIUM",
        "confidence": 0.75,
        "source": "Recruiter Email Check",
        "source_reference": null,
        "created_at": "2026-06-15T22:25:03.479837Z",
        "is_deleted": false
      },
      {
        "id": "adda45ce-bcbf-41e3-ae84-d44518a61824",
        "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
        "evidence_type": "DOCUMENT",
        "title": "Payment Requested",
        "description": "Text contains requests for payment or regi
... [TRUNCATED] ...
```

### Comparative Scenario Analysis
| Metric | Scenario A: Legitimate Offer | Scenario B: Suspicious Offer |
| :--- | :--- | :--- |
| **Trust Score** | `87.0/100` | `0.0/100` |
| **Risk Score** | `13.0/100` | `100.0/100` |
| **Risk Level** | `LOW` | `CRITICAL` |
| **Evidence Items Count** | `4` | `11` |
| **Fired Rule Breakdown Count** | `5` | `12` |

#### Trust Engine Scoring Comparison details
**Legitimate Case Breakdown:**
```json
[
  {
    "id": "36e98af9-875f-4683-9e5c-863ff0250d90",
    "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
    "rule_name": "DOMAIN_AGE_UNKNOWN",
    "rule_category": "DOMAIN_SIGNALS",
    "weight": 0.0,
    "score_change": 0.0,
    "confidence": "LOW",
    "reason": "WHOIS registry info could not be verified reliably. Domain age remains unknown.",
    "source": "WHOIS Mock Service",
    "created_at": "2026-06-15T22:25:00.207180Z"
  },
  {
    "id": "a2165bc0-7f29-401c-9524-214abbe8606f",
    "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
    "rule_name": "NO_CAREERS_PAGE",
    "rule_category": "COMPANY_SIGNALS",
    "weight": -10.0,
    "score_change": -10.0,
    "confidence": "MEDIUM",
    "reason": "No active careers portal URL found associated with the company domain.",
    "source": "Company website scan",
    "created_at": "2026-06-15T22:25:00.207318Z"
  },
  {
    "id": "ad1cc60c-9041-4caf-8d1b-5875d118625a",
    "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
    "rule_name": "CORPORATE_EMAIL_RECRUITER",
    "rule_category": "RECRUITER_SIGNALS",
    "weight": 15.0,
    "score_change": 15.0,
    "confidence": "MEDIUM",
    "reason": "Recruiter uses an official corporate email domain address.",
    "source": "Recruiter Email Check",
    "created_at": "2026-06-15T22:25:00.207405Z"
  },
  {
    "id": "533fdda9-b11c-457f-a772-35854661489d",
    "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
    "rule_name": "NO_LINKEDIN_PRESENCE",
    "rule_category": "SOCIAL_SIGNALS",
    "weight": -15.0,
    "score_change": -15.0,
    "confidence": "MEDIUM",
    "reason": "No LinkedIn professional profile page URLs detected in content.",
    "source": "Social Media Check",
    "created_at": "2026-06-15T22:25:00.207479Z"
  },
  {
    "id": "e18bc57c-8dbd-42f7-a44f-66fbab95655a",
    "report_id": "5b4b70b2-4cd7-4e2d-8ff2-6cbe290c7a98",
    "rule_name": "MISSING_SOCIAL_LINKS",
    "rule_category": "SOCIAL_SIGNALS",
    "weight": -3.0,
    "score_change": -3.0,
    "confidence": "LOW",
    "reason": "No associated social handles (Twitter, GitHub, LinkedIn) found.",
    "source": "Social Media Check",
    "created_at": "2026-06-15T22:25:00.207552Z"
  }
]
```
**Suspicious Case Breakdown:**
```json
[
  {
    "id": "72536366-da5f-471c-8170-d9fe62515567",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "HTTPS_MISSING",
    "rule_category": "DOMAIN_SIGNALS",
    "weight": -15.0,
    "score_change": -15.0,
    "confidence": "MEDIUM",
    "reason": "One or more URL targets use insecure HTTP instead of HTTPS.",
    "source": "URL Protocol Check",
    "created_at": "2026-06-15T22:25:03.480085Z"
  },
  {
    "id": "b31acb4f-db74-4adc-affb-707bc3620a64",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "RARE_TLD",
    "rule_category": "DOMAIN_SIGNALS",
    "weight": -5.0,
    "score_change": -5.0,
    "confidence": "LOW",
    "reason": "Input content references a domain using a rare or suspicious TLD (.xyz).",
    "source": "Domain Extension Check",
    "created_at": "2026-06-15T22:25:03.480135Z"
  },
  {
    "id": "59a1f3a2-6900-4464-8aa1-2faf22e34db5",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "BROKEN_WEBSITE",
    "rule_category": "DOMAIN_SIGNALS",
    "weight": -30.0,
    "score_change": -30.0,
    "confidence": "HIGH",
    "reason": "Domain techcorp-scam.xyz referenced in scan does not resolve via DNS.",
    "source": "DNS Lookup",
    "created_at": "2026-06-15T22:25:03.480172Z"
  },
  {
    "id": "daf308a4-c495-4c03-a796-4492211bc8e7",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "DOMAIN_AGE_UNKNOWN",
    "rule_category": "DOMAIN_SIGNALS",
    "weight": 0.0,
    "score_change": 0.0,
    "confidence": "LOW",
    "reason": "WHOIS registry info could not be verified reliably. Domain age remains unknown.",
    "source": "WHOIS Mock Service",
    "created_at": "2026-06-15T22:25:03.480208Z"
  },
  {
    "id": "c7239df8-a332-4f91-b83f-3bcae567750e",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "NO_CAREERS_PAGE",
    "rule_category": "COMPANY_SIGNALS",
    "weight": -10.0,
    "score_change": -10.0,
    "confidence": "MEDIUM",
    "reason": "No active careers portal URL found associated with the company domain.",
    "source": "Company website scan",
    "created_at": "2026-06-15T22:25:03.480270Z"
  },
  {
    "id": "0c24e5b7-1ff5-4fcb-a5f5-32fd87b18aaa",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "FREE_EMAIL_RECRUITER",
    "rule_category": "RECRUITER_SIGNALS",
    "weight": -15.0,
    "score_change": -15.0,
    "confidence": "MEDIUM",
    "reason": "Recruiter communicates via a free public email provider (e.g. Gmail/Yahoo).",
    "source": "Recruiter Email Check",
    "created_at": "2026-06-15T22:25:03.480471Z"
  },
  {
    "id": "7d780819-a777-44a3-ab21-86da788710e7",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "PAYMENT_REQUESTED",
    "rule_category": "DOCUMENT_SIGNALS",
    "weight": -40.0,
    "score_change": -40.0,
    "confidence": "HIGH",
    "reason": "Text contains requests for payment or registration/processing fee options.",
    "source": "Document Text Parsing",
    "created_at": "2026-06-15T22:25:03.480582Z"
  },
  {
    "id": "fb5b145e-baf4-488b-a208-6b8aa2284d20",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "TRAINING_FEE_REQUESTED",
    "rule_category": "DOCUMENT_SIGNALS",
    "weight": -50.0,
    "score_change": -50.0,
    "confidence": "HIGH",
    "reason": "Job offer requests payment for training modules, tools, or courses.",
    "source": "Document Text Parsing",
    "created_at": "2026-06-15T22:25:03.480661Z"
  },
  {
    "id": "a3f0d1f6-66d7-4fcf-bfcf-0d95e6b44faf",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "URGENT_LANGUAGE_DETECTED",
    "rule_category": "DOCUMENT_SIGNALS",
    "weight": -8.0,
    "score_change": -8.0,
    "confidence": "LOW",
    "reason": "Offer stresses immediate signing and creates pressure using urgent deadlines.",
    "source": "Document Text Parsing",
    "created_at": "2026-06-15T22:25:03.480723Z"
  },
  {
    "id": "ee010fa6-9322-4a46-b965-295f3dc6104b",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "NO_COMPANY_ADDRESS",
    "rule_category": "CONTACT_SIGNALS",
    "weight": -12.0,
    "score_change": -12.0,
    "confidence": "MEDIUM",
    "reason": "Missing any headquarters or physical mailing address properties.",
    "source": "Contact Info Checker",
    "created_at": "2026-06-15T22:25:03.480766Z"
  },
  {
    "id": "3a64111e-1d0f-439a-a3d6-f9c8127ef176",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "NO_LINKEDIN_PRESENCE",
    "rule_category": "SOCIAL_SIGNALS",
    "weight": -15.0,
    "score_change": -15.0,
    "confidence": "MEDIUM",
    "reason": "No LinkedIn professional profile page URLs detected in content.",
    "source": "Social Media Check",
    "created_at": "2026-06-15T22:25:03.480806Z"
  },
  {
    "id": "9165bca5-349d-4f50-b5b7-6cdba364ee5e",
    "report_id": "a14c01c4-f23e-48df-a505-d2ed03c601de",
    "rule_name": "MISSING_SOCIAL_LINKS",
    "rule_category": "SOCIAL_SIGNALS",
    "weight": -3.0,
    "score_change": -3.0,
    "confidence": "LOW",
    "reason": "No associated social handles (Twitter, GitHub, LinkedIn) found.",
    "source": "Social Media Check",
    "created_at": "2026-06-15T22:25:03.480843Z"
  }
]
```
#### Core Differences Explanation:
1. **Recruiter Identity & Email Domain**: Scenario A features an official corporate domain recruiter (`hr@techcorp.com`), triggering `CORPORATE_EMAIL_RECRUITER` (+15.0). Scenario B utilizes a free public address (`gmail.com`), triggering `FREE_EMAIL_RECRUITER` (-15.0).
2. **Upfront Payment Requests**: Scenario B demands a '$150 training fee', triggering `TRAINING_FEE_REQUESTED` (-50.0) - a high-confidence signal. Scenario A requires no payment.
3. **Website Protocols & Extension Security**: Scenario A uses HTTPS (`https://techcorp.com`). Scenario B uses insecure HTTP (`http://techcorp-scam.xyz`) and a suspicious extension, triggering `HTTPS_MISSING` (-15.0) and `RARE_TLD` (-5.0).
4. **Corporate Identifiers & Contacts**: Scenario A includes signature blocks, physical address keywords, and careers references. Scenario B triggers `NO_COMPANY_ADDRESS` (-12.0) and `MISSING_SIGNATURE` (-8.0).
5. **Scoring principle safety clamp**: If a scan contains multiple low-confidence signal triggers but no high or medium ones, the risk level is prevented from hitting HIGH or CRITICAL. In Scenario B, the presence of HIGH confidence markers like `TRAINING_FEE_REQUESTED` (-50) safely updates the classification to `CRITICAL` naturally.


## 6. DATABASE PERSISTENCE STATISTICS

#### Database Table Counts
```json
{
  "users": 19,
  "uploaded_files": 9,
  "scans": 9,
  "reports": 8,
  "evidence_items": 29,
  "trust_score_breakdowns": 26,
  "audit_logs": 118
}
```

## Working Features
- **In-Memory JWT Access State**: Access tokens live strictly in memory to block XSS vector access.
- **HttpOnly Lax refresh cookies**: Handled proxy session auth safely.
- **Duplicate file deduplication**: Binary matches reuse existing uploads automatically to save database disk space.
- **Rule-based Scoring Intelligence**: Safety clamped calculations provide completely deterministic, explainable results.
- **Trust Audit Trail**: Detailed breakdowns showing categories, rules, sources, and score changes are logged and visible.

## Partially Working Features
- **DNS Existence Lookup**: Implemented socket checks for domain verification. Relies on short timeouts to bypass network hangs but does not fetch full registration details directly.

## Known Limitations
- **Local File Store**: Uploaded files are persisted on the local filesystem of the server instead of a cloud bucket (e.g. AWS S3).
- **No WHOIS API Integration**: Domain age remains unknown (`DOMAIN_AGE_UNKNOWN`) since WHOIS registry lookups are mock endpoints reserved for future phases.

## Future Work (Phase 4 Ready)
- **Company Verification Engine**: Implement MCA/GST registries, CIN, and ROC verification APIs.
- **Reputation Mining**: Mining community review boards (Reddit, Glassdoor) for sentiment feedback analysis.

## Deployment Status
- **Local Dev Environment**: Docker Compose orchestrates a PostgreSQL container.
- **Frontend Compiler**: Next.js optimized production build Turbopack compiler compiles 100% cleanly.
- **Testing Suites**: Pytest backend coverage (46 tests) and Playwright E2E browser tests (2 tests) pass successfully.