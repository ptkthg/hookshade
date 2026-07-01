from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

_ALGO = "HS256"
_BCRYPT_MAX_BYTES = 72


def _prepare(plain: str) -> bytes:
    # bcrypt hard-limits input to 72 bytes; truncate deterministically.
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prepare(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prepare(plain), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": subject, "exp": expire}, settings.secret_key, algorithm=_ALGO)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGO])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
