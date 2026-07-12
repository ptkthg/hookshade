"""Headers de segurança em toda resposta da API.

A API devolve **só JSON** — nunca HTML, nunca script, nunca estilo. Isso permite a
política mais restritiva que existe: `default-src 'none'`. Não é exagero, é a descrição
literal do que esta origem carrega (nada).

Os headers saem em TODA resposta, inclusive 401, 403 e 404. Uma resposta de erro é uma
resposta como outra qualquer: se sair sem `nosniff` ou sem `frame-ancestors`, está
desprotegida. O 403 do CSRF, aliás, é justamente a resposta que um atacante mais vê.

O que estes headers NÃO fazem: eles não protegem o frontend. A CSP que importa contra
XSS na UI é a do Next (nonce por requisição) — esta aqui só tranca a origem da API.
"""
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

_STATIC_HEADERS = {
    # A API não carrega recurso nenhum; e ninguém pode embutí-la num frame.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    # Impede o browser de "adivinhar" o tipo do conteúdo e executar JSON como script.
    "X-Content-Type-Options": "nosniff",
    # frame-ancestors já cobre navegador moderno; X-Frame-Options cobre o resto.
    "X-Frame-Options": "DENY",
    # Nenhuma URL nossa (que pode conter id de análise) vaza no Referer.
    "Referrer-Policy": "no-referrer",
    # Desliga APIs de dispositivo que a API jamais usaria.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for name, value in _STATIC_HEADERS.items():
            response.headers[name] = value

        # HSTS só faz sentido sob HTTPS. Emitido apenas quando explicitamente ligado
        # (produção) — ver config.hsts_enabled.
        if settings.hsts_enabled:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={settings.hsts_max_age}; includeSubDomains"
            )

        # Não anunciar o servidor: é reconhecimento de graça para quem está sondando.
        response.headers["Server"] = "hookshade"
        return response
