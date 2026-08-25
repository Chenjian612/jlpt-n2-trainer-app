import math
import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Any

from .controlled_web_service import (
    get_web_rag_config,
    load_web_cache,
    search_web_cache,
)
from .embedding_service import semantic_scores
from .knowledge_service import load_question_index
from .schemas import (
    EvidenceLocation,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    ListeningDialogueLine,
    ListeningEvidence,
)


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+|[\u3040-\u30ff\u3400-\u9fff]+")
BM25_K1 = 1.5
BM25_B = 0.75
READING_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "data"
    / "seed"
    / "reading_passages.json"
)
LISTENING_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "data"
    / "seed"
    / "listening_cases.json"
)


def tokenize(text: str) -> list[str]:
    """Tokenize mixed Chinese/Japanese prose without an external dictionary."""
    tokens: list[str] = []
    for segment in TOKEN_PATTERN.findall(text.lower()):
        if segment.isascii():
            tokens.append(segment)
            continue
        tokens.append(segment)
        if len(segment) > 1:
            tokens.extend(segment[index : index + 2] for index in range(len(segment) - 1))
    return tokens


def _tested_point(question: dict[str, Any]) -> str:
    tags = question.get("tags", [])
    if question.get("modeId") in {"reading_drill", "listening_analyze"}:
        fallback = (
            "听力陷阱分析"
            if question.get("modeId") == "listening_analyze"
            else "读解证据定位"
        )
        return tags[0] if tags else fallback
    answer = question.get("answer", 0)
    choices = question.get("choices", [])
    return tags[1] if len(tags) > 1 else choices[answer]


def _search_text(question: dict[str, Any]) -> str:
    fields = [
        question.get("prompt", ""),
        question.get("explanation", ""),
        question.get("reviewNote", ""),
        question.get("source", ""),
        question.get("title", ""),
        question.get("evidence", ""),
        question.get("basisLine", ""),
        question.get("keySignal", ""),
        question.get("trapPoint", ""),
        question.get("scene", ""),
        question.get("task", ""),
        question.get("note", ""),
        *question.get("choices", []),
        *question.get("choiceInsights", []),
        *question.get("tags", []),
        *question.get("listenChecklist", []),
        *(line.get("text", "") for line in question.get("dialogue", [])),
    ]
    return " ".join(value for value in fields if isinstance(value, str))


@lru_cache(maxsize=1)
def load_search_documents() -> dict[str, dict[str, Any]]:
    documents = dict(load_question_index())
    with READING_DATA_PATH.open(encoding="utf-8-sig") as source:
        passages = json.load(source)
    for passage in passages:
        for question in passage.get("questions", []):
            documents[question["id"]] = {
                **question,
                "modeId": "reading_drill",
                "source": passage["source"],
                "passageId": passage["id"],
                "title": passage["title"],
                "paragraphs": passage["paragraphs"],
            }
    with LISTENING_DATA_PATH.open(encoding="utf-8-sig") as source:
        listening_cases = json.load(source)
    for case in listening_cases:
        for question in case.get("questions", []):
            documents[question["id"]] = {
                **question,
                "modeId": "listening_analyze",
                "source": case["source"],
                "caseId": case["id"],
                "title": case["title"],
                "audioKey": case["audioKey"],
                "scene": case["scene"],
                "task": case["task"],
                "note": case["note"],
                "listenChecklist": case["listenChecklist"],
                "dialogue": case["dialogue"],
            }
    return documents


def get_embedding_documents() -> dict[str, str]:
    return {
        question_id: _search_text(question)
        for question_id, question in load_search_documents().items()
    }


@dataclass(frozen=True)
class IndexedDocument:
    question: dict[str, Any]
    text: str
    term_counts: Counter[str]
    length: int
    vector: dict[str, float]
    vector_norm: float


@dataclass(frozen=True)
class RetrievalIndex:
    documents: tuple[IndexedDocument, ...]
    document_frequencies: Counter[str]
    average_length: float


