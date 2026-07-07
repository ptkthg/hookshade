from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores default são de CONVENIÊNCIA para desenvolvimento. Em produção o gate
# validate_for_production() recusa subir com qualquer um deles (fail-closed).
DEFAULT_SECRET = "change-me-in-production-use-a-32byte-plus-secret"
DEFAULT_SEED_PASSWORD = "changeme123"
_MIN_SECRET_LEN = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HOOKSHADE_", env_file=".env")

    environment: str = "development"  # development | production
    secret_key: str = DEFAULT_SECRET
    encryption_key: str = ""          # cifra em repouso; OBRIGATÓRIA e forte em produção (SEC-2)
    retention_days: int = 90          # retenção do raw_content antes de purga (P0-11)
    access_token_expire_minutes: int = 30
    login_max_attempts: int = 10      # falhas seguidas até lockout da conta
    login_lockout_minutes: int = 15   # duração do lockout
    rate_limit_login_per_minute: int = 10       # por IP, janela deslizante de 60s
    rate_limit_analyses_per_minute: int = 30    # por IP, criação de análise
    database_url: str = "sqlite:///./hookshade.db"
    seed_email: str = "analyst@hookshade.local"
    seed_password: str = DEFAULT_SEED_PASSWORD
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def validate_for_production(self) -> None:
        """Recusa configuração insegura em produção. No-op fora de produção.

        Chamado no startup da app (main.py). Não roda no import, para não afetar
        testes/dev, que usam os defaults acima intencionalmente.
        """
        if not self.is_production:
            return
        problems: list[str] = []
        if self.secret_key == DEFAULT_SECRET or len(self.secret_key) < _MIN_SECRET_LEN:
            problems.append("HOOKSHADE_SECRET_KEY deve ser forte (>= 32 chars) e diferente do default.")
        if len(self.encryption_key) < _MIN_SECRET_LEN:
            problems.append("HOOKSHADE_ENCRYPTION_KEY é obrigatória e forte (>= 32 chars) em produção.")
        if self.seed_password == DEFAULT_SEED_PASSWORD:
            problems.append("HOOKSHADE_SEED_PASSWORD deve ser trocado do default.")
        if not self.cors_origin_list or "*" in self.cors_origins:
            problems.append("HOOKSHADE_CORS_ORIGINS deve listar origens específicas (sem curinga '*').")
        if problems:
            raise RuntimeError(
                "Configuração de produção insegura — corrija antes de subir:\n- " + "\n- ".join(problems)
            )


settings = Settings()
