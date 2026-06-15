import logging
import uuid
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog

logger = logging.getLogger("app.services.audit")


async def create_audit_log(
    db: AsyncSession,
    action: str,
    ip_address: str,
    user_id: Optional[uuid.UUID] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    audit = AuditLog(
        user_id=user_id, action=action, ip_address=ip_address, payload=payload
    )
    db.add(audit)
    await db.commit()
    await db.refresh(audit)

    logger.info(
        f"Audit trail log added: {action} by user {user_id}",
        extra={
            "action": action,
            "user_id": str(user_id) if user_id else None,
            "ip_address": ip_address,
        },
    )
    return audit
