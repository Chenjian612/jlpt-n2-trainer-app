import unittest

from app.knowledge_service import build_grounded_explanation, load_question_index
from app.schemas import ExplainWrongAnswerRequest


class KnowledgeServiceTest(unittest.TestCase):
    def test_loads_grammar_and_vocab_questions(self) -> None:
        self.assertEqual(len(load_question_index()), 800)

    def test_builds_traceable_explanation(self) -> None:
        result = build_grounded_explanation(
            ExplainWrongAnswerRequest(
                questionId="grammar-001",
                selectedChoice=1,
                wrongCount=2,
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.testedPoint, "わけにはいかない")
        self.assertEqual(result.sources[0].id, "knowledge-grammar-001")
        self.assertEqual(result.generationMode, "local_knowledge")

    def test_refuses_unknown_question(self) -> None:
        result = build_grounded_explanation(
            ExplainWrongAnswerRequest(
                questionId="unknown",
                selectedChoice=0,
                wrongCount=1,
            )
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
