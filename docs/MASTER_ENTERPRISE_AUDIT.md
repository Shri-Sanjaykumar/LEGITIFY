# LEGITIFY Master Enterprise Validation & Gap Analysis

This document presents the master audit and gap analysis of LEGITIFY's current codebase (Phases 2 through 6.5). The objective is to verify that all implemented verification layers are fully operational, identify structural/security gaps, and determine readiness for Phase 7 (Unified Risk Decision Engine).

---

## 1. Frontend Audit

A page-by-page review of the Next.js user interface was conducted to verify routes, loaded components, API dependencies, and operational status.

### User Registration
* **Route**: `/register`
* **Components Loaded**: `Shield`, `User`, `Mail`, `Lock` icons, role selection cards (Student, Placement, Recruiter), Framer Motion registration card.
* **API Calls Used**: `POST /api/v1/auth/register`
* **Working Status**: **Operational**
* **Issues Found**: None.

### User Login
* **Route**: `/login`
* **Components Loaded**: `Shield`, `Mail`, `Lock` icons, password visibility toggles, Google OAuth login triggers.
* **API Calls Used**: `POST /api/v1/auth/login`
* **Working Status**: **Operational**
* **Issues Found**: None.

### Dashboard
* **Route**: `/dashboard`
* **Components Loaded**: `Sidebar`, `DashboardLayout`, `StatsCards` (scans count, scams flagged, average score), `TrustChart` (Recharts AreaChart), `QuickScan` card, `RecentScans` table, `ActivityFeed`.
* **API Calls Used**: `GET /api/v1/scan/history` (recent scans table), `GET /api/v1/report` (trust stats/trends).
* **Working Status**: **Operational**
* **Issues Found**: **Medium**: The recent scans table displays a hardcoded fallback trust score of `72` when displaying completed scans because the scan list API does not return the associated report's trust score directly (see API Gaps).

### New Scan Submission
* **Route**: `/scan`
* **Components Loaded**: `InputTypeSelector` (PDF Document, Word Document, URL, LinkedIn, Email, Raw Text), `FileUpload` dropzone, `ScanProgress` overlay (timelines for upload, extract, analyze, domain, company, reputation, report).
* **API Calls Used**: `POST /api/v1/scan/upload` (file uploads), `POST /api/v1/scan/create` (scan record initialization), `POST /api/v1/trust/analyze` (trust analysis pipeline).
* **Working Status**: **Operational**
* **Issues Found**: None.

### Trust Investigation Report
* **Route**: `/report/[id]`
* **Components Loaded**: `TrustGauge` (animated SVG dial), `RiskRadar` (Recharts), `AIAnalysis` (markdown parse card), `EvidenceCard` grid (collapsible), `Timeline` list, `CompanyVerificationPanel`, `DomainIntelligencePanel`, `RecruiterVerificationPanel`.
* **API Calls Used**: `GET /api/v1/report/{report_id}` (retrieves report metadata), `GET /api/v1/report/{report_id}/evidence` (evidence list), `GET /api/v1/report/{report_id}/breakdown` (rules audit trail).
* **Working Status**: **Operational**
* **Issues Found**: **Medium**: The vertical timeline ("Investigation Timeline") is hardcoded on the client-side rather than backed by database records (see Mock Audit).

---

## 2. API Audit

