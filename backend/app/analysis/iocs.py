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
        if ("hash", att.sha256) not in seen:
            seen.add(("hash", att.sha256))
            out.append(IOCItem(type="hash", value=att.sha256, value_defanged=att.sha256, value_hash=att.sha256))

    for ip in _IP_RE.findall(" ".join(parsed.received)):
        add("ip", ip)

    return out
