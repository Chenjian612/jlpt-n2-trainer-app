import type {
  DrillModeId,
  ListeningModeId,
  OfficialVocabMemoryModeId,
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

export type WrongAnswerErrorType =
  | 'grammar_constraint'
  | 'grammar_judgement'
  | 'grammar_conclusion'
  | 'grammar_parallel'
  | 'grammar_concession'
  | 'vocab_collocation'
  | 'vocab_context'
  | 'vocab_nuance';

export type ReadingWeaknessErrorType =
  | 'reading_evidence'
  | 'reading_main_idea'
  | 'reading_distractor';

export type ListeningWeaknessErrorType =
  | 'listening_turning_point'
  | 'listening_detail_tracking'
  | 'listening_final_decision'
  | 'listening_main_point';

export type WeaknessErrorType =
  | WrongAnswerErrorType
  | ReadingWeaknessErrorType
  | ListeningWeaknessErrorType;

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
  errorTypes: WrongAnswerErrorType[];
};

export type WeaknessSignalDraft = {
  questionId: string;
  modeId: ReadingModeId | ListeningModeId;
  prompt: string;
  source: string;
  tags: string[];
  errorTypes: WeaknessErrorType[];
  wasCorrect: boolean;
};

export type WeaknessSignalItem = {
  questionId: string;
  modeId: ReadingModeId | ListeningModeId;
  prompt: string;
  source: string;
  tags: string[];
  wrongCount: number;
  firstWrongAt: string;
  lastWrongAt: string;
  lastResolvedAt?: string;
  active: boolean;
  errorTypes: WeaknessErrorType[];
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

export type OfficialVocabDeckType = 'language_knowledge' | 'listening' | 'reading';

export type OfficialVocabDeckStatus = 'ready' | 'pending';

export type OfficialVocabMemoryItem = {
  id: string;
  term: string;
  reading: string;
  coreMeaning: string;
  keyUsage: string;
  example: string;
  memoryHook: string;
  sourceHint: string;
};

export type OfficialVocabDeck = {
  id: string;
  modeId: OfficialVocabMemoryModeId;
  type: OfficialVocabDeckType;
  title: string;
  shortLabel: string;
  description: string;
  source: string;
  downloadLabel: string;
  note: string;
  status: OfficialVocabDeckStatus;
  items: OfficialVocabMemoryItem[];
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

