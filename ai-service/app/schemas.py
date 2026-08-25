from typing import Literal

from pydantic import BaseModel, Field


class ExplainWrongAnswerRequest(BaseModel):
    questionId: str = Field(min_length=1)
    selectedChoice: int = Field(ge=0)
    wrongCount: int = Field(default=1, ge=1)


class ExplanationSource(BaseModel):
    id: str
    title: str
    snippet: str
    sourceLabel: str
    sourceType: Literal["local_knowledge"] = "local_knowledge"


class ChoiceAnalysis(BaseModel):
    choice: str
    reason: str
    status: Literal["correct", "selected_wrong", "other"]


class WrongAnswerExplanation(BaseModel):
    testedPoint: str
    mistakePattern: str
    whyCorrect: str
    whyUserWrong: str
    whyDistractorFooled: str
    watchNextTime: str
    choiceAnalysis: list[ChoiceAnalysis]
    sources: list[ExplanationSource]
    confidence: Literal["high", "medium", "low"]
    generationMode: Literal["ai_service", "local_knowledge"]


class TutorWrongAnswerRequest(BaseModel):
    questionId: str = Field(min_length=1)
    selectedChoice: int = Field(ge=0)
    wrongCount: int = Field(default=1, ge=1)
    weaknessType: str = Field(min_length=1, max_length=80)
    recentSimilarWrongCount: int = Field(default=0, ge=0)
    recentSimilarPointIds: list[str] = Field(default_factory=list, max_length=3)


class ConfusionComparison(BaseModel):
    correctPoint: str
    confusedPoint: str
    decisiveDifference: str


class ReviewAction(BaseModel):
    timing: Literal["now", "tomorrow", "three_days"]
    action: str


class PersonalizationEvidence(BaseModel):
    selectedChoice: str
    wrongCount: int
    weaknessType: str
    recentSimilarWrongCount: int


class TransferQuestion(BaseModel):
    prompt: str
    choices: list[str] = Field(min_length=2, max_length=4)
    answer: int = Field(ge=0)
    testedPoint: str
    explanation: str


class PersonalizedTutorExplanation(BaseModel):
    diagnosisSummary: str
    whyYouChoseIt: str
    reasoningSteps: tuple[str, str, str]
    confusionComparison: ConfusionComparison
    reviewPlan: list[ReviewAction] = Field(min_length=1, max_length=3)
    personalizationEvidence: PersonalizationEvidence
    transferQuestion: TransferQuestion
    generationMode: Literal["ai_tutor"] = "ai_tutor"


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    modeId: Literal[
        "grammar_drill", "vocab_drill", "reading_drill", "listening_analyze"
    ] | None = None
    limit: int = Field(default=5, ge=1, le=20)
    allowWeb: bool = False
    webLimit: int = Field(default=3, ge=1, le=5)


class EvidenceLocation(BaseModel):
    passageId: str
    passageTitle: str
    paragraphNumbers: list[int]
    paragraphTexts: list[str]
    quotes: list[str]
    evidence: str


class ListeningDialogueLine(BaseModel):
    speaker: str
    text: str


class ListeningEvidence(BaseModel):
    caseId: str
    caseTitle: str
    audioKey: str
    evidenceType: Literal[
        "audio_transcript",
        "stimulus_response",
        "dialogue_quote",
        "pedagogical_summary",
    ]
    scene: str
    dialogue: list[ListeningDialogueLine]
    basisLine: str
    keySignal: str
    trapPoint: str
    listenChecklist: list[str]


class WebEvidenceSource(BaseModel):
    id: str
    title: str
    url: str
    snippet: str
    sourceType: Literal["official", "authorized"]
    fetchedAt: str
    contentHash: str
    score: float
    usagePolicy: Literal["supplemental_only"] = "supplemental_only"
    canOverrideLocalFacts: Literal[False] = False


class KnowledgeSearchHit(BaseModel):
    questionId: str
    modeId: Literal[
        "grammar_drill", "vocab_drill", "reading_drill", "listening_analyze"
    ]
    contentType: Literal[
        "drill_question", "reading_question", "listening_question"
    ]
    testedPoint: str
    prompt: str
    snippet: str
    sourceLabel: str
    score: float
    scores: dict[Literal["bm25", "vector", "semantic", "rerankBonus"], float]
    matchReasons: list[str]
    evidenceLocation: EvidenceLocation | None = None
    listeningEvidence: ListeningEvidence | None = None


class KnowledgeSearchResponse(BaseModel):
    query: str
    retrievalMode: Literal[
        "hybrid_tfidf_rerank", "hybrid_semantic_rerank"
    ] = "hybrid_tfidf_rerank"
    totalCandidates: int
    hits: list[KnowledgeSearchHit]
    webMode: Literal["disabled", "controlled_cache"] = "disabled"
    webFallbackReason: Literal[
        "local_sufficient",
        "not_requested",
        "web_disabled",
        "no_cached_sources",
        "no_web_match",
        "local_evidence_insufficient",
    ]
    webSources: list[WebEvidenceSource] = Field(default_factory=list)


class ResearchSource(BaseModel):
    id: str
    title: str
    snippet: str
    sourceType: Literal["local_knowledge", "official", "authorized"]
    url: str | None = None
    fetchedAt: str | None = None
    contentHash: str | None = None
    canOverrideLocalFacts: Literal[False] = False


class KnowledgeResearchAnswer(BaseModel):
    query: str
    answer: str
    citedSourceIds: list[str]
    sources: list[ResearchSource]
    evidenceMode: Literal["local_only", "web_supplemented"]
    generationMode: Literal["local_extract", "ai_service"]
    fallbackReason: str | None = None
