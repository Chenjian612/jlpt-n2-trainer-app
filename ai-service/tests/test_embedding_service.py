import tempfile
import unittest
from pathlib import Path

from app.embedding_service import (
    EmbeddingConfig,
    build_semantic_index,
    load_semantic_index,
    semantic_scores,
)


class EmbeddingServiceTest(unittest.TestCase):
    def test_refuses_to_build_without_explicit_configuration(self) -> None:
        config = EmbeddingConfig(False, "", "", "", Path("unused"))

        with self.assertRaisesRegex(ValueError, "explicitly enabled"):
            build_semantic_index({"a": "文法限制"}, config=config)

    def test_builds_batches_and_reuses_valid_fingerprinted_cache(self) -> None:
        documents = {"a": "文法限制", "b": "词汇搭配", "c": "读解主旨"}
        batches: list[list[str]] = []

        def sender(_config: EmbeddingConfig, texts: list[str]) -> list[list[float]]:
            batches.append(texts)
            return [[float(len(text)), float(index + 1)] for index, text in enumerate(texts)]

        with tempfile.TemporaryDirectory() as directory:
            config = EmbeddingConfig(
                True,
                "https://example.invalid/v1",
                "test-key",
                "test-embedding",
                Path(directory) / "index.json",
            )
            built = build_semantic_index(documents, config, batch_size=2, sender=sender)
            loaded = load_semantic_index(documents, config)

            self.assertEqual([len(batch) for batch in batches], [2, 1])
            self.assertEqual(len(built.vectors), 3)
            self.assertEqual(loaded, built)
            self.assertIsNone(load_semantic_index({**documents, "d": "听力陷阱"}, config))

    def test_scores_query_against_cached_dense_vectors(self) -> None:
        documents = {"grammar": "文法限制", "vocab": "词汇搭配"}

        with tempfile.TemporaryDirectory() as directory:
            config = EmbeddingConfig(
                True,
                "https://example.invalid/v1",
                "test-key",
                "test-embedding",
                Path(directory) / "index.json",
            )
            build_semantic_index(
                documents,
                config,
                sender=lambda _config, _texts: [[1.0, 0.0], [0.0, 1.0]],
            )
            scores = semantic_scores(
                "近义表达",
                documents,
                config,
                sender=lambda _config, _texts: [[0.0, 1.0]],
            )

            self.assertEqual(scores["grammar"], 0.0)
            self.assertEqual(scores["vocab"], 1.0)


if __name__ == "__main__":
    unittest.main()
