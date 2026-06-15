from fastapi import APIRouter, status
from app.schemas.base import StandardResponse
from app.middleware.logging import request_id_var

router = APIRouter()


@router.get("/health", response_model=StandardResponse, status_code=status.HTTP_200_OK)
async def check_health():
    req_id = request_id_var.get()
    return StandardResponse(
        success=True,
        message="System is healthy",
        data={"status": "healthy"},
        request_id=req_id
    )
