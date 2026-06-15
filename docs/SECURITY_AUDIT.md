# LEGITIFY Security Audit Report

## Executive Summary
This document provides a security audit of the LEGITIFY modular monolith platform. The scope covers authentication, token mechanics, session management, Cross-Origin Resource Sharing (CORS), Cross-Site Request Forgery (CSRF) mitigation, file upload validation, role-based access controls (RBAC), and audit logging.

Overall, the platform architecture shows a strong security posture with strict input sanitization, secure cookie isolation, and robust authorization checks at all endpoint gates.

---

## Audit Findings & Risk Matrix

| Finding ID | Vulnerability / Observation | Component | Impact | Risk Level | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | Default Fallback Secret Key | Backend config | Authentication bypass if default key is exposed | **Medium** | Mitigation Proposed |
| **SEC-002** | Lax SameSite Cookie for Refresh | Next.js Auth Proxy | CSRF risk on cross-site requests | **Low** | Verified Secure |
| **SEC-003** | Broad CORS Settings in Localhost | Backend CORS | Unauthorized cross-origin resource access | **Low** | Configurable |
| **SEC-004** | File Upload Vector Exploits | Backend Upload | Malicious executable upload and path traversal | **Low** | Verified Secure |

---

## Detailed Findings & Recommendations

### SEC-001: Default Fallback Secret Key
* **Description**: In `backend/app/core/config.py`, `SECRET_KEY` falls back to a hardcoded string `SUPER_SECRET_KEY_CHANGE_IN_PRODUCTION_3dc5c0b` if not explicitly set in the environment. If deployed to production with this fallback active, an attacker could forge valid JWT access and refresh tokens.
* **Risk Level**: **Medium**
* **Recommendation**: Modify the configuration class to raise a configuration error (or fail startup) if `SECRET_KEY` is not provided when running in production mode.
  ```python
  # Example mitigation
  if not settings.SECRET_KEY or settings.SECRET_KEY.startswith("SUPER_SECRET_KEY"):
      if os.getenv("ENV") == "production":
          raise ValueError("SECRET_KEY must be a cryptographically strong secret in production!")
  ```

### SEC-002: Lax SameSite Cookie for Refresh Tokens
* **Description**: The Next.js auth proxy sets the `refresh_token` in an HttpOnly cookie with `SameSite=Lax`. This cookie is sent automatically by the browser on top-level cross-site navigations.
* **Risk Level**: **Low** (No immediate vulnerability)
* **Analysis**: Because the refresh endpoint `/api/auth/refresh` only returns a new access token in-memory and does not execute side effects or modify database states on behalf of the user, CSRF attacks cannot perform state changes. Standard API requests are authenticated via `Authorization: Bearer <token>` headers which browsers do not auto-send, rendering CSRF impossible on protected resource endpoints.
* **Recommendation**: Maintain current cookie configuration. If state-modifying actions are moved to cookie-based auth in the future, implement double-submit cookie patterns or anti-CSRF tokens.

### SEC-003: CORS Configuration
* **Description**: The backend CORS middleware exposes endpoints to a set of configured origins (`BACKEND_CORS_ORIGINS`). Currently, in local environments, this is set to allow `http://localhost:3000` and `http://localhost:3001`.
* **Risk Level**: **Low**
* **Recommendation**: Ensure that the unified `.env` or deployment settings override `BACKEND_CORS_ORIGINS` to only allow the specific domain hosting the frontend (e.g. `https://legitify.io`), rather than wildcard or local defaults.

### SEC-004: File Upload Security & Path Traversal
* **Description**: File uploads present risks of remote code execution (RCE) via malicious script execution, or arbitrary file overwrite via path traversal vectors (e.g. filename `../../etc/passwd`).
* **Risk Level**: **Low** (Verified Secure)
* **Analysis**: 
  * **Magic Bytes Verification**: Uploads are validated against binary headers (magic bytes), meaning renamed scripts (e.g. `malicious.exe` renamed to `doc.pdf`) are instantly blocked.
  * **Filename Sanitization**: Filenames are strictly sanitized to alphanumeric characters, dashes, and underscores, removing any directory traversal elements (`../`, `..\`).
  * **Storage Isolation**: Files are renamed with a randomly generated UUID prefix (`file_id`) and stored in dedicated isolated subdirectories, preventing file collision or write overrides.
* **Recommendation**: Integrate ClamAV or VirusTotal API scanning in the background scanning tasks (using the existing `run_virus_scan` hook architecture).

---

## Security Verification Walkthrough

### 1. JWT Security
Token validation verifies:
1. **Signature Integrity**: Cryptographic signature validation ensures tokens are tamper-proof.
2. **Expiration**: Verifies `exp` claim. Rejects expired tokens.
3. **Type Isolation**: `get_current_user` validates the `type` claim is strictly `"access"`. Refresh tokens (having type `"refresh"`) are rejected if presented as access tokens.

### 2. Access Control Checks (RBAC)
* Scan and report endpoint controllers enforce strict resource-ownership filters.
* A user can only view scans and reports they created:
  ```python
  if db_file.user_id != current_user.id and current_user.role not in {"admin", "investigator"}:
      raise HTTPException(status_code=403, detail="Not authorized...")
  ```
* Role-based endpoints (e.g. investigator portals, stats) are protected by the `RoleChecker(["admin", "investigator"])` dependency, which rejects unprivileged roles with `403 Forbidden`.

### 3. Audit Logging
Audit logs are written to the database for all key security events including:
* Login (`USER_LOGIN` / `USER_LOGIN_FAILED`)
* Registration (`USER_REGISTER`)
* File upload (`FILE_UPLOAD`)
* Scan state changes (`SCAN_CREATED` / `SCAN_STATUS_CHANGED`)
Logs record the action type, client IP address, target user ID, and action payload.
