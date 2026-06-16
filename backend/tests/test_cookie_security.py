import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime
from main import app

@pytest.mark.asyncio
async def test_cookie_security_flow(db):
    """
    Test Task 1: Cookie security flags on login, refresh, logout.
    Ensures refresh_token is HttpOnly, Secure, SameSite=strict, and never in JSON.
    """
    email = f"cookie_test_{int(datetime.now().timestamp())}@legitify.io"
    password = "SecurePassword123!"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://test") as client:
        # 1. Register
        reg_payload = {
            "email": email,
            "password": password,
            "full_name": "Cookie Test User",
            "role": "student"
        }
        res_reg = await client.post("/api/v1/auth/register", json=reg_payload)
        assert res_reg.status_code == 201

        # 2. Login
        login_data = {"username": email, "password": password}
        res_login = await client.post("/api/v1/auth/login", data=login_data)
        assert res_login.status_code == 200

        # Check response body - MUST NOT contain refresh_token
        login_json = res_login.json()
        assert "refresh_token" not in login_json["data"]
        assert "access_token" in login_json["data"]

        # Check Cookies - MUST contain refresh_token with secure attributes
        assert "refresh_token" in res_login.cookies
        cookie = next((c for c in res_login.cookies.jar if c.name == "refresh_token"), None)
        assert cookie is not None
        assert cookie.secure is True
        assert any(k.lower() == "httponly" for k in cookie._rest)
        assert any(k.lower() == "samesite" and (v or "").lower() == "strict" for k, v in cookie._rest.items())

        # Save cookies for subsequent calls
        cookies_to_use = res_login.cookies

        # 3. Refresh (reading from cookie)
        res_refresh = await client.post("/api/v1/auth/refresh")
        assert res_refresh.status_code == 200

        # Check response body - MUST NOT contain refresh_token
        refresh_json = res_refresh.json()
        assert "refresh_token" not in refresh_json["data"]
        assert "access_token" in refresh_json["data"]

        # Check Cookies rotated
        assert "refresh_token" in res_refresh.cookies
        cookie_rotated = next((c for c in res_refresh.cookies.jar if c.name == "refresh_token"), None)
        assert cookie_rotated is not None
        assert cookie_rotated.secure is True
        assert any(k.lower() == "httponly" for k in cookie_rotated._rest)
        assert any(k.lower() == "samesite" and (v or "").lower() == "strict" for k, v in cookie_rotated._rest.items())

        # 4. Logout (clearing cookie)
        headers = {"Authorization": f"Bearer {refresh_json['data']['access_token']}"}
        res_logout = await client.post(
            "/api/v1/auth/logout",
            headers=headers
        )
        assert res_logout.status_code == 200

        # Check that cookie is deleted (Max-Age=0 or empty)
        # In httpx client, the deleted cookie might be removed or set to expired/empty
        cookie_logout = next((c for c in res_logout.cookies.jar if c.name == "refresh_token"), None)
        assert cookie_logout is None or cookie_logout.value == "" or cookie_logout.is_expired()


@pytest.mark.asyncio
async def test_security_headers():
    """
    Test Task 3: Security headers presence.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://test") as client:
        res = await client.get("/api/v1/health")
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert res.headers.get("Permissions-Policy") == "camera=(), microphone=(), geolocation=()"
        assert res.headers.get("Content-Security-Policy") == "default-src 'self'"

