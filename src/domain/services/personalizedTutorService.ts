import type { ProgressState } from '../models/progress';
import type {
  CachedPersonalizedTutorExplanation,
  PersonalizedTutorExplanation,
} from '../models/personalizedTutor';
import type { WrongAnswerItem, WrongAnswerErrorType } from '../models/trainingContent';

const WEAKNESS_LABELS: Record<WrongAnswerErrorType, string> = {
  grammar_constraint: '接续条件判断',
  grammar_judgement: '近义句型辨析',
  grammar_conclusion: '结论与说明语气',
  grammar_parallel: '并列与递进关系',
  grammar_concession: '让步与逆接关系',
  vocab_collocation: '词汇搭配',
  vocab_context: '语境选词',
  vocab_nuance: '近义词语感辨析',
};

export type TutorLearningContext = {
  weaknessType: string;
  recentSimilarWrongCount: number;
  recentSimilarPointIds: string[];
  contextVersion: string;
};

export const getTutorCacheKey = (questionId: string, contextVersion: string): string =>
  `${questionId}:${contextVersion}`;

export const buildTutorLearningContext = (
  state: ProgressState,
  item: WrongAnswerItem,
  selectedChoice: number,
): TutorLearningContext => {
  const errorType = item.errorTypes[0] ?? (item.modeId === 'grammar_drill' ? 'grammar_judgement' : 'vocab_context');
  const similarItems = state.wrongAnswers.filter(
    (candidate) =>
      candidate.questionId !== item.questionId &&
      !candidate.mastered &&
      candidate.errorTypes.includes(errorType),
  );
  const recentPointIds = similarItems
    .map((candidate) => candidate.tags[1] ?? candidate.questionId)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);
  const latestTransfer = [...state.transferResults]
    .reverse()
    .find((result) => result.questionId === item.questionId);
  const transferVersion = latestTransfer ? (latestTransfer.correct ? 'pass' : 'retry') : 'none';

  return {
    weaknessType: WEAKNESS_LABELS[errorType],
    recentSimilarWrongCount: similarItems.length,
    recentSimilarPointIds: recentPointIds,
    contextVersion: [item.wrongCount, selectedChoice, similarItems.length, transferVersion].join('-'),
  };
};

export const getCachedPersonalizedTutor = (
  state: ProgressState,
  questionId: string,
  contextVersion: string,
): CachedPersonalizedTutorExplanation | null =>
  state.personalizedTutorCache[getTutorCacheKey(questionId, contextVersion)] ?? null;

export const withTutorCacheMetadata = (
  explanation: PersonalizedTutorExplanation,
  contextVersion: string,
  generatedAt: string = new Date().toISOString(),
): CachedPersonalizedTutorExplanation => ({
  ...explanation,
  contextVersion,
  generatedAt,
});
