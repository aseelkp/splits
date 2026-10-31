from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Reads values from environment variables (and a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase transaction pooler URL in production. SQLite file for local dev.
    database_url: str = "sqlite:///./dev.db"
    timezone: str = "Asia/Kolkata"

    # Web login. Empty values mean login is disabled (the app fails closed).
    app_password: str = ""
    session_secret: str = ""
    # The browser only sends a Secure cookie over https. localhost counts as secure in
    # Chrome/Firefox; set COOKIE_SECURE=false only if you test over plain http elsewhere.
    cookie_secure: bool = True

    # Used from step 4 (MCP).
    mcp_secret: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        """Supabase hands out `postgresql://...`; SQLAlchemy needs to be told to use psycopg 3."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
