from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HOOKSHADE_", env_file=".env")

    secret_key: str = "change-me-in-production-use-a-32byte-plus-secret"
    access_token_expire_minutes: int = 30
    database_url: str = "sqlite:///./hookshade.db"
    seed_email: str = "analyst@hookshade.local"
    seed_password: str = "changeme123"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
