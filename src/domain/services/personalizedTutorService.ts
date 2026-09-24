import type { ProgressState } from '../models/progress';
import type {
  CachedPersonalizedTutorExplanation,
  PersonalizedTutorExplanation,
} from '../models/personalizedTutor';
import type { DrillModeId, ListeningModeId, ReadingModeId } from '../models/training';
import type { WeaknessErrorType } from '../models/trainingContent';

const WEAKNESS_LABELS: Record<WeaknessErrorType, string> = {
  grammar_constraint: '接续条件判断',
  grammar_judgement: '近义句型辨析',
  grammar_conclusion: '结论与说明语气',
  grammar_parallel: '并列与递进关系',
  grammar_concession: '让步与逆接关系',
  vocab_collocation: '词汇搭配',
  vocab_context: '语境选词',
  vocab_nuance: '近义词语感辨析',
  reading_evidence: '读解证据定位',
  reading_main_idea: '读解主旨判断',
  reading_distractor: '读解干扰项排除',
  listening_turning_point: '听力转折识别',
  listening_detail_tracking: '听力信息追踪',
  listening_final_decision: '听力最终结论',
  listening_main_point: '听力主旨判断',
  grammar_study_unstable: '文法学习项不稳定',
  vocab_study_unstable: '词汇学习项不稳定',
  official_vocab_unstable: '官方词卡记忆不稳定',
  grammar_200_unstable: '文法 200 条掌握不稳定',
};

type TutorContextItem = {
  questionId: string;
  modeId: DrillModeId | ReadingModeId | ListeningModeId;
  tags: string[];
  wrongCount: number;
  errorTypes: WeaknessErrorType[];
  mastered?: boolean;
  active?: boolean;
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
  item: TutorContextItem,
  selectedChoice: number,
): TutorLearningContext => {
  const errorType = item.errorTypes[0] ?? (
    item.modeId === 'grammar_drill'
      ? 'grammar_judgement'
      : item.modeId === 'listening_analyze'
        ? 'listening_detail_tracking'
        : item.modeId === 'reading_drill'
          ? 'reading_evidence'
          : 'vocab_context'
  );
  const candidates: TutorContextItem[] = item.modeId === 'reading_drill' || item.modeId === 'listening_analyze'
    ? state.weaknessSignals.filter((candidate) => candidate.modeId === item.modeId)
    : state.wrongAnswers;
  const similarItems = candidates.filter(
    (candidate) =>
      candidate.questionId !== item.questionId &&
      candidate.mastered !== true &&
      candidate.active !== false &&
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
