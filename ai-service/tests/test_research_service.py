import unittest
from unittest.mock import patch

from app.research_service import research_knowledge
from app.schemas import (
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    WebEvidenceSource,
)


class ResearchServiceTest(unittest.TestCase):
    @patch("app.research_service.generate_grounded_research", return_value=None)
    def test_returns_traceable_local_extract_when_model_is_unavailable(
        self, _mock_generate
    ) -> None:
        result = research_knowledge(
            KnowledgeSearchRequest(query="わけにはいかない")
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.evidenceMode, "local_only")
        self.assertEqual(result.generationMode, "local_extract")
        self.assertTrue(result.citedSourceIds[0].startswith("knowledge-"))
        self.assertTrue(all(source.url is None for source in result.sources))

    @patch("app.research_service.generate_grounded_research")
    @patch("app.research_service.search_knowledge")
    def test_generates_only_with_locked_controlled_web_source_ids(
        self, mock_search, mock_generate
    ) -> None:
        web_source = WebEvidenceSource(
            id="official-faq",
            title="JLPT Official FAQ",
            url="https://www.jlpt.jp/e/faq/",
            snippet="Official guidance",
            sourceType="official",
            fetchedAt="2026-08-25T00:00:00+00:00",
            contentHash="a" * 64,
            score=0.9,
        )
        mock_search.return_value = KnowledgeSearchResponse(
            query="unknown",
            retrievalMode="hybrid_tfidf_rerank",
            totalCandidates=0,
            hits=[],
            webMode="controlled_cache",
            webFallbackReason="local_evidence_insufficient",
            webSources=[web_source],
        )
        mock_generate.return_value = (
            "官方资料说明了考试结构。",
            ["official-faq"],
        )

        result = research_knowledge(
            KnowledgeSearchRequest(query="unknown", allowWeb=True)
        )

        assert result is not None
        self.assertEqual(result.evidenceMode, "web_supplemented")
        self.assertEqual(result.generationMode, "ai_service")
        self.assertEqual(result.citedSourceIds, ["official-faq"])
        self.assertFalse(result.sources[0].canOverrideLocalFacts)

    @patch("app.research_service.generate_grounded_research", return_value=None)
    @patch("app.research_service.search_knowledge")
    def test_refuses_when_local_and_controlled_web_evidence_are_empty(
        self, mock_search, _mock_generate
    ) -> None:
        mock_search.return_value = KnowledgeSearchResponse(
            query="unknown",
            retrievalMode="hybrid_tfidf_rerank",
            totalCandidates=0,
            hits=[],
            webMode="disabled",
            webFallbackReason="no_web_match",
            webSources=[],
        )

        self.assertIsNone(
            research_knowledge(
                KnowledgeSearchRequest(query="unknown", allowWeb=True)
            )
        )


if __name__ == "__main__":
    unittest.main()
