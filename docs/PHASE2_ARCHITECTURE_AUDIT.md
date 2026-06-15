# LEGITIFY Phase 2 Architecture and Security Audit Report

This report presents a thorough audit of the **LEGITIFY** backend codebase, focusing on its architecture, database design, security layers, API conventions, test coverage, and query performance as of the end of Phase 2.

---

## Section 1: Architecture Review

### 1.1 Backend Structure & API Organization
The LEGITIFY backend is designed as a **modular monolith** with clean boundaries between components, facilitating future decomposition into microservices (e.g., `auth-service`, `scan-service`). The repository structure is organized as follows:
* `app/api/endpoints/`: Implements RESTful HTTP routers (`auth.py`, `health.py`, `scan.py`).
* `app/core/`: Contains system-wide configurations (`config.py`), logging setups (`logging.py`), and security logic (`security.py`).
* `app/db/`: Manages database session lifecycles (`session.py`) and baseline mappings (`base.py`, `base_class.py`).
* `app/middleware/`: Handles global concerns such as exception parsing (`errors.py`) and log-tracing correlation (`logging.py`).
* `app/models/`: Holds SQLAlchemy 2.0 declarative database entities.
* `app/schemas/`: Contains Pydantic models for request/response serialization and validation.
* `app/services/`: Enforces core business processes (file lifecycle processing, state machine checks).

### 1.2 Database Models & Alembic Migrations
* Database entities utilize modern SQLAlchemy 2.0 mapping syntax (`Mapped[...]` and `mapped_column`), which provides strong static analysis and type verification.
* Database schemas are version-tracked using **Alembic**, ensuring migration histories align with python model structures. All modifications are committed and applied dynamically.

### 1.3 Service Abstraction & Couplings
* **File Service (`app/services/file.py`)**: Completely encapsulates filesystem storage, integrity checks, and validation layers.
* **Scan State Machine (`app/services/scan_state_machine.py`)**: Abstracted out of the router. Enforces rigorous, deterministic status validation before transitions.
* **Audit Service (`app/services/audit.py`)**: Dispatched across endpoint lifecycles to write persistent logs.
* *Critique*: High coupling remains between endpoint controllers and database sessions (`Depends(get_db)`). In subsequent phases (specifically Phase 6/Enterprise scaling), migrating to a **Repository Pattern** will decouple database access from route logic and ease transition to asynchronous ORM mocking.

### 1.4 Future Scaling Bottlenecks
* **Synchronous operations**: Current file hashes and magic byte headers are computed synchronously inside async routes. If file traffic increases, CPU bound operations (like calculating SHA256 checksums) will block FastAPI's event loop.
* *Mitigation*: Offload hashing, magic byte scans, and downstream analysis (WHOIS, company intelligence) to an asynchronous worker queue (such as Celery or arq) once the background daemon architecture is deployed.

---

## Section 2: Database Audit

A granular analysis of database schemas, relationships, constraints, and indexes.

### 2.1 Entity Review and Analysis

#### 2.1.1 `users`
* **Primary Key**: UUID (v4) to prevent account enumeration.
* **Constraints**: Unique check index on `email`. Check constraint `check_user_role` restricts roles to `('student', 'faculty', 'admin', 'investigator')`.
* **Soft Delete**: `is_deleted` boolean flag. 
* *Recommendation*: Ensure queries explicitly apply `.where(User.is_deleted.is_(False))` to prevent unauthorized auth queries on deleted entities.

#### 2.1.2 `sessions`
* **Primary Key**: UUID (v4).
* **Foreign Key**: `user_id` pointing to `users.id` with `ondelete="CASCADE"`. This ensures session cleanup on user account deletion.
* **Constraints**: Unique index on `correlation_id` (JWT-mapped identifier).

#### 2.1.3 `uploaded_files`
* **Primary Key**: UUID (v4).
* **Foreign Key**: `user_id` pointing to `users.id` with `ondelete="SET NULL"`. Ensures uploaded records persist for audit purposes even if a user is deleted.
* **Self-Referential Constraint**: `duplicate_of` pointing to `uploaded_files.id` with `ondelete="SET NULL"`. This implements file-level deduplication.
* **Hardening Fields**: Stores `virus_scan_status` (`PENDING`, `CLEAN`, `INFECTED`), `integrity_status` (`VERIFIED`, `CORRUPTED`), and `file_hash` (SHA256).

