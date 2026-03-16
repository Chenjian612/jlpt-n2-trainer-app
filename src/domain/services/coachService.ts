import type {
  CoachPlanStep,
  DashboardWeaknessSnapshot,
  ProgressState,
  WeaknessFocusItem,
} from '../models/progress';
import type { TrainingModeId } from '../models/training';
import type {
  WeaknessErrorType,
  WeaknessSignalItem,
  WrongAnswerItem,
} from '../models/trainingContent';
import {
  getWeaknessSignalPriorityScore,
  getWrongAnswerPriorityScore,
} from './progressService';
import { WEAKNESS_ERROR_META } from './wrongAnswerClassifier';

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

const aggregateWeaknesses = (
  wrongAnswers: WrongAnswerItem[],
  weaknessSignals: WeaknessSignalItem[],
): WeaknessFocusItem[] => {
  const summaryMap = new Map<WeaknessErrorType, WeaknessFocusItem & { weightedScore: number }>();

  for (const item of wrongAnswers) {
    if (item.mastered) {
      continue;
    }

    const score = getWrongAnswerPriorityScore(item);

    for (const errorType of item.errorTypes) {
      const meta = WEAKNESS_ERROR_META[errorType];
      const current = summaryMap.get(errorType);

      if (!current) {
        summaryMap.set(errorType, {
          id: errorType,
          label: meta.label,
          questionCount: 1,
          wrongCount: item.wrongCount,
          statusLabel: resolveStatusLabel(1, item.wrongCount),
          sourceModeId: meta.sourceModeId,
          recommendedModeId: meta.recommendedModeId,
          body: meta.summary,
          coachPoint: meta.coachPoint,
          weightedScore: score,
        });
        continue;
      }

      current.questionCount += 1;
      current.wrongCount += item.wrongCount;
      current.weightedScore += score;
      current.statusLabel = resolveStatusLabel(
        current.questionCount,
        current.wrongCount,
      );
    }
  }

  for (const item of weaknessSignals) {
    if (!item.active) {
      continue;
    }

    const score = getWeaknessSignalPriorityScore(item);

    for (const errorType of item.errorTypes) {
      const meta = WEAKNESS_ERROR_META[errorType];
      const current = summaryMap.get(errorType);

      if (!current) {
        summaryMap.set(errorType, {
          id: errorType,
          label: meta.label,
          questionCount: 1,
          wrongCount: item.wrongCount,
          statusLabel: resolveStatusLabel(1, item.wrongCount),
          sourceModeId: meta.sourceModeId,
          recommendedModeId: meta.recommendedModeId,
          body: meta.summary,
          coachPoint: meta.coachPoint,
          weightedScore: score,
        });
        continue;
      }

      current.questionCount += 1;
      current.wrongCount += item.wrongCount;
      current.weightedScore += score;
      current.statusLabel = resolveStatusLabel(
        current.questionCount,
        current.wrongCount,
      );
    }
  }

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
  const [primary, secondary] = focusItems;
  const primaryMeta = WEAKNESS_ERROR_META[primary.id];
  const recommendedModeTitle = REVIEW_MODE_LABEL[primary.recommendedModeId];
  const sourceModeTitle = REVIEW_MODE_LABEL[primary.sourceModeId];
  const reusesSourceMode = primary.recommendedModeId === primary.sourceModeId;

  return [
    {
      title: reusesSourceMode
        ? `先补 1 轮 ${recommendedModeTitle}`
        : `先做 ${recommendedModeTitle}`,
      body: reusesSourceMode
        ? `先在 ${recommendedModeTitle} 里专盯 ${primary.label}，用一轮新题把最容易飘掉的判断点拉回来。`
        : `先处理 ${primary.label} 相关的 ${primary.questionCount} 题，把最容易反复错的判断点压回去。`,
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
        ? `如果还有余力，再顺手看 ${secondary.label}；没有的话就先用一轮新题确认 ${primary.label} 是否稳住。`
        : primaryMeta.followUp,
      recommendedModeId: primary.sourceModeId,
    },
  ];
};

export const getDashboardWeaknessSnapshot = (
  state: ProgressState,
): DashboardWeaknessSnapshot => {
  const focusItems = aggregateWeaknesses(state.wrongAnswers, state.weaknessSignals);

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
    body: `${primary.label} 相关的未稳题有 ${primary.questionCount} 题，主要集中在 ${sourceModeTitle}。先把这一类压回去，比继续推新题更划算。`,
    focusItems,
    planSteps: buildPlanSteps(focusItems),
    recommendedModeId: primary.recommendedModeId,
  };
};
