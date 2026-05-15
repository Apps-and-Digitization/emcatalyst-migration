from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str  # Required — no default, fails loudly if missing
    SECRET_KEY: str  # Required — no default
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    FIRST_SUPERUSER: str = "admin@emcure.com"
    FIRST_SUPERUSER_PASSWORD: str  # Required — no default
    APP_NAME: str = "EMCatalyst"
    DEBUG: bool = False

    # SMTP (optional — leave SMTP_HOST empty to log emails instead of sending)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    FRONTEND_URL: str = "http://localhost:5173"

    # Azure AD / Microsoft SSO
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = ""
    AZURE_REDIRECT_URI: str = ""  # Will default to {FRONTEND_URL}/auth/microsoft/callback

    class Config:
        env_file = ".env"


settings = Settings()