#### 2.1.4 `scans`
* **Primary Key**: UUID (v4).
* **Foreign Keys**: `user_id` (SET NULL) and `file_id` (SET NULL).
* **Constraints**: 
  * `check_scan_type` restricts to `('pdf', 'docx', 'txt', 'url', 'linkedin', 'email', 'text')`.
  * `check_scan_status` restricts to `('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')`.
  * `check_scan_source` restricts to `('FILE', 'EMAIL', 'LINKEDIN', 'URL', 'TEXT')`.
  * `check_scan_priority` restricts to `('LOW', 'NORMAL', 'HIGH')`.

#### 2.1.5 `reports`, `trust_scores`, & `evidence_items`
* Linked via CASCADE keys. `reports` maps 1-to-1 to `scans`. `trust_scores` maps 1-to-1 to `reports`. `evidence_items` maps many-to-1 to `reports` with check constraints on severity categories (`low`, `medium`, `high`, `critical`).

#### 2.1.6 `audit_logs`
* Primary key UUID. Includes indexed `action` column, remote `ip_address`, and JSONB `payload` to capture unstructured audit metadata.

### 2.2 Schema Recommendations
1. **Soft Delete enforcement**: Integrate a custom SQLAlchemy query modifier or wrapper to enforce `is_deleted = False` filters automatically on `users`, `uploaded_files`, and `scans`.
2. **Soft delete index**: For tables utilizing soft deletes, create partial indexes (e.g., `CREATE UNIQUE INDEX idx_user_email_active ON users(email) WHERE is_deleted = FALSE;`) to allow email re-use by new accounts if a previous one was deleted.

---

## Section 3: Security Audit

### 3.1 Authentication & JWT Hardening
* JWT tokens are generated with high entropy signatures via `jose.jwt` utilizing a secret key from environment variables.
* Distinct `access` (short-lived) and `refresh` (long-lived, mapped to `sessions.correlation_id`) tokens are used. The `get_current_user` dependency enforces token type assertions:
  ```python
  if user_id is None or token_type != "access":
      raise credentials_exception
  ```

### 3.2 Role-Based Access Control (RBAC)
* Handled dynamically via `RoleChecker` inside API dependencies:
  ```python
  class RoleChecker:
      def __init__(self, allowed_roles: list[str]):
          self.allowed_roles = allowed_roles
      def __call__(self, current_user: User = Depends(get_current_user)) -> User:
          if current_user.role not in self.allowed_roles:
              raise HTTPException(status_code=403, detail="Forbidden")
          return current_user
  ```
* Applied to administrative routes (e.g., status overrides) to restrict access to authorized roles.

### 3.3 File Upload Hardening
The file upload workflow implemented in `app/services/file.py` utilizes multiple defense-in-depth strategies:
1. **Extension Validation**: Rejects files not matching whitelist extensions (`.pdf`, `.docx`, `.doc`, `.txt`).
2. **MIME Validation**: Validates the upload stream headers against expected file content types.
3. **Magic Byte Validation**: Inspects the leading binary headers (magic numbers) of the stream to prevent attackers from bypassing filters by renaming malicious files (e.g., renaming an `.exe` to `.pdf`).
4. **File Size Limit**: Rejects streams exceeding the max file size limit (currently configured to 10MB).
5. **Path Traversal Prevention**: Enforces filename sanitization using secure formatting patterns to prevent folder escaping (`../` sequences).
6. **Access Control List (ACL) Check**: Endpoints restrict downloads or scan triggers to the user who uploaded the file or an administrator.

### 3.4 Audit Trail Logging
* Essential authentication and verification actions are saved to `audit_logs` via the database, storing client IP, user IDs, action names, and input summaries, ensuring traceability.

---

## Section 4: API Conventions & Middleware

