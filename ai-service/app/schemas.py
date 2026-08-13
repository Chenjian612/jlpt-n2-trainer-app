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
