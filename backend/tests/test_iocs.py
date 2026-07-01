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
