import hashlib
import re
from email import message_from_string
from email.message import Message
from email.utils import parseaddr

from app.analysis.types import AttachmentMeta, ParsedEmail

_URL_RE = re.compile(r"https?://[^\s\"'<>)\]]+", re.IGNORECASE)
_ANCHOR_RE = re.compile(r"<a\s+[^>]*?href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")


def _extract_anchors(html: str) -> list[tuple[str, str]]:
    """Pares (href, texto visível) de links http(s). O HTML nunca é renderizado."""
    anchors: list[tuple[str, str]] = []
    for href, inner in _ANCHOR_RE.findall(html):
        if not href.lower().startswith(("http://", "https://")):
            continue
        text = " ".join(_TAG_RE.sub(" ", inner).split()).strip()
        anchors.append((href.strip(), text))
    return anchors


def _domain_of(addr: str) -> str:
    return addr.split("@", 1)[1].lower() if "@" in addr else ""


def _bodies(msg: Message) -> tuple[str, str, list[AttachmentMeta]]:
    text, html, attachments = "", "", []
    if msg.is_multipart():
        for part in msg.walk():
            if part.is_multipart():
                continue
            disp = str(part.get("Content-Disposition") or "")
            ctype = part.get_content_type()
            if "attachment" in disp.lower():
                payload = part.get_payload(decode=True) or b""
                attachments.append(AttachmentMeta(
                    filename=part.get_filename() or "unnamed",
                    mime_type=ctype,
                    size=len(payload),
                    sha256=hashlib.sha256(payload).hexdigest(),
                ))
            elif ctype == "text/plain":
                payload = part.get_payload(decode=True)
                text += payload.decode(errors="replace") if payload else ""
            elif ctype == "text/html":
                payload = part.get_payload(decode=True)
                html += payload.decode(errors="replace") if payload else ""
    else:
        payload = msg.get_payload(decode=True)
        body = payload.decode(errors="replace") if payload else (msg.get_payload() or "")
        if msg.get_content_type() == "text/html":
            html = body
        else:
            text = body
    return text, html, attachments


def parse_email(raw: str) -> ParsedEmail:
    msg = message_from_string(raw)
    headers = {k: str(v) for k, v in msg.items()}

    from_display, from_addr = parseaddr(msg.get("From", ""))
    _, reply_to = parseaddr(msg.get("Reply-To", ""))
    _, return_path = parseaddr(msg.get("Return-Path", ""))
    message_id = (msg.get("Message-ID", "") or "").strip("<>")

    body_text, body_html, attachments = _bodies(msg)
    urls = sorted({u.rstrip(".,;:!?\"')]") for u in _URL_RE.findall(f"{body_text}\n{body_html}")})

    received = [str(v) for k, v in msg.items() if k.lower() == "received"]

    return ParsedEmail(
        headers=headers,
        from_addr=from_addr.lower(),
        from_domain=_domain_of(from_addr),
        from_display=from_display,
        reply_to=reply_to.lower(),
        return_path=return_path.lower(),
        message_id=message_id,
        message_id_domain=_domain_of(message_id),
        received=received,
        subject=msg.get("Subject", ""),
        body_text=body_text,
        body_html=body_html,
        urls=urls,
        attachments=attachments,
        auth_results_raw=str(msg.get("Authentication-Results", "")),
        anchors=_extract_anchors(body_html),
    )
