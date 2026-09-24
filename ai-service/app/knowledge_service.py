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
LISTENING_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "src" / "data" / "seed" / "listening_cases.json"
)
READING_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "src" / "data" / "seed" / "reading_passages.json"
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


@lru_cache(maxsize=1)
def load_listening_question_index() -> dict[str, dict[str, Any]]:
    with LISTENING_DATA_PATH.open(encoding="utf-8-sig") as source:
        listening_cases = json.load(source)
    return {
        question["id"]: {
            **question,
            "modeId": "listening_analyze",
            "source": case["source"],
            "caseId": case["id"],
            "title": case["title"],
            "scene": case["scene"],
            "dialogue": case["dialogue"],
        }
        for case in listening_cases
        for question in case.get("questions", [])
    }


@lru_cache(maxsize=1)
def load_reading_question_index() -> dict[str, dict[str, Any]]:
    with READING_DATA_PATH.open(encoding="utf-8-sig") as source:
        reading_passages = json.load(source)
    return {
        question["id"]: {
            **question,
            "modeId": "reading_drill",
            "source": passage["source"],
            "passageId": passage["id"],
            "title": passage["title"],
            "paragraphs": passage["paragraphs"],
        }
        for passage in reading_passages
        for question in passage.get("questions", [])
    }


def build_grounded_explanation(
    request: ExplainWrongAnswerRequest,
) -> WrongAnswerExplanation | None:
    question = load_question_index().get(request.questionId)
    if question is None:
        question = load_reading_question_index().get(request.questionId)
    if question is None:
        question = load_listening_question_index().get(request.questionId)
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
    is_listening = question["modeId"] == "listening_analyze"
    is_reading = question["modeId"] == "reading_drill"
    tested_point = (
        tags[0] if is_listening and tags else
        tags[0] if is_reading and tags else
        tags[1] if len(tags) > 1 else
        "听力证据定位" if is_listening else correct_choice
    )
    correct_reason = insights[answer] if answer < len(insights) else question["explanation"]
    wrong_reason = (
        insights[request.selectedChoice]
        if request.selectedChoice < len(insights)
        else f"「{selected_choice}」与本题考点不匹配。"
    )
    mode_label = (
        "听力线索与原文证据" if is_listening else
        "题干、原文证据与选项改写" if is_reading else
        "接续或语义条件" if question["modeId"] == "grammar_drill" else
        "词义、搭配或语境限制"
    )

    return WrongAnswerExplanation(
        testedPoint=tested_point,
        mistakePattern=f"这次错误反映出对「{tested_point}」的{mode_label}判断不够稳定。",
        whyCorrect=f"正确答案是「{correct_choice}」。{correct_reason}",
        whyUserWrong=f"你选择了「{selected_choice}」。{wrong_reason}",
        whyDistractorFooled=wrong_reason,
        watchNextTime=(
            f"{question.get('keySignal', '')} {question.get('reviewNote', '')}".strip()
            if is_listening else
            f"{question.get('evidence', '')} {question.get('reviewNote', '')}".strip()
            if is_reading else
            question.get("reviewNote", "下次先确认考点条件，再比较选项。")
        ),
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
                id=(
                    f"listening-{question['id']}" if is_listening else
                    f"reading-{question['id']}" if is_reading else
                    f"knowledge-{question['id']}"
                ),
                title=f"N2 {'听力 ' if is_listening else '读解 ' if is_reading else ''}{tested_point}",
                snippet=(
                    question.get("basisLine", question["explanation"]) if is_listening else
                    question.get("evidence", question["explanation"]) if is_reading else
                    question["explanation"]
                ),
                sourceLabel=question["source"],
            )
        ],
        confidence="high",
        generationMode="local_knowledge",
    )
