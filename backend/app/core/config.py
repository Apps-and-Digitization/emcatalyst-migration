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

    # Embedded Sign (emSigner) API
    EMSIGNER_BASE_URL: str = "https://emsn-dev-emudra-dev.apps.emart.oneemcure.local/rest/embededsign/v1/"
    EMSIGNER_SENDER_NAME: str = "Sumith Gangadharan"
    EMSIGNER_SENDER_EMAIL: str = "sumith.gangadharan@emcure.com"
    EMSIGNER_TEMPLATE_ID: int = 1

    # Vendor OData API
    VENDOR_ODATA_URL: str = "https://mdprod-masterdata-prod.apps.emart.oneemcure.local/odata/ODataMasterService/v1/LFB1s?$expand=LFA1&$filter=%20BUKRS%20eq%20%27EPL%27%20or%20BUKRS%20eq%20%27ZHL%27%20or%20BUKRS%20eq%20%27EBT%27%20and%20LFA1/KTOKK%20eq%20%270006%27%20or%20LFA1/KTOKK%20eq%20%270007%27"

    class Config:
        env_file = ".env"


settings = Settings()
