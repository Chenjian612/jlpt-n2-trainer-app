from __future__ import annotations

import json
import math
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable

from .knowledge_service import build_grounded_explanation, load_question_index
from .llm_gateway import TutorGenerationAttempt, generate_personalized_tutor_with_metrics
from .schemas import ExplainWrongAnswerRequest, TutorWrongAnswerRequest


EVALUATION_SET_PATH = Path(__file__).resolve().parents[1] / "evaluation" / "fixed_set.json"


@dataclass
class CaseResult:
    caseId: str
    questionId: str
    contextGroup: str
    status: str
    failureReason: str | None
    latencyMs: float
    promptTokens: int
    completionTokens: int
    estimatedCostUsd: float
    lockedFieldsValid: bool
    personalizationValid: bool
    transferQualityScore: float
    transferQualityChecks: dict[str, bool] = field(default_factory=dict)


def load_evaluation_set(path: Path = EVALUATION_SET_PATH) -> list[dict]:
    with path.open(encoding="utf-8") as source:
        cases = json.load(source)
    if not isinstance(cases, list) or not 30 <= len(cases) <= 50:
        raise ValueError("fixed evaluation set must contain 30-50 cases")
    return cases


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(0, math.ceil(percentile * len(ordered)) - 1)
    return round(ordered[rank], 2)


def _contains_any(text: str, candidates: list[str]) -> bool:
    return any(candidate and candidate in text for candidate in candidates)


def _score_transfer(case: dict, attempt: TutorGenerationAttempt) -> tuple[float, dict[str, bool]]:
    result = attempt.explanation
    if result is None:
        return 0.0, {}
    transfer = result.transferQuestion
    original = load_question_index()[case["questionId"]]
    checks = {
        "sameTestedPoint": transfer.testedPoint == case["expectedTestedPoint"],
        "newPrompt": transfer.prompt.strip() != original["prompt"].strip(),
        "uniqueChoices": len(set(transfer.choices)) == len(transfer.choices),
        "validAnswer": 0 <= transfer.answer < len(transfer.choices),
        "nonEmptyExplanation": bool(transfer.explanation.strip()),
        "pointGrounded": _contains_any(
            transfer.prompt + transfer.explanation,
            case["qualityAnchors"],
        ),
    }
    return round(sum(checks.values()) / len(checks), 4), checks


def evaluate_cases(
    cases: list[dict],
    generator: Callable = generate_personalized_tutor_with_metrics,
    input_cost_per_million: float = 0.0,
    output_cost_per_million: float = 0.0,
) -> dict:
    results: list[CaseResult] = []
    for case in cases:
        request = TutorWrongAnswerRequest(
            questionId=case["questionId"],
            selectedChoice=case["selectedChoice"],
            wrongCount=case["wrongCount"],
            weaknessType=case["weaknessType"],
            recentSimilarWrongCount=case["recentSimilarWrongCount"],
            recentSimilarPointIds=case.get("recentSimilarPointIds", []),
        )
        grounded = build_grounded_explanation(
            ExplainWrongAnswerRequest(
                questionId=request.questionId,
                selectedChoice=request.selectedChoice,
                wrongCount=request.wrongCount,
            )
        )
        if grounded is None:
            attempt = TutorGenerationAttempt(failureReason="knowledge_missing")
        else:
            started = time.perf_counter()
            attempt = generator(request, grounded)
            if attempt.latencyMs <= 0:
                attempt.latencyMs = (time.perf_counter() - started) * 1000

        selected = ""
        if grounded is not None:
            selected = next(
                (item.choice for item in grounded.choiceAnalysis if item.status == "selected_wrong"),
                "",
            )
        tutor = attempt.explanation
        locked_valid = bool(
            tutor
            and grounded
            and tutor.confusionComparison.correctPoint == grounded.testedPoint
            and tutor.confusionComparison.confusedPoint == selected
            and tutor.personalizationEvidence.wrongCount == request.wrongCount
            and tutor.personalizationEvidence.weaknessType == request.weaknessType
            and tutor.transferQuestion.testedPoint == grounded.testedPoint
        )
        personalization_valid = bool(
            tutor
            and selected in (tutor.diagnosisSummary + tutor.whyYouChoseIt)
            and (
                request.wrongCount == 1
                or str(request.wrongCount)
                in (tutor.diagnosisSummary + tutor.whyYouChoseIt + "".join(tutor.reasoningSteps))
            )
        )
        quality_score, quality_checks = _score_transfer(case, attempt)
        cost = (
            attempt.promptTokens * input_cost_per_million
            + attempt.completionTokens * output_cost_per_million
        ) / 1_000_000
        results.append(
            CaseResult(
                caseId=case["id"],
                questionId=case["questionId"],
                contextGroup=case["contextGroup"],
                status="success" if tutor else "fallback",
                failureReason=attempt.failureReason,
                latencyMs=round(attempt.latencyMs, 2),
                promptTokens=attempt.promptTokens,
                completionTokens=attempt.completionTokens,
                estimatedCostUsd=round(cost, 8),
                lockedFieldsValid=locked_valid,
                personalizationValid=personalization_valid,
                transferQualityScore=quality_score,
                transferQualityChecks=quality_checks,
            )
        )

    total = len(results)
    successful = [result for result in results if result.status == "success"]
    latencies = [result.latencyMs for result in results]
    summary = {
        "totalCases": total,
        "successfulCases": len(successful),
        "fallbackRate": round((total - len(successful)) / total, 4) if total else 0,
        "validationFailureRate": round(
            sum(result.failureReason == "validation_failed" for result in results) / total,
            4,
        ) if total else 0,
        "lockedFieldsValidRate": round(
            sum(result.lockedFieldsValid for result in successful) / len(successful), 4
        ) if successful else 0,
        "personalizationValidRate": round(
            sum(result.personalizationValid for result in successful) / len(successful), 4
        ) if successful else 0,
        "averageTransferQualityScore": round(
            sum(result.transferQualityScore for result in successful) / len(successful), 4
        ) if successful else 0,
        "latencyMs": {
            "average": round(sum(latencies) / len(latencies), 2) if latencies else 0,
            "p50": _percentile(latencies, 0.5),
            "p95": _percentile(latencies, 0.95),
        },
        "modelUsage": {
            "promptTokens": sum(result.promptTokens for result in results),
            "completionTokens": sum(result.completionTokens for result in results),
            "estimatedCostUsd": round(sum(result.estimatedCostUsd for result in results), 8),
        },
    }
    return {"summary": summary, "cases": [asdict(result) for result in results]}
