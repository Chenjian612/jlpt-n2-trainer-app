import type {
  DashboardInsight,
  DashboardMetrics,
  ProgressState,
  RecentDay,
} from '../models/progress';
import type { ReviewModeId, TrainingMode, TrainingModeId } from '../models/training';
import {
  DEFAULT_WEEKLY_GOAL,
  getCompletedModeIdsForDay,
  getDayKey,
  getSessionsForDay,
  getWrongReviewBacklogCount,
} from './progressService';

export const DAILY_TARGET = 3;
export const WEEKLY_GOAL_OPTIONS = [10, DEFAULT_WEEKLY_GOAL, 18] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REVIEW_MODE_IDS: ReviewModeId[] = ['review_wrong', 'vocab_review_wrong'];
const RECOMMENDED_MODE_ORDER: TrainingModeId[] = [
  'review_wrong',
  'vocab_review_wrong',
  'grammar_drill',
  'vocab_drill',
  'reading_drill',
  'listening_analyze',
  'grammar_study',
  'vocab_study',
  'official_vocab_memory',
];

const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const diffInDays = (left: Date, right: Date): number =>
  Math.round(
    (startOfDay(left).getTime() - startOfDay(right).getTime()) / MS_PER_DAY,
  );

const getModeOrderIndex = (modeId: TrainingModeId): number => {
  const index = RECOMMENDED_MODE_ORDER.indexOf(modeId);
  return index >= 0 ? index : RECOMMENDED_MODE_ORDER.length;
};

const getReviewBacklogCounts = (state: ProgressState): Record<ReviewModeId, number> => ({
  review_wrong: getWrongReviewBacklogCount(state, 'review_wrong'),
  vocab_review_wrong: getWrongReviewBacklogCount(state, 'vocab_review_wrong'),
});

export const getProgressRatio = (value: number, total: number): number =>
  total <= 0 ? 0 : Math.min(value / total, 1);

export const getRecommendedModes = (
  trainingModes: TrainingMode[],
  state: ProgressState,
  todayKey: string,
): TrainingMode[] => {
  const completedModeIds = new Set(getCompletedModeIdsForDay(state, todayKey));
  const reviewBacklogCounts = getReviewBacklogCounts(state);
  const getRecommendationBucket = (modeId: TrainingModeId): number => {
    if (!REVIEW_MODE_IDS.includes(modeId as ReviewModeId)) {
      return 1;
    }

    return reviewBacklogCounts[modeId as ReviewModeId] > 0 ? 0 : 2;
  };

  return [...trainingModes]
    .filter((mode) => !completedModeIds.has(mode.id))
    .sort((left, right) => {
      const bucketGap = getRecommendationBucket(left.id) - getRecommendationBucket(right.id);
      if (bucketGap !== 0) {
        return bucketGap;
      }

      const leftBacklog = REVIEW_MODE_IDS.includes(left.id as ReviewModeId)
        ? reviewBacklogCounts[left.id as ReviewModeId]
        : 0;
      const rightBacklog = REVIEW_MODE_IDS.includes(right.id as ReviewModeId)
        ? reviewBacklogCounts[right.id as ReviewModeId]
        : 0;

      if (leftBacklog !== rightBacklog) {
        return rightBacklog - leftBacklog;
      }

      return getModeOrderIndex(left.id) - getModeOrderIndex(right.id);
    });
};

export const getTodayPlan = (
  trainingModes: TrainingMode[],
  state: ProgressState,
  todayKey: string,
): TrainingMode[] => getRecommendedModes(trainingModes, state, todayKey).slice(0, DAILY_TARGET);

const getActiveDayKeys = (state: ProgressState): string[] =>
  Object.keys(state.sessionsByDay)
    .filter((dayKey) => getSessionsForDay(state, dayKey).length > 0)
    .sort();

