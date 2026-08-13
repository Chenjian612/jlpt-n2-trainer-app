import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .schemas import (
    ChoiceAnalysis,
    ExplainWrongAnswerRequest,
    ExplanationSource,
    WrongAnswerExplanation,
)


QUESTION_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "src" / "data" / "seed" / "drill_questions.json"
)


@lru_cache(maxsize=1)
def load_question_index() -> dict[str, dict[str, Any]]:
    with QUESTION_DATA_PATH.open(encoding="utf-8-sig") as source:
        questions = json.load(source)
    return {
        question["id"]: question
        for question in questions
        if question.get("modeId") in {"grammar_drill", "vocab_drill"}
    }


def build_grounded_explanation(
    request: ExplainWrongAnswerRequest,
) -> WrongAnswerExplanation | None:
    question = load_question_index().get(request.questionId)
    if question is None:
        return None

    choices: list[str] = question["choices"]
    answer: int = question["answer"]
    if request.selectedChoice >= len(choices):
        return None

    selected_choice = choices[request.selectedChoice]
    correct_choice = choices[answer]
    insights: list[str] = question.get("choiceInsights", [])
    tags: list[str] = question.get("tags", [])
    tested_point = tags[1] if len(tags) > 1 else correct_choice
    correct_reason = insights[answer] if answer < len(insights) else question["explanation"]
    wrong_reason = (
        insights[request.selectedChoice]
        if request.selectedChoice < len(insights)
        else f"「{selected_choice}」与本题考点不匹配。"
    )
    mode_label = "接续或语义条件" if question["modeId"] == "grammar_drill" else "词义、搭配或语境限制"

    return WrongAnswerExplanation(
        testedPoint=tested_point,
        mistakePattern=f"这次错误反映出对「{tested_point}」的{mode_label}判断不够稳定。",
        whyCorrect=f"正确答案是「{correct_choice}」。{correct_reason}",
        whyUserWrong=f"你选择了「{selected_choice}」。{wrong_reason}",
        whyDistractorFooled=wrong_reason,
        watchNextTime=question.get("reviewNote", "下次先确认考点条件，再比较选项。"),
        choiceAnalysis=[
            ChoiceAnalysis(
                choice=choice,
                reason=insights[index] if index < len(insights) else "知识库暂无补充说明。",
                status=(
                    "correct"
                    if index == answer
                    else "selected_wrong"
                    if index == request.selectedChoice
                    else "other"
                ),
            )
            for index, choice in enumerate(choices)
        ],
        sources=[
            ExplanationSource(
                id=f"knowledge-{question['id']}",
                title=f"N2 {tested_point}",
                snippet=question["explanation"],
                sourceLabel=question["source"],
            )
        ],
        confidence="high",
        generationMode="local_knowledge",
    )
