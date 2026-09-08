import type {
  CoachPlanStep,
  CrossModuleWeaknessSummary,
  DailyStudyItem,
  DashboardWeaknessSnapshot,
  GeneratedDailyPlan,
  ProgressState,
  WeaknessFocusItem,
  WeaknessTrend,
  WeaknessModuleId,
} from '../models/progress';
import type { TrainingModeId } from '../models/training';
import type {
  StudyWeaknessItem,
  WeaknessErrorType,
  WeaknessSignalItem,
  WrongAnswerErrorType,
  WrongAnswerItem,
} from '../models/trainingContent';
import {
  getWeaknessSignalPriorityScore,
  getWrongAnswerPriorityScore,
} from './progressService';
import { WEAKNESS_ERROR_META } from './wrongAnswerClassifier';
import { APP_CONFIG } from '../../config/constants';
import { getReviewTasks } from './reviewScheduleService';

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
  grammar_200: 'N2 文法 200 条特训',
};

const WEAKNESS_MODULE_LABEL: Record<WeaknessModuleId, string> = {
  grammar: '文法',
  vocab: '词汇',
  reading: '读解',
  listening: '听力',
};

const resolveModuleStatus = (
  activeItems: number,
  exposureCount: number,
): 'clear' | 'watch' | 'priority' => {
  if (activeItems === 0) return 'clear';
  if (activeItems >= 3 || exposureCount >= 6) return 'priority';
  return 'watch';
};

export const getCrossModuleWeaknessSummary = (
  state: ProgressState,
): CrossModuleWeaknessSummary => {
  const counters: Record<WeaknessModuleId, { activeItems: number; exposureCount: number }> = {
    grammar: { activeItems: 0, exposureCount: 0 },
    vocab: { activeItems: 0, exposureCount: 0 },
    reading: { activeItems: 0, exposureCount: 0 },
    listening: { activeItems: 0, exposureCount: 0 },
  };

  state.wrongAnswers
    .filter((item) => !item.mastered)
    .forEach((item) => {
      const moduleId = item.modeId === 'grammar_drill' ? 'grammar' : 'vocab';
      counters[moduleId].activeItems += 1;
      counters[moduleId].exposureCount += item.wrongCount;
    });

  state.weaknessSignals
    .filter((item) => item.active)
    .forEach((item) => {
      const moduleId = item.modeId === 'reading_drill' ? 'reading' : 'listening';
      counters[moduleId].activeItems += 1;
      counters[moduleId].exposureCount += item.wrongCount;
    });

  state.studyWeaknesses
    .filter((item) => item.active)
    .forEach((item) => {
      const moduleId = item.modeId === 'grammar_study' ? 'grammar' : 'vocab';
      counters[moduleId].activeItems += 1;
      counters[moduleId].exposureCount += item.unstableCount;
    });

  const modules = (Object.keys(counters) as WeaknessModuleId[]).map((id) => ({
    id,
    label: WEAKNESS_MODULE_LABEL[id],
    ...counters[id],
    status: resolveModuleStatus(counters[id].activeItems, counters[id].exposureCount),
  }));
  const latestTransferByQuestion = new Map<string, boolean>();
  state.transferResults.forEach((result) => {
    latestTransferByQuestion.set(result.questionId, result.correct);
  });
  const correctCount = state.transferResults.filter((result) => result.correct).length;

  return {
    activeModuleCount: modules.filter((item) => item.activeItems > 0).length,
    activeItemCount: modules.reduce((total, item) => total + item.activeItems, 0),
    exposureCount: modules.reduce((total, item) => total + item.exposureCount, 0),
    modules,
    transferVerification: {
      attempts: state.transferResults.length,
      correctCount,
      accuracy:
        state.transferResults.length > 0
          ? correctCount / state.transferResults.length
          : null,
      retryQuestionCount: [...latestTransferByQuestion.values()].filter(
        (correct) => !correct,
      ).length,
    },
  };
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
  state: ProgressState, date: string, now: Date = new Date(),
): GeneratedDailyPlan => {
  const items: DailyStudyItem[] = getReviewTasks(state, now).map((task) => ({
    modeId: task.modeId,
    reason: task.reason,
    priority: task.overdueCount > 0 ? 'urgent' : 'normal',
    estimatedMinutes: task.modeId === 'reading_drill' || task.modeId === 'listening_analyze' ? 20 : 10,
  }));
  if (items.length === 0) {
    items.push(
      { modeId: 'grammar_drill', reason: '当前没有到期弱项，继续一轮文法训练', priority: 'normal', estimatedMinutes: 15 },
      { modeId: 'vocab_drill', reason: '当前没有到期弱项，继续一轮词汇训练', priority: 'normal', estimatedMinutes: 15 },
    );
  }
  return { date, items, generatedBy: 'local' };
};