@lru_cache(maxsize=1)
def build_retrieval_index() -> RetrievalIndex:
    raw_documents: list[tuple[dict[str, Any], str, Counter[str]]] = []
    document_frequencies: Counter[str] = Counter()
    for question in load_search_documents().values():
        text = _search_text(question)
        term_counts = Counter(tokenize(text))
        document_frequencies.update(term_counts.keys())
        raw_documents.append((question, text, term_counts))

    document_count = len(raw_documents)
    documents: list[IndexedDocument] = []
    for question, text, term_counts in raw_documents:
        vector = {
            token: (1 + math.log(frequency))
            * _vector_inverse_document_frequency(document_count, document_frequencies[token])
            for token, frequency in term_counts.items()
        }
        documents.append(
            IndexedDocument(
                question=question,
                text=text.lower(),
                term_counts=term_counts,
                length=sum(term_counts.values()),
                vector=vector,
                vector_norm=math.sqrt(sum(weight * weight for weight in vector.values())),
            )
        )
    average_length = sum(item.length for item in documents) / max(len(documents), 1)
    return RetrievalIndex(tuple(documents), document_frequencies, average_length)


def _vector_inverse_document_frequency(document_count: int, document_frequency: int) -> float:
    return math.log((1 + document_count) / (1 + document_frequency)) + 1


def _bm25_score(query_tokens: list[str], document: IndexedDocument, index: RetrievalIndex) -> float:
    score = 0.0
    document_count = len(index.documents)
    for token in set(query_tokens):
        frequency = document.term_counts.get(token, 0)
        if not frequency:
            continue
        document_frequency = index.document_frequencies[token]
        inverse_document_frequency = math.log(
            1 + (document_count - document_frequency + 0.5) / (document_frequency + 0.5)
        )
        normalization = frequency + BM25_K1 * (
            1 - BM25_B + BM25_B * document.length / max(index.average_length, 1)
        )
        score += inverse_document_frequency * frequency * (BM25_K1 + 1) / normalization
    return score


def _query_vector(query_tokens: list[str], index: RetrievalIndex) -> tuple[dict[str, float], float]:
    term_counts = Counter(query_tokens)
    vector = {
        token: (1 + math.log(frequency))
        * _vector_inverse_document_frequency(
            len(index.documents), index.document_frequencies.get(token, 0)
        )
        for token, frequency in term_counts.items()
    }
    return vector, math.sqrt(sum(weight * weight for weight in vector.values()))


def _cosine_similarity(
    query_vector: dict[str, float], query_norm: float, document: IndexedDocument
) -> float:
    if query_norm == 0 or document.vector_norm == 0:
        return 0.0
    dot_product = sum(
        query_weight * document.vector.get(token, 0.0)
        for token, query_weight in query_vector.items()
    )
    return dot_product / (query_norm * document.vector_norm)


def _rerank_bonus(query: str, query_tokens: list[str], document: IndexedDocument) -> tuple[float, list[str]]:
    question = document.question
    normalized_query = query.strip().lower()
    tested_point = _tested_point(question).lower()
    tags = [tag.lower() for tag in question.get("tags", [])]
    reasons: list[str] = []
    bonus = 0.0

    if normalized_query and normalized_query in document.text:
        bonus += 2.0
        reasons.append("完整短语命中")
    if tested_point in normalized_query or normalized_query == tested_point:
        bonus += 3.0
        reasons.append("考点命中")
    if any(tag in normalized_query or normalized_query in tag for tag in tags if tag):
        bonus += 1.5
        reasons.append("标签命中")

    matched_tokens = sum(1 for token in set(query_tokens) if token in document.term_counts)
    if matched_tokens:
        reasons.append(f"关键词命中 {matched_tokens} 项")
    return bonus, reasons


def _extract_evidence_quotes(evidence: str) -> list[str]:
    quoted = re.findall(r'["“”「」]([^"“”「」]+)["“”「」]', evidence)
    return [quote.strip("。 ") for quote in quoted if quote.strip("。 ")]