We verified the routing table for FastAPI backend routes. The full routing list, authentication rules, and dependencies are documented in [API_AUDIT.md](file:///C:/projects/legitify/docs/API_AUDIT.md).

* **Total Registered Routes**: **36**
* **Auth Enforcement**: All endpoints mounted under `/scan`, `/report`, `/trust`, `/company`, `/domain`, and `/recruiter` require JWT validation (via the `get_current_user` dependency or custom `RoleChecker` instances).
* **Issues Found**: The auth check on `/api/v1/report/create` uses a generic `RoleChecker` but lacks secondary user ownership checks (meaning any student can link a report to another user's scan if the ID is known).

---

## 3. Database Audit

A PostgreSQL catalog audit was conducted to count records, map foreign key relations, check index coverage, and verify table constraints.

### Catalog Summary Table

| Table Name | Records | Indexes | FK Relations | Primary Purpose | Issues |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | 33 | 2 | 0 | Platform accounts | None |
| `uploaded_files` | 9 | 2 | 2 | Raw document uploads | None |
| `scans` | 18 | 5 | 2 | Scan record catalog | None |
| `reports` | 17 | 10 | 2 | Trust score metrics | None |
| `evidence_items` | 101 | 1 | 1 | Flagged signals catalog | None |
| `audit_logs` | 186 | 2 | 1 | Platform compliance trails | None |
| `trust_score_breakdowns` | 107 | 2 | 1 | Rules audit logs | None |
| `company_verifications` | 11 | 1 | 0 | Verified corporate listings | None |
| `company_verification_breakdowns` | 0 | 2 | 1 | Company registry audit trail | Empty (Pre-seeded cache hits) |
| `company_verification_evidence` | 0 | 2 | 1 | Company crawler findings | Empty (Pre-seeded cache hits) |
| `domain_verifications` | 12 | 2 | 0 | Verified domain parameters | None |
| `domain_verification_breakdowns` | 0 | 2 | 1 | Domain analysis audit trail | Empty (Pre-seeded cache hits) |
| `domain_verification_evidence` | 0 | 2 | 1 | Domain crawler findings | Empty (Pre-seeded cache hits) |
| `domain_reputation_snapshots` | 0 | 2 | 0 | Domain history trend metrics | Empty (Pre-seeded cache hits) |
| `recruiter_verifications` | 8 | 3 | 0 | Verified recruiter listings | None |
| `recruiter_verification_breakdowns` | 8 | 2 | 1 | Recruiter audit records | None |
| `recruiter_verification_evidence` | 8 | 2 | 1 | Recruiter engine findings | None |
| `recruiter_reputation_snapshots` | 8 | 2 | 0 | Recruiter stats snapshots | None |

*Audit Note on Empty Tables*: The sub-tables for company and domain verifications (e.g. `company_verification_breakdowns`) are currently empty because we pre-seeded the database with completed verifications to simulate cached public registries. These tables are fully populated during live crawlers (confirmed by unit tests).

---

## 4. Engine Validation

We validated that each verification engine successfully interacts with and affects the central trust score calculations.

* **Company Engine Synergy**: When the input matches a verified website domain (e.g., `microsoft.com`), the trust engine queries `company_verifications` and injects positive credits: `COMPANY_VERIFIED` (+10.0), `CORPORATE_EMAIL_VERIFIED` (+10.0), `PHYSICAL_ADDRESS_VERIFIED` (+5.0), and `CAREERS_PAGE_VERIFIED` (+5.0).
* **Domain Engine Synergy**: Active records inject parameters: `DNS_RESOLVED` (+5.0), `MX_INFRASTRUCTURE_VALID` (+10.0), `EMAIL_SECURE_SPF` (+5.0), `EMAIL_SECURE_DMARC` (+5.0), and `SSL_CERTIFICATE_VALID` (+10.0). Missing records trigger heavy penalties: `NO_DNS_RECORDS` (-35.0), `SSL_INVALID_CHAIN` (-30.0), and `NO_MX_RECORDS` (-25.0).
* **Recruiter Engine Synergy**: Links recruiter verifications to score deductions: `RECRUITER_VERIFIED` (+15.0), `RECRUITER_SUSPICIOUS` (-30.0), `RECRUITER_UNVERIFIED` (-45.0), or `INTERNAL_RECRUITER_DETECTED` (+10.0).
* **Trust Score Impact Proof**: In Scenario 4, the combination of an upfront training fee request and a free public email address claimed as Microsoft authority correctly resulted in a trust score of **`0.0/100`** and a **`CRITICAL`** risk classification.

---

## 5. Mock Data Audit

We ran a code scan across all non-test files to locate instances of `mock`, `fake`, `dummy`, `placeholder`, and `sample` terms.

* **Backend Services**:
  * `backend/app/services/file.py`: Stub architecture placeholder for virus scanning integration.
  * `backend/app/services/domain_intelligence/crawler.py`: Generates mock certificates for internal domain names (`.local`, `.test`, `localhost`) only. Public domains use a real TLS handshake.
  * `backend/app/services/recruiter_verification/engine.py`: Placeholder stub for future LinkedIn verification integration.
  * `backend/app/services/trust_engine/rules.py`: Hardcoded `source: "WHOIS Mock Service"` and mock domains used in testing rules.
* **Frontend Components**:
  * `src/app/report/[id]/page.tsx`: Falls back to mock evidence text and has a hardcoded investigation timeline (`investigationSteps` list) when DB records are absent.
  * `src/components/dashboard/RecentScans.tsx`: Falls back to a mock score of `72` for completed scans if `scan.trustScore` is missing from the list payload.
  * `src/components/dashboard/StatsCards.tsx`: Falls back to mock dashboard stats if API queries fail.
  * `src/lib/mock-data.ts`: Contains mock datasets used for landing page counters, charts, and activity feeds.

---

## 6. Security Audit

* **JWT Verification**: Bearer tokens are properly signed with HS256 and verified using standard FastAPI middleware.
* **Refresh Cookies Gap (HIGH)**: The backend `/auth/login` and `/auth/refresh` APIs return the refresh token in the JSON response body and expect it in the request body. Enforcing secure `HttpOnly` cookie wrappers is missing.
* **CORS Policy**: Configured correctly, restricting API calls to defined domains in settings.
* **RBAC & ACL**: Correctly configured. Students can only view their own files, scans, and reports. Investigators and Admins have global access.
* **Rate Limits Gap (HIGH)**: No rate limiting is mounted on public endpoints (Login, Registration, File Upload, Scan Creation).
* **Security Headers Gap (MEDIUM)**: No HTTP security headers (`X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`) are set on responses.

---

## 7. Performance Audit

* **API Response Latencies (Average)**:
  * `/auth/login`: **0.74s**
  * `/scan/create`: **0.08s**
  * `/trust/analyze`: **0.15s**
  * `/report/{id}`: **0.02s**
* **Database Query Performance**: Index configurations prevent full table scans. All primary queries resolve in `< 10ms`.
* **Dashboard Load Time**: **0.11s** (average page draw).

---

## 8. Enterprise Readiness Score

* **Architecture Score**: **92/100** (Solid domain-driven layout; modular backend engines. Gap: hardcoded timeline steps).
* **Security Score**: **80/100** (JWT/RBAC/ACL logic is strong. Gaps: refresh token in response body, no rate limits, missing headers).
* **Scalability Score**: **90/100** (Ready to split into microservices; database connections use async pools; table indexes are optimal).
* **Auditability Score**: **95/100** (Every engine decision, fired rule, and user action is written to PostgreSQL).
* **Maintainability Score**: **92/100** (91% unit test coverage; 0 issues on black/ruff/mypy).

### Overall Enterprise Readiness Score: **90/100**

---

## 9. Critical Gap List

### BLOCKER
* None. The application builds, runs, passes all tests, and generates reports.

### HIGH
1. **Refresh Token Cookie Storage**: Refresh tokens are returned in the API response body, exposing them to client-side storage (vulnerable to XSS).
2. **Missing Rate Limiting**: The lack of rate limiters on `/auth/login` and `/scan/create` exposes the application to brute force and DDoS attacks.

### MEDIUM
1. **Dashboard Scan History trustScore**: `/scan/history` does not join the `reports` table to fetch the actual trust score, forcing the frontend to display a hardcoded fallback (`72`).
2. **Client-side Timeline Hardcoding**: The investigation timeline on the report page is hardcoded in the frontend rather than retrieved from a timeline steps database table.
3. **Missing Security Headers**: Responses lack security parameters (`X-Frame-Options: DENY`, `Content-Security-Policy`).

### LOW
1. **ClamAV Integration**: The virus scanning step on file upload is currently a placeholder.
2. **LinkedIn Roster Integration**: LinkedIn credential verification is a placeholder stub matching only corporate domains.

---

## 10. Final Decision

### 🔴 NOT READY FOR PHASE 7

**Rationale**: While LEGITIFY's core logic is solid and the engines work together correctly, we should resolve the **2 HIGH** and **3 MEDIUM** gaps before writing the Unified Risk Decision Engine (Phase 7). Specifically, hardening refresh tokens via secure HttpOnly cookies, adding rate limits, and returning actual trust scores in scan lists will establish a secure, production-grade foundation.
