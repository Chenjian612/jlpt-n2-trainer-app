import hashlib
import ipaddress
import json
import os
import re
import socket
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable, Literal
from urllib import request as urlrequest
from urllib.parse import urlparse

import certifi

from .schemas import WebEvidenceSource


SERVICE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY_PATH = SERVICE_ROOT / "web_sources.json"
DEFAULT_CACHE_PATH = SERVICE_ROOT / ".cache" / "web-sources.json"
DEFAULT_ALLOWED_HOSTS = (
    "jlpt.jp",
    "www.jlpt.jp",
    "samplequestions.jlpt.jp",
    "jpf.go.jp",
    "www.jpf.go.jp",
)
MAX_RESPONSE_BYTES = 1_000_000
MAX_CONTENT_CHARACTERS = 50_000
INJECTION_MARKERS = (
    "ignore previous instructions",
    "ignore all instructions",
    "system prompt",
    "developer message",
    "act as an ai",
    "忽略之前的指令",
    "忽略所有指令",
    "系统提示词",
)


@dataclass(frozen=True)
class WebRagConfig:
    enabled: bool
    allowed_hosts: tuple[str, ...]
    registry_path: Path
    cache_path: Path
    timeout_seconds: int
    max_age_hours: int = 168


@dataclass(frozen=True)
class WebSourceDefinition:
    id: str
    title: str
    url: str
    sourceType: Literal["official", "authorized"]


@dataclass(frozen=True)
class CachedWebSource:
    id: str
    title: str
    url: str
    sourceType: Literal["official", "authorized"]
    fetchedAt: str
    contentHash: str
    content: str


@dataclass(frozen=True)
class WebSyncResult:
    synced: int
    failed: int
    failures: dict[str, str]


def get_web_rag_config() -> WebRagConfig:
    configured_hosts = tuple(
        host.strip().lower()
        for host in os.getenv("AI_WEB_RAG_ALLOWED_HOSTS", "").split(",")
        if host.strip()
    )
    return WebRagConfig(
        enabled=os.getenv("AI_WEB_RAG_ENABLED", "").lower() == "true",
        allowed_hosts=configured_hosts or DEFAULT_ALLOWED_HOSTS,
        registry_path=Path(
            os.getenv("AI_WEB_RAG_REGISTRY_PATH", str(DEFAULT_REGISTRY_PATH))
        ),
        cache_path=Path(os.getenv("AI_WEB_RAG_CACHE_PATH", str(DEFAULT_CACHE_PATH))),
        timeout_seconds=max(
            1, min(_environment_integer("AI_WEB_RAG_TIMEOUT_SECONDS", 10), 30)
        ),
        max_age_hours=max(
            1, _environment_integer("AI_WEB_RAG_MAX_AGE_HOURS", 168)
        ),
    )


