import type {
  CoachPlanStep,
  DailyStudyItem,
  DashboardWeaknessSnapshot,
  GeneratedDailyPlan,
  ProgressState,
  WeaknessFocusItem,
} from '../models/progress';
import type { TrainingModeId } from '../models/training';
import type {
  StudyWeaknessItem,
  WeaknessErrorType,
  WeaknessSignalItem,
  WrongAnswerItem,
} from '../models/trainingContent';
import {
  getWeaknessSignalPriorityScore,
  getWrongAnswerPriorityScore,
} from './progressService';
import { WEAKNESS_ERROR_META } from './wrongAnswerClassifier';
import { APP_CONFIG } from '../../config/constants';

const REVIEW_MODE_LABEL: Record<TrainingModeId, string> = {
  grammar_drill: '文法闯关',
  grammar_study: '文法记忆包',
  vocab_drill: '词汇刷题',
  vocab_study: '词汇记忆包',
  official_vocab_memory: '官方词卡记忆',
  reading_drill: '读解实战',
  listening_analyze: '听力要点拆解',
  review_wrong: '文法错题回收',
  vocab_review_wrong: '词汇错题回收',
};

const resolveStatusLabel = (questionCount: number, wrongCount: number): string => {
  if (wrongCount >= 6 || questionCount >= 3) {
    return '反复出错';
  }

  if (wrongCount >= 3 || questionCount >= 2) {
    return '持续暴露';
  }

  return '刚暴露';
};

type WeaknessEntry = {
  errorTypes: WeaknessErrorType[];
  wrongCount: number;
  score: number;
};

const accumulateEntries = (
  entries: WeaknessEntry[],
  summaryMap: Map<WeaknessErrorType, WeaknessFocusItem & { weightedScore: number }>,
): void => {
  for (const { errorTypes, wrongCount, score } of entries) {
    for (const errorType of errorTypes) {
      const meta = WEAKNESS_ERROR_META[errorType];
      if (!meta) continue;

      const current = summaryMap.get(errorType);

      if (!current) {
        summaryMap.set(errorType, {
          id: errorType,
          label: meta.label,
          questionCount: 1,
          wrongCount,
          statusLabel: resolveStatusLabel(1, wrongCount),
          sourceModeId: meta.sourceModeId,
          recommendedModeId: meta.recommendedModeId,
          body: meta.summary,
          coachPoint: meta.coachPoint,
          weightedScore: score,
        });
        continue;
      }

      current.questionCount += 1;
      current.wrongCount += wrongCount;
      current.weightedScore += score;
      current.statusLabel = resolveStatusLabel(current.questionCount, current.wrongCount);
    }
  }
};

const aggregateWeaknesses = (
  wrongAnswers: WrongAnswerItem[],
  weaknessSignals: WeaknessSignalItem[],
  studyWeaknesses: StudyWeaknessItem[],
): WeaknessFocusItem[] => {
  const summaryMap = new Map<WeaknessErrorType, WeaknessFocusItem & { weightedScore: number }>();

  accumulateEntries(
    wrongAnswers
      .filter((item) => !item.mastered)
      .map((item) => ({ errorTypes: item.errorTypes, wrongCount: item.wrongCount, score: getWrongAnswerPriorityScore(item) })),
    summaryMap,
  );

  accumulateEntries(
    weaknessSignals
      .filter((item) => item.active)
      .map((item) => ({ errorTypes: item.errorTypes, wrongCount: item.wrongCount, score: getWeaknessSignalPriorityScore(item) })),
    summaryMap,
  );

  accumulateEntries(
    studyWeaknesses
      .filter((item) => item.active)
      .map((item) => ({
        errorTypes: [item.modeId === 'grammar_study' ? 'grammar_study_unstable' : 'vocab_study_unstable'] as WeaknessErrorType[],
        wrongCount: item.unstableCount,
        score: item.unstableCount * APP_CONFIG.PRIORITY_WEIGHT_STUDY,
      })),
    summaryMap,
  );

  return [...summaryMap.values()]
    .sort((left, right) => {
      if (left.weightedScore !== right.weightedScore) {
        return right.weightedScore - left.weightedScore;
      }

      if (left.questionCount !== right.questionCount) {
        return right.questionCount - left.questionCount;
      }

      return right.wrongCount - left.wrongCount;
    })
    .map(({ weightedScore: _weightedScore, ...item }) => item)
    .slice(0, 3);
};

const buildNeutralPlan = (): CoachPlanStep[] => [
  {
    title: '先完成今日推荐',
    body: '当前没有积压的高频错误，先把首页推荐的一轮推进完，再看新的错误分布。',
  },
  {
    title: '优先保住训练节奏',
    body: '没有 backlog 时，不需要过度回顾，先保证今天的连续训练更划算。',
  },
  {
    title: '出现重复错再集中回收',
    body: '等同类题开始重复出错，再切到对应模式集中回收，效率会更高。',
  },
];

