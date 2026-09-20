#!/usr/bin/env python3
import argparse
import json
import math
import os
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.evaluation import (  # noqa: E402
    evaluate_cases,
    evaluate_quality_gates,
    load_evaluation_set,
)


def non_negative_float(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a number") from error
    if not math.isfinite(parsed) or parsed < 0:
        raise argparse.ArgumentTypeError("must be a finite non-negative number")
    return parsed


def probability(value: str) -> float:
    parsed = non_negative_float(value)
    if parsed > 1:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the fixed AI tutor quality evaluation set.")
    parser.add_argument("--limit", type=int, default=None, help="Run only the first N cases.")
    parser.add_argument("--output", type=Path, default=None, help="Write the full JSON report.")
    parser.add_argument(
        "--input-cost-per-million",
        type=non_negative_float,
        default=non_negative_float(os.getenv("AI_LLM_INPUT_COST_PER_MILLION", "0")),
    )
    parser.add_argument(
        "--output-cost-per-million",
        type=non_negative_float,
        default=non_negative_float(os.getenv("AI_LLM_OUTPUT_COST_PER_MILLION", "0")),
    )
    parser.add_argument("--max-fallback-rate", type=probability)
    parser.add_argument("--max-validation-failure-rate", type=probability)
    parser.add_argument("--min-locked-fields-valid-rate", type=probability)
    parser.add_argument("--min-personalization-valid-rate", type=probability)
    parser.add_argument("--min-transfer-quality-score", type=probability)
    parser.add_argument("--max-p95-latency-ms", type=non_negative_float)
    parser.add_argument("--max-estimated-cost-usd", type=non_negative_float)
    args = parser.parse_args()

    cases = load_evaluation_set()
    if args.limit is not None:
        if args.limit < 1:
            parser.error("--limit must be at least 1")
        cases = cases[: args.limit]
    report = evaluate_cases(
        cases,
        input_cost_per_million=args.input_cost_per_million,
        output_cost_per_million=args.output_cost_per_million,
    )
    gate_values = {
        "fallbackRate": args.max_fallback_rate,
        "validationFailureRate": args.max_validation_failure_rate,
        "lockedFieldsValidRate": args.min_locked_fields_valid_rate,
        "personalizationValidRate": args.min_personalization_valid_rate,
        "averageTransferQualityScore": args.min_transfer_quality_score,
        "p95LatencyMs": args.max_p95_latency_ms,
        "estimatedCostUsd": args.max_estimated_cost_usd,
    }
    configured_gates = {
        metric: value for metric, value in gate_values.items() if value is not None
    }
    if configured_gates:
        report["qualityGates"] = evaluate_quality_gates(
            report["summary"], configured_gates
        )
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if configured_gates:
        print(json.dumps(report["qualityGates"], ensure_ascii=False, indent=2))
        if not report["qualityGates"]["passed"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
