import contextvars
import time
import uuid
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variables for logging correlation
request_id_var = contextvars.ContextVar("request_id", default="")
correlation_id_var = contextvars.ContextVar("correlation_id", default="")

logger = logging.getLogger("app.request")


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.correlation_id = correlation_id_var.get()
        return True


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        
        # Get or generate Request ID and Correlation ID
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        corr_id = request.headers.get("X-Correlation-ID", req_id)
        
        # Set context variables
        token_req = request_id_var.set(req_id)
        token_corr = correlation_id_var.set(corr_id)

        # Log request start
        logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra={"client_ip": request.client.host if request.client else "unknown"}
        )

        try:
            response: Response = await call_next(request)
        except Exception as e:
            # Errors are logged here, but global exception middleware handles formatting
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                f"Request failed: {request.method} {request.url.path} - Error: {str(e)}",
                exc_info=True,
                extra={"duration_ms": duration_ms}
            )
            raise e
        finally:
            duration_ms = (time.time() - start_time) * 1000
            
        # Log request end
        logger.info(
            f"Completed request: {request.method} {request.url.path} - Status: {response.status_code}",
            extra={
                "status_code": response.status_code,
                "duration_ms": duration_ms
            }
        )

        # Append headers to response
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Correlation-ID"] = corr_id

        # Reset context variables
        request_id_var.reset(token_req)
        correlation_id_var.reset(token_corr)

        return response
