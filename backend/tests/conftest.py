import asyncio
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from main import app
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db

# Create test engine using null pool for tests to avoid hanging connections
test_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    future=True
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


@pytest_asyncio.fixture(scope="function", autouse=True)
async def cleanup_db():
    yield
    from app.db.session import engine as main_engine
    await test_engine.dispose()
    await main_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    # Use connection transactions to automatically rollback all test writes
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        async with TestSessionLocal(bind=connection) as session:
            
            # Override dependency
            async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
                yield session
                
            app.dependency_overrides[get_db] = override_get_db
            
            yield session
            
            # Cleanup overrides
            app.dependency_overrides.clear()
            await transaction.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(db) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        yield ac


@pytest.fixture(scope="function", autouse=True)
def clear_rate_limiter():
    from app.core.rate_limit import rate_limiter
    rate_limiter.requests.clear()
