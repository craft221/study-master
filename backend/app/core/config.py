import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "StudyMaster"
    APP_NAME: str = "Study Master API"
    APP_VERSION: str = "1.0.0"

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://studymaster:studymaster123@postgres:5432/studymaster_db"
    )

    # Environment
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"

    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8000"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list = ["*"]
    CORS_ALLOW_HEADERS: list = ["*"]

settings = Settings()