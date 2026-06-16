import uuid
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.db.session import get_db
from app.models.user import User, Session
from app.schemas.auth import UserRegister, UserOut, Token, TokenRefreshRequest
from app.schemas.base import StandardResponse
from app.services.audit import create_audit_log
from app.middleware.logging import request_id_var
from app.api.dependencies import get_current_user
from app.core.rate_limit import rate_limit

router = APIRouter()
logger = logging.getLogger("app.api.auth")


@router.post(
    "/register",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(3, 60))],
)
async def register(
    request: Request, user_in: UserRegister, db: AsyncSession = Depends(get_db)
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    # Hash password
    hashed_password = get_password_hash(user_in.password)

    # Create user
    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        full_name=user_in.full_name,
        role=user_in.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Log audit
    await create_audit_log(
        db=db,
        action="USER_REGISTER",
        ip_address=client_ip,
        user_id=user.id,
        payload={"email": user.email, "role": user.role},
    )

    user_out = UserOut.model_validate(user)
    return StandardResponse(
        success=True,
        message="User registered successfully.",
        data=user_out,
        request_id=req_id,
    )


@router.post(
    "/login",
    response_model=StandardResponse,
    dependencies=[Depends(rate_limit(5, 60))],
)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")

    # Fetch user
    result = await db.execute(
        select(User).where(User.email == form_data.username, User.is_deleted.is_(False))
    )
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User account is inactive"
        )

    # Create Session correlation ID
    corr_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=60 * 24 * 7)  # 7 days

    session_record = Session(
        user_id=user.id,
        correlation_id=corr_id,
        user_agent=user_agent,
        ip_address=client_ip,
        expires_at=expires_at,
    )
    db.add(session_record)
    await db.commit()

    # Generate tokens
    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id, correlation_id=corr_id)

    # Log audit
    await create_audit_log(
        db=db, action="USER_LOGIN", ip_address=client_ip, user_id=user.id
    )

    token_data = Token(access_token=access_token)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )
    return StandardResponse(
        success=True,
        message="Logged in successfully.",
        data=token_data,
        request_id=req_id,
    )


@router.post(
    "/refresh",
    response_model=StandardResponse,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def refresh(
    request: Request,
    response: Response,
    refresh_in: Optional[TokenRefreshRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token and refresh_in:
        refresh_token = refresh_in.refresh_token

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token cookie missing")

    try:
        payload = decode_token(refresh_token)
        user_id = payload.get("sub")
        corr_id = payload.get("correlation_id")
        token_type = payload.get("type")

        if user_id is None or corr_id is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Fetch session
    res = await db.execute(select(Session).where(Session.correlation_id == corr_id))
    session_record = res.scalars().first()

    if not session_record:
        raise HTTPException(status_code=401, detail="Refresh token session not found")

    # Token Re-use / Theft Detection
    if session_record.is_revoked:
        # Revoke ALL sessions for this user immediately as a security precaution
        await db.execute(
            select(Session).where(Session.user_id == session_record.user_id)
        )
        # We can update them
        await create_audit_log(
            db=db,
            action="SECURITY_ALERT_REFRESH_REUSE",
            ip_address=client_ip,
            user_id=uuid.UUID(user_id),
            payload={"correlation_id": corr_id},
        )
        raise HTTPException(
            status_code=401, detail="Session compromised. Please re-authenticate."
        )

    # Check expiration
    if session_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
        timezone.utc
    ):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # Revoke old session (rotation)
    session_record.is_revoked = True
    await db.commit()

    # Get user role for new access token
    user_res = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = user_res.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=401, detail="User account is inactive or disabled"
        )

    # Issue new session and token pair
    new_corr_id = str(uuid.uuid4())
    new_expires_at = datetime.now(timezone.utc) + timedelta(minutes=60 * 24 * 7)

    new_session = Session(
        user_id=user.id,
        correlation_id=new_corr_id,
        user_agent=request.headers.get("User-Agent", "unknown"),
        ip_address=client_ip,
        expires_at=new_expires_at,
    )
    db.add(new_session)
    await db.commit()

    access_token = create_access_token(subject=user.id, role=user.role)
    new_refresh_token = create_refresh_token(
        subject=user.id, correlation_id=new_corr_id
    )

    # Log audit
    await create_audit_log(
        db=db, action="TOKEN_ROTATION", ip_address=client_ip, user_id=user.id
    )

    token_data = Token(access_token=access_token)
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )
    return StandardResponse(
        success=True,
        message="Tokens rotated successfully.",
        data=token_data,
        request_id=req_id,
    )


@router.post("/logout", response_model=StandardResponse)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_var.get()
    client_ip = request.client.host if request.client else "unknown"

    # Revoke all sessions for this user (simple signout-all approach)
    res = await db.execute(
        select(Session).where(
            Session.user_id == current_user.id, Session.is_revoked.is_(False)
        )
    )
    sessions = res.scalars().all()
    for s in sessions:
        s.is_revoked = True

    await db.commit()

    # Log audit
    await create_audit_log(
        db=db, action="USER_LOGOUT", ip_address=client_ip, user_id=current_user.id
    )

    response.delete_cookie(
        key="refresh_token",
        path="/",
    )

    return StandardResponse(
        success=True,
        message="Session invalidated successfully.",
        data={},
        request_id=req_id,
    )


@router.get("/me", response_model=StandardResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    req_id = request_id_var.get()
    user_out = UserOut.model_validate(current_user)

    return StandardResponse(
        success=True,
        message="User profile retrieved successfully.",
        data=user_out,
        request_id=req_id,
    )