const computeTrendsForTypes = (
  errorTypes: WeaknessErrorType[],
  wrongAnswers: WrongAnswerItem[],
  weaknessSignals: WeaknessSignalItem[],
  todayKey: string,
): Record<WeaknessErrorType, WeaknessTrend> => {
  const today = new Date(todayKey);
  const msPerDay = 86_400_000;
  const recentStart = new Date(today.getTime() - 7 * msPerDay);
  const priorStart = new Date(today.getTime() - 14 * msPerDay);

  const inRecent = (iso: string) => {
    const d = new Date(iso);
    return d >= recentStart && d <= today;
  };
  const inPrior = (iso: string) => {
    const d = new Date(iso);
    return d >= priorStart && d < recentStart;
  };

  const result = {} as Record<WeaknessErrorType, WeaknessTrend>;

  for (const errorType of errorTypes) {
    let recentCount = 0;
    let priorCount = 0;

    for (const item of wrongAnswers) {
      if (!item.errorTypes.includes(errorType as WrongAnswerErrorType)) continue;
      if (inRecent(item.lastWrongAt)) recentCount++;
      else if (inPrior(item.lastWrongAt)) priorCount++;
    }
    for (const item of weaknessSignals) {
      if (!item.errorTypes.includes(errorType)) continue;
      if (inRecent(item.lastWrongAt)) recentCount++;
      else if (inPrior(item.lastWrongAt)) priorCount++;
    }

    if (priorCount === 0 && recentCount === 0) {
      result[errorType] = 'stable';
    } else if (priorCount === 0) {
      result[errorType] = 'worsening';
    } else if (recentCount === 0) {
      result[errorType] = 'improving';
    } else if (recentCount > priorCount * 1.2) {
      result[errorType] = 'worsening';
    } else if (recentCount < priorCount * 0.8) {
      result[errorType] = 'improving';
    } else {
      result[errorType] = 'stable';
    }
  }

  return result;
};

export const getDashboardWeaknessSnapshot = (
  state: ProgressState,
  todayKey: string,
  now: Date = new Date(),
): DashboardWeaknessSnapshot => {
  const tasks = getReviewTasks(state, now);
  const dueIds = new Set(tasks.flatMap((task) => task.itemIds));
  const focusItems = aggregateWeaknesses(
    state.wrongAnswers.filter((item) => dueIds.has(item.questionId)),
    state.weaknessSignals.filter((item) => dueIds.has(item.questionId)),
    state.studyWeaknesses.filter((item) => dueIds.has(item.id)),
  );
  const crossModuleSummary = getCrossModuleWeaknessSummary(state);

  if (focusItems.length === 0) {
    return {
      headline: '当前没有到期的复习弱项',
      body: crossModuleSummary.activeItemCount > 0
        ? '仍有未稳项正在等待复习日期或冷却结束，当前可以继续新训练。'
        : '当前没有待回收弱项，可以继续新训练。',
      focusItems: [],
      planSteps: buildNeutralPlan(),
      crossModuleSummary,
    };
  }

  const trends = computeTrendsForTypes(
    focusItems.map((item) => item.id),
    state.wrongAnswers,
    state.weaknessSignals,
    todayKey,
  );

  const focusItemsWithTrend = focusItems.map((item) => ({
    ...item,
    trend: trends[item.id] ?? 'stable',
  }));

  const primary = focusItemsWithTrend[0];
  const sourceModeTitle = REVIEW_MODE_LABEL[primary.sourceModeId];

  return {
    headline: `当前最该先补：${primary.label}`,
    body: `${primary.label} 相关的未稳项有 ${primary.questionCount} 项，主要集中在 ${sourceModeTitle}。先把这一类压回去，比继续推新内容更划算。`,
    focusItems: focusItemsWithTrend,
    planSteps: buildPlanSteps(focusItemsWithTrend),
    crossModuleSummary,
    recommendedModeId: primary.recommendedModeId,
  };
};
