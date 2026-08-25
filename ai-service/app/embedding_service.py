import hashlib
import json
import math
import os
import ssl
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Callable
from urllib import request as urlrequest

import certifi


DEFAULT_CACHE_PATH = Path(__file__).resolve().parents[1] / ".cache" / "embedding-index.json"


@dataclass(frozen=True)
class EmbeddingConfig:
    enabled: bool
    base_url: str
    api_key: str
    model: str
    cache_path: Path

    @property
    def configured(self) -> bool:
        return self.enabled and bool(self.base_url and self.api_key and self.model)


@dataclass(frozen=True)
class SemanticIndex:
    model: str
    fingerprint: str
    vectors: dict[str, list[float]]


def get_embedding_config() -> EmbeddingConfig:
    return EmbeddingConfig(
        enabled=os.getenv("AI_EMBEDDING_ENABLED", "").lower() == "true",
        base_url=os.getenv("AI_EMBEDDING_BASE_URL", "").rstrip("/"),
        api_key=os.getenv("AI_EMBEDDING_API_KEY", ""),
        model=os.getenv("AI_EMBEDDING_MODEL", ""),
        cache_path=Path(os.getenv("AI_EMBEDDING_CACHE_PATH", str(DEFAULT_CACHE_PATH))),
    )


def source_fingerprint(documents: dict[str, str]) -> str:
    digest = hashlib.sha256()
    for document_id, text in sorted(documents.items()):
        digest.update(document_id.encode("utf-8"))
        digest.update(b"\0")
        digest.update(text.encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()


def _send_embedding_request(config: EmbeddingConfig, texts: list[str]) -> list[list[float]]:
    req = urlrequest.Request(
        f"{config.base_url}/embeddings",
        data=json.dumps({"model": config.model, "input": texts}, ensure_ascii=False).encode(
            "utf-8"
        ),
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "jlpt-n2-rag-service/0.1",
        },
        method="POST",
    )
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with urlrequest.urlopen(req, timeout=60, context=ssl_context) as response:
        payload = json.loads(response.read().decode("utf-8"))
    ordered = sorted(payload["data"], key=lambda item: item["index"])
    vectors = [item["embedding"] for item in ordered]
    if len(vectors) != len(texts) or not all(_valid_vector(vector) for vector in vectors):
        raise ValueError("Embedding service returned invalid vectors")
    return vectors


def _valid_vector(vector: object) -> bool:
    return (
        isinstance(vector, list)
        and len(vector) > 0
        and all(isinstance(value, (int, float)) and math.isfinite(value) for value in vector)
    )


def build_semantic_index(
    documents: dict[str, str],
    config: EmbeddingConfig | None = None,
    batch_size: int = 32,
    sender: Callable[[EmbeddingConfig, list[str]], list[list[float]]] = _send_embedding_request,
) -> SemanticIndex:
    resolved_config = config or get_embedding_config()
    if not resolved_config.configured:
        raise ValueError("Embedding service is not explicitly enabled and fully configured")
    document_items = sorted(documents.items())
    vectors: dict[str, list[float]] = {}
    expected_dimension: int | None = None
    for start in range(0, len(document_items), batch_size):
        batch = document_items[start : start + batch_size]
        embedded = sender(resolved_config, [text for _, text in batch])
        if len(embedded) != len(batch):
            raise ValueError("Embedding batch size does not match input size")
        for (document_id, _), vector in zip(batch, embedded):
            if not _valid_vector(vector):
                raise ValueError("Embedding service returned an invalid vector")
            if expected_dimension is None:
                expected_dimension = len(vector)
            if len(vector) != expected_dimension:
                raise ValueError("Embedding vectors have inconsistent dimensions")
            vectors[document_id] = [float(value) for value in vector]
    semantic_index = SemanticIndex(
        model=resolved_config.model,
        fingerprint=source_fingerprint(documents),
        vectors=vectors,
    )
    _save_semantic_index(semantic_index, resolved_config.cache_path)
    return semantic_index


def _save_semantic_index(index: SemanticIndex, cache_path: Path) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "model": index.model,
        "fingerprint": index.fingerprint,
        "vectors": index.vectors,
    }
    with NamedTemporaryFile(
        "w", encoding="utf-8", dir=cache_path.parent, delete=False
    ) as temporary:
        json.dump(payload, temporary, ensure_ascii=False, separators=(",", ":"))
        temporary_path = Path(temporary.name)
    temporary_path.replace(cache_path)


def load_semantic_index(
    documents: dict[str, str], config: EmbeddingConfig | None = None
) -> SemanticIndex | None:
    resolved_config = config or get_embedding_config()
    if not resolved_config.configured or not resolved_config.cache_path.exists():
        return None
    try:
        payload = json.loads(resolved_config.cache_path.read_text(encoding="utf-8"))
        vectors = payload["vectors"]
        if (
            payload.get("version") != 1
            or payload.get("model") != resolved_config.model
            or payload.get("fingerprint") != source_fingerprint(documents)
            or set(vectors) != set(documents)
            or not all(_valid_vector(vector) for vector in vectors.values())
        ):
            return None
        dimensions = {len(vector) for vector in vectors.values()}
        if len(dimensions) != 1:
            return None
        return SemanticIndex(
            model=payload["model"],
            fingerprint=payload["fingerprint"],
            vectors=vectors,
        )
    except (AttributeError, KeyError, TypeError, ValueError, OSError, json.JSONDecodeError):
        return None


def semantic_scores(
    query: str,
    documents: dict[str, str],
    config: EmbeddingConfig | None = None,
    sender: Callable[[EmbeddingConfig, list[str]], list[list[float]]] = _send_embedding_request,
) -> dict[str, float]:
    resolved_config = config or get_embedding_config()
    index = load_semantic_index(documents, resolved_config)
    if index is None:
        return {}
    try:
        query_vector = sender(resolved_config, [query])[0]
        if not _valid_vector(query_vector):
            return {}
        return {
            document_id: _dense_cosine_similarity(query_vector, vector)
            for document_id, vector in index.vectors.items()
        }
    except (
        AttributeError,
        KeyError,
        IndexError,
        TypeError,
        ValueError,
        OSError,
        json.JSONDecodeError,
    ):
        return {}


def _dense_cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)
