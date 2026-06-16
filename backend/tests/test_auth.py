import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User


@pytest.mark.asyncio
async def test_auth_flow(client: AsyncClient, db: AsyncSession):
    email = "teststudent@vitstudent.ac.in"
    password = "SecurePassword123!"
    full_name = "Test Student"
    
    # 1. Test Registration
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "role": "student"
        }
    )
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["email"] == email
    assert res_data["data"]["role"] == "student"

    # 2. Test Duplicate Registration
    response_dup = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "role": "student"
        }
    )
    assert response_dup.status_code == 409
    
    # 3. Test Login
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password
        }
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert login_data["success"] is True
    tokens = login_data["data"]
    assert "access_token" in tokens
    assert "refresh_token" not in tokens
    
    access_token = tokens["access_token"]
    assert "refresh_token" in login_response.cookies

    # 4. Test Get Me Profile
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["success"] is True
    assert me_data["data"]["email"] == email

    # 5. Test Token Refresh
    refresh_response = await client.post(
        "/api/v1/auth/refresh"
    )
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    assert refresh_data["success"] is True
    assert "access_token" in refresh_data["data"]
    assert "refresh_token" not in refresh_data["data"]
    assert "refresh_token" in refresh_response.cookies
    
    new_access_token = refresh_data["data"]["access_token"]

    # 6. Test Logout
    logout_response = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {new_access_token}"}
    )
    assert logout_response.status_code == 200
    assert logout_response.json()["success"] is True

    # 7. Test Get Me Profile with invalid token
    expired_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert expired_response.status_code == 401
