# Hookshade Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end vertical slice of Hookshade — an authenticated user submits a `.eml`/raw email and receives a persisted analysis with explainable risk score, IOCs, authentication findings and recommendations.

**Architecture:** Monorepo at `D:\Projetos\hookshade` with `backend/` (FastAPI + SQLite, synchronous analysis pipeline) and `frontend/` (Next.js). Backend exposes a small versioned REST API and runs the whole analysis in-request. Frontend has 4 pages (Login, Nova Análise, Resultado, Histórico). Phase A (backend) is independently testable via pytest; Phase B (frontend) consumes the API.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.x, PyJWT, passlib[bcrypt], python-multipart, pytest, httpx. Node 18+, Next.js (App Router), TypeScript, Tailwind, shadcn/ui.

**Slice deviations from spec (intentional, deferred):** SQLite + `Base.metadata.create_all` instead of Postgres+Alembic; synchronous analysis instead of Redis/workers; local structural heuristics instead of external threat intel; no AI, no PDF, no RBAC/audit/rate-limit. See design doc `docs/superpowers/specs/2026-07-01-hookshade-vertical-slice-design.md`.

---

## File Structure

### Backend (`backend/`)
```
backend/
  app/
    __init__.py
    config.py              # pydantic-settings, reads .env
    database.py            # engine, SessionLocal, Base
    models.py              # User, Analysis, IOC, Finding, Recommendation
    schemas.py             # Pydantic request/response models
    security.py            # password hash + JWT create/decode
    deps.py                # get_db, get_current_user
    seed.py                # create tables + seed user
    main.py                # FastAPI app, CORS, router wiring
    routers/
      __init__.py
      auth.py              # POST /auth/login, GET /auth/me
      analyses.py          # POST /analyses, GET /analyses, GET /analyses/{id}
    analysis/
      __init__.py
      types.py             # dataclasses: ParsedEmail, AttachmentMeta, IOCItem, FindingItem, RecItem, AnalysisResult
      parser.py            # parse_email(raw) -> ParsedEmail
      iocs.py              # extract_iocs(parsed), defang()
      auth_analysis.py     # analyze_authentication(parsed) -> findings + subscore
      content.py           # analyze_content(parsed) -> findings + subscore
      scoring.py           # score(parsed, ioc_findings...) -> AnalysisResult
      pipeline.py          # run_analysis(raw, source_type, context) -> AnalysisResult
  tests/
    conftest.py
    fixtures/benign.eml
    fixtures/phishing.eml
    test_parser.py
    test_iocs.py
    test_auth_analysis.py
    test_content.py
    test_scoring.py
    test_api_auth.py
    test_api_analyses.py
  requirements.txt
  pytest.ini
  .env.example
```

### Frontend (`frontend/`)
```
frontend/
  app/
    layout.tsx
    globals.css
    page.tsx                     # redirect -> /nova-analise (or /login)
    login/page.tsx
    nova-analise/page.tsx
    resultado/[id]/page.tsx
    historico/page.tsx
  lib/
    api.ts                       # fetch wrapper w/ bearer token
    auth.ts                      # token in localStorage
    types.ts                     # TS mirrors of API responses
  components/
    SeverityBadge.tsx
    Nav.tsx
  tailwind.config.ts
  package.json
  .env.local.example
```

---

# PHASE A — BACKEND

### Task 1: Backend scaffold

**Files:**
- Create: `backend/requirements.txt`, `backend/pytest.ini`, `backend/.env.example`, `backend/app/__init__.py`, `backend/app/analysis/__init__.py`, `backend/app/routers/__init__.py`, `backend/tests/__init__.py`

- [ ] **Step 1: Write requirements.txt**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
pydantic==2.10.3
pydantic-settings==2.6.1
sqlalchemy==2.0.36
PyJWT==2.10.1
passlib[bcrypt]==1.7.4
python-multipart==0.0.19
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Write pytest.ini**

```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 3: Write .env.example**

```
HOOKSHADE_SECRET_KEY=change-me-in-production
HOOKSHADE_ACCESS_TOKEN_EXPIRE_MINUTES=30
HOOKSHADE_DATABASE_URL=sqlite:///./hookshade.db
HOOKSHADE_SEED_EMAIL=analyst@hookshade.local
HOOKSHADE_SEED_PASSWORD=changeme123
HOOKSHADE_CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 4: Create empty package files**

Create `backend/app/__init__.py`, `backend/app/analysis/__init__.py`, `backend/app/routers/__init__.py`, `backend/tests/__init__.py` all empty.

- [ ] **Step 5: Create and activate venv, install deps**

Run:
```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
```
Expected: installs without errors. (On Git Bash use `.venv/Scripts/python`; all later `pytest`/`python` commands use `.venv/Scripts/python -m ...`.)

- [ ] **Step 6: Commit**

```bash
git add backend/ && git commit -m "chore: scaffold backend project"
```

---

### Task 2: Config

**Files:**
- Create: `backend/app/config.py`

- [ ] **Step 1: Write config**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HOOKSHADE_", env_file=".env")

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 30
    database_url: str = "sqlite:///./hookshade.db"
    seed_email: str = "analyst@hookshade.local"
    seed_password: str = "changeme123"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/config.py && git commit -m "feat: add backend settings"
```

---

### Task 3: Database + models

**Files:**
- Create: `backend/app/database.py`, `backend/app/models.py`
- Test: `backend/tests/conftest.py` (partial — DB fixture)

- [ ] **Step 1: Write database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Write models.py**

```python
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    source_type: Mapped[str] = mapped_column(String(10))  # eml | text
    status: Mapped[str] = mapped_column(String(20), default="completed")
    raw_content: Mapped[str] = mapped_column(Text)
    parsed_headers: Mapped[dict] = mapped_column(JSON, default=dict)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    severity: Mapped[str] = mapped_column(String(10), default="baixo")
    confidence: Mapped[str] = mapped_column(String(10), default="low")
    summary: Mapped[str] = mapped_column(Text, default="")
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)

    iocs: Mapped[list["IOC"]] = relationship(cascade="all, delete-orphan")
    findings: Mapped[list["Finding"]] = relationship(cascade="all, delete-orphan")
    recommendations: Mapped[list["Recommendation"]] = relationship(cascade="all, delete-orphan")


class IOC(Base):
    __tablename__ = "iocs"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"))
    type: Mapped[str] = mapped_column(String(20))  # domain|url|ip|email|hash
    value_defanged: Mapped[str] = mapped_column(String(2048))
    value_hash: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(40), default="parser")
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Finding(Base):
    __tablename__ = "findings"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"))
    category: Mapped[str] = mapped_column(String(20))  # auth|url|content|attachment|structural
    severity: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    weight_contribution: Mapped[int] = mapped_column(Integer, default=0)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"))
    priority: Mapped[str] = mapped_column(String(10))  # low|medium|high
    action_type: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
