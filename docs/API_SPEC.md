# LEGITIFY API Specification (v1)

All endpoints are prefixed with `/api/v1/`.

---

## 1. Authentication Endpoints

### 1.1 Register User
* **Method**: `POST`
* **Path**: `/api/v1/auth/register`
* **Auth Required**: No
* **Request Body**:
  ```json
  {
    "email": "student@vitstudent.ac.in",
    "password": "SecurePassword123!",
    "full_name": "Sanjay Kumar",
    "role": "student"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "data": {
      "id": "e0b57e7b-c9a9-4674-8b65-bfd045d4e101",
      "email": "student@vitstudent.ac.in",
      "full_name": "Sanjay Kumar",
      "role": "student",
      "is_active": true
    },
    "errors": [],
    "request_id": "4a7bcf12-581d-44a3-a773-5819ba714901"
  }
  ```

### 1.2 Login User
* **Method**: `POST`
* **Path**: `/api/v1/auth/login`
* **Auth Required**: No
* **Request Body**:
  ```json
  {
    "username": "student@vitstudent.ac.in",
    "password": "SecurePassword123!"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged in successfully.",
    "data": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "eyJhbGciOi...",
      "token_type": "bearer"
    },
    "errors": [],
    "request_id": "8f03bc51-0a6e-473d-922e-13c59db6789b"
  }
  ```

### 1.3 Refresh Token
* **Method**: `POST`
* **Path**: `/api/v1/auth/refresh`
* **Auth Required**: No
* **Request Body**:
  ```json
  {
    "refresh_token": "eyJhbGciOi..."
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Tokens rotated successfully.",
    "data": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "eyJhbGciOi...",
      "token_type": "bearer"
    },
    "errors": [],
    "request_id": "8f03bc51-0a6e-473d-922e-13c59db6789c"
  }
  ```

### 1.4 Logout User
* **Method**: `POST`
* **Path**: `/api/v1/auth/logout`
* **Auth Required**: Yes (Access Token in Header)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Session invalidated successfully.",
    "data": {},
    "errors": [],
    "request_id": "8f03bc51-0a6e-473d-922e-13c59db6789d"
  }
  ```

### 1.5 Get Current User Profile
* **Method**: `GET`
* **Path**: `/api/v1/auth/me`
* **Auth Required**: Yes (Access Token in Header)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User profile retrieved successfully.",
    "data": {
      "id": "e0b57e7b-c9a9-4674-8b65-bfd045d4e101",
      "email": "student@vitstudent.ac.in",
      "full_name": "Sanjay Kumar",
      "role": "student",
      "is_active": true
    },
    "errors": [],
    "request_id": "a98402db-bb2b-426b-ae18-f2bcf9bc7e02"
  }
  ```

---

## 2. File Upload & Scan Endpoints

### 2.1 Upload File
* **Method**: `POST`
* **Path**: `/api/v1/scan/upload`
* **Auth Required**: Yes
* **Request Body**: `multipart/form-data` with `file` field
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "File uploaded successfully.",
    "data": {
      "id": "f8a002bd-b8c2-4eb4-b9b3-059bc43a129f",
      "original_filename": "offer_letter.pdf",
      "mime_type": "application/pdf",
      "file_size": 204857,
      "file_hash": "sha256:d57b12d54e..."
    },
    "errors": [],
    "request_id": "b1b7095c-9c3f-4228-9844-306915b22b10"
  }
  ```

### 2.2 Create Scan
* **Method**: `POST`
* **Path**: `/api/v1/scan/create`
* **Auth Required**: Yes
* **Request Body**:
  ```json
  {
    "input_type": "pdf",
    "file_id": "f8a002bd-b8c2-4eb4-b9b3-059bc43a129f",
    "raw_input_text": null
  }
  ```
  *(Alternatively, inputs can provide a raw text string or URL, with `file_id` set to `null`).*
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Scan record initialized.",
    "data": {
      "id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
      "input_type": "pdf",
      "status": "PENDING",
      "file_id": "f8a002bd-b8c2-4eb4-b9b3-059bc43a129f",
      "created_at": "2026-06-15T16:32:00Z"
    },
    "errors": [],
    "request_id": "02bdc142-b9e7-494b-bf0d-6e7b4b1a4cb0"
  }
  ```

### 2.3 Get Scan Details
* **Method**: `GET`
* **Path**: `/api/v1/scan/{id}`
* **Auth Required**: Yes
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Scan status retrieved.",
    "data": {
      "id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
      "input_type": "pdf",
      "status": "PROCESSING",
      "file_id": "f8a002bd-b8c2-4eb4-b9b3-059bc43a129f",
      "created_at": "2026-06-15T16:32:00Z"
    },
    "errors": [],
    "request_id": "02bdc142-b9e7-494b-bf0d-6e7b4b1a4cb1"
  }
  ```

### 2.4 Get Scan History
* **Method**: `GET`
* **Path**: `/api/v1/scan/history`
* **Auth Required**: Yes
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Scan history retrieved.",
    "data": {
      "scans": [
        {
          "id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
          "input_type": "pdf",
          "status": "COMPLETED",
          "created_at": "2026-06-15T16:32:00Z"
        }
      ]
    },
    "errors": [],
    "request_id": "02bdc142-b9e7-494b-bf0d-6e7b4b1a4cb2"
  }
  ```

### 2.5 Patch Scan Status
* **Method**: `PATCH`
* **Path**: `/api/v1/scan/status`
* **Auth Required**: Yes (Internal/Admin only)
* **Request Body**:
  ```json
  {
    "scan_id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
    "status": "COMPLETED"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Scan status updated.",
    "data": {
      "id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
      "status": "COMPLETED"
    },
    "errors": [],
    "request_id": "02bdc142-b9e7-494b-bf0d-6e7b4b1a4cb3"
  }
  ```

---

## 3. Report Endpoints

### 3.1 Get Report Details
* **Method**: `GET`
* **Path**: `/api/v1/report/{id}`
* **Auth Required**: Yes
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Report details retrieved.",
    "data": {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
      "scan_id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
      "trust_score": 72.4,
      "confidence_score": 94,
      "summary": "AI investigation completed. The document matches the verified domains, but has medium risks regarding recruiter details.",
      "created_at": "2026-06-15T16:35:00Z",
      "risk_breakdown": {
        "document": 85.0,
        "domain": 90.0,
        "company": 70.0,
        "recruiter": 50.0,
        "community": 65.0,
        "technical": 80.0
      },
      "evidence_items": [
        {
          "id": "11111111-2222-3333-4444-555555555555",
          "dimension": "recruiter",
          "severity": "medium",
          "source": "LinkedIn API",
          "description": "Recruiter profile was registered less than 30 days ago."
        }
      ]
    },
    "errors": [],
    "request_id": "e02b74ba-9db6-448f-bb7e-f8bc36cb7a21"
  }
  ```

### 3.2 Get Report History
* **Method**: `GET`
* **Path**: `/api/v1/report/history`
* **Auth Required**: Yes
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Report history retrieved.",
    "data": {
      "reports": [
        {
          "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
          "scan_id": "c1f7b0e1-bbcb-402a-a92c-674b0f69a101",
          "trust_score": 72.4,
          "created_at": "2026-06-15T16:35:00Z"
        }
      ]
    },
    "errors": [],
    "request_id": "e02b74ba-9db6-448f-bb7e-f8bc36cb7a22"
  }
  ```