def _evidence_quote_matches(quote: str, paragraph: str) -> bool:
    fragments = [part.strip("。 、") for part in re.split(r"[…‥]+", quote)]
    if any(len(fragment) >= 4 and fragment in paragraph for fragment in fragments):
        return True
    normalized_quote = re.sub(r"[\s、。！？『』「」]", "", quote)
    normalized_paragraph = re.sub(r"[\s、。！？『』「」]", "", paragraph)
    if len(normalized_quote) < 8:
        return False
    matching_characters = sum(
        block.size
        for block in SequenceMatcher(None, normalized_quote, normalized_paragraph).get_matching_blocks()
        if block.size >= 2
    )
    return matching_characters / len(normalized_quote) >= 0.75


def _locate_evidence(question: dict[str, Any]) -> EvidenceLocation | None:
    if question.get("modeId") != "reading_drill":
        return None
    evidence = question.get("evidence", "")
    quotes = _extract_evidence_quotes(evidence)
    paragraph_numbers: list[int] = []
    for index, paragraph in enumerate(question.get("paragraphs", []), start=1):
        if any(_evidence_quote_matches(quote, paragraph) for quote in quotes):
            paragraph_numbers.append(index)
    unique_paragraph_numbers = sorted(set(paragraph_numbers))
    return EvidenceLocation(
        passageId=question["passageId"],
        passageTitle=question["title"],
        paragraphNumbers=unique_paragraph_numbers,
        paragraphTexts=[
            question["paragraphs"][number - 1] for number in unique_paragraph_numbers
        ],
        quotes=quotes,
        evidence=evidence,
    )


def _listening_evidence_type(question: dict[str, Any]) -> str:
    case_id = question["caseId"]
    if case_id.startswith("official-"):
        return "audio_transcript"
    if case_id.startswith("instant-reply-"):
        return "stimulus_response"
    dialogue_text = " ".join(line.get("text", "") for line in question["dialogue"])
    if question["basisLine"] in dialogue_text:
        return "dialogue_quote"
    return "pedagogical_summary"


def _build_listening_evidence(question: dict[str, Any]) -> ListeningEvidence | None:
    if question.get("modeId") != "listening_analyze":
        return None
    return ListeningEvidence(
        caseId=question["caseId"],
        caseTitle=question["title"],
        audioKey=question["audioKey"],
        evidenceType=_listening_evidence_type(question),
        scene=question["scene"],
        dialogue=[ListeningDialogueLine(**line) for line in question["dialogue"]],
        basisLine=question["basisLine"],
        keySignal=question["keySignal"],
        trapPoint=question["trapPoint"],
        listenChecklist=question["listenChecklist"],
    )