```

- [ ] **Step 3: Write conftest.py with in-memory DB fixture**

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 4: Write a smoke test for models**

Create `backend/tests/test_models.py`:
```python
from app.models import Analysis, User


def test_can_persist_user_and_analysis(db_session):
    user = User(name="A", email="a@b.com", password_hash="x")
    db_session.add(user)
    db_session.commit()
    analysis = Analysis(
        submitted_by=user.id, source_type="text", raw_content="hi",
        sha256="0" * 64, risk_score=10, severity="baixo",
    )
    db_session.add(analysis)
    db_session.commit()
    assert analysis.id is not None
    assert analysis.iocs == []
```

- [ ] **Step 5: Run test**

Run: `.venv/Scripts/python -m pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/database.py backend/app/models.py backend/tests/ && git commit -m "feat: add database and ORM models"
```

---

### Task 4: Analysis shared types

**Files:**
- Create: `backend/app/analysis/types.py`

- [ ] **Step 1: Write types.py**

```python
from dataclasses import dataclass, field


@dataclass
class AttachmentMeta:
    filename: str
    mime_type: str
    size: int
    sha256: str


@dataclass
class ParsedEmail:
    headers: dict[str, str]
    from_addr: str
    from_domain: str
    from_display: str
    reply_to: str
    return_path: str
    message_id: str
    message_id_domain: str
    received: list[str]
    subject: str
    body_text: str
    body_html: str
    urls: list[str]
    attachments: list[AttachmentMeta]
    auth_results_raw: str


@dataclass
class IOCItem:
    type: str          # domain|url|ip|email|hash
    value: str
    value_defanged: str
    value_hash: str


@dataclass
class FindingItem:
    category: str      # auth|url|content|attachment|structural
    severity: str      # baixo|médio|alto|crítico
    title: str
    description: str
    weight_contribution: int = 0


@dataclass
class RecItem:
    priority: str      # low|medium|high
    action_type: str
    description: str


@dataclass
class AnalysisResult:
    risk_score: int
    severity: str
    confidence: str
    summary: str
    parsed_headers: dict[str, str]
    iocs: list[IOCItem] = field(default_factory=list)
    findings: list[FindingItem] = field(default_factory=list)
    recommendations: list[RecItem] = field(default_factory=list)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/analysis/types.py && git commit -m "feat: add analysis shared types"
```

---

### Task 5: Email parser

**Files:**
- Create: `backend/app/analysis/parser.py`
- Test: `backend/tests/test_parser.py`, `backend/tests/fixtures/benign.eml`, `backend/tests/fixtures/phishing.eml`

- [ ] **Step 1: Create fixture benign.eml**

Create `backend/tests/fixtures/benign.eml`:
```
From: Contoso Billing <billing@contoso.com>
Reply-To: billing@contoso.com
Return-Path: <billing@contoso.com>
Message-ID: <abc123@contoso.com>
Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=contoso.com; dkim=pass header.d=contoso.com; dmarc=pass header.from=contoso.com
Received: from mail.contoso.com (mail.contoso.com [203.0.113.10]) by mx.example.com
Subject: Your monthly invoice is ready
Content-Type: text/plain

Hello, your invoice for this month is available in your account portal at https://contoso.com/invoices. Thank you.
```

- [ ] **Step 2: Create fixture phishing.eml**

Create `backend/tests/fixtures/phishing.eml`:
```
From: Microsoft 365 Security <security@micros0ft-support.com>
Reply-To: recovery@mail.ru
Return-Path: <bounce@sketchy-host.ru>
Message-ID: <9931@sketchy-host.ru>
Authentication-Results: mx.example.com; spf=fail smtp.mailfrom=sketchy-host.ru; dkim=none; dmarc=fail header.from=micros0ft-support.com
Received: from unknown (10.20.30.40) by mx.example.com
Subject: URGENT: Your password will expire in 24 hours - verify now
Content-Type: text/plain

Your account has been flagged. You must verify your credentials immediately or your account will be permanently suspended. Click here to reset your password: http://bit.ly/verify-now-account
```

- [ ] **Step 3: Write failing tests**

Create `backend/tests/test_parser.py`:
```python
from pathlib import Path

from app.analysis.parser import parse_email

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_parses_from_domain_and_display():
    parsed = parse_email(_load("benign.eml"))
    assert parsed.from_addr == "billing@contoso.com"
    assert parsed.from_domain == "contoso.com"
    assert parsed.from_display == "Contoso Billing"


def test_extracts_urls():
    parsed = parse_email(_load("benign.eml"))
    assert "https://contoso.com/invoices" in parsed.urls


def test_parses_auth_results_and_mismatched_domains():
    parsed = parse_email(_load("phishing.eml"))
    assert parsed.from_domain == "micros0ft-support.com"
    assert parsed.return_path == "bounce@sketchy-host.ru"
    assert parsed.message_id_domain == "sketchy-host.ru"
    assert "spf=fail" in parsed.auth_results_raw


def test_handles_raw_text_without_full_headers():
    parsed = parse_email("Subject: hi\n\nSome body with http://evil.example/login")
    assert parsed.subject == "hi"
    assert "http://evil.example/login" in parsed.urls
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_parser.py -v`
Expected: FAIL (ImportError: cannot import name parse_email)

- [ ] **Step 5: Implement parser.py**

```python
import hashlib
import re
from email import message_from_string
from email.message import Message
from email.utils import getaddresses, parseaddr

from app.analysis.types import AttachmentMeta, ParsedEmail

_URL_RE = re.compile(r"https?://[^\s\"'<>)\]]+", re.IGNORECASE)


def _domain_of(addr: str) -> str:
    return addr.split("@", 1)[1].lower() if "@" in addr else ""


def _bodies(msg: Message) -> tuple[str, str, list[AttachmentMeta]]:
    text, html, attachments = "", "", []
    if msg.is_multipart():
        for part in msg.walk():
            if part.is_multipart():
                continue
            disp = str(part.get("Content-Disposition") or "")
            ctype = part.get_content_type()
            if "attachment" in disp.lower():
                payload = part.get_payload(decode=True) or b""
                attachments.append(AttachmentMeta(
                    filename=part.get_filename() or "unnamed",
                    mime_type=ctype,
                    size=len(payload),
                    sha256=hashlib.sha256(payload).hexdigest(),
                ))
            elif ctype == "text/plain":
                text += part.get_payload(decode=True).decode(errors="replace") if part.get_payload(decode=True) else ""
            elif ctype == "text/html":
                html += part.get_payload(decode=True).decode(errors="replace") if part.get_payload(decode=True) else ""
    else:
        payload = msg.get_payload(decode=True)
        body = payload.decode(errors="replace") if payload else (msg.get_payload() or "")
        if msg.get_content_type() == "text/html":
            html = body
        else:
            text = body
    return text, html, attachments


