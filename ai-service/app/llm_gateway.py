import json
import os
import ssl
from urllib.error import HTTPError
from urllib import request as urlrequest

import certifi

from .schemas import (
    ConfusionComparison,
    PersonalizationEvidence,
    PersonalizedTutorExplanation,
    ReviewAction,
    TransferQuestion,
    TutorWrongAnswerRequest,
    WrongAnswerExplanation,
)


TEXT_FIELDS = (
    "mistakePattern",
    "whyCorrect",
    "whyUserWrong",
    "whyDistractorFooled",
    "watchNextTime",
)


def get_llm_config() -> tuple[str, str, str]:
    return (
        os.getenv("AI_LLM_BASE_URL", "").rstrip("/"),
        os.getenv("AI_LLM_API_KEY", ""),
        os.getenv("AI_LLM_MODEL", ""),
    )


def _build_request(base_url: str, api_key: str, payload: dict) -> urlrequest.Request:
    return urlrequest.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "jlpt-n2-rag-service/0.1",
        },
        method="POST",
    )


def _send_request(req: urlrequest.Request, timeout: int = 45) -> dict:
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with urlrequest.urlopen(req, timeout=timeout, context=ssl_context) as response:
        return json.loads(response.read().decode("utf-8"))


def probe_llm() -> tuple[bool, str, str]:
    """Check the configured model without sending any question-bank content."""
    base_url, api_key, model = get_llm_config()
    if not base_url or not api_key or not model:
        return False, model, "AI model is not fully configured"

    req = _build_request(
        base_url,
        api_key,
        {
            "model": model,
            "temperature": 0,
            "max_tokens": 20,
            "messages": [
                {"role": "system", "content": "You are a health-check endpoint."},
                {"role": "user", "content": "Reply with only: ok"},
            ],
        },
    )
    try:
        raw = _send_request(req, timeout=10)
        content = raw["choices"][0]["message"]["content"].strip().lower()
        actual_model = str(raw.get("model") or model)
        if "ok" not in content:
            return False, actual_model, "AI model returned an unexpected probe response"
        return True, actual_model, "AI model is reachable"
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:200]
        return False, model, f"AI model returned HTTP {error.code}: {detail}"
    except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError) as error:
        return False, model, f"AI model request failed: {type(error).__name__}: {error}"


