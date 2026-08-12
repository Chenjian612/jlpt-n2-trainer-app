import json
import os
import unittest
from unittest.mock import patch

from app.llm_gateway import enrich_with_llm, probe_llm
from app.schemas import ExplanationSource, WrongAnswerExplanation


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
            {"choices": [{"message": {"content": content}}]},
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


if __name__ == "__main__":
    unittest.main()