def parse_email(raw: str) -> ParsedEmail:
    msg = message_from_string(raw)
    headers = {k: str(v) for k, v in msg.items()}

    from_display, from_addr = parseaddr(msg.get("From", ""))
    _, reply_to = parseaddr(msg.get("Reply-To", ""))
    _, return_path = parseaddr(msg.get("Return-Path", ""))
    message_id = (msg.get("Message-ID", "") or "").strip("<>")

    body_text, body_html, attachments = _bodies(msg)
    urls = sorted(set(_URL_RE.findall(f"{body_text}\n{body_html}")))

    received = [str(v) for k, v in msg.items() if k.lower() == "received"]

    return ParsedEmail(
        headers=headers,
        from_addr=from_addr.lower(),
        from_domain=_domain_of(from_addr),
        from_display=from_display,
        reply_to=reply_to.lower(),
        return_path=return_path.lower(),
        message_id=message_id,
        message_id_domain=_domain_of(message_id) if "@" in message_id else message_id.split("@")[-1] if "@" in message_id else _domain_of(message_id),
        received=received,
        subject=msg.get("Subject", ""),
        body_text=body_text,
        body_html=body_html,
        urls=urls,
        attachments=attachments,
        auth_results_raw=str(msg.get("Authentication-Results", "")),
    )
```

Note: `message_id_domain` — Message-ID is like `9931@sketchy-host.ru`; `_domain_of` on it returns `sketchy-host.ru`. Simplify the line to `message_id_domain=_domain_of(message_id)`.

- [ ] **Step 6: Simplify message_id_domain line**

Replace the tangled `message_id_domain=...` line with:
```python
        message_id_domain=_domain_of(message_id),
```

- [ ] **Step 7: Run tests**

Run: `.venv/Scripts/python -m pytest tests/test_parser.py -v`
Expected: PASS (4 passed)

- [ ] **Step 8: Commit**

```bash
git add backend/app/analysis/parser.py backend/tests/test_parser.py backend/tests/fixtures/ && git commit -m "feat: add email parser"
```

---

### Task 6: IOC extraction + defang

**Files:**
- Create: `backend/app/analysis/iocs.py`
- Test: `backend/tests/test_iocs.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_iocs.py`:
```python
from pathlib import Path

from app.analysis.iocs import defang, extract_iocs
from app.analysis.parser import parse_email

FIXTURES = Path(__file__).parent / "fixtures"


def test_defang_replaces_dots_and_scheme():
    assert defang("http://bit.ly/x") == "hxxp://bit[.]ly/x"
    assert defang("contoso.com") == "contoso[.]com"


def test_extract_iocs_types_and_dedup():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    iocs = extract_iocs(parsed)
    types = {i.type for i in iocs}
    assert "url" in types
    assert "domain" in types
    assert "email" in types
    # every ioc carries a defanged value and a hash
    for i in iocs:
        assert "[.]" in i.value_defanged or i.type == "hash"
        assert len(i.value_hash) == 64


def test_iocs_are_deduplicated():
    parsed = parse_email("Body http://a.com/1 http://a.com/1")
    urls = [i for i in extract_iocs(parsed) if i.type == "url"]
    assert len(urls) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_iocs.py -v`
Expected: FAIL (ImportError)

- [ ] **Step 3: Implement iocs.py**

```python
import hashlib
import re
from urllib.parse import urlparse

from app.analysis.types import IOCItem, ParsedEmail

_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def defang(value: str) -> str:
    return value.replace("http://", "hxxp://").replace("https://", "hxxps://").replace(".", "[.]")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _mk(type_: str, value: str) -> IOCItem:
    return IOCItem(type=type_, value=value, value_defanged=defang(value), value_hash=_hash(value))


def extract_iocs(parsed: ParsedEmail) -> list[IOCItem]:
    seen: set[tuple[str, str]] = set()
    out: list[IOCItem] = []

    def add(type_: str, value: str) -> None:
        value = value.strip().lower()
        if not value or (type_, value) in seen:
            return
        seen.add((type_, value))
        out.append(_mk(type_, value))

    for url in parsed.urls:
        add("url", url)
        host = urlparse(url).hostname or ""
        if host:
            if _IP_RE.fullmatch(host):
                add("ip", host)
            else:
                add("domain", host)

    for addr in (parsed.from_addr, parsed.reply_to, parsed.return_path):
        if "@" in addr:
            add("email", addr)
            add("domain", addr.split("@", 1)[1])

    for att in parsed.attachments:
        # hash IOC is not defanged
        item = IOCItem(type="hash", value=att.sha256, value_defanged=att.sha256, value_hash=att.sha256)
        if ("hash", att.sha256) not in seen:
            seen.add(("hash", att.sha256))
            out.append(item)

    for ip in _IP_RE.findall(" ".join(parsed.received)):
        add("ip", ip)

    return out
```

- [ ] **Step 4: Run tests**

Run: `.venv/Scripts/python -m pytest tests/test_iocs.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/analysis/iocs.py backend/tests/test_iocs.py && git commit -m "feat: add IOC extraction and defang"
```

---

### Task 7: Authentication analysis

**Files:**
- Create: `backend/app/analysis/auth_analysis.py`
- Test: `backend/tests/test_auth_analysis.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_auth_analysis.py`:
```python
from pathlib import Path

from app.analysis.auth_analysis import analyze_authentication
from app.analysis.parser import parse_email

FIXTURES = Path(__file__).parent / "fixtures"


