# LEGITIFY Deployment Guide

This document details the configuration and deployment of the LEGITIFY modular monolith platform. The architecture comprises a Next.js App Router frontend, a FastAPI backend gateway, and a PostgreSQL database.

---

## 1. Local Development Setup (Manual)

### Backend Service:
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Unix/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template and configure settings:
   ```bash
   cp .env.example .env
   ```
5. Run database migrations:
   ```bash
   alembic upgrade head
   ```
6. Seed database with standard test accounts:
   ```bash
   python seed_db.py
   ```
7. Start the FastAPI application server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend Service:
1. Navigate to the root directory.
2. Install npm packages:
   ```bash
   npm install
   ```
3. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```
4. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

---

## 2. Docker Compose Deployment (Local & Production-ready)

The easiest way to run the entire LEGITIFY stack is using the root-level `docker-compose.yml` file.

1. Ensure Docker and Docker Compose are installed.
2. Copy and configure the environment variables:
   ```bash
   cp .env.example .env
   ```
3. Build and launch all services (`db`, `backend`, `frontend`) in detached mode:
   ```bash
   docker compose up --build -d
   ```
4. Perform database migrations inside the running backend container:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
5. Run the DB seed script to populate test credentials:
   ```bash
   docker compose exec backend python seed_db.py
   ```
6. Access the services:
   * **Frontend Application**: `http://localhost:3000`
   * **Backend Gateway API**: `http://localhost:8000/api/v1`
   * **API Docs (Swagger)**: `http://localhost:8000/docs`

---

## 3. Production Deployment Guide (Cloud Platforms)

### Frontend Deployment (Vercel)
Next.js connects natively to Vercel.
1. Connect the GitHub repository to your Vercel account.
2. Configure environment variables in Vercel project settings:
   * `NEXT_PUBLIC_API_URL`: Set to your deployed FastAPI backend URL (e.g. `https://api.legitify.io/api/v1`).
3. Deploy! Vercel compiles the static routes and serverless API proxy handlers.

### Backend Deployment (Render or Railway)
For Render or Railway:
1. Connect your repository and select the subfolder `/backend` as the build context.
2. Use the provided Dockerfile (`backend/Dockerfile`).
3. Provisions a PostgreSQL database addon.
4. Set the environment variables in your control panel:
   * `DATABASE_URL`: Connection string from your database addon.
   * `SECRET_KEY`: Set a secure secret key (run `openssl rand -hex 32` to generate one).
   * `BACKEND_CORS_ORIGINS`: Set to `["https://your-frontend-domain.vercel.app"]`.
   * `UPLOAD_DIR`: Set to `/workspace/storage/uploads` (mount a persistent disk volume to this path to retain files).
5. Deploy. The backend service starts on port 8000.

---

## 4. Troubleshooting & Database Migrations

* **Applying New Schema Migrations**:
  When database schemas change, generate a new alembic revision and apply:
  ```bash
  alembic revision --autogenerate -m "description of changes"
  alembic upgrade head
  ```
* **Checking Docker logs**:
  ```bash
  docker compose logs -f [service_name]
  ```
