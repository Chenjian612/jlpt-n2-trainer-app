from __future__ import annotations

import hashlib
import json
import math
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
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
    _validate_evaluation_set(cases)
    return cases


def _validate_evaluation_set(cases: object) -> None:
    if not isinstance(cases, list) or not 30 <= len(cases) <= 50:
        raise ValueError("fixed evaluation set must contain 30-50 cases")

    question_index = load_question_index()
    seen_case_ids: set[str] = set()
    contexts_by_question: dict[str, list[str]] = {}
    mode_counts = {"grammar_drill": 0, "vocab_drill": 0}
    context_counts = {"first_error": 0, "repeated_error": 0}
    required_fields = {
        "id",
        "questionId",
        "contextGroup",
        "selectedChoice",
        "wrongCount",
        "weaknessType",
        "recentSimilarWrongCount",
        "recentSimilarPointIds",
        "expectedTestedPoint",
        "qualityAnchors",
    }

    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            raise ValueError(f"evaluation case {index} must be an object")
        missing = sorted(required_fields - case.keys())
        if missing:
            raise ValueError(
                f"evaluation case {index} is missing fields: {', '.join(missing)}"
            )

        case_id = case["id"]
        if not isinstance(case_id, str) or not case_id.strip():
            raise ValueError(f"evaluation case {index} has an invalid id")
        if case_id in seen_case_ids:
            raise ValueError(f"duplicate evaluation case id: {case_id}")
        seen_case_ids.add(case_id)

        question_id = case["questionId"]
        question = question_index.get(question_id)
        if question is None:
            raise ValueError(f"{case_id}: unknown questionId {question_id}")
        mode_counts[question["modeId"]] += 1

        context = case["contextGroup"]
        if context not in context_counts:
            raise ValueError(f"{case_id}: unsupported contextGroup {context}")
        context_counts[context] += 1
        contexts_by_question.setdefault(question_id, []).append(context)

        try:
            request = TutorWrongAnswerRequest(
                questionId=question_id,
                selectedChoice=case["selectedChoice"],
                wrongCount=case["wrongCount"],
                weaknessType=case["weaknessType"],
                recentSimilarWrongCount=case["recentSimilarWrongCount"],
                recentSimilarPointIds=case["recentSimilarPointIds"],
            )
        except (TypeError, ValueError) as error:
            raise ValueError(f"{case_id}: invalid learning context: {error}") from error

        if request.selectedChoice >= len(question["choices"]):
            raise ValueError(f"{case_id}: selectedChoice is outside the question choices")
        if request.selectedChoice == question["answer"]:
            raise ValueError(f"{case_id}: selectedChoice must be a wrong answer")
        if context == "first_error" and (
            request.wrongCount != 1 or request.recentSimilarWrongCount != 0
        ):
            raise ValueError(f"{case_id}: first_error must use a first-error context")
        if context == "repeated_error" and (
            request.wrongCount < 2 or request.recentSimilarWrongCount < 1
        ):
            raise ValueError(f"{case_id}: repeated_error must use a repeated-error context")

        tags = question.get("tags", [])
        tested_point = tags[1] if len(tags) > 1 else question["choices"][question["answer"]]
        if case["expectedTestedPoint"] != tested_point:
            raise ValueError(
                f"{case_id}: expectedTestedPoint does not match current question data"
            )
        anchors = case["qualityAnchors"]
        if (
            not isinstance(anchors, list)
            or not anchors
            or not all(isinstance(anchor, str) and anchor.strip() for anchor in anchors)
        ):
            raise ValueError(f"{case_id}: qualityAnchors must contain non-empty strings")

    if mode_counts["grammar_drill"] != mode_counts["vocab_drill"]:
        raise ValueError("fixed evaluation set must balance grammar and vocabulary cases")
    if context_counts["first_error"] != context_counts["repeated_error"]:
        raise ValueError("fixed evaluation set must balance first and repeated errors")
    for question_id, contexts in contexts_by_question.items():
        if sorted(contexts) != ["first_error", "repeated_error"]:
            raise ValueError(
                f"{question_id}: evaluation set must include both learning contexts"
            )


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(0, math.ceil(percentile * len(ordered)) - 1)
    return round(ordered[rank], 2)


