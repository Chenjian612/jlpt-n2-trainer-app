export type AiExplanationSource = {
  id: string;
  title: string;
  snippet: string;
  sourceLabel: string;
  sourceType: 'local_knowledge';
};

export type AiChoiceAnalysis = {
  choice: string;
  reason: string;
  status: 'correct' | 'selected_wrong' | 'other';
};

export type WrongAnswerExplanation = {
  testedPoint: string;
  mistakePattern: string;
  whyCorrect: string;
  whyUserWrong: string;
  whyDistractorFooled: string;
  watchNextTime: string;
  choiceAnalysis: AiChoiceAnalysis[];
  sources: AiExplanationSource[];
  confidence: 'high' | 'medium' | 'low';
  generationMode: 'ai_service' | 'local_knowledge' | 'legacy';
};
