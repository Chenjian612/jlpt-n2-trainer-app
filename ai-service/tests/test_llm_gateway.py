import json
import os
import unittest
from unittest.mock import patch

from app.llm_gateway import (
    enrich_with_llm,
    generate_personalized_tutor,
    generate_personalized_tutor_with_metrics,
    probe_llm,
)
from app.schemas import ExplanationSource, TutorWrongAnswerRequest, WrongAnswerExplanation


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self) -> bytes:
        content = json.dumps(
            {
                "mistakePattern": "AI 错误模式",
                "whyCorrect": "AI 正确原因",
                "whyUserWrong": "AI 误选原因",
                "whyDistractorFooled": "AI 干扰项原因",
                "watchNextTime": "AI 复习建议",
                "testedPoint": "模型伪造考点",
                "sources": [{"title": "模型伪造来源"}],
            },
            ensure_ascii=False,
        )
        return json.dumps(
            {
                "choices": [{"message": {"content": content}}],
                "usage": {"prompt_tokens": 120, "completion_tokens": 80},
            },
            ensure_ascii=False,
        ).encode("utf-8")


class FakeProbeResponse(FakeResponse):
    def read(self) -> bytes:
        return json.dumps(
            {
                "model": "actual-model",
                "choices": [{"message": {"content": "ok"}}],
            }
        ).encode("utf-8")


class FakeTutorResponse(FakeResponse):
    def read(self) -> bytes:
        content = json.dumps(
            {
                "diagnosisSummary": "你把义务限制误判成了单纯的不做。",
                "whyYouChoseIt": "误选项表面上也是否定表达，但没有社会责任限制。",
                "reasoningSteps": ["先找义务线索", "再判断是否能自由选择", "最后排除单纯否定"],
                "confusionComparison": {
                    "correctPoint": "模型伪造考点",
                    "confusedPoint": "模型伪造误选",
                    "decisiveDifference": "关键看是否存在责任导致的不能不做。",
                },
                "reviewPlan": [
                    {"timing": "now", "action": "对比两个句型"},
                    {"timing": "tomorrow", "action": "再做一道辨析题"},
                ],
                "personalizationEvidence": {
                    "selectedChoice": "模型伪造误选",
                    "wrongCount": 99,
                    "weaknessType": "模型伪造类型",
                    "recentSimilarWrongCount": 99,
                },
                "transferQuestion": {
                    "prompt": "約束した以上、行かない___。",
                    "choices": ["わけにはいかない", "ことはない"],
                    "answer": 0,
                    "testedPoint": "模型伪造考点",
                    "explanation": "有约定带来的责任限制。",
                },
            },
            ensure_ascii=False,
        )
        return json.dumps(
            {
                "choices": [{"message": {"content": content}}],
                "usage": {"prompt_tokens": 120, "completion_tokens": 80},
            },
            ensure_ascii=False,
        ).encode("utf-8")


def build_explanation() -> WrongAnswerExplanation:
    return WrongAnswerExplanation(
        testedPoint="わけにはいかない",
        mistakePattern="本地错误模式",
        whyCorrect="本地正确原因",
        whyUserWrong="本地误选原因",
        whyDistractorFooled="本地干扰项原因",
        watchNextTime="本地复习建议",
        choiceAnalysis=[],
        sources=[
            ExplanationSource(
                id="knowledge-grammar-001",
                title="N2 わけにはいかない",
                snippet="本地证据",
                sourceLabel="本地题组",
            )
        ],
        confidence="high",
        generationMode="local_knowledge",
    )


class LlmGatewayTest(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "AI_LLM_BASE_URL": "https://example.invalid/v1",
            "AI_LLM_API_KEY": "test-key",
            "AI_LLM_MODEL": "test-model",
        },
        clear=False,
    )
    @patch("app.llm_gateway.urlrequest.urlopen")
    def test_updates_only_allowed_text_fields(self, mock_urlopen) -> None:
        mock_urlopen.return_value = FakeResponse()

        result = enrich_with_llm(build_explanation(), wrong_count=3)

        self.assertEqual(result.generationMode, "ai_service")
        self.assertEqual(result.whyCorrect, "AI 正确原因")
        self.assertEqual(result.testedPoint, "わけにはいかない")
        self.assertEqual(result.sources[0].sourceLabel, "本地题组")
        self.assertIsNotNone(mock_urlopen.call_args.kwargs["context"])
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.get_header("User-agent"), "jlpt-n2-rag-service/0.1")

    @patch.dict(
        os.environ,
        {
            "AI_LLM_BASE_URL": "https://example.invalid/v1",
            "AI_LLM_API_KEY": "test-key",
            "AI_LLM_MODEL": "configured-model",
        },
        clear=False,
    )
    @patch("app.llm_gateway.urlrequest.urlopen")
    def test_probe_checks_real_model_without_question_content(self, mock_urlopen) -> None:
        mock_urlopen.return_value = FakeProbeResponse()

        reachable, model, detail = probe_llm()

        self.assertTrue(reachable)
        self.assertEqual(model, "actual-model")
        self.assertEqual(detail, "AI model is reachable")
        request_body = json.loads(mock_urlopen.call_args.args[0].data.decode("utf-8"))
        self.assertEqual(request_body["messages"][1]["content"], "Reply with only: ok")

    @patch.dict(
        os.environ,
        {
            "AI_LLM_BASE_URL": "https://example.invalid/v1",
            "AI_LLM_API_KEY": "test-key",
            "AI_LLM_MODEL": "test-model",
        },
        clear=False,
    )
    @patch("app.llm_gateway.urlrequest.urlopen")
    def test_personalized_tutor_locks_factual_context(self, mock_urlopen) -> None:
        mock_urlopen.return_value = FakeTutorResponse()
        request = TutorWrongAnswerRequest(
            questionId="grammar-001",
            selectedChoice=1,
            wrongCount=3,
            weaknessType="近义句型辨析",
            recentSimilarWrongCount=2,
        )

        result = generate_personalized_tutor(request, build_explanation())

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.confusionComparison.correctPoint, "わけにはいかない")
        self.assertEqual(result.confusionComparison.confusedPoint, "未记录误选项")
        self.assertEqual(result.personalizationEvidence.wrongCount, 3)
        self.assertEqual(result.personalizationEvidence.weaknessType, "近义句型辨析")
        self.assertEqual(result.transferQuestion.testedPoint, "わけにはいかない")
        self.assertEqual(len(result.reasoningSteps), 3)

    @patch.dict(
        os.environ,
        {
            "AI_LLM_BASE_URL": "https://example.invalid/v1",
            "AI_LLM_API_KEY": "test-key",
            "AI_LLM_MODEL": "test-model",
        },
        clear=False,
    )
    @patch("app.llm_gateway.urlrequest.urlopen")
    def test_personalized_tutor_records_model_usage(self, mock_urlopen) -> None:
        mock_urlopen.return_value = FakeTutorResponse()
        request = TutorWrongAnswerRequest(
            questionId="grammar-001",
            selectedChoice=1,
            wrongCount=1,
            weaknessType="近义句型辨析",
        )

        attempt = generate_personalized_tutor_with_metrics(request, build_explanation())

        self.assertIsNotNone(attempt.explanation)
        self.assertEqual(attempt.promptTokens, 120)
        self.assertEqual(attempt.completionTokens, 80)
        self.assertGreater(attempt.latencyMs, 0)


if __name__ == "__main__":
    unittest.main()
