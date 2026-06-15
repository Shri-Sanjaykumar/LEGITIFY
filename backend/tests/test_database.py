import pytest
from sqlalchemy.sql import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_database_connection(db: AsyncSession):
    result = await db.execute(text("SELECT 1"))
    val = result.scalar()
    assert val == 1
