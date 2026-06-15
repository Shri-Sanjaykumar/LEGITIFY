import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.middleware.logging import StructuredLoggingMiddleware
from app.middleware.errors import setup_exception_handlers
from app.api.endpoints import health, auth, scan, report, trust, company


# 1. Setup structured logging
setup_logging()

# 2. Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# 3. Add CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 4. Add structured logging & request trace middleware
app.add_middleware(StructuredLoggingMiddleware)

# 5. Add global error exception handlers
setup_exception_handlers(app)

# 6. Include endpoints routers
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["System"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(scan.router, prefix=f"{settings.API_V1_STR}/scan", tags=["Scans"])
app.include_router(report.router, prefix=f"{settings.API_V1_STR}/report", tags=["Reports"])
app.include_router(trust.router, prefix=f"{settings.API_V1_STR}/trust", tags=["Trust Engine"])
app.include_router(company.router, prefix=f"{settings.API_V1_STR}/company", tags=["Company Verification"])



@app.get("/")
async def redirect_to_docs():
    return {"message": f"Welcome to {settings.PROJECT_NAME}. View docs at /api/v1/docs"}
