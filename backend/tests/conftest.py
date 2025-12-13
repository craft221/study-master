"""
Configuration pytest et fixtures pour les tests
"""

import pytest
import asyncio
from typing import AsyncGenerator, Generator
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole, create_user_with_defaults
from app.main import app


# Configuration de la base de données de test (SQLite en mémoire)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Crée une boucle d'événements pour les tests async"""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Crée un moteur de base de données de test"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Crée une session de base de données pour chaque test"""
    async_session_maker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest.fixture
def override_get_db(db_session: AsyncSession):
    """Override la dépendance get_db pour utiliser la session de test"""
    async def _override_get_db():
        yield db_session
    return _override_get_db


@pytest.fixture
def test_app(override_get_db) -> FastAPI:
    """Crée une application FastAPI de test"""
    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_app: FastAPI) -> TestClient:
    """Crée un client de test synchrone"""
    return TestClient(test_app)


@pytest.fixture
async def async_client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Crée un client de test asynchrone"""
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Crée un utilisateur de test"""
    user = create_user_with_defaults(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("Test123!"),
        full_name="Test User",
        role=UserRole.STUDENT
    )
    user.is_active = True
    user.is_verified = True
    user.gamification.total_xp = 100
    user.gamification.level = 2
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_admin(db_session: AsyncSession) -> User:
    """Crée un utilisateur admin de test"""
    admin = create_user_with_defaults(
        email="admin@example.com",
        username="adminuser",
        hashed_password=get_password_hash("Admin123!"),
        full_name="Admin User",
        role=UserRole.ADMIN
    )
    admin.is_active = True
    admin.is_verified = True
    admin.gamification.total_xp = 1000
    admin.gamification.level = 10
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest.fixture
def user_token(test_user: User) -> str:
    """Génère un token JWT pour l'utilisateur de test"""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest.fixture
def admin_token(test_admin: User) -> str:
    """Génère un token JWT pour l'admin de test"""
    return create_access_token(data={"sub": str(test_admin.id)})


@pytest.fixture
def auth_headers(user_token: str) -> dict:
    """Headers d'authentification pour l'utilisateur de test"""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Headers d'authentification pour l'admin de test"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def mock_cache_service():
    """Mock du service de cache"""
    mock = MagicMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=True)
    mock.delete_pattern = AsyncMock(return_value=0)
    return mock


@pytest.fixture
def mock_anti_cheat_service():
    """Mock du service anti-triche"""
    mock = MagicMock()
    mock.start_session = AsyncMock(return_value="test-session-id")
    mock.record_answer = AsyncMock(return_value=None)
    mock.record_event = AsyncMock(return_value=None)
    mock.validate_quiz_completion = AsyncMock(return_value=MagicMock(
        is_valid=True,
        violations=[],
        penalty_xp=0,
        is_disqualified=False,
        warning_message=None,
        adjusted_score=100.0
    ))
    return mock
