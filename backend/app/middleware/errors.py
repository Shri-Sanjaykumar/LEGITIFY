import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from app.schemas.base import StandardResponse
from app.middleware.logging import request_id_var

logger = logging.getLogger("app.errors")


def setup_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        req_id = request_id_var.get()
        response_body = StandardResponse(
            success=False, message=exc.detail, errors=[exc.detail], request_id=req_id
        )
        return JSONResponse(
            status_code=exc.status_code, content=response_body.model_dump()
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        req_id = request_id_var.get()
        errors_list = []
        for err in exc.errors():
            loc = " -> ".join(str(x) for x in err.get("loc", []))
            msg = err.get("msg", "Invalid value")
            errors_list.append(f"{loc}: {msg}")

        logger.warning(f"Validation failure: {errors_list}")

        response_body = StandardResponse(
            success=False,
            message="Validation error",
            errors=errors_list,
            request_id=req_id,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=response_body.model_dump(),
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        req_id = request_id_var.get()
        logger.error(f"Uncaught general exception: {str(exc)}", exc_info=True)

        response_body = StandardResponse(
            success=False,
            message="Internal server error",
            errors=["An unexpected error occurred."],
            request_id=req_id,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_body.model_dump(),
        )
