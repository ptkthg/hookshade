"""Cifra em repouso do conteúdo sensível (SEC-2 / P0-11).

Fernet (AES-128-CBC + HMAC) da lib `cryptography`. A chave é derivada do segredo
configurado — em produção, defina HOOKSHADE_ENCRYPTION_KEY dedicado.
"""
import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    seed = (settings.encryption_key or settings.secret_key).encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(seed).digest())
    return Fernet(key)


def encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
