"""Redação mínima de PII em saídas narrativas visíveis (defensivo)."""
from app.redaction import redact_pii


def test_masks_email_keeping_no_local_part():
    out = redact_pii("contato: joao.silva@empresa.com por favor")
    assert "joao.silva" not in out
    assert "[email redigido]" in out


def test_masks_cpf_formatted_and_bare():
    assert "[cpf redigido]" in redact_pii("CPF 123.456.789-09 do titular")
    assert "[cpf redigido]" in redact_pii("cpf 12345678909 informado")


def test_masks_cnpj():
    assert "[cnpj redigido]" in redact_pii("CNPJ 12.345.678/0001-95 emitido")


def test_masks_br_phone():
    out = redact_pii("ligue (21) 98765-4321 agora")
    assert "98765-4321" not in out
    assert "[telefone redigido]" in out


def test_masks_credentials_and_tokens():
    assert "[credencial redigida]" in redact_pii("senha=hunter2")
    assert "[credencial redigida]" in redact_pii("Authorization: Bearer abc.def.ghi")
    assert "hunter2" not in redact_pii("password: hunter2")


def test_masks_long_token():
    tok = "sk_live_" + "A1b2C3d4" * 5
    out = redact_pii(f"chave {tok} exposta")
    assert tok not in out
    assert "[credencial redigida]" in out


def test_leaves_benign_text_and_domains_untouched():
    text = "E-mail de paypa1.com — severidade alto. Evidências: Encurtador de URL (bit.ly)."
    assert redact_pii(text) == text


def test_handles_empty_and_none_safely():
    assert redact_pii("") == ""
    assert redact_pii(None) == ""
