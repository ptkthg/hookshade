"""Token CSRF: double-submit com assinatura HMAC.

Por que CSRF passou a importar: com o JWT em localStorage, o header Authorization
era montado por JavaScript e um site terceiro simplesmente não conseguia forjá-lo.
Ao mover a sessão para cookie, o navegador passa a anexá-la SOZINHO em toda
requisição para a nossa origem — inclusive nas que um site malicioso disparar.

O double-submit fecha isso: o token vai no cookie E no header. Um atacante
cross-site consegue fazer o browser ENVIAR o cookie, mas a same-origin policy o
impede de LER o valor para copiá-lo no header. Sem os dois batendo, não passa.

A assinatura HMAC é a camada extra: mesmo que alguém consiga plantar um cookie na
nossa origem (via subdomínio comprometido, por exemplo), não consegue produzir um
token com assinatura válida sem o secret_key do servidor.
"""
import hmac
import secrets
from hashlib import sha256

from app.config import settings

_NONCE_BYTES = 32


def _sign(nonce: str) -> str:
    return hmac.new(settings.secret_key.encode(), nonce.encode(), sha256).hexdigest()


def issue_csrf_token() -> str:
    nonce = secrets.token_urlsafe(_NONCE_BYTES)
    return f"{nonce}.{_sign(nonce)}"


def verify_csrf_token(cookie_value: str | None, header_value: str | None) -> bool:
    if not cookie_value or not header_value:
        return False
    # compare_digest: comparação em tempo constante, sem vazar o token por timing
    if not hmac.compare_digest(cookie_value, header_value):
        return False
    nonce, _, signature = cookie_value.partition(".")
    if not nonce or not signature:
        return False
    return hmac.compare_digest(signature, _sign(nonce))
