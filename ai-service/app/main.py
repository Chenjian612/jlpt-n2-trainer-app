from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .embedding_service import get_embedding_config, load_semantic_index
from .controlled_web_service import get_web_rag_config, load_web_cache
from .knowledge_service import build_grounded_explanation, load_question_index
from .llm_gateway import enrich_with_llm, generate_personalized_tutor, get_llm_config, probe_llm
from .retrieval_service import (
    build_retrieval_index,
    get_embedding_documents,
    search_knowledge,
)
from .research_service import research_knowledge
from .schemas import (
    ExplainWrongAnswerRequest,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeResearchAnswer,
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
    embedding_config = get_embedding_config()
    embedding_index = load_semantic_index(get_embedding_documents(), embedding_config)
    web_config = get_web_rag_config()
    web_cache = load_web_cache(web_config)
    return {
        "status": "ok",
        "knowledgeEntries": len(load_question_index()),
        "searchEntries": len(build_retrieval_index().documents),
        "retrievalMode": (
            "hybrid_semantic_rerank"
            if embedding_index is not None
            else "hybrid_tfidf_rerank"
        ),
        "embeddingConfigured": embedding_config.configured,
        "embeddingIndexReady": embedding_index is not None,
        "embeddingModel": embedding_config.model or "not-configured",
        "webRagEnabled": web_config.enabled,
        "webCacheEntries": len(web_cache),
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


@app.post("/knowledge/search", response_model=KnowledgeSearchResponse)
def knowledge_search(request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    return search_knowledge(request)


@app.post("/knowledge/research", response_model=KnowledgeResearchAnswer)
def knowledge_research(request: KnowledgeSearchRequest) -> KnowledgeResearchAnswer:
    result = research_knowledge(request)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="本地知识库与受控网络缓存都没有足够证据。",
        )
    return result
