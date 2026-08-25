import unittest
from unittest.mock import patch

from app.retrieval_service import (
    build_retrieval_index,
    load_search_documents,
    search_knowledge,
    tokenize,
)
from app.schemas import KnowledgeSearchRequest


class RetrievalServiceTest(unittest.TestCase):
    def test_builds_index_for_all_searchable_questions(self) -> None:
        index = build_retrieval_index()
        self.assertEqual(len(index.documents), 886)
        self.assertTrue(all(document.vector_norm > 0 for document in index.documents))

    def test_flattens_reading_questions_into_search_documents(self) -> None:
        documents = load_search_documents()
        self.assertEqual(len(documents), 886)
        self.assertEqual(documents["reading-001-q1"]["passageId"], "reading-001")
        self.assertEqual(len(documents["reading-001-q1"]["paragraphs"]), 4)

    def test_every_reading_question_has_traceable_original_evidence(self) -> None:
        reading_documents = [
            document
            for document in load_search_documents().values()
            if document["modeId"] == "reading_drill"
        ]

        for document in reading_documents:
            with self.subTest(question_id=document["id"]):
                result = search_knowledge(
                    KnowledgeSearchRequest(
                        query=document["evidence"], modeId="reading_drill", limit=20
                    )
                )
                hit = next(
                    item for item in result.hits if item.questionId == document["id"]
                )
                self.assertIsNotNone(hit.evidenceLocation)
                assert hit.evidenceLocation is not None
                self.assertTrue(hit.evidenceLocation.paragraphNumbers)
                self.assertEqual(
                    len(hit.evidenceLocation.paragraphNumbers),
                    len(hit.evidenceLocation.paragraphTexts),
                )

    def test_flattens_all_listening_questions_with_traceable_evidence(self) -> None:
        listening_documents = [
            document
            for document in load_search_documents().values()
            if document["modeId"] == "listening_analyze"
        ]

        self.assertEqual(len(listening_documents), 26)
        for document in listening_documents:
            with self.subTest(question_id=document["id"]):
                result = search_knowledge(
                    KnowledgeSearchRequest(
                        query=document["basisLine"],
                        modeId="listening_analyze",
                        limit=20,
                    )
                )
                hit = next(
                    item for item in result.hits if item.questionId == document["id"]
                )
                self.assertIsNotNone(hit.listeningEvidence)
                assert hit.listeningEvidence is not None
                self.assertTrue(hit.listeningEvidence.basisLine)
                self.assertTrue(hit.listeningEvidence.keySignal)
                self.assertTrue(hit.listeningEvidence.trapPoint)

    def test_marks_official_audio_transcript_without_claiming_dialogue_match(self) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(
                query="名刺を忘れてた お茶はいらない",
                modeId="listening_analyze",
                limit=3,
            )
        )

        self.assertEqual(result.hits[0].questionId, "official-m1q2-q1")
        assert result.hits[0].listeningEvidence is not None
        self.assertEqual(result.hits[0].listeningEvidence.evidenceType, "audio_transcript")

    def test_distinguishes_listening_evidence_types(self) -> None:
        cases = [
            ("instant-reply-001-q1", "stimulus_response"),
            ("planning-meeting-001-q1", "dialogue_quote"),
            ("office-reassignment-001-q1", "pedagogical_summary"),
        ]
        documents = load_search_documents()

        for question_id, evidence_type in cases:
            with self.subTest(question_id=question_id):
                result = search_knowledge(
                    KnowledgeSearchRequest(
                        query=documents[question_id]["basisLine"],
                        modeId="listening_analyze",
                        limit=20,
                    )
                )
                hit = next(item for item in result.hits if item.questionId == question_id)
                self.assertEqual(hit.contentType, "listening_question")
                assert hit.listeningEvidence is not None
                self.assertEqual(hit.listeningEvidence.evidenceType, evidence_type)

    def test_tokenizes_mixed_japanese_and_chinese_text(self) -> None:
        tokens = tokenize("わけにはいかない 表示不能")
        self.assertIn("わけ", tokens)
        self.assertIn("表示", tokens)
        self.assertIn("不能", tokens)

    def test_retrieves_exact_grammar_point_first(self) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(query="わけにはいかない", modeId="grammar_drill", limit=3)
        )

        self.assertTrue(result.hits)
        self.assertEqual(result.hits[0].testedPoint, "わけにはいかない")
        self.assertIn("考点命中", result.hits[0].matchReasons)
        self.assertEqual(result.retrievalMode, "hybrid_tfidf_rerank")
        self.assertGreater(result.hits[0].scores["bm25"], 0)
        self.assertGreater(result.hits[0].scores["vector"], 0)
        self.assertTrue(all(hit.modeId == "grammar_drill" for hit in result.hits))

    def test_retrieves_by_chinese_learning_intent(self) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(query="表示不能或不可以做某事", limit=5)
        )

        self.assertTrue(result.hits)
        self.assertGreater(result.hits[0].score, 0)
        self.assertTrue(result.hits[0].matchReasons)
        self.assertIn("TF-IDF 向量相似", result.hits[0].matchReasons)

    def test_hybrid_scores_are_normalized_and_stably_sorted(self) -> None:
        request = KnowledgeSearchRequest(query="变化同时发生", limit=10)
        first = search_knowledge(request)
        second = search_knowledge(request)

        self.assertEqual(first, second)
        self.assertTrue(all(0 < hit.score <= 1 for hit in first.hits))
        self.assertEqual(
            [hit.score for hit in first.hits],
            sorted((hit.score for hit in first.hits), reverse=True),
        )

    def test_fixed_exact_point_set_reaches_top_result(self) -> None:
        cases = [
            ("わけにはいかない", "grammar_drill"),
            ("まい", "grammar_drill"),
            ("というものではない", "grammar_drill"),
            ("あげく", "grammar_drill"),
            ("にあるまじき", "grammar_drill"),
            ("分担", "vocab_drill"),
            ("切り替える", "vocab_drill"),
            ("算出する", "vocab_drill"),
            ("緩む", "vocab_drill"),
            ("莫大", "vocab_drill"),
        ]

        for query, mode_id in cases:
            with self.subTest(query=query):
                result = search_knowledge(
                    KnowledgeSearchRequest(query=query, modeId=mode_id, limit=3)
                )
                self.assertTrue(result.hits)
                self.assertEqual(result.hits[0].testedPoint, query)

    def test_returns_empty_hits_when_evidence_does_not_match(self) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(query="zzzzunmatchedtoken", limit=5)
        )

        self.assertEqual(result.totalCandidates, 0)
        self.assertEqual(result.hits, [])

    @patch("app.retrieval_service.semantic_scores")
    def test_semantic_embedding_can_recall_without_keyword_overlap(
        self, mock_semantic_scores
    ) -> None:
        mock_semantic_scores.return_value = {"vocab-500": 0.95}

        result = search_knowledge(
            KnowledgeSearchRequest(query="zzzzsemanticquery", limit=3)
        )

        self.assertEqual(result.retrievalMode, "hybrid_semantic_rerank")
        self.assertEqual(result.hits[0].questionId, "vocab-500")
        self.assertEqual(result.hits[0].scores["semantic"], 0.95)
        self.assertIn("语义 Embedding 相似", result.hits[0].matchReasons)

    @patch("app.retrieval_service.semantic_scores", return_value={})
    def test_embedding_unavailable_preserves_local_fallback(self, _mock_scores) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(query="わけにはいかない", limit=3)
        )

        self.assertEqual(result.retrievalMode, "hybrid_tfidf_rerank")
        self.assertEqual(result.hits[0].testedPoint, "わけにはいかない")
        self.assertEqual(result.hits[0].scores["semantic"], 0.0)

    def test_locates_early_reading_evidence_in_original_paragraph(self) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(
                query="必要な情報がかえって見つけにくい",
                modeId="reading_drill",
                limit=3,
            )
        )

        self.assertEqual(result.hits[0].questionId, "reading-001-q1")
        self.assertEqual(result.hits[0].contentType, "reading_question")
        self.assertIsNotNone(result.hits[0].evidenceLocation)
        assert result.hits[0].evidenceLocation is not None
        self.assertEqual(result.hits[0].evidenceLocation.paragraphNumbers, [1])
        self.assertIn(
            "必要な情報がかえって見つけにくい",
            result.hits[0].evidenceLocation.quotes,
        )

    def test_locates_late_reading_evidence_without_position_label(self) -> None:
        result = search_knowledge(
            KnowledgeSearchRequest(
                query="AIは人の代わりに考えるのではなく",
                modeId="reading_drill",
                limit=3,
            )
        )

        self.assertEqual(result.hits[0].questionId, "reading-011-q1")
        assert result.hits[0].evidenceLocation is not None
        self.assertTrue(result.hits[0].evidenceLocation.paragraphNumbers)
        paragraph_number = result.hits[0].evidenceLocation.paragraphNumbers[0]
        paragraph = load_search_documents()["reading-011-q1"]["paragraphs"][
            paragraph_number - 1
        ]
        self.assertEqual(result.hits[0].evidenceLocation.paragraphTexts, [paragraph])
        self.assertIn("AIは人の代わりに考えるのではなく", paragraph)


if __name__ == "__main__":
    unittest.main()
