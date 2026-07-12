from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores default são de CONVENIÊNCIA para desenvolvimento. Em produção o gate
# validate_for_production() recusa subir com qualquer um deles (fail-closed).
DEFAULT_SECRET = "change-me-in-production-use-a-32byte-plus-secret"
DEFAULT_SEED_PASSWORD = "changeme123"
_MIN_SECRET_LEN = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HOOKSHADE_", env_file=".env", populate_by_name=True
    )

    # O prefixo geraria HOOKSHADE_ENVIRONMENT, mas TODA a documentação (.env.example,
    # README, runbook de deploy) diz HOOKSHADE_ENV. Sem este alias, um deploy feito
    # conforme a documentação subiria em modo desenvolvimento SEM AVISO: gate fail-closed
    # inerte, cookie de sessão sem Secure sob HTTPS, sem __Host-, sem HSTS. Aceitamos os
    # dois nomes para que a falha não possa ser silenciosa.
    environment: str = Field(
        "development",  # development | production
        validation_alias=AliasChoices("HOOKSHADE_ENV", "HOOKSHADE_ENVIRONMENT", "environment"),
    )
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

    # --- Sessão em cookie httpOnly ---
    # cookie_secure=False é default de DEV (localhost é http). Produção exige True
    # (validate_for_production recusa o contrário).
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # lax | strict. "none" é recusado em produção.
    csrf_header_name: str = "X-CSRF-Token"

    # --- Headers de segurança ---
    # HSTS fica DESLIGADO em dev de propósito: sob http://localhost o navegador
    # gravaria "só https neste host" por meses e travaria o ambiente local.
    # Em produção o gate exige que esteja ligado.
    hsts_enabled: bool = False
    hsts_max_age: int = 31_536_000  # 1 ano

    @property
    def session_cookie_name(self) -> str:
        # O prefixo __Host- é a trava mais forte que o browser oferece: só aceita o
        # cookie se vier com Secure, Path=/ e SEM Domain — logo, nenhum subdomínio
        # (nem um comprometido) consegue sobrescrevê-lo. Exige Secure, então em dev
        # (http://localhost) o nome fica sem prefixo, senão o browser descarta.
        return self._prefixed("hookshade_session")

    @property
    def csrf_cookie_name(self) -> str:
        return self._prefixed("hookshade_csrf")

    def _prefixed(self, base: str) -> str:
        return f"__Host-{base}" if self.cookie_secure else base

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
        if not self.cookie_secure:
            problems.append("HOOKSHADE_COOKIE_SECURE deve ser true em produção (cookie de sessão só sob HTTPS).")
        if not self.hsts_enabled:
            problems.append(
                "HOOKSHADE_HSTS_ENABLED deve ser true em produção. Sem HSTS, um MITM "
                "rebaixa a conexão para http na primeira visita e o cookie Secure nem é "
                "enviado — a sessão trafega em claro."
            )
        elif self.hsts_max_age < 31_536_000:
            problems.append("HOOKSHADE_HSTS_MAX_AGE deve ser >= 31536000 (1 ano) em produção.")
        if self.cookie_samesite.strip().lower() not in ("lax", "strict"):
            problems.append(
                "HOOKSHADE_COOKIE_SAMESITE deve ser 'lax' ou 'strict'. "
                "'none' enviaria a sessão cross-site e é desnecessário com o proxy same-origin."
            )
        if problems:
            raise RuntimeError(
                "Configuração de produção insegura — corrija antes de subir:\n- " + "\n- ".join(problems)
            )


settings = Settings()