def test_benign_passes_auth_low_subscore():
    parsed = parse_email((FIXTURES / "benign.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_authentication(parsed)
    assert subscore < 0.3
    assert all(f.category == "auth" for f in findings)


def test_phishing_fails_auth_high_subscore():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_authentication(parsed)
    assert subscore >= 0.6
    titles = " ".join(f.title.lower() for f in findings)
    assert "dmarc" in titles or "spf" in titles
    # alignment mismatch between From and Return-Path domains
    assert any("alinhamento" in f.title.lower() or "alignment" in f.title.lower() for f in findings)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_auth_analysis.py -v`
Expected: FAIL (ImportError)

- [ ] **Step 3: Implement auth_analysis.py**

```python
import re

from app.analysis.types import FindingItem, ParsedEmail


def _verdict(raw: str, mechanism: str) -> str:
    m = re.search(rf"{mechanism}\s*=\s*(\w+)", raw, re.IGNORECASE)
    return m.group(1).lower() if m else "none"


def analyze_authentication(parsed: ParsedEmail) -> tuple[list[FindingItem], float]:
    findings: list[FindingItem] = []
    raw = parsed.auth_results_raw
    penalty = 0.0

    for mech, weight, crit in (("spf", 0.25, "médio"), ("dkim", 0.25, "médio"), ("dmarc", 0.35, "alto")):
        v = _verdict(raw, mech)
        if v in ("fail", "none", "softfail", "permerror", "temperror"):
            penalty += weight
            findings.append(FindingItem(
                category="auth",
                severity=crit if v == "fail" else "médio",
                title=f"{mech.upper()} {v}",
                description=f"Resultado de {mech.upper()} = {v} no header Authentication-Results.",
            ))

    # Domain alignment: From vs Return-Path vs Reply-To
    fd = parsed.from_domain
    for label, other in (("Return-Path", parsed.return_path), ("Reply-To", parsed.reply_to)):
        od = other.split("@", 1)[1] if "@" in other else ""
        if fd and od and od != fd:
            penalty += 0.2
            findings.append(FindingItem(
                category="auth",
                severity="alto",
                title=f"Desalinhamento de domínio ({label})",
                description=f"Domínio do From ({fd}) difere de {label} ({od}).",
            ))

    if parsed.message_id_domain and fd and parsed.message_id_domain != fd:
        penalty += 0.1
        findings.append(FindingItem(
            category="auth",
            severity="médio",
            title="Message-ID de domínio distinto",
            description=f"Message-ID usa domínio {parsed.message_id_domain}, diferente do From ({fd}).",
        ))

    return findings, min(penalty, 1.0)
```

- [ ] **Step 4: Run tests**

Run: `.venv/Scripts/python -m pytest tests/test_auth_analysis.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/analysis/auth_analysis.py backend/tests/test_auth_analysis.py && git commit -m "feat: add email authentication analysis"
```

---

### Task 8: Content heuristics

**Files:**
- Create: `backend/app/analysis/content.py`
- Test: `backend/tests/test_content.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_content.py`:
```python
from pathlib import Path

from app.analysis.content import analyze_content
from app.analysis.parser import parse_email

FIXTURES = Path(__file__).parent / "fixtures"


def test_benign_low_content_subscore():
    parsed = parse_email((FIXTURES / "benign.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_content(parsed)
    assert subscore < 0.3


def test_phishing_flags_urgency_and_credentials():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_content(parsed)
    assert subscore >= 0.5
    titles = " ".join(f.title.lower() for f in findings)
    assert "urgência" in titles or "urgencia" in titles
    assert "credencial" in titles or "senha" in titles
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_content.py -v`
Expected: FAIL (ImportError)

- [ ] **Step 3: Implement content.py**

```python
from app.analysis.types import FindingItem, ParsedEmail

_SIGNALS: list[tuple[str, str, list[str]]] = [
    ("urgência", "Urgência / pressão temporal", ["urgent", "urgente", "immediately", "imediatamente", "24 hours", "expire", "expira", "now", "agora"]),
    ("credencial", "Pedido de credencial / senha", ["password", "senha", "verify", "verifique", "credential", "credencial", "reset", "login"]),
    ("ameaça", "Ameaça / consequência", ["suspend", "suspens", "flagged", "blocked", "bloquead", "permanently", "permanente"]),
    ("recompensa", "Recompensa / isca", ["reward", "prize", "prêmio", "premio", "winner", "ganhou", "refund", "reembolso"]),
    ("financeiro", "Cobrança / financeiro", ["invoice fraud", "boleto", "payment", "pagamento", "wire transfer", "transferência"]),
]


def analyze_content(parsed: ParsedEmail) -> tuple[list[FindingItem], float]:
    corpus = f"{parsed.subject}\n{parsed.body_text}\n{parsed.body_html}".lower()
    findings: list[FindingItem] = []
    hits = 0
    for _key, title, kws in _SIGNALS:
        if any(kw in corpus for kw in kws):
            hits += 1
            findings.append(FindingItem(
                category="content",
                severity="médio",
                title=title,
                description="Sinal de engenharia social detectado no assunto/corpo.",
            ))
    subscore = min(hits / 3.0, 1.0)  # 3+ distinct signals => saturates
    return findings, subscore
```

- [ ] **Step 4: Run tests**

Run: `.venv/Scripts/python -m pytest tests/test_content.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/analysis/content.py backend/tests/test_content.py && git commit -m "feat: add content heuristics"
```

---

### Task 9: Structural IOC heuristics + scoring engine

**Files:**
- Create: `backend/app/analysis/scoring.py`
- Test: `backend/tests/test_scoring.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_scoring.py`:
```python
from pathlib import Path

from app.analysis.parser import parse_email
from app.analysis.scoring import score

FIXTURES = Path(__file__).parent / "fixtures"


def test_benign_low_risk():
    parsed = parse_email((FIXTURES / "benign.eml").read_text(encoding="utf-8"))
    result = score(parsed)
    assert result.risk_score < 30
    assert result.severity in ("baixo", "médio")


def test_phishing_high_risk_with_explainable_findings():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    result = score(parsed)
    assert result.risk_score >= 60
    assert result.severity in ("alto", "crítico")
    # explainability: weight contributions sum to roughly the risk score
    total = sum(f.weight_contribution for f in result.findings)
    assert abs(total - result.risk_score) <= 5
    assert result.recommendations
    assert result.summary


def test_lookalike_and_shortener_structural_findings():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    result = score(parsed)
    titles = " ".join(f.title.lower() for f in result.findings)
    assert "lookalike" in titles or "similar" in titles or "encurtador" in titles or "punycode" in titles
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: FAIL (ImportError)

- [ ] **Step 3: Implement scoring.py**

```python
from urllib.parse import urlparse

from app.analysis.auth_analysis import analyze_authentication
from app.analysis.content import analyze_content
from app.analysis.iocs import extract_iocs
from app.analysis.types import AnalysisResult, FindingItem, ParsedEmail, RecItem

_WEIGHTS = {"auth": 20, "structural": 25, "content": 20, "attachment": 15}
_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"}
_BRANDS = {"microsoft", "office365", "office", "paypal", "apple", "google", "amazon", "netflix", "banco", "itau", "bradesco", "nubank"}


def _structural(parsed: ParsedEmail) -> tuple[list[FindingItem], float]:
    findings: list[FindingItem] = []
    penalty = 0.0
    hosts = {urlparse(u).hostname or "" for u in parsed.urls}
    for host in filter(None, hosts):
        if host in _SHORTENERS:
            penalty += 0.4
            findings.append(FindingItem("url", "médio", f"Encurtador de URL ({host})",
                                        f"URL usa encurtador {host}, ocultando o destino real."))
        if "xn--" in host:
            penalty += 0.5
            findings.append(FindingItem("url", "alto", f"Domínio punycode ({host})",
                                        "Domínio internacionalizado (punycode) pode imitar marca legítima."))

    # lookalike: brand token appears in from-domain but domain isn't the plain brand
    fd = parsed.from_domain
    for brand in _BRANDS:
        if brand in fd.replace("0", "o").replace("1", "l") and not fd.startswith(f"{brand}."):
            penalty += 0.5
            findings.append(FindingItem("url", "alto", f"Domínio lookalike de marca ({fd})",
                                        f"Domínio do remetente lembra a marca '{brand}' mas não é o domínio oficial."))
            break

    if parsed.attachments:
        risky = {".exe", ".scr", ".js", ".vbs", ".zip", ".rar", ".docm", ".xlsm", ".html", ".htm"}
        for att in parsed.attachments:
            ext = "." + att.filename.rsplit(".", 1)[-1].lower() if "." in att.filename else ""
            if ext in risky:
                penalty += 0.4
                findings.append(FindingItem("attachment", "alto", f"Anexo de extensão arriscada ({att.filename})",
                                            f"Anexo {att.filename} ({att.mime_type}) tem extensão de risco. Nunca executado; apenas hash/metadados."))
    return findings, min(penalty, 1.0)


def _severity_from_score(s: int) -> str:
    if s >= 75:
        return "crítico"
    if s >= 50:
        return "alto"
    if s >= 20:
        return "médio"
    return "baixo"


def _confidence(parsed: ParsedEmail) -> str:
    has_auth = bool(parsed.auth_results_raw.strip())
    has_headers = bool(parsed.from_domain)
    if has_auth and has_headers:
        return "high"
    if has_headers:
        return "medium"
    return "low"


def score(parsed: ParsedEmail) -> AnalysisResult:
    auth_findings, auth_sub = analyze_authentication(parsed)
    struct_findings, struct_sub = _structural(parsed)
    content_findings, content_sub = analyze_content(parsed)

    # attachment subscore folded into structural findings; compute from attachment findings
    att_findings = [f for f in struct_findings if f.category == "attachment"]
    att_sub = min(len(att_findings) * 0.5, 1.0)
    struct_only = [f for f in struct_findings if f.category != "attachment"]
    struct_sub_only = min(struct_sub, 1.0)

    parts = {
        "auth": auth_sub * _WEIGHTS["auth"],
        "structural": struct_sub_only * _WEIGHTS["structural"],
        "content": content_sub * _WEIGHTS["content"],
        "attachment": att_sub * _WEIGHTS["attachment"],
    }
    risk = round(sum(parts.values()))
    risk = max(0, min(100, risk))

    # distribute weight_contribution across findings per category, proportional
    all_findings = auth_findings + struct_only + content_findings + att_findings
    by_cat = {
        "auth": (auth_findings, parts["auth"]),
        "structural": (struct_only, parts["structural"]),
        "content": (content_findings, parts["content"]),
        "attachment": (att_findings, parts["attachment"]),
    }
    for _cat, (flist, pts) in by_cat.items():
        if flist:
            per = round(pts / len(flist))
            for f in flist:
                f.weight_contribution = per

    severity = _severity_from_score(risk)
    iocs = extract_iocs(parsed)

    recs = _recommendations(severity, auth_findings, struct_only)
    summary = _summary(parsed, severity, risk, all_findings)

    return AnalysisResult(
        risk_score=risk,
        severity=severity,
        confidence=_confidence(parsed),
        summary=summary,
        parsed_headers=parsed.headers,
        iocs=iocs,
        findings=all_findings,
        recommendations=recs,
    )


def _summary(parsed: ParsedEmail, severity: str, risk: int, findings: list[FindingItem]) -> str:
    top = "; ".join(f.title for f in findings[:3]) or "sem sinais relevantes"
    return f"E-mail de {parsed.from_domain or 'remetente desconhecido'} classificado como severidade {severity} (score {risk}). Principais evidências: {top}."


def _recommendations(severity: str, auth_findings, struct_findings) -> list[RecItem]:
    recs: list[RecItem] = []
    if severity in ("alto", "crítico"):
        recs.append(RecItem("high", "block_domain", "Bloquear domínio remetente no gateway de e-mail."))
        recs.append(RecItem("high", "threat_hunt", "Caça retroativa por assunto, remetente e URLs relacionadas."))
    if auth_findings:
        recs.append(RecItem("medium", "review_auth", "Revisar políticas SPF/DKIM/DMARC e autenticações recentes do usuário alvo."))
    if struct_findings:
        recs.append(RecItem("medium", "block_urls", "Bloquear/inspecionar URLs suspeitas em ambiente isolado."))
    if not recs:
        recs.append(RecItem("low", "monitor", "Nenhuma ação urgente; manter monitoramento padrão."))
    return recs
```

- [ ] **Step 4: Run tests**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Run full analysis suite**

Run: `.venv/Scripts/python -m pytest tests/test_parser.py tests/test_iocs.py tests/test_auth_analysis.py tests/test_content.py tests/test_scoring.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/analysis/scoring.py backend/tests/test_scoring.py && git commit -m "feat: add structural heuristics and scoring engine"
```

---

### Task 10: Pipeline

**Files:**
- Create: `backend/app/analysis/pipeline.py`

- [ ] **Step 1: Implement pipeline.py**

```python
import hashlib

from app.analysis.scoring import score
from app.analysis.parser import parse_email
from app.analysis.types import AnalysisResult


def run_analysis(raw: str) -> tuple[AnalysisResult, str]:
    """Parse + score raw email content. Returns (result, sha256_of_raw)."""
    sha256 = hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()
    parsed = parse_email(raw)
    result = score(parsed)
    return result, sha256
```

- [ ] **Step 2: Write a quick test**

Add to a new file `backend/tests/test_pipeline.py`:
```python
from pathlib import Path

from app.analysis.pipeline import run_analysis

FIXTURES = Path(__file__).parent / "fixtures"


def test_run_analysis_returns_result_and_hash():
    raw = (FIXTURES / "phishing.eml").read_text(encoding="utf-8")
    result, sha = run_analysis(raw)
    assert len(sha) == 64
    assert result.risk_score >= 60
```

- [ ] **Step 3: Run test**

Run: `.venv/Scripts/python -m pytest tests/test_pipeline.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/analysis/pipeline.py backend/tests/test_pipeline.py && git commit -m "feat: add analysis pipeline"
```

---

### Task 11: Security (hashing + JWT) and schemas

**Files:**
- Create: `backend/app/security.py`, `backend/app/schemas.py`

- [ ] **Step 1: Implement security.py**

```python
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_ALGO = "HS256"


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": subject, "exp": expire}, settings.secret_key, algorithm=_ALGO)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGO])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
```

- [ ] **Step 2: Implement schemas.py**

```python
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class AnalyzeTextRequest(BaseModel):
    content: str
    context: str | None = None


class IOCOut(BaseModel):
    type: str
    value_defanged: str
    value_hash: str


class FindingOut(BaseModel):
    category: str
    severity: str
    title: str
    description: str
    weight_contribution: int


class RecommendationOut(BaseModel):
    priority: str
    action_type: str
    description: str


class AnalysisSummary(BaseModel):
    id: int
    source_type: str
    severity: str
    risk_score: int
    confidence: str
    summary: str
    created_at: datetime


class AnalysisDetail(AnalysisSummary):
    parsed_headers: dict[str, str]
    iocs: list[IOCOut]
    findings: list[FindingOut]
    recommendations: list[RecommendationOut]
```

- [ ] **Step 3: Write a security test**

Create `backend/tests/test_security.py`:
```python
from app.security import create_access_token, decode_token, hash_password, verify_password


def test_password_roundtrip():
    h = hash_password("secret123")
    assert verify_password("secret123", h)
    assert not verify_password("wrong", h)


def test_token_roundtrip():
    token = create_access_token("analyst@hookshade.local")
    assert decode_token(token) == "analyst@hookshade.local"


def test_bad_token_returns_none():
    assert decode_token("garbage") is None
```

- [ ] **Step 4: Run test**

Run: `.venv/Scripts/python -m pytest tests/test_security.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/security.py backend/app/schemas.py backend/tests/test_security.py && git commit -m "feat: add security helpers and API schemas"
```

---

### Task 12: Dependencies, seed, and app wiring

**Files:**
- Create: `backend/app/deps.py`, `backend/app/seed.py`, `backend/app/routers/auth.py`, `backend/app/routers/analyses.py`, `backend/app/main.py`

- [ ] **Step 1: Implement deps.py**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.security import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    email = decode_token(creds.credentials)
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user
```

- [ ] **Step 2: Implement seed.py**

```python
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.seed_email).first()
        if not existing:
            db.add(User(
                name="Analyst",
                email=settings.seed_email,
                password_hash=hash_password(settings.seed_password),
            ))
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("DB initialized and seed user ensured.")
```

- [ ] **Step 3: Implement routers/auth.py**

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return TokenResponse(access_token=create_access_token(user.email))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, name=user.name, email=user.email)
```

- [ ] **Step 4: Implement routers/analyses.py**

```python
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.analysis.pipeline import run_analysis
from app.deps import get_current_user, get_db
from app.models import IOC, Analysis, Finding, Recommendation, User
from app.schemas import (
    AnalysisDetail, AnalysisSummary, AnalyzeTextRequest,
    FindingOut, IOCOut, RecommendationOut,
)

router = APIRouter(prefix="/api/v1/analyses", tags=["analyses"])
_MAX_BYTES = 5 * 1024 * 1024


def _persist(db: Session, user: User, raw: str, source_type: str, context: str | None) -> Analysis:
    result, sha256 = run_analysis(raw)
    analysis = Analysis(
        submitted_by=user.id, source_type=source_type, status="completed",
        raw_content=raw, parsed_headers=result.parsed_headers, sha256=sha256,
        risk_score=result.risk_score, severity=result.severity,
        confidence=result.confidence, summary=result.summary, context=context,
    )
    analysis.iocs = [IOC(type=i.type, value_defanged=i.value_defanged, value_hash=i.value_hash) for i in result.iocs]
    analysis.findings = [Finding(category=f.category, severity=f.severity, title=f.title,
                                 description=f.description, weight_contribution=f.weight_contribution)
                         for f in result.findings]
    analysis.recommendations = [Recommendation(priority=r.priority, action_type=r.action_type, description=r.description)
                                for r in result.recommendations]
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def _to_detail(a: Analysis) -> AnalysisDetail:
    return AnalysisDetail(
        id=a.id, source_type=a.source_type, severity=a.severity, risk_score=a.risk_score,
        confidence=a.confidence, summary=a.summary, created_at=a.created_at,
        parsed_headers=a.parsed_headers or {},
        iocs=[IOCOut(type=i.type, value_defanged=i.value_defanged, value_hash=i.value_hash) for i in a.iocs],
        findings=[FindingOut(category=f.category, severity=f.severity, title=f.title,
                             description=f.description, weight_contribution=f.weight_contribution) for f in a.findings],
        recommendations=[RecommendationOut(priority=r.priority, action_type=r.action_type, description=r.description)
                         for r in a.recommendations],
    )


@router.post("", response_model=AnalysisDetail)
async def create_analysis(
    file: UploadFile | None = File(default=None),
    content: str | None = Form(default=None),
    context: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file is not None:
        data = await file.read()
        if len(data) > _MAX_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")
        raw = data.decode("utf-8", errors="replace")
        source_type = "eml"
    elif content:
        raw = content
        source_type = "text"
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide 'file' or 'content'")
    analysis = _persist(db, user, raw, source_type, context)
    return _to_detail(analysis)


@router.post("/text", response_model=AnalysisDetail)
def create_analysis_text(
    body: AnalyzeTextRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.content.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Empty content")
    return _to_detail(_persist(db, user, body.content, "text", body.context))


@router.get("", response_model=list[AnalysisSummary])
def list_analyses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Analysis).order_by(Analysis.created_at.desc()).all()
    return [AnalysisSummary(id=a.id, source_type=a.source_type, severity=a.severity,
                            risk_score=a.risk_score, confidence=a.confidence,
                            summary=a.summary, created_at=a.created_at) for a in rows]


@router.get("/{analysis_id}", response_model=AnalysisDetail)
def get_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return _to_detail(a)
```

Note: a JSON endpoint `/text` is added alongside the multipart root so the frontend can submit pasted text as JSON. Both reuse `_persist`.

- [ ] **Step 5: Implement main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analyses, auth
from app.seed import init_db

app = FastAPI(title="Hookshade API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analyses.router)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/deps.py backend/app/seed.py backend/app/routers/ backend/app/main.py && git commit -m "feat: wire FastAPI app, auth and analyses routers, seed"
```

---

### Task 13: API integration tests

**Files:**
- Create: `backend/tests/test_api_auth.py`, `backend/tests/test_api_analyses.py`
- Modify: `backend/tests/conftest.py` (add `client` fixture)

- [ ] **Step 1: Add client fixture to conftest.py**

Append to `backend/tests/conftest.py`:
```python
from fastapi.testclient import TestClient

from app.deps import get_db
from app.main import app
from app.models import User
from app.security import hash_password


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    db_session.add(User(name="Analyst", email="analyst@hookshade.local",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Note: `TestClient(app)` triggers the startup event which calls `init_db()` against the real engine; that is harmless (creates file DB) but tests use the overridden `db_session`. To avoid the file DB during tests, guard `init_db` — see Step 2.

- [ ] **Step 2: Guard startup init in tests**

Modify `backend/app/main.py` startup to be import-safe by wrapping in try/except so a missing/locked DB during tests doesn't fail:
```python
@app.on_event("startup")
def _startup() -> None:
    try:
        init_db()
    except Exception:
        pass
```

- [ ] **Step 3: Write auth API tests**

Create `backend/tests/test_api_auth.py`:
```python
def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_login_success(client):
    assert _token(client)


def test_login_bad_password(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    token = _token(client)
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "analyst@hookshade.local"
```

- [ ] **Step 4: Write analyses API tests**

Create `backend/tests/test_api_analyses.py`:
```python
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return r.json()["access_token"]


def test_create_analysis_from_text_and_fetch(client):
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    raw = (FIXTURES / "phishing.eml").read_text(encoding="utf-8")
    r = client.post("/api/v1/analyses/text", json={"content": raw}, headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["risk_score"] >= 60
    assert detail["severity"] in ("alto", "crítico")
    assert detail["findings"]

    aid = detail["id"]
    r2 = client.get(f"/api/v1/analyses/{aid}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["id"] == aid

    r3 = client.get("/api/v1/analyses", headers=headers)
    assert r3.status_code == 200
    assert any(a["id"] == aid for a in r3.json())


def test_create_analysis_from_eml_upload(client):
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    raw = (FIXTURES / "benign.eml").read_bytes()
    r = client.post("/api/v1/analyses",
                    files={"file": ("benign.eml", raw, "message/rfc822")}, headers=headers)
    assert r.status_code == 200
    assert r.json()["risk_score"] < 30


def test_analyses_require_auth(client):
    assert client.get("/api/v1/analyses").status_code == 401
```

- [ ] **Step 5: Run the full backend suite**

Run: `.venv/Scripts/python -m pytest -v`
Expected: all tests PASS

- [ ] **Step 6: Manually verify the server boots**

Run: `.venv/Scripts/python -m uvicorn app.main:app --port 8000` then in another shell `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/ backend/app/main.py && git commit -m "test: add API integration tests for auth and analyses"
```

---

# PHASE B — FRONTEND

### Task 14: Frontend scaffold + theme

**Files:**
- Create: `frontend/` via create-next-app, then `frontend/.env.local.example`, edit `frontend/app/globals.css`, `frontend/tailwind.config.ts`

- [ ] **Step 1: Scaffold Next.js app**

Run:
```bash
cd D:/Projetos/hookshade && npx create-next-app@latest frontend --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm
```
Expected: app created under `frontend/`.

- [ ] **Step 2: Create .env.local.example**

Create `frontend/.env.local.example`:
```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```
Then copy to `frontend/.env.local` with the same content.

- [ ] **Step 3: Set dark navy theme tokens in globals.css**

Replace the `:root`/`body` block of `frontend/app/globals.css` body styles with a dark navy base:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #040d1a;
  --panel: #0a1a2f;
  --accent: #7c5cff;      /* azul-violeta */
  --text: #e6edf5;
  --muted: #8aa0b8;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/ && git commit -m "chore: scaffold Next.js frontend with dark navy theme"
```

---

### Task 15: API client, auth storage, and types

**Files:**
- Create: `frontend/lib/types.ts`, `frontend/lib/auth.ts`, `frontend/lib/api.ts`

- [ ] **Step 1: Write types.ts**

```typescript
export interface IOC { type: string; value_defanged: string; value_hash: string; }
export interface Finding {
  category: string; severity: string; title: string; description: string; weight_contribution: number;
}
export interface Recommendation { priority: string; action_type: string; description: string; }
export interface AnalysisSummary {
  id: number; source_type: string; severity: string; risk_score: number;
  confidence: string; summary: string; created_at: string;
}
export interface AnalysisDetail extends AnalysisSummary {
  parsed_headers: Record<string, string>;
  iocs: IOC[]; findings: Finding[]; recommendations: Recommendation[];
}
```

- [ ] **Step 2: Write auth.ts**

```typescript
const KEY = "hookshade_token";
export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(KEY) : null);
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);
```

- [ ] **Step 3: Write api.ts**

```typescript
import { getToken } from "./auth";
import type { AnalysisDetail, AnalysisSummary } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<string> {
  const data = await req<{ access_token: string }>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

export const listAnalyses = () => req<AnalysisSummary[]>("/api/v1/analyses");
export const getAnalysis = (id: number) => req<AnalysisDetail>(`/api/v1/analyses/${id}`);

export const analyzeText = (content: string, context?: string) =>
  req<AnalysisDetail>("/api/v1/analyses/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, context }),
  });

export async function analyzeFile(file: File, context?: string): Promise<AnalysisDetail> {
  const form = new FormData();
  form.append("file", file);
  if (context) form.append("context", context);
  return req<AnalysisDetail>("/api/v1/analyses", { method: "POST", body: form });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/ && git commit -m "feat: add frontend api client, auth storage, types"
```

---

### Task 16: Shared components (SeverityBadge, Nav)

**Files:**
- Create: `frontend/components/SeverityBadge.tsx`, `frontend/components/Nav.tsx`

- [ ] **Step 1: Write SeverityBadge.tsx**

```tsx
const COLORS: Record<string, string> = {
  "baixo": "#34d399",
  "médio": "#fbbf24",
  "alto": "#fb923c",
  "crítico": "#f87171",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const color = COLORS[severity] ?? "#8aa0b8";
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}` }}
          className="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide">
      {severity}
    </span>
  );
}
```

- [ ] **Step 2: Write Nav.tsx**

```tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";

export function Nav() {
  const router = useRouter();
  return (
    <nav className="flex items-center gap-6 px-6 py-4 border-b border-white/10">
      <span className="font-bold tracking-wide" style={{ color: "var(--accent)" }}>HOOKSHADE</span>
      <Link href="/nova-analise" className="text-sm text-slate-300 hover:text-white">Nova Análise</Link>
      <Link href="/historico" className="text-sm text-slate-300 hover:text-white">Histórico</Link>
      <button onClick={() => { clearToken(); router.push("/login"); }}
              className="ml-auto text-sm text-slate-400 hover:text-white">Sair</button>
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ && git commit -m "feat: add SeverityBadge and Nav components"
```

---

### Task 17: Login page

**Files:**
- Create: `frontend/app/login/page.tsx`
- Modify: `frontend/app/page.tsx` (redirect to /nova-analise)

- [ ] **Step 1: Write login/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const token = await login(email, password);
      setToken(token);
      router.push("/nova-analise");
    } catch (err) {
      setError((err as Error).message || "Falha no login");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={onSubmit} className="w-80 p-6 rounded-lg space-y-4"
            style={{ background: "var(--panel)" }}>
        <h1 className="text-xl font-bold" style={{ color: "var(--accent)" }}>Hookshade</h1>
        <input className="w-full p-2 rounded bg-black/30 border border-white/10" placeholder="E-mail"
               value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full p-2 rounded bg-black/30 border border-white/10" type="password"
               placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="w-full p-2 rounded font-semibold text-white"
                style={{ background: "var(--accent)" }}>Entrar</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Redirect root page**

Replace `frontend/app/page.tsx` with:
```tsx
import { redirect } from "next/navigation";
export default function Home() { redirect("/nova-analise"); }
```

- [ ] **Step 3: Manually verify**

Run backend (`uvicorn`) and `cd frontend && npm run dev`. Visit `http://localhost:3000/login`, log in with seed creds. Expected: redirect to /nova-analise.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/login/ frontend/app/page.tsx && git commit -m "feat: add login page"
```

---

### Task 18: Nova Análise page

**Files:**
- Create: `frontend/app/nova-analise/page.tsx`

- [ ] **Step 1: Write nova-analise/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeFile, analyzeText } from "@/lib/api";
import { Nav } from "@/components/Nav";

export default function NovaAnalisePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = file
        ? await analyzeFile(file, context || undefined)
        : await analyzeText(text, context || undefined);
      router.push(`/resultado/${result.id}`);
    } catch (err) {
      setError((err as Error).message || "Falha na análise");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-lg font-semibold">Nova Análise</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Arquivo .eml</label>
            <input type="file" accept=".eml,message/rfc822"
                   onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                   className="block w-full mt-1 text-sm" />
          </div>
          <div className="text-center text-xs text-slate-500">ou cole headers/corpo abaixo</div>
          <textarea className="w-full h-48 p-2 rounded bg-black/30 border border-white/10 font-mono text-sm"
                    placeholder="Cole o e-mail bruto aqui" value={text}
                    onChange={(e) => setText(e.target.value)} disabled={!!file} />
          <input className="w-full p-2 rounded bg-black/30 border border-white/10"
                 placeholder="Contexto (opcional): área afetada, usuário alvo…"
                 value={context} onChange={(e) => setContext(e.target.value)} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button disabled={loading || (!file && !text.trim())}
                  className="px-4 py-2 rounded font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--accent)" }}>
            {loading ? "Analisando…" : "Analisar"}
          </button>
        </form>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Manually verify**

Submit the phishing fixture text. Expected: redirect to `/resultado/<id>`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/nova-analise/ && git commit -m "feat: add nova analise page"
```

---

### Task 19: Resultado + Histórico pages

**Files:**
- Create: `frontend/app/resultado/[id]/page.tsx`, `frontend/app/historico/page.tsx`

- [ ] **Step 1: Write resultado/[id]/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAnalysis } from "@/lib/api";
import type { AnalysisDetail } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Nav } from "@/components/Nav";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-lg" style={{ background: "var(--panel)" }}>
      <h2 className="text-sm font-semibold text-slate-300 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function ResultadoPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAnalysis(Number(id)).then(setA).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return (<><Nav /><main className="p-6 text-red-400">{error}</main></>);
  if (!a) return (<><Nav /><main className="p-6 text-slate-400">Carregando…</main></>);

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Análise #{a.id}</h1>
          <SeverityBadge severity={a.severity} />
          <span className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{a.risk_score}</span>
          <span className="text-xs text-slate-500">confiança: {a.confidence}</span>
        </div>
        <p className="text-slate-300 text-sm">{a.summary}</p>

        <Card title="Evidências (findings)">
          <ul className="space-y-2">
            {a.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <SeverityBadge severity={f.severity} />
                <div>
                  <div className="font-medium">{f.title} <span className="text-slate-500">(+{f.weight_contribution})</span></div>
                  <div className="text-slate-400">{f.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="IOCs (defanged)">
          <ul className="text-sm font-mono space-y-1">
            {a.iocs.map((i, idx) => (
              <li key={idx} className="text-slate-300"><span className="text-slate-500">{i.type}:</span> {i.value_defanged}</li>
            ))}
          </ul>
        </Card>

        <Card title="Recomendações">
          <ul className="text-sm space-y-1 list-disc list-inside text-slate-300">
            {a.recommendations.map((r, i) => (<li key={i}>[{r.priority}] {r.description}</li>))}
          </ul>
        </Card>

        <Card title="Headers">
          <pre className="text-xs text-slate-400 overflow-auto max-h-64">
{Object.entries(a.parsed_headers).map(([k, v]) => `${k}: ${v}`).join("\n")}
          </pre>
        </Card>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Write historico/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Nav } from "@/components/Nav";

export default function HistoricoPage() {
  const [rows, setRows] = useState<AnalysisSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listAnalyses().then(setRows).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-lg font-semibold">Histórico</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">#</th><th>Severidade</th><th>Score</th><th>Resumo</th><th>Data</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="py-2"><Link href={`/resultado/${r.id}`} className="text-[var(--accent)]">{r.id}</Link></td>
                <td><SeverityBadge severity={r.severity} /></td>
                <td>{r.risk_score}</td>
                <td className="text-slate-400 truncate max-w-xs">{r.summary}</td>
                <td className="text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Manually verify end-to-end**

With backend + `npm run dev` running: login → submit phishing.eml → land on Resultado showing high score, findings, defanged IOCs, recommendations → open Histórico and see the entry → click it back to Resultado.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/resultado/ frontend/app/historico/ && git commit -m "feat: add resultado and historico pages"
```

---

### Task 20: README + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# Hookshade — Vertical Slice

Defensive phishing analysis platform (first vertical slice).

## Backend
cd backend
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env
.venv/Scripts/python -m app.seed
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

## Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev

Login with the seed credentials from backend/.env.
```

- [ ] **Step 2: Run full backend test suite one more time**

Run: `cd backend && .venv/Scripts/python -m pytest -v`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: add README with run instructions"
```

---

## Notes for the implementer

- All backend commands assume Git Bash with the venv at `backend/.venv`; on PowerShell use `.venv\Scripts\python`.
- The `@app.on_event("startup")` API is deprecated in newer FastAPI but works on the pinned version; if a lifespan warning appears it is non-fatal for the slice.
- Severity labels are Portuguese (`baixo/médio/alto/crítico`) end-to-end — keep them consistent between `scoring.py`, `SeverityBadge.tsx`, and tests.
- Never execute or open attachments — only hash/metadata. URLs are always defanged before display.