const getBestStreak = (state: ProgressState): number => {
  const activeDayKeys = getActiveDayKeys(state);

  if (activeDayKeys.length === 0) {
    return 0;
  }

  let best = 1;
  let current = 1;

  for (let index = 1; index < activeDayKeys.length; index += 1) {
    const previous = parseDayKey(activeDayKeys[index - 1]);
    const currentDate = parseDayKey(activeDayKeys[index]);

    if (diffInDays(currentDate, previous) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
};

const getCurrentStreak = (state: ProgressState, todayKey: string): number => {
  const today = parseDayKey(todayKey);
  const active = new Set(getActiveDayKeys(state));
  const yesterdayKey = getDayKey(addDays(today, -1));

  if (!active.has(todayKey) && !active.has(yesterdayKey)) {
    return 0;
  }

  let streak = 0;
  let cursor = active.has(todayKey) ? today : addDays(today, -1);

  while (active.has(getDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
};

const getWeeklySessions = (state: ProgressState, todayKey: string): number => {
  const today = parseDayKey(todayKey);
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const dayKey = getDayKey(addDays(today, -offset));
    total += getSessionsForDay(state, dayKey).length;
  }

  return total;
};

const getTotalSessions = (state: ProgressState): number =>
  Object.values(state.sessionsByDay).reduce(
    (sum, sessions) => sum + (sessions?.length ?? 0),
    0,
  );

export const getDashboardMetrics = (
  state: ProgressState,
  todayKey: string,
): DashboardMetrics => ({
  todayCompletedCount: getCompletedModeIdsForDay(state, todayKey).length,
  weeklySessions: getWeeklySessions(state, todayKey),
  totalSessions: getTotalSessions(state),
  currentStreak: getCurrentStreak(state, todayKey),
  bestStreak: getBestStreak(state),
});

export const getDashboardInsight = (
  state: ProgressState,
  todayKey: string,
  weeklyGoal: number,
  todayPlan: TrainingMode[],
): DashboardInsight => {
  const metrics = getDashboardMetrics(state, todayKey);
  const reviewBacklogCounts = getReviewBacklogCounts(state);
  const totalBacklog = reviewBacklogCounts.review_wrong + reviewBacklogCounts.vocab_review_wrong;
  const recommendedMode = todayPlan[0] ?? null;

  if (totalBacklog > 0 && recommendedMode) {
    return {
      headline: '先回收错题，再推新内容',
      body: `当前还有 ${totalBacklog} 题待回收，优先清掉重复错误，再继续做新的训练更划算。`,
      recommendedModeId: recommendedMode.id,
      tone: 'review',
    };
  }

  if (metrics.todayCompletedCount === 0 && recommendedMode) {
    return {
      headline: `先完成今天的第 1 轮：${recommendedMode.title}`,
      body: '先把第一轮做起来，节奏一旦启动，后面的推进成本会明显下降。',
      recommendedModeId: recommendedMode.id,
      tone: 'focus',
    };
  }

  if (metrics.todayCompletedCount < DAILY_TARGET) {
    const remaining = DAILY_TARGET - metrics.todayCompletedCount;
    return {
      headline: `今天再完成 ${remaining} 轮就达标`,
      body: recommendedMode
        ? `下一轮建议直接接 ${recommendedMode.title}，保持今天的推进连贯性。`
        : '今天的推荐已经接近完成，顺手把最后一轮补齐即可。',
      recommendedModeId: recommendedMode?.id,
      tone: 'focus',
    };
  }

  if (metrics.weeklySessions < weeklyGoal) {
    return {
      headline: '今日目标完成，顺手补强本周节奏',
      body: `本周还差 ${Math.max(weeklyGoal - metrics.weeklySessions, 0)} 轮达到周目标，现在继续练一轮最容易把节奏拉稳。`,
      recommendedModeId: recommendedMode?.id,
      tone: 'push',
    };
  }

  return {
    headline: '今天的节奏已经稳住',
    body: '今日目标和本周节奏都在线，接下来可以自由补薄弱项，也可以直接收尾。',
    recommendedModeId: recommendedMode?.id,
    tone: 'steady',
  };
};

export const buildRecentWeek = (
  state: ProgressState,
  todayKey: string,
): RecentDay[] => {
  const today = parseDayKey(todayKey);
  const labels = ['日', '一', '二', '三', '四', '五', '六'];

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const dayKey = getDayKey(date);

    return {
      dayKey,
      label: labels[date.getDay()],
      count: getSessionsForDay(state, dayKey).length,
    };
  });
};


