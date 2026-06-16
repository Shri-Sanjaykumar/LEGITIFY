# LEGITIFY API Audit Document

This document lists and audits all FastAPI backend routes implemented in LEGITIFY. It verifies route existence, HTTP methods, authentication enforcement, dependency resolution, and schema details.

---

## 1. Authentication Endpoints
Mounted under prefix `/api/v1/auth`

### Register User
* **Route**: `POST /api/v1/auth/register`
* **Handler Name**: `register`
* **Dependencies**: `get_db`
* **Auth Enforced**: No (Public)
* **Request Schema**: `UserCreate` (email, password, full_name, role)
* **Response Schema**: `StandardResponse` containing `UserOut`

### Login / Token Generation
* **Route**: `POST /api/v1/auth/login`
* **Handler Name**: `login`
* **Dependencies**: `OAuth2PasswordRequestForm`, `get_db`
* **Auth Enforced**: No (Public credentials validation)
* **Request Schema**: `form-data` (username, password)
* **Response Schema**: `StandardResponse` containing `Token` (access_token, refresh_token)

### Refresh Token
* **Route**: `POST /api/v1/auth/refresh`
* **Handler Name**: `refresh`
* **Dependencies**: `get_db`
* **Auth Enforced**: No (Validates refresh token payload)
* **Request Schema**: `TokenRefreshRequest` (refresh_token)
* **Response Schema**: `StandardResponse` containing `Token`

### Logout User
* **Route**: `POST /api/v1/auth/logout`
* **Handler Name**: `logout`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse` (success confirmation)

### Get Current User Details
* **Route**: `GET /api/v1/auth/me`
* **Handler Name**: `get_me`
* **Dependencies**: `get_current_user`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse` containing `UserOut`

---

## 2. Scan Endpoints
Mounted under prefix `/api/v1/scan`

### File Upload
* **Route**: `POST /api/v1/scan/upload`
* **Handler Name**: `upload_file`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Body**: `multipart/form-data` (file)
* **Response Schema**: `StandardResponse` containing `UploadedFileOut`

### Fetch Uploaded File
* **Route**: `GET /api/v1/scan/file/{id}`
* **Handler Name**: `get_file`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT; owner or admin validation)
* **Response**: `FileResponse` (raw file stream)

### Initialize Scan Record
* **Route**: `POST /api/v1/scan/create`
* **Handler Name**: `create_scan`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `ScanCreate` (scan_type, scan_source, raw_input_text, file_id, priority)
* **Response Schema**: `StandardResponse` containing `ScanOut`

### Fetch Scan History
* **Route**: `GET /api/v1/scan/history`
* **Handler Name**: `get_scan_history`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT; returns user's scans only)
* **Query Parameters**: `page`, `limit`, `sort`, `order`, `status`, `scan_type`, `start_date`, `end_date`
* **Response Schema**: `StandardResponse` containing scans count and lists

### Update Scan Status (Admin/Investigator)
* **Route**: `PATCH /api/v1/scan/status`
* **Handler Name**: `patch_scan_status`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT; Admin or Investigator role checker)
* **Request Schema**: `ScanStatusPatch` (scan_id, status, error_code, error_message)
* **Response Schema**: `StandardResponse`

### Fetch Scan Details
* **Route**: `GET /api/v1/scan/{id}`
* **Handler Name**: `get_scan_details`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT; owner or privileged)
* **Response Schema**: `StandardResponse` containing `ScanOut`

---

## 3. Report Endpoints
Mounted under prefix `/api/v1/report`

### Create Report
* **Route**: `POST /api/v1/report/create`
* **Handler Name**: `create_report`
* **Dependencies**: `get_db`, `RoleChecker` (all roles)
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `ReportCreate` (scan_id, trust_score, risk_score, confidence_score, risk_level, summary, recommendation, etc.)
* **Response Schema**: `StandardResponse` containing `ReportOut`

### Fetch Report Details
* **Route**: `GET /api/v1/report/{report_id}`
* **Handler Name**: `get_report`
* **Dependencies**: `get_db`, `RoleChecker` (all roles)
* **Auth Enforced**: Yes (Bearer JWT; owner or privileged)
* **Response Schema**: `StandardResponse` containing `ReportOut`

### Fetch Reports History
* **Route**: `GET /api/v1/report`
* **Handler Name**: `get_report_history`
* **Dependencies**: `get_db`, `RoleChecker` (all roles)
* **Auth Enforced**: Yes (Bearer JWT; filters by user ownership for students)
* **Query Parameters**: `page`, `limit`, `sort`, `order`, `report_status`, `risk_level`, `min_trust_score`, etc.
* **Response Schema**: `StandardResponse`

### Update Report Status (Admin/Investigator)
* **Route**: `PATCH /api/v1/report/status`
* **Handler Name**: `patch_report_status`
* **Dependencies**: `get_db`, `RoleChecker` (privileged roles: admin/investigator)
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `ReportStatusPatch` (report_id, status)
* **Response Schema**: `StandardResponse`

