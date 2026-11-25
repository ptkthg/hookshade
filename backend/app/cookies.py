"""Emissão e limpeza dos cookies de sessão e de CSRF.

Centralizado num módulo só porque o cookie de limpeza PRECISA repetir exatamente
os mesmos atributos do cookie original (path, secure, samesite, httponly). Se um
atributo divergir, o browser trata como outro cookie e o logout não apaga nada.
"""
from fastapi import Response

from app.config import settings


def _common() -> dict:
    return {
        "path": "/",
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        # sem `domain`: __Host- exige ausência de Domain e evita vazar p/ subdomínios
    }


def set_session_cookie(response: Response, token: str, *, minutes: int | None = None) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,  # o JS nunca lê a sessão: essa é a razão de existir da migração
        max_age=(settings.access_token_expire_minutes if minutes is None else minutes) * 60,
        **_common(),
    )


def set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.csrf_cookie_name,
        token,
        httponly=False,  # legível de propósito: o front precisa ecoá-lo no header
        max_age=settings.access_token_expire_minutes * 60,
        **_common(),
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie_name, httponly=True, **_common())


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(settings.csrf_cookie_name, httponly=False, **_common())
