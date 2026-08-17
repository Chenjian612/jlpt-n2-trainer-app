import unittest

from app.evaluation import evaluate_cases, load_evaluation_set
from app.llm_gateway import TutorGenerationAttempt
from app.schemas import (
    ConfusionComparison,
    PersonalizationEvidence,
    PersonalizedTutorExplanation,
    ReviewAction,
    TransferQuestion,
)


class EvaluationTest(unittest.TestCase):
    def test_fixed_set_has_two_contexts_and_balanced_modes(self) -> None:
        cases = load_evaluation_set()

        self.assertEqual(len(cases), 40)
        self.assertEqual(sum(case["questionId"].startswith("grammar-") for case in cases), 20)
        self.assertEqual(sum(case["questionId"].startswith("vocab-") for case in cases), 20)
        self.assertEqual({case["contextGroup"] for case in cases}, {"first_error", "repeated_error"})

    def test_aggregates_fallback_latency_transfer_quality_and_cost(self) -> None:
        cases = load_evaluation_set()[:2]
        calls = 0

        def fake_generator(request, grounded):
            nonlocal calls
            calls += 1
            if calls == 2:
                return TutorGenerationAttempt(
                    failureReason="validation_failed",
                    latencyMs=300,
                    promptTokens=80,
                    completionTokens=20,
                )
            selected = next(item.choice for item in grounded.choiceAnalysis if item.status == "selected_wrong")
            return TutorGenerationAttempt(
                explanation=PersonalizedTutorExplanation(
                    diagnosisSummary=f"你本次误选了「{selected}」。",
                    whyYouChoseIt=f"「{selected}」容易与正确规则混淆。",
                    reasoningSteps=("先找限制线索", "再确认责任", "最后排除干扰项"),
                    confusionComparison=ConfusionComparison(
                        correctPoint=grounded.testedPoint,
                        confusedPoint=selected,
                        decisiveDifference="是否存在现实责任限制。",
                    ),
                    reviewPlan=[ReviewAction(timing="now", action="立即对比")],
                    personalizationEvidence=PersonalizationEvidence(
                        selectedChoice=selected,
                        wrongCount=request.wrongCount,
                        weaknessType=request.weaknessType,
                        recentSimilarWrongCount=request.recentSimilarWrongCount,
                    ),
                    transferQuestion=TransferQuestion(
                        prompt="約束した以上、参加しない___。",
                        choices=[grounded.testedPoint, "ことはない"],
                        answer=0,
                        testedPoint=grounded.testedPoint,
                        explanation=f"这里需要「{grounded.testedPoint}」表达限制。",
                    ),
                ),
                latencyMs=100,
                promptTokens=100,
                completionTokens=50,
            )

        report = evaluate_cases(
            cases,
            generator=fake_generator,
            input_cost_per_million=2,
            output_cost_per_million=4,
        )
        summary = report["summary"]

        self.assertEqual(summary["fallbackRate"], 0.5)
        self.assertEqual(summary["validationFailureRate"], 0.5)
        self.assertEqual(summary["latencyMs"], {"average": 200.0, "p50": 100, "p95": 300})
        self.assertEqual(summary["modelUsage"]["promptTokens"], 180)
        self.assertEqual(summary["modelUsage"]["completionTokens"], 70)
        self.assertAlmostEqual(summary["modelUsage"]["estimatedCostUsd"], 0.00064)
        self.assertEqual(summary["averageTransferQualityScore"], 1.0)


if __name__ == "__main__":
    unittest.main()
