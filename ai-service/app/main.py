from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .knowledge_service import build_grounded_explanation, load_question_index
from .llm_gateway import enrich_with_llm, generate_personalized_tutor, get_llm_config, probe_llm
from .schemas import (
    ExplainWrongAnswerRequest,
    PersonalizedTutorExplanation,
    TutorWrongAnswerRequest,
    WrongAnswerExplanation,
)


app = FastAPI(
    title="JLPT N2 RAG Explanation Service",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, int | str | bool]:
    base_url, api_key, model = get_llm_config()
    return {
        "status": "ok",
        "knowledgeEntries": len(load_question_index()),
        "llmConfigured": bool(base_url and api_key and model),
        "llmModel": model or "not-configured",
    }


@app.get("/health/ai")
def ai_health() -> dict[str, str | bool]:
    reachable, model, detail = probe_llm()
    return {
        "status": "ok" if reachable else "unavailable",
        "reachable": reachable,
        "model": model or "not-configured",
        "detail": detail,
    }


@app.post("/explain-wrong-answer", response_model=WrongAnswerExplanation)
def explain_wrong_answer(
    request: ExplainWrongAnswerRequest,
) -> WrongAnswerExplanation:
    explanation = build_grounded_explanation(request)
    if explanation is None:
        raise HTTPException(
            status_code=404,
            detail="知识库证据不足，暂时不能可靠解释这道题。",
        )
    return enrich_with_llm(explanation, request.wrongCount)


@app.post("/tutor/wrong-answer", response_model=PersonalizedTutorExplanation)
def tutor_wrong_answer(
    request: TutorWrongAnswerRequest,
) -> PersonalizedTutorExplanation:
    grounded_request = ExplainWrongAnswerRequest(
        questionId=request.questionId,
        selectedChoice=request.selectedChoice,
        wrongCount=request.wrongCount,
    )
    explanation = build_grounded_explanation(grounded_request)
    if explanation is None:
        raise HTTPException(
            status_code=404,
            detail="知识库证据不足，暂时不能生成个性化辅导。",
        )
    result = generate_personalized_tutor(request, explanation)
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="个性化 AI 辅导暂时不可用，请保留知识库讲解。",
        )
    return result
