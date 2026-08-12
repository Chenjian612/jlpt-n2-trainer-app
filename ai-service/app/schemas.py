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
