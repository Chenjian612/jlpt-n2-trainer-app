import json
import os
import ssl
from urllib.error import HTTPError
from urllib import request as urlrequest

import certifi

from .schemas import WrongAnswerExplanation


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
