# LEGITIFY Project Handoff

This document acts as a comprehensive handoff file to guide incoming engineering agents in resuming development on **LEGITIFY**, specifically beginning with **Task 9: Frontend Integration**.

---

## 1. Current Architecture

LEGITIFY is an AI-powered trust intelligence platform structured as a modular monolith split into two main layers:

### 1.1 Backend
- **Framework**: FastAPI (Python 3.12+)
- **Database ORM**: SQLAlchemy 2.0 (using asynchronous engine/sessions via `asyncpg`)
- **Migrations**: Alembic
- **Testing**: pytest (with async support via `anyio` / `pytest-asyncio` / `pytest-cov`)
- **Key Modules**:
  - `app/api/endpoints/`: Defines REST endpoints.
  - `app/core/`: Security (bcrypt hashing, Jose JWT), system config, and structured logging.
  - `app/models/`: Database tables (Declarative mappings).
  - `app/services/`: File upload operations (magic byte detection, deduplication), scan and report state machines.

### 1.2 Frontend
- **Framework**: Next.js 16.2.9 (App Router) & React 19.2.4
- **Styling**: Tailwind CSS & Framer Motion
- **State Management**: Zustand (v5)
- **Charts**: Recharts
- **Components**: Built with design aesthetics supporting a premium dark mode first interface, custom icons, glassmorphism card styling, animated statistics counters, and interactive dashboards.

---

## 2. Completed Tasks

The following modules have been completed, tested, and verified:
- **Phase 0 Architecture**: Core architecture definitions and specifications.
- **Phase 1 Frontend MVP**: Interactive visual mock pages and layouts (Landing page, Dashboard, New Scan form, Report details, Login, Register).
- **Task 5 Authentication**: Secure password hashing, JWT creation (access token valid for 15 minutes, refresh token valid for 7 days), active session tracking in `sessions` table.
- **Task 6 Upload Service**: Hardened file upload service featuring file extension filtering, MIME validation, magic byte checking (against whitelisted signatures like PDF, DOCX, DOC, TXT, PNG, JPG), path traversal sanitization, and SHA-256 deduplication.
- **Task 7 Scan Persistence**: Persistent scan records utilizing UUID keys. Includes scan metadata (`scan_version`, `scan_source`, `priority`, `retry_count`), ACL check dependencies to verify file/scan ownership, and transition checks through `ScanStateMachine`.
- **Task 8 Report Persistence**: Immutable report snapshots for completed states, versioning engine (e.g. `v1`, `v2`, `v3` for re-runs instead of updates), and validation checks for scores (trust, risk, confidence ranges between `0` and `100`, evidence confidence between `0.0` and `1.0`).

---

## 3. Database Tables

The database schema contains the following PostgreSQL tables:

1. **`users`**: Stores user credentials, hashed passwords, roles (`student`, `faculty`, `admin`, `investigator`), and soft delete flags.
2. **`sessions`**: Manages active sessions, linking users to IP address, user agent, expiration times, and the JWT correlation ID.
3. **`uploaded_files`**: Tracks metadata for uploaded documents, files' local paths, SHA-256 hashes, virus scan status, integrity checks, and self-referential duplicate markings.
4. **`scans`**: Tracks verification inputs (file, URL, text), status (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), versioning, source types, priority, retry counts, timing, and error details.
5. **`reports`**: Records analysis results, trust score, risk score, confidence score, risk level classification, markdown-friendly AI investigation summaries, recommendations, version identifier, and immutability lock state.
6. **`evidence_items`**: Individual evidence files and findings supporting a report, classified by severity (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), source type, and confidence score.
7. **`report_history`**: Audit trail documenting every state transition of a report.
8. **`audit_logs`**: Centralized, read-only audit logs recording client IP addresses, action keywords, and metadata payloads.

---

## 4. API Endpoints

