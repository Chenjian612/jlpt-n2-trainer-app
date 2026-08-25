from .llm_gateway import generate_grounded_research
from .retrieval_service import search_knowledge
from .schemas import (
    KnowledgeResearchAnswer,
    KnowledgeSearchRequest,
    ResearchSource,
)


def research_knowledge(
    request: KnowledgeSearchRequest,
) -> KnowledgeResearchAnswer | None:
    result = search_knowledge(request)
    local_sources = [
        ResearchSource(
            id=f"knowledge-{hit.questionId}",
            title=f"N2 {hit.testedPoint}",
            snippet=hit.snippet[:500],
            sourceType="local_knowledge",
        )
        for hit in result.hits[:3]
    ]
    web_sources = [
        ResearchSource(
            id=source.id,
            title=source.title,
            snippet=source.snippet,
            sourceType=source.sourceType,
            url=source.url,
            fetchedAt=source.fetchedAt,
            contentHash=source.contentHash,
        )
        for source in result.webSources
    ]
    sources = [*local_sources, *web_sources]
    if not sources:
        return None

    evidence = [source.model_dump() for source in sources]
    generated = generate_grounded_research(request.query, evidence)
    if generated is not None:
        answer, cited_source_ids = generated
        return KnowledgeResearchAnswer(
            query=request.query,
            answer=answer,
            citedSourceIds=cited_source_ids,
            sources=sources,
            evidenceMode="web_supplemented" if web_sources else "local_only",
            generationMode="ai_service",
        )

    primary = sources[0]
    prefix = (
        "本地知识库证据不足，已从审批过的网络缓存找到补充资料。"
        if web_sources and not local_sources
        else "已从本地知识库找到相关资料。"
    )
    return KnowledgeResearchAnswer(
        query=request.query,
        answer=f"{prefix}{primary.snippet}",
        citedSourceIds=[primary.id],
        sources=sources,
        evidenceMode="web_supplemented" if web_sources else "local_only",
        generationMode="local_extract",
        fallbackReason=(
            "model_unavailable_or_invalid"
            if generated is None
            else None
        ),
    )
