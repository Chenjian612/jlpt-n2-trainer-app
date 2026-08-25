#!/usr/bin/env python3
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.controlled_web_service import get_web_rag_config, sync_web_sources  # noqa: E402


def main() -> None:
    config = get_web_rag_config()
    try:
        result = sync_web_sources(config)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print(f"Synced {result.synced} controlled web sources; failed: {result.failed}")
    for source_id, reason in result.failures.items():
        print(f"- {source_id}: {reason}")
    if result.failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