def search_knowledge(request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    index = build_retrieval_index()
    query_tokens = tokenize(request.query)
    query_vector, query_norm = _query_vector(query_tokens, index)
    semantic_score_map = semantic_scores(request.query, get_embedding_documents())
    try:
        semantic_min_score = float(os.getenv("AI_EMBEDDING_MIN_SCORE", "0.35"))
    except ValueError:
        semantic_min_score = 0.35
    semantic_min_score = max(0.0, min(semantic_min_score, 1.0))
    raw_candidates: list[
        tuple[float, float, float, float, IndexedDocument, list[str]]
    ] = []

    for document in index.documents:
        question = document.question
        if request.modeId and question.get("modeId") != request.modeId:
            continue
        bm25_score = _bm25_score(query_tokens, document, index)
        vector_score = _cosine_similarity(query_vector, query_norm, document)
        raw_semantic_score = max(semantic_score_map.get(question["id"], 0.0), 0.0)
        semantic_score = (
            raw_semantic_score if raw_semantic_score >= semantic_min_score else 0.0
        )
        if bm25_score <= 0 and vector_score <= 0 and semantic_score <= 0:
            continue
        bonus, reasons = _rerank_bonus(request.query, query_tokens, document)
        if vector_score > 0:
            reasons.append("TF-IDF 向量相似")
        if semantic_score > 0:
            reasons.append("语义 Embedding 相似")
        raw_candidates.append(
            (bm25_score, vector_score, semantic_score, bonus, document, reasons)
        )

    max_bm25 = max((item[0] for item in raw_candidates), default=1.0) or 1.0
    max_vector = max((item[1] for item in raw_candidates), default=1.0) or 1.0
    max_semantic = max((item[2] for item in raw_candidates), default=1.0) or 1.0
    semantic_enabled = any(score > 0 for score in semantic_score_map.values())
    fused_candidates = [
        (
            (0.40 if semantic_enabled else 0.55) * bm25_score / max_bm25
            + (0.20 if semantic_enabled else 0.35) * vector_score / max_vector
            + (0.30 * semantic_score / max_semantic if semantic_enabled else 0.0)
            + 0.10 * min(bonus / 6.5, 1.0)
            + (1.0 if "考点命中" in reasons else 0.0),
            bm25_score,
            vector_score,
            semantic_score,
            bonus,
            document,
            reasons,
        )
        for bm25_score, vector_score, semantic_score, bonus, document, reasons in raw_candidates
    ]
    max_fused_score = max((item[0] for item in fused_candidates), default=1.0)
    candidates = [
        (
            score / max_fused_score,
            bm25_score,
            vector_score,
            semantic_score,
            bonus,
            document,
            reasons,
        )
        for score, bm25_score, vector_score, semantic_score, bonus, document, reasons in fused_candidates
    ]

    candidates.sort(key=lambda item: (-item[0], item[5].question["id"]))
    hits = [
        KnowledgeSearchHit(
            questionId=document.question["id"],
            modeId=document.question["modeId"],
            contentType=(
                "reading_question"
                if document.question["modeId"] == "reading_drill"
                else "listening_question"
                if document.question["modeId"] == "listening_analyze"
                else "drill_question"
            ),
            testedPoint=_tested_point(document.question),
            prompt=document.question["prompt"],
            snippet=document.question["explanation"],
            sourceLabel=document.question["source"],
            score=round(score, 4),
            scores={
                "bm25": round(bm25_score, 4),
                "vector": round(vector_score, 4),
                "semantic": round(semantic_score, 4),
                "rerankBonus": round(bonus, 4),
            },
            matchReasons=reasons,
            evidenceLocation=_locate_evidence(document.question),
            listeningEvidence=_build_listening_evidence(document.question),
        )
        for score, bm25_score, vector_score, semantic_score, bonus, document, reasons in candidates[
            : request.limit
        ]
    ]
    web_config = get_web_rag_config()
    web_sources = []
    web_mode = "disabled"
    local_sufficient = False
    if candidates:
        top_candidate = candidates[0]
        top_document = top_candidate[5]
        unique_query_tokens = set(query_tokens)
        lexical_coverage = (
            sum(
                1
                for token in unique_query_tokens
                if token in top_document.term_counts
            )
            / max(len(unique_query_tokens), 1)
        )
        local_sufficient = (
            lexical_coverage >= 0.35
            or top_candidate[3] >= semantic_min_score
            or "考点命中" in top_candidate[6]
        )

    if local_sufficient:
        web_fallback_reason = "local_sufficient"
    elif not request.allowWeb:
        web_fallback_reason = "not_requested"
    elif not web_config.enabled:
        web_fallback_reason = "web_disabled"
    elif not load_web_cache(web_config):
        web_fallback_reason = "no_cached_sources"
    else:
        web_mode = "controlled_cache"
        web_sources = search_web_cache(
            request.query, web_config, limit=request.webLimit
        )
        web_fallback_reason = (
            "local_evidence_insufficient" if web_sources else "no_web_match"
        )

    return KnowledgeSearchResponse(
        query=request.query,
        retrievalMode=(
            "hybrid_semantic_rerank"
            if semantic_enabled
            else "hybrid_tfidf_rerank"
        ),
        totalCandidates=len(candidates),
        hits=hits,
        webMode=web_mode,
        webFallbackReason=web_fallback_reason,
        webSources=web_sources,
    )
