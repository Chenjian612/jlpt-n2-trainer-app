export type Grammar200PatternId = string;
export type Grammar200ChapterId = string;
export type Grammar200SortQuestionId = string;

export type Grammar200Example = {
  jp: string;
  reading: string;
  zh: string;
};

export type Grammar200Pattern = {
  id: Grammar200PatternId;
  no: number;
  term: string;
  reading?: string;
  meaningZh: string;
  structure: string;
  usage: string;
  confusingWith?: string;
  memoryHook: string;
  examTip?: string;
  examples: Grammar200Example[];
};

export type Grammar200SortQuestion = {
  id: Grammar200SortQuestionId;
  index: number;
  patternRefs: number[];
  stemPrefix: string;
  stemSuffix: string;
  fragments: string[];
  correctOrder: number[];
  fullSentenceJp: string;
  fullSentenceReading: string;
  fullSentenceZh: string;
  explanation: string;
};

export type Grammar200Chapter = {
  id: Grammar200ChapterId;
  index: number;
  title: string;
  rangeLabel: string;
  intro: string;
  patterns: Grammar200Pattern[];
  sortQuestions: Grammar200SortQuestion[];
  published: boolean;
};

export type Grammar200ChapterPhase = 'overview' | 'study' | 'sort' | 'result';

export type Grammar200SortAttempt = {
  questionId: Grammar200SortQuestionId;
  userOrder: number[];
  correct: boolean;
};

export type Grammar200ChapterProgress = {
  chapterId: Grammar200ChapterId;
  lastCompletedAt: string | null;
  bestScore: number;
  attemptCount: number;
};

export type Grammar200SortAiExplanation = {
  lockEnding: string;
  identifyChunks: string;
  chainParticles: string;
  finalOrder: string;
  transferRule: string;
  generatedAt: string;
};

export type Grammar200ProgressState = {
  chapters: Record<Grammar200ChapterId, Grammar200ChapterProgress>;
  aiExplanationCache: Record<Grammar200SortQuestionId, Grammar200SortAiExplanation>;
};
