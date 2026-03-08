import type { DrillModeId, StudyModeId } from './training';

export type DrillQuestion = {
  id: string;
  modeId: DrillModeId;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  choiceInsights: string[];
  reviewNote: string;
  tags: string[];
  source: string;
};

export type WrongAnswerDraft = {
  question: DrillQuestion;
  selectedChoice: number | null;
};

export type WrongAnswerItem = {
  questionId: string;
  modeId: DrillModeId;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  choiceInsights: string[];
  reviewNote: string;
  tags: string[];
  source: string;
  wrongCount: number;
  firstWrongAt: string;
  lastWrongAt: string;
  lastUserChoice: number | null;
  lastReviewedAt?: string;
  mastered: boolean;
};

export type WrongReviewDecision = {
  questionId: string;
  mastered: boolean;
};

export type StudyPackItem = {
  id: string;
  modeId: StudyModeId;
  term: string;
  reading?: string;
  coreMeaning: string;
  keyUsage: string;
  confusingPair: string;
  example: string;
  memoryHook: string;
  reviewPrompt: string;
};

export type StudyPack = {
  modeId: StudyModeId;
  theme: string;
  source: string;
  items: StudyPackItem[];
};
