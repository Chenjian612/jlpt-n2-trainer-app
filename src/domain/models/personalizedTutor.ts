export type TutorReviewTiming = 'now' | 'tomorrow' | 'three_days';

export type TutorReviewAction = {
  timing: TutorReviewTiming;
  action: string;
};

export type TransferQuestion = {
  prompt: string;
  choices: string[];
  answer: number;
  testedPoint: string;
  explanation: string;
};

export type PersonalizedTutorExplanation = {
  diagnosisSummary: string;
  whyYouChoseIt: string;
  reasoningSteps: [string, string, string];
  confusionComparison: {
    correctPoint: string;
    confusedPoint: string;
    decisiveDifference: string;
  };
  reviewPlan: TutorReviewAction[];
  personalizationEvidence: {
    selectedChoice: string;
    wrongCount: number;
    weaknessType: string;
    recentSimilarWrongCount: number;
  };
  transferQuestion: TransferQuestion;
  generationMode: 'ai_tutor';
};

export type CachedPersonalizedTutorExplanation = PersonalizedTutorExplanation & {
  contextVersion: string;
  generatedAt: string;
};

export type TransferResult = {
  questionId: string;
  contextVersion: string;
  selectedChoice: number;
  correct: boolean;
  answeredAt: string;
};