def _contains_any(text: str, candidates: list[str]) -> bool:
    return any(candidate and candidate in text for candidate in candidates)


def _latency_summary(results: list[CaseResult]) -> dict[str, float]:
    latencies = [result.latencyMs for result in results]
    return {
        "average": round(sum(latencies) / len(latencies), 2) if latencies else 0,
        "p50": _percentile(latencies, 0.5),
        "p95": _percentile(latencies, 0.95),
    }


def _result_breakdown(results: list[CaseResult]) -> dict:
    successful = [result for result in results if result.status == "success"]
    total = len(results)
    return {
        "totalCases": total,
        "successfulCases": len(successful),
        "fallbackRate": round((total - len(successful)) / total, 4) if total else 0,
        "lockedFieldsValidRate": round(
            sum(result.lockedFieldsValid for result in successful) / len(successful), 4
        ) if successful else 0,
        "personalizationValidRate": round(
            sum(result.personalizationValid for result in successful) / len(successful), 4
        ) if successful else 0,
        "averageTransferQualityScore": round(
            sum(result.transferQualityScore for result in successful) / len(successful), 4
        ) if successful else 0,
        "latencyMs": _latency_summary(results),
    }


def evaluate_quality_gates(summary: dict, gates: dict[str, float]) -> dict:
    checks: list[dict] = []
    metrics = {
        "fallbackRate": summary["fallbackRate"],
        "validationFailureRate": summary["validationFailureRate"],
        "lockedFieldsValidRate": summary["lockedFieldsValidRate"],
        "personalizationValidRate": summary["personalizationValidRate"],
        "averageTransferQualityScore": summary["averageTransferQualityScore"],
        "p95LatencyMs": summary["latencyMs"]["p95"],
        "estimatedCostUsd": summary["modelUsage"]["estimatedCostUsd"],
    }
    for metric, threshold in gates.items():
        if metric not in metrics:
            raise ValueError(f"unsupported quality gate: {metric}")
        comparison = "max" if metric in {
            "fallbackRate",
            "validationFailureRate",
            "p95LatencyMs",
            "estimatedCostUsd",
        } else "min"
        actual = metrics[metric]
        passed = actual <= threshold if comparison == "max" else actual >= threshold
        checks.append(
            {
                "metric": metric,
                "comparison": comparison,
                "threshold": threshold,
                "actual": actual,
                "passed": passed,
            }
        )
    return {"passed": all(check["passed"] for check in checks), "checks": checks}


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
    failure_reason_counts: dict[str, int] = {}
    for result in results:
        if result.failureReason:
            failure_reason_counts[result.failureReason] = (
                failure_reason_counts.get(result.failureReason, 0) + 1
            )
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
        "latencyMs": _latency_summary(results),
        "successfulLatencyMs": _latency_summary(successful),
        "fallbackLatencyMs": _latency_summary(
            [result for result in results if result.status == "fallback"]
        ),
        "failureReasonCounts": failure_reason_counts,
        "byContext": {
            context: _result_breakdown(
                [result for result in results if result.contextGroup == context]
            )
            for context in sorted({result.contextGroup for result in results})
        },
        "modelUsage": {
            "promptTokens": sum(result.promptTokens for result in results),
            "completionTokens": sum(result.completionTokens for result in results),
            "estimatedCostUsd": round(sum(result.estimatedCostUsd for result in results), 8),
        },
    }
    canonical_set = json.dumps(
        cases, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    metadata = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "evaluationSetSha256": hashlib.sha256(canonical_set).hexdigest(),
        "model": os.getenv("AI_LLM_MODEL", "") or None,
        "pricingUsdPerMillionTokens": {
            "input": input_cost_per_million,
            "output": output_cost_per_million,
        },
    }
    return {
        "metadata": metadata,
        "summary": summary,
        "cases": [asdict(result) for result in results],
    }