### 4.1 Standard Response Envelope
All API endpoints conform to a unified output scheme specified in `app/schemas/base.py`:
```json
{
  "success": true,
  "message": "Resource retrieved successfully.",
  "data": { ... },
  "errors": [],
  "request_id": "9bc3a12d-944d-4952-b88a-3507d3f82cb1"
}
```
This guarantees unified consumption logic for frontends, integrations, and automated agents.

### 4.2 Logging & Exception Middleware
* **Exception Handling (`app/middleware/errors.py`)**: Catches all unhandled system exceptions, logs them with debug trace details, and outputs a clean `500 Internal Server Error` standard envelope.
* **Contextual Log Tracing (`app/middleware/logging.py`)**: Generates an unique `request_id` for every request, binding it using `contextvars`. This ID is injected into every backend log line and returned in the HTTP headers and response body.

---

## Section 5: Testing Audit

The test suite runs 16 unit and integration tests under `pytest` with a **88% total coverage rate**.

### 5.1 Test Coverage Analysis

| File / Component | Test Coverage | Verified Functionality |
| :--- | :---: | :--- |
| `app/api/dependencies.py` | 78% | Token decoding, active user lookups, Role Checker intercepts. |
| `app/api/endpoints/auth.py` | 90% | Account registration, Login credential checks, Token refreshing. |
| `app/api/endpoints/health.py` | 100% | Health status output. |
| `app/api/endpoints/scan.py` | 88% | Scan initiation, History pagination, Status updates. |
| `app/services/file.py` | 80% | Upload validations, duplicate checking, owner authorization checks. |
| `app/services/scan_state_machine.py` | 75% | Lifecycle state transition constraint checks. |
| **All Models (`user`, `scan`, `file`, etc.)** | 100% | Database ORM schemas and properties. |

### 5.2 Test Execution Results
All 16 tests pass successfully:
```text
tests/test_auth.py::test_auth_flow PASSED
tests/test_database.py::test_database_connection PASSED
tests/test_health.py::test_health_check PASSED
tests/test_scan.py::test_create_scan_success PASSED
tests/test_scan.py::test_get_scan_details_acl PASSED
tests/test_scan.py::test_scan_status_transitions_and_timing PASSED
tests/test_scan.py::test_scan_history_pagination_and_filtering PASSED
tests/test_upload.py::test_upload_file_pdf PASSED
tests/test_upload.py::test_upload_file_docx PASSED
tests/test_upload.py::test_upload_file_txt PASSED
tests/test_upload.py::test_upload_file_forbidden_extension PASSED
tests/test_upload.py::test_upload_file_magic_bytes_mismatch PASSED
tests/test_upload.py::test_upload_file_size_exceeded PASSED
tests/test_upload.py::test_download_file_flow PASSED
tests/test_upload.py::test_download_file_not_found PASSED
tests/test_upload.py::test_upload_file_duplicate_deduplication PASSED
```

---

## Section 6: Query Performance & Indexes

To keep read/write performance optimal as data scales, the following index strategy is implemented and recommended.

### 6.1 Configured Indexes
* `users.email` (Unique Index): Fast email lookup during login.
* `sessions.correlation_id` (Unique Index): Fast session validation during token refresh.
* `uploaded_files.file_hash` (Index): Allows instant `O(1)` file deduplication lookup.
* `scans.user_id` (Index): Speeds up scan history lookups per user.
* `scans.scan_type` (Index): Speeds up scan history filtering.
* `scans.status` (Index): Speeds up worker retrieval of `PENDING` or `QUEUED` scans.
* `scans.created_at` (Index): Speeds up temporal sorting.
* `audit_logs.action` (Index): Speeds up filtering operations on system actions.

### 6.2 Recommended Performance Indexes (Phase 6 scale)
1. **Composite index for history pagination**:
   ```sql
   CREATE INDEX idx_scans_user_created ON scans(user_id, created_at DESC);
   ```
   *Reasoning*: User scan dashboards fetch history using a filter on `user_id` sorted by `created_at DESC` with a limit. A composite index avoids memory sort operations.
2. **Unique constraint index on active email**:
   ```sql
   CREATE UNIQUE INDEX idx_users_active_email ON users(email) WHERE is_deleted = FALSE;
   ```
   *Reasoning*: Enforces email uniqueness only for active accounts.
