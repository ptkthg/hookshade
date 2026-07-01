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