def _environment_integer(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _host_allowed(hostname: str, allowed_hosts: tuple[str, ...]) -> bool:
    normalized = hostname.rstrip(".").lower()
    return any(
        normalized == allowed or normalized.endswith(f".{allowed}")
        for allowed in allowed_hosts
    )


def validate_source_url(
    url: str,
    allowed_hosts: tuple[str, ...],
    resolver: Callable[..., list[tuple]] = socket.getaddrinfo,
    resolve_dns: bool = True,
) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Only credential-free HTTPS source URLs are allowed")
    if parsed.port not in (None, 443):
        raise ValueError("Only the standard HTTPS port is allowed")
    if not _host_allowed(parsed.hostname, allowed_hosts):
        raise ValueError("Source host is not in the approved allowlist")
    if not resolve_dns:
        return
    addresses = resolver(parsed.hostname, 443, type=socket.SOCK_STREAM)
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Source host resolved to a non-public address")


def load_source_registry(
    config: WebRagConfig | None = None, resolve_dns: bool = True
) -> list[WebSourceDefinition]:
    resolved = config or get_web_rag_config()
    payload = json.loads(resolved.registry_path.read_text(encoding="utf-8"))
    sources: list[WebSourceDefinition] = []
    seen_ids: set[str] = set()
    for item in payload:
        if not item.get("enabled", True):
            continue
        source = WebSourceDefinition(
            id=item["id"],
            title=item["title"],
            url=item["url"],
            sourceType=item["sourceType"],
        )
        if source.id in seen_ids:
            raise ValueError(f"Duplicate web source id: {source.id}")
        if source.sourceType not in {"official", "authorized"}:
            raise ValueError(f"Unsupported source type: {source.sourceType}")
        validate_source_url(
            source.url, resolved.allowed_hosts, resolve_dns=resolve_dns
        )
        seen_ids.add(source.id)
        sources.append(source)
    return sources


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignored_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg", "canvas"}:
            self._ignored_depth += 1
        elif tag in {"p", "br", "li", "h1", "h2", "h3", "h4", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg", "canvas"}:
            self._ignored_depth = max(0, self._ignored_depth - 1)

    def handle_data(self, data: str) -> None:
        if self._ignored_depth == 0:
            self.parts.append(data)


def extract_safe_text(html: str) -> str:
    parser = _VisibleTextParser()
    parser.feed(html)
    lines: list[str] = []
    for raw_line in "".join(parser.parts).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        lowered = line.lower()
        if any(marker in lowered for marker in INJECTION_MARKERS):
            continue
        lines.append(line)
    return "\n".join(lines)[:MAX_CONTENT_CHARACTERS]


class _AllowlistRedirectHandler(urlrequest.HTTPRedirectHandler):
    def __init__(self, config: WebRagConfig) -> None:
        self.config = config

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_source_url(newurl, self.config.allowed_hosts)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _fetch_html(source: WebSourceDefinition, config: WebRagConfig) -> str:
    request = urlrequest.Request(
        source.url,
        headers={"Accept": "text/html", "User-Agent": "jlpt-n2-rag-service/0.1"},
    )
    context = ssl.create_default_context(cafile=certifi.where())
    opener = urlrequest.build_opener(
        urlrequest.HTTPSHandler(context=context), _AllowlistRedirectHandler(config)
    )
    with opener.open(request, timeout=config.timeout_seconds) as response:
        final_url = response.geturl()
        validate_source_url(final_url, config.allowed_hosts)
        content_type = response.headers.get_content_type()
        if content_type != "text/html":
            raise ValueError(f"Unsupported content type: {content_type}")
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("Source response exceeded the size limit")
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def sync_web_sources(
    config: WebRagConfig | None = None,
    fetcher: Callable[[WebSourceDefinition, WebRagConfig], str] = _fetch_html,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    registry_loader: Callable[[WebRagConfig], list[WebSourceDefinition]] = load_source_registry,
) -> WebSyncResult:
    resolved = config or get_web_rag_config()
    if not resolved.enabled:
        raise ValueError("Controlled Web RAG is not explicitly enabled")
    sources = registry_loader(resolved)
    existing = {item.id: item for item in load_web_cache(resolved)}
    failures: dict[str, str] = {}
    for source in sources:
        try:
            safe_text = extract_safe_text(fetcher(source, resolved))
            if len(safe_text) < 80:
                raise ValueError("Source did not contain enough safe text")
            existing[source.id] = CachedWebSource(
                id=source.id,
                title=source.title,
                url=source.url,
                sourceType=source.sourceType,
                fetchedAt=now().isoformat(),
                contentHash=hashlib.sha256(safe_text.encode("utf-8")).hexdigest(),
                content=safe_text,
            )
        except (ValueError, OSError, UnicodeError) as error:
            failures[source.id] = f"{type(error).__name__}: {error}"
    _save_web_cache(list(existing.values()), resolved.cache_path)
    return WebSyncResult(
        synced=len(sources) - len(failures), failed=len(failures), failures=failures
    )


def _save_web_cache(sources: list[CachedWebSource], cache_path: Path) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": 1, "sources": [source.__dict__ for source in sources]}
    temporary = cache_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(cache_path)


def load_web_cache(
    config: WebRagConfig | None = None,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
) -> list[CachedWebSource]:
    resolved = config or get_web_rag_config()
    if not resolved.enabled or not resolved.cache_path.exists():
        return []
    try:
        payload = json.loads(resolved.cache_path.read_text(encoding="utf-8"))
        if payload.get("version") != 1:
            return []
        registry = {
            source.id: source
            for source in load_source_registry(resolved, resolve_dns=False)
        }
        cached: list[CachedWebSource] = []
        for item in payload["sources"]:
            approved = registry.get(item["id"])
            if approved is None or approved.url != item["url"]:
                continue
            content = item["content"]
            expected_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            if item["contentHash"] != expected_hash:
                continue
            fetched_at = datetime.fromisoformat(item["fetchedAt"])
            if fetched_at.tzinfo is None:
                continue
            age_hours = (now() - fetched_at).total_seconds() / 3600
            if age_hours < -1 or age_hours > resolved.max_age_hours:
                continue
            cached.append(
                CachedWebSource(
                    id=approved.id,
                    title=approved.title,
                    url=approved.url,
                    sourceType=approved.sourceType,
                    fetchedAt=item["fetchedAt"],
                    contentHash=item["contentHash"],
                    content=content,
                )
            )
        return cached
    except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError):
        return []


def _tokens(text: str) -> set[str]:
    normalized = re.sub(r"\s+", "", text.lower())
    return {
        normalized[index : index + 2]
        for index in range(max(0, len(normalized) - 1))
        if normalized[index : index + 2].strip()
    }


def search_web_cache(
    query: str, config: WebRagConfig | None = None, limit: int = 3
) -> list[WebEvidenceSource]:
    resolved = config or get_web_rag_config()
    query_tokens = _tokens(query)
    if not query_tokens:
        return []
    candidates: list[tuple[float, CachedWebSource]] = []
    for source in load_web_cache(resolved):
        content_tokens = _tokens(f"{source.title} {source.content}")
        overlap = len(query_tokens & content_tokens)
        if overlap == 0:
            continue
        score = overlap / len(query_tokens)
        candidates.append((score, source))
    candidates.sort(key=lambda item: (-item[0], item[1].id))
    return [
        WebEvidenceSource(
            id=source.id,
            title=source.title,
            url=source.url,
            snippet=_best_snippet(query_tokens, source.content),
            sourceType=source.sourceType,
            fetchedAt=source.fetchedAt,
            contentHash=source.contentHash,
            score=round(score, 4),
        )
        for score, source in candidates[:limit]
    ]


def _best_snippet(query_tokens: set[str], content: str) -> str:
    lines = [line for line in content.splitlines() if line]
    if not lines:
        return ""
    best = max(lines, key=lambda line: len(query_tokens & _tokens(line)))
    return best[:400]
