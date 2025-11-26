"""
Configuration de la base de données avec SQLAlchemy async
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator

from app.core.config import settings

# Créer le moteur async
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True if settings.DEBUG else False,
    future=True,
    pool_pre_ping=True,
)

# Session maker async
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base pour les modèles
Base = declarative_base()


# Dépendance pour obtenir la session DB
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