All responses match the standardized JSON envelope:
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "errors": [],
  "request_id": "<UUID>"
}
```

### 4.1 Authentication
- `POST /api/v1/auth/register`: Register new users.
- `POST /api/v1/auth/login`: Authenticate and obtain JWT access/refresh tokens.
- `POST /api/v1/auth/refresh`: Refresh expired access tokens using a valid refresh token.

### 4.2 Scans & Uploads
- `POST /api/v1/scan/upload`: Upload file (e.g., PDF, DOCX, TXT) and store on disk with integrity validation. Returns file ID.
- `GET /api/v1/scan/file/{id}`: Serve the raw uploaded file content (with ownership/ACL validation).
- `POST /api/v1/scan/create`: Create a scan record (takes `file_id`, `scan_type`, `raw_input_text`, `scan_source`, `priority`).
- `GET /api/v1/scan/history`: Retrieve paginated scan history for the authenticated user.
- `PATCH /api/v1/scan/status`: Update scan status (restricted to admin/investigator). Runs state machine transition checks.
- `GET /api/v1/scan/{id}`: Retrieve detailed status/metadata of a specific scan.

### 4.3 Reports
- `POST /api/v1/report/create`: Initialize a report in `DRAFT` status.
- `GET /api/v1/report/{report_id}`: Retrieve full report details including trust score breakdown and evidence findings.
- `GET /api/v1/report/`: Retrieve paginated report history with filter fields.
- `PATCH /api/v1/report/status`: Advance report status (runs transition validator, locks metrics if status advances to `COMPLETED`).
- `POST /api/v1/report/{report_id}/evidence`: Add evidence findings to a report.

---

## 5. Environment Variables

Define the following environment variables in `backend/.env` for local backend development:
```bash
PROJECT_NAME=LEGITIFY
API_V1_STR=/api/v1
SECRET_KEY=replace_this_with_a_secure_random_key_in_production
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_MINUTES=10080

POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=legitify

UPLOAD_DIR=storage/uploads
MAX_FILE_SIZE_MB=10
```

---

## 6. Known Issues & Architecture Notes

- **Synchronous CPU Operations**: In `app/services/file.py`, computing SHA256 checksums and inspecting magic bytes are synchronous tasks. In a production deployment, this could temporarily block the async loop if multiple large uploads arrive concurrently. *Future optimization: Offload CPU-bound validation to Celery workers.*
- **Direct DB Session Dependency**: Route controllers depend heavily on database session injection (`Depends(get_db)`). *Future optimization: Implement Repository and Unit of Work patterns in Phase 6 to isolate DB access details.*

---

## 7. Next Recommended Steps: Task 9 Implementation

The immediate objective is **Task 9: Frontend Integration** to connect the client app UI to the live backend services.

### 7.1 Crucial Corrections to Implement
1. **Access Token Management**: Do NOT persist JWT access tokens in `localStorage` due to XSS vulnerability. Keep access tokens in client-side memory (Zustand state).
2. **Refresh Token & Auth Persistence**: Store refresh tokens in `HttpOnly; Secure; SameSite=Lax` cookies, set directly by the backend `/login` and `/refresh` endpoints. Ensure Next.js requests send credentials (e.g., `credentials: 'include'` on fetch/axios).
3. **Data Fetching Layer**: Implement `@tanstack/react-query` (React Query) for caching, automatic background refetching, retry logic, loading/error boundary integration, and endpoint deduplication. Do not rely on manual `useEffect` fetches for list pages.

### 7.2 Integration Scope
- **Centralized API Client**: A configured Fetch or Axios client targeting `process.env.NEXT_PUBLIC_API_URL` (defaulting to `http://localhost:8000/api/v1`).
- **Auth Integration**: Connect Register & Login screens to backend. Refresh token cycle should run in the background to fetch new access tokens.
- **Route Protection**: Use Next.js middleware or HOCs to prevent unauthenticated users from hitting `/dashboard`, `/scan`, and `/report/*` routes.
- **Scan Page**: Connect the `FileUpload` and form values directly to `POST /api/v1/scan/upload` and `POST /api/v1/scan/create`. Replace the hardcoded progress steps timer with active polling on `GET /api/v1/scan/{id}` status until status transitions to `COMPLETED` or `FAILED`.
- **Dashboard Page**: Connect stats counters, recent scans table, and activity feed to `/api/v1/scan/history` and `/api/v1/report/`.
- **Report Page**: Fetch the matching report from `/api/v1/report/{id}` using the URL dynamic path param, rendering live trust metrics and evidence items.