const buildPlanSteps = (focusItems: WeaknessFocusItem[]): CoachPlanStep[] => {
  if (focusItems.length === 0) {
    return buildNeutralPlan();
  }

  const [primary, secondary] = focusItems;
  const primaryMeta = WEAKNESS_ERROR_META[primary.id];
  if (!primaryMeta) return buildNeutralPlan();

  const recommendedModeTitle = REVIEW_MODE_LABEL[primary.recommendedModeId];
  const sourceModeTitle = REVIEW_MODE_LABEL[primary.sourceModeId];
  const reusesSourceMode = primary.recommendedModeId === primary.sourceModeId;

  return [
    {
      title: reusesSourceMode
        ? `先补 1 轮 ${recommendedModeTitle}`
        : `先做 ${recommendedModeTitle}`,
      body: reusesSourceMode
        ? `先在 ${recommendedModeTitle} 里专盯 ${primary.label}，用一轮项把最容易飘掉的记忆点拉回来。`
        : `先处理 ${primary.label} 相关的 ${primary.questionCount} 个弱项，把最容易反复错的判断点压回去。`,
      recommendedModeId: primary.recommendedModeId,
    },
    {
      title: '复盘时只盯一个判断点',
      body: primary.coachPoint,
    },
    {
      title: reusesSourceMode
        ? `做完后回看 ${sourceModeTitle} 的结果页`
        : `回收后补 1 轮 ${sourceModeTitle}`,
      body: secondary
        ? `如果还有余力，再顺手看 ${secondary.label}；没有的话就先用一轮新内容确认 ${primary.label} 是否稳住。`
        : primaryMeta.followUp,
      recommendedModeId: primary.sourceModeId,
    },
  ];
};

export const getGeneratedDailyPlan = (
  state: ProgressState,
  date: string,
): GeneratedDailyPlan => {
  const items: DailyStudyItem[] = [];

  const grammarBacklog = state.wrongAnswers.filter(
    (w) => !w.mastered && w.modeId === 'grammar_drill',
  );
  const vocabBacklog = state.wrongAnswers.filter(
    (w) => !w.mastered && w.modeId === 'vocab_drill',
  );
  const activeSignals = state.weaknessSignals.filter((s) => s.active);
  const activeStudyWeaknesses = state.studyWeaknesses.filter((s) => s.active);

  if (grammarBacklog.length > 0) {
    items.push({
      modeId: 'review_wrong',
      reason: `文法错题队列有 ${grammarBacklog.length} 题待回收`,
      priority: grammarBacklog.length >= APP_CONFIG.REVIEW_BATCH_SIZE ? 'urgent' : 'normal',
      estimatedMinutes: 10,
    });
  }

  if (vocabBacklog.length > 0) {
    items.push({
      modeId: 'vocab_review_wrong',
      reason: `词汇错题队列有 ${vocabBacklog.length} 题待回收`,
      priority: vocabBacklog.length >= APP_CONFIG.REVIEW_BATCH_SIZE ? 'urgent' : 'normal',
      estimatedMinutes: 10,
    });
  }

  if (activeSignals.length > 0) {
    const readingSignals = activeSignals.filter((s) => s.modeId === 'reading_drill');
    const listeningSignals = activeSignals.filter((s) => s.modeId === 'listening_analyze');

    if (readingSignals.length > 0) {
      items.push({
        modeId: 'reading_drill',
        reason: `读解弱项 ${readingSignals.length} 个待巩固`,
        priority: 'normal',
        estimatedMinutes: 20,
      });
    }

    if (listeningSignals.length > 0) {
      items.push({
        modeId: 'listening_analyze',
        reason: `听力弱项 ${listeningSignals.length} 个待巩固`,
        priority: 'normal',
        estimatedMinutes: 20,
      });
    }
  }

  if (activeStudyWeaknesses.length > 0) {
    const grammarStudyWeak = activeStudyWeaknesses.filter(
      (s) => s.modeId === 'grammar_study',
    );
    const vocabStudyWeak = activeStudyWeaknesses.filter(
      (s) => s.modeId === 'vocab_study',
    );

    if (grammarStudyWeak.length > 0) {
      items.push({
        modeId: 'grammar_study',
        reason: `文法记忆包有 ${grammarStudyWeak.length} 个不稳定项`,
        priority: 'normal',
        estimatedMinutes: 10,
      });
    }

    if (vocabStudyWeak.length > 0) {
      items.push({
        modeId: 'vocab_study',
        reason: `词汇记忆包有 ${vocabStudyWeak.length} 个不稳定项`,
        priority: 'normal',
        estimatedMinutes: 10,
      });
    }
  }

  if (items.length === 0) {
    items.push(
      {
        modeId: 'grammar_drill',
        reason: '文法题库还有未刷完的内容',
        priority: 'normal',
        estimatedMinutes: 15,
      },
      {
        modeId: 'vocab_drill',
        reason: '词汇题库还有未刷完的内容',
        priority: 'normal',
        estimatedMinutes: 15,
      },
    );
  }

  return { date, items, generatedBy: 'local' };
};

export const getDashboardWeaknessSnapshot = (
  state: ProgressState,
): DashboardWeaknessSnapshot => {
  const focusItems = aggregateWeaknesses(
    state.wrongAnswers,
    state.weaknessSignals,
    state.studyWeaknesses,
  );

  if (focusItems.length === 0) {
    return {
      headline: '当前没有积压的高频错误',
      body: '错题队列和训练弱项都比较干净，现在更适合继续推新内容；等出现重复错误后，再按类型集中回收。',
      focusItems: [],
      planSteps: buildNeutralPlan(),
    };
  }

  const primary = focusItems[0];
  const sourceModeTitle = REVIEW_MODE_LABEL[primary.sourceModeId];

  return {
    headline: `当前最该先补：${primary.label}`,
    body: `${primary.label} 相关的未稳项有 ${primary.questionCount} 项，主要集中在 ${sourceModeTitle}。先把这一类压回去，比继续推新内容更划算。`,
    focusItems,
    planSteps: buildPlanSteps(focusItems),
    recommendedModeId: primary.recommendedModeId,
  };
};