def _strip_json_fence(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```json"):
        stripped = stripped[7:]
    elif stripped.startswith("```"):
        stripped = stripped[3:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


def enrich_with_llm(
    explanation: WrongAnswerExplanation,
    wrong_count: int = 1,
) -> WrongAnswerExplanation:
    base_url, api_key, model = get_llm_config()
    if not base_url or not api_key or not model:
        return explanation

    evidence = explanation.model_dump()
    prompt = (
        "你是面向中国学习者的 JLPT N2 错题教练。只能依据下面 JSON 证据改写讲解，"
        "不得改变答案、考点、选项事实或来源。讲解要具体指出本题判断线索，避免空泛鼓励。"
        f"学生累计答错 {wrong_count} 次；如果重复出错，要在 mistakePattern 和 watchNextTime 中给出针对性强化建议。"
        "只返回包含 mistakePattern、whyCorrect、whyUserWrong、whyDistractorFooled、"
        "watchNextTime 五个字符串字段的 JSON，每个字段控制在 60-120 个汉字。\n证据："
        + json.dumps(evidence, ensure_ascii=False)
    )
    req = _build_request(
        base_url,
        api_key,
        {
            "model": model,
            "temperature": 0.1,
            "max_tokens": 900,
            "messages": [
                {"role": "system", "content": "严格基于证据回答；证据不足时不要编造。"},
                {"role": "user", "content": prompt},
            ],
        },
    )

    try:
        raw = _send_request(req)
        generated = json.loads(_strip_json_fence(raw["choices"][0]["message"]["content"]))
        if not all(isinstance(generated.get(field), str) for field in TEXT_FIELDS):
            return explanation
        updated = explanation.model_copy(update={field: generated[field] for field in TEXT_FIELDS})
        return updated.model_copy(update={"generationMode": "ai_service"})
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        print(f"[llm_gateway] HTTP {error.code}, fallback to local knowledge: {detail}")
        return explanation
    except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError) as error:
        print(f"[llm_gateway] fallback to local knowledge: {type(error).__name__}: {error}")
        return explanation


def generate_personalized_tutor(
    request: TutorWrongAnswerRequest,
    explanation: WrongAnswerExplanation,
) -> PersonalizedTutorExplanation | None:
    base_url, api_key, model = get_llm_config()
    if not base_url or not api_key or not model:
        return None

    selected = next(
        (item.choice for item in explanation.choiceAnalysis if item.status == "selected_wrong"),
        "未记录误选项",
    )
    evidence = {
        "groundedExplanation": explanation.model_dump(),
        "learningContext": request.model_dump(),
    }
    prompt = (
        "你是 JLPT N2 个性化错题教练。事实只能来自 evidence，不得修改正确考点、误选项、"
        "错误次数或来源。不要重复普通知识库定义，重点诊断这个学生为何误选，并给出可复用步骤。"
        "生成一道全新但考查同一 testedPoint 的迁移选择题。只返回 JSON，字段必须是："
        "diagnosisSummary(string), whyYouChoseIt(string), reasoningSteps(正好3个string), "
        "confusionComparison{decisiveDifference}, reviewPlan(1-3项，每项 timing 只能是 now/tomorrow/three_days, action), "
        "transferQuestion{prompt,choices(2-4项),answer(从0开始的索引),explanation}。"
        "诊断必须提到本次真实误选，步骤必须引用本题线索，迁移题答案必须唯一。\n"
        + json.dumps(evidence, ensure_ascii=False)
    )
    req = _build_request(
        base_url,
        api_key,
        {
            "model": model,
            "temperature": 0.2,
            "max_tokens": 1400,
            "messages": [
                {
                    "role": "system",
                    "content": "基于证据进行个性化教学，只输出合法 JSON；不可做无依据心理判断。",
                },
                {"role": "user", "content": prompt},
            ],
        },
    )

    try:
        raw = _send_request(req)
        generated = json.loads(_strip_json_fence(raw["choices"][0]["message"]["content"]))
        steps = generated.get("reasoningSteps")
        comparison = generated.get("confusionComparison")
        review_plan = generated.get("reviewPlan")
        transfer = generated.get("transferQuestion")
        if not isinstance(steps, list) or len(steps) != 3 or not all(isinstance(step, str) and step.strip() for step in steps):
            return None
        if not isinstance(comparison, dict) or not isinstance(comparison.get("decisiveDifference"), str):
            return None
        if not isinstance(review_plan, list) or not 1 <= len(review_plan) <= 3:
            return None
        if not isinstance(transfer, dict):
            return None
        choices = transfer.get("choices")
        answer = transfer.get("answer")
        if (
            not isinstance(choices, list)
            or not 2 <= len(choices) <= 4
            or not all(isinstance(choice, str) and choice.strip() for choice in choices)
            or not isinstance(answer, int)
            or not 0 <= answer < len(choices)
        ):
            return None

        return PersonalizedTutorExplanation(
            diagnosisSummary=generated["diagnosisSummary"],
            whyYouChoseIt=generated["whyYouChoseIt"],
            reasoningSteps=tuple(steps),
            confusionComparison=ConfusionComparison(
                correctPoint=explanation.testedPoint,
                confusedPoint=selected,
                decisiveDifference=comparison["decisiveDifference"],
            ),
            reviewPlan=[ReviewAction.model_validate(item) for item in review_plan],
            personalizationEvidence=PersonalizationEvidence(
                selectedChoice=selected,
                wrongCount=request.wrongCount,
                weaknessType=request.weaknessType,
                recentSimilarWrongCount=request.recentSimilarWrongCount,
            ),
            transferQuestion=TransferQuestion(
                prompt=transfer["prompt"],
                choices=choices,
                answer=answer,
                testedPoint=explanation.testedPoint,
                explanation=transfer["explanation"],
            ),
        )
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        print(f"[llm_gateway] tutor HTTP {error.code}: {detail}")
        return None
    except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError) as error:
        print(f"[llm_gateway] tutor failed: {type(error).__name__}: {error}")
        return None
