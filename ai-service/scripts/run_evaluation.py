#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.evaluation import evaluate_cases, load_evaluation_set  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the fixed AI tutor quality evaluation set.")
    parser.add_argument("--limit", type=int, default=None, help="Run only the first N cases.")
    parser.add_argument("--output", type=Path, default=None, help="Write the full JSON report.")
    parser.add_argument(
        "--input-cost-per-million",
        type=float,
        default=float(os.getenv("AI_LLM_INPUT_COST_PER_MILLION", "0")),
    )
    parser.add_argument(
        "--output-cost-per-million",
        type=float,
        default=float(os.getenv("AI_LLM_OUTPUT_COST_PER_MILLION", "0")),
    )
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
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
