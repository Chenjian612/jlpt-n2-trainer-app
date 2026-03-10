import type {
  DrillModeId,
  ListeningModeId,
  ReadingModeId,
  StudyModeId,
} from './training';

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

export type ReadingQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  choiceInsights: string[];
  evidence: string;
  reviewNote: string;
  tags: string[];
};

export type ReadingPassage = {
  id: string;
  modeId: ReadingModeId;
  title: string;
  source: string;
  lead: string;
  guidance: string;
  paragraphs: string[];
  questions: ReadingQuestion[];
};

export type ListeningDialogueLine = {
  speaker: string;
  text: string;
};

export type ListeningQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  basisLine: string;
  explanation: string;
  choiceInsights: string[];
  keySignal: string;
  trapPoint: string;
  reviewNote: string;
  tags: string[];
};

export type ListeningCase = {
  id: string;
  modeId: ListeningModeId;
  title: string;
  source: string;
  audioAsset: number;
  audioDurationLabel: string;
  scene: string;
  task: string;
  note: string;
  listenChecklist: string[];
  dialogue: ListeningDialogueLine[];
  questions: ListeningQuestion[];
};
