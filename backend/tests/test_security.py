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
