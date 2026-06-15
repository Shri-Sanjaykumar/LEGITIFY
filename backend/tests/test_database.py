import pytest
from sqlalchemy.sql import text
from app.db.session import SessionLocal


@pytest.mark.asyncio
async def test_database_connection():
    async with SessionLocal() as session:
        result = await session.execute(text("SELECT 1"))
        val = result.scalar()
        assert val == 1
