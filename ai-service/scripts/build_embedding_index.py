import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.embedding_service import build_semantic_index, get_embedding_config
from app.retrieval_service import get_embedding_documents


def main() -> None:
    config = get_embedding_config()
    if not config.configured:
        raise SystemExit(
            "Set AI_EMBEDDING_ENABLED=true and configure base URL, API key, and model first."
        )
    documents = get_embedding_documents()
    index = build_semantic_index(documents, config)
    print(
        f"Built {len(index.vectors)} embeddings with {index.model}; "
        f"cache: {config.cache_path}"
    )


if __name__ == "__main__":
    main()
