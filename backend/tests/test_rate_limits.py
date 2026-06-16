import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime
from main import app
from app.core.rate_limit import rate_limiter

@pytest.mark.anyio
async def test_rate_limits_and_isolation():
    """
    Test Task 2: Rate Limiting and client isolation.
    """
    email = f"ratelimit_test_{int(datetime.now().timestamp())}@legitify.io"
    password = "SecurePassword123!"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register user first
        reg_payload = {
            "email": email,
            "password": password,
            "full_name": "Rate Limit Test User",
            "role": "student"
        }
        res_reg = await client.post("/api/v1/auth/register", json=reg_payload)
        assert res_reg.status_code == 201

        # Reset rate limiter for `/auth/login` to ensure clean state
        # The key formula is: {path}:{ip}
        # Httpx client default host is 127.0.0.1
        login_key = "/api/v1/auth/login:127.0.0.1"
        await rate_limiter.reset(login_key)

        login_data = {"username": email, "password": password}

        # 2. Make 5 successful login calls (limit is 5/min)
        for i in range(5):
            res = await client.post("/api/v1/auth/login", data=login_data)
            assert res.status_code == 200, f"Login {i} failed"

        # 3. The 6th login call must trigger rate limit (429)
        res_limited = await client.post("/api/v1/auth/login", data=login_data)
        assert res_limited.status_code == 429
        
        limited_json = res_limited.json()
        assert limited_json["success"] is False
        assert limited_json["message"] == "Rate limit exceeded"
        assert "request_id" in limited_json

        # 4. Verify isolation by using another IP address in headers (X-Forwarded-For)
        headers_other_ip = {"X-Forwarded-For": "192.168.1.100"}
        res_isolated = await client.post("/api/v1/auth/login", data=login_data, headers=headers_other_ip)
        # Should succeed because it is a different client
        assert res_isolated.status_code == 200

        # 5. Verify reset works
        await rate_limiter.reset(login_key)
        res_after_reset = await client.post("/api/v1/auth/login", data=login_data)
        assert res_after_reset.status_code == 200