### Fetch Report Evidence Items
* **Route**: `GET /api/v1/report/{report_id}/evidence`
* **Handler Name**: `get_evidence`
* **Dependencies**: `get_db`, `RoleChecker` (all roles)
* **Auth Enforced**: Yes (Bearer JWT; owner or privileged)
* **Response Schema**: `StandardResponse`

### Fetch Report Score Breakdowns
* **Route**: `GET /api/v1/report/{report_id}/breakdown`
* **Handler Name**: `get_breakdown`
* **Dependencies**: `get_db`, `RoleChecker` (all roles)
* **Auth Enforced**: Yes (Bearer JWT; owner or privileged)
* **Response Schema**: `StandardResponse`

### Add Evidence Item (Admin/Investigator)
* **Route**: `POST /api/v1/report/{report_id}/evidence`
* **Handler Name**: `add_evidence`
* **Dependencies**: `get_db`, `RoleChecker` (privileged roles: admin/investigator)
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `EvidenceItemCreate`
* **Response Schema**: `StandardResponse`

### Export Report (Placeholder)
* **Route**: `GET /api/v1/report/{report_id}/export`
* **Handler Name**: `export_report`
* **Dependencies**: `get_db`, `RoleChecker` (all roles)
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse` (returns placeholder error status)

---

## 4. Trust Engine Endpoints
Mounted under prefix `/api/v1/trust`

### Execute Trust Analysis
* **Route**: `POST /api/v1/trust/analyze`
* **Handler Name**: `analyze_trust`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT; owner or privileged)
* **Request Schema**: `TrustAnalysisRequest` (scan_id)
* **Response Schema**: `StandardResponse` containing `TrustAnalysisOut`

---

## 5. Company Verification Endpoints
Mounted under prefix `/api/v1/company`

### Trigger Company Verification
* **Route**: `POST /api/v1/company/verify`
* **Handler Name**: `verify_company`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `CompanyVerificationRequest` (company_name, website, location)
* **Response Schema**: `StandardResponse` containing `CompanyVerificationOut`

### Fetch Company History
* **Route**: `GET /api/v1/company/history`
* **Handler Name**: `get_verification_history`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Verification details
* **Route**: `GET /api/v1/company/{verification_id}`
* **Handler Name**: `get_verification_by_id`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Verification Breakdown rules
* **Route**: `GET /api/v1/company/{verification_id}/breakdown`
* **Handler Name**: `get_verification_breakdown`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

---

## 6. Domain Intelligence Endpoints
Mounted under prefix `/api/v1/domain`

### Trigger Domain Verification
* **Route**: `POST /api/v1/domain/verify`
* **Handler Name**: `verify_domain`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `DomainVerificationRequest` (domain)
* **Response Schema**: `StandardResponse` containing `DomainVerificationOut`

### Fetch Domain History
* **Route**: `GET /api/v1/domain/history`
* **Handler Name**: `get_domain_history`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Domain Details
* **Route**: `GET /api/v1/domain/{verification_id}`
* **Handler Name**: `get_domain_by_id`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Domain Breakdown
* **Route**: `GET /api/v1/domain/{verification_id}/breakdown`
* **Handler Name**: `get_domain_breakdown`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Domain Reputation Snapshots History
* **Route**: `GET /api/v1/domain/reputation/{domain}`
* **Handler Name**: `get_domain_reputation_history`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

---

## 7. Recruiter Verification Endpoints
Mounted under prefix `/api/v1/recruiter`

### Trigger Recruiter Verification
* **Route**: `POST /api/v1/recruiter/verify`
* **Handler Name**: `verify_recruiter`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Request Schema**: `RecruiterVerificationRequest` (recruiter_name, recruiter_email, claimed_company, recruiter_phone, recruiter_role, linkedin_profile_url)
* **Response Schema**: `StandardResponse` containing `RecruiterVerificationOut`

### Fetch Recruiter History
* **Route**: `GET /api/v1/recruiter/history`
* **Handler Name**: `get_recruiter_history`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Recruiter Details
* **Route**: `GET /api/v1/recruiter/{verification_id}`
* **Handler Name**: `get_recruiter_by_id`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Recruiter Breakdown
* **Route**: `GET /api/v1/recruiter/{verification_id}/breakdown`
* **Handler Name**: `get_recruiter_breakdown`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

### Fetch Recruiter Reputation Snapshots History
* **Route**: `GET /api/v1/recruiter/reputation/{email}`
* **Handler Name**: `get_recruiter_reputation_history`
* **Dependencies**: `get_current_user`, `get_db`
* **Auth Enforced**: Yes (Bearer JWT)
* **Response Schema**: `StandardResponse`

---

## 8. System Endpoints

### Health Status
* **Route**: `GET /api/v1/health`
* **Handler Name**: `check_health`
* **Dependencies**: None
* **Auth Enforced**: No (Public)
* **Response**: System status indicators (JSON)

### Welcome / Docs Redirect
* **Route**: `GET /`
* **Handler Name**: `redirect_to_docs`
* **Dependencies**: None
* **Auth Enforced**: No (Public)
* **Response**: Redirect or Welcome message (JSON)
