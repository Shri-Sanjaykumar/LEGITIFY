from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging
from fastapi import Request
from app.middleware.logging import request_id_var

logger = logging.getLogger("app.rate_limit")


class RateLimitException(Exception):
    def __init__(self, message: str = "Rate limit exceeded", request_id: str = ""):
        self.message = message
        self.request_id = request_id


class RateLimiterInterface(ABC):
    @abstractmethod
    async def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> bool:
        pass

    @abstractmethod
    async def reset(self, key: str) -> None:
        pass


class MemoryRateLimiter(RateLimiterInterface):
    def __init__(self):
        # Maps key -> list of datetime timestamps
        self.requests = defaultdict(list)

    async def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> bool:
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=window_seconds)

        # Filter out old requests
        self.requests[key] = [t for t in self.requests[key] if t > window_start]

        if len(self.requests[key]) >= limit:
            return True

        self.requests[key].append(now)
        return False

    async def reset(self, key: str) -> None:
        if key in self.requests:
            del self.requests[key]


class RedisRateLimiter(RateLimiterInterface):
    """
    Skeleton Redis Rate Limiter for future distributed production scaling.
    """

    def __init__(self, redis_client=None):
        self.redis_client = redis_client

    async def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> bool:
        # Placeholder logic
        # In production: run Redis transaction or Lua script using sliding window log/sorted sets.
        raise NotImplementedError("Redis rate limiter is not implemented yet.")

    async def reset(self, key: str) -> None:
        raise NotImplementedError("Redis rate limiter is not implemented yet.")


# Global active instance
rate_limiter = MemoryRateLimiter()


def rate_limit(limit: int, window_seconds: int = 60):
    """
    FastAPI dependency to enforce rate limits per IP address or User ID.
    """

    async def dependency(request: Request):
        # 1. Resolve client identity (IP or User ID if authenticated)
        identity = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                from app.core.security import decode_token

                payload = decode_token(token)
                identity = payload.get("sub")
            except Exception:
                pass

        if not identity:
            # Fallback to IP address
            identity = request.client.host if request.client else "127.0.0.1"
            # Forwarded headers support
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                identity = forwarded.split(",")[0].strip()

        # 2. Build unique key (route path + client identifier)
        path = request.url.path
        key = f"{path}:{identity}"

        # 3. Check rate limit
        is_limited = await rate_limiter.is_rate_limited(key, limit, window_seconds)
        if is_limited:
            req_id = request_id_var.get() if request_id_var else ""
            raise RateLimitException(message="Rate limit exceeded", request_id=req_id)

    return dependency
