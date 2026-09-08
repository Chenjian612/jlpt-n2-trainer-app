import type {
  CapabilityDistribution,
  DashboardInsight,
  DashboardMetrics,
  ProgressState,
  RecentDay,
} from '../models/progress';
import type { ReviewModeId, StudyModeId, TrainingMode, TrainingModeId } from '../models/training';
import {
  getCompletedModeIdsForDay,
  getSessionsForDay,
  getStudyWeaknessBacklogCount,
  getWrongReviewBacklogCount,
} from './progressService';
import { APP_CONFIG } from '../../config/constants';
import { getReviewTasks } from './reviewScheduleService';
import { addDays, diffInDays, getDayKey, parseDayKey } from '../../utils/dateUtils';

export const WEEKLY_GOAL_OPTIONS = [10, APP_CONFIG.DEFAULT_WEEKLY_GOAL, 18] as const;

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

const MODE_CAPABILITY: Record<TrainingModeId, keyof CapabilityDistribution> = {
  grammar_drill: 'grammar',
  grammar_study: 'grammar',
  vocab_drill: 'vocab',
  vocab_study: 'vocab',
  official_vocab_memory: 'vocab',
  reading_drill: 'reading',
  listening_analyze: 'listening',
  review_wrong: 'grammar',
  vocab_review_wrong: 'vocab',
  grammar_200: 'grammar',
};

const getModeOrderIndex = (modeId: TrainingModeId): number => {
  const index = RECOMMENDED_MODE_ORDER.indexOf(modeId);
  return index >= 0 ? index : RECOMMENDED_MODE_ORDER.length;
};

const getReviewBacklogCounts = (state: ProgressState): Record<ReviewModeId, number> => ({
  review_wrong: getWrongReviewBacklogCount(state, 'review_wrong'),
  vocab_review_wrong: getWrongReviewBacklogCount(state, 'vocab_review_wrong'),
});

const getStudyBacklogCounts = (state: ProgressState): Record<StudyModeId, number> => ({
  grammar_study: getStudyWeaknessBacklogCount(state, 'grammar_study'),
  vocab_study: getStudyWeaknessBacklogCount(state, 'vocab_study'),
});

export const getProgressRatio = (value: number, total: number): number =>
  total <= 0 ? 0 : Math.min(value / total, 1);

export const getRecommendedModes = (
  trainingModes: TrainingMode[],
  state: ProgressState,
  todayKey: string,
  now: Date = new Date(),
): TrainingMode[] => {
  const completed = new Set(getCompletedModeIdsForDay(state, todayKey));
  const tasks = getReviewTasks(state, now);
  const rank = new Map(tasks.map((task, index) => [task.modeId, index]));
  return [...trainingModes]
    // Remaining review work stays available even after a round in that mode.
    .filter((mode) => rank.has(mode.id) || !completed.has(mode.id))
    .sort((a, b) => {
      const aRank = rank.get(a.id);
      const bRank = rank.get(b.id);
      if (aRank !== undefined || bRank !== undefined) return (aRank ?? Infinity) - (bRank ?? Infinity);
      const emptyReviewGap = Number(REVIEW_MODE_IDS.includes(a.id as ReviewModeId)) - Number(REVIEW_MODE_IDS.includes(b.id as ReviewModeId));
      return emptyReviewGap || getModeOrderIndex(a.id) - getModeOrderIndex(b.id);
    });
};

export const getTodayPlan = (
  trainingModes: TrainingMode[], state: ProgressState, todayKey: string, now: Date = new Date(),
): TrainingMode[] => getRecommendedModes(trainingModes, state, todayKey, now).slice(0, APP_CONFIG.DAILY_RECOMMENDATION_LIMIT);

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

const getCapabilityDistribution = (
  state: ProgressState,
  todayKey: string,
): CapabilityDistribution => {
  const today = parseDayKey(todayKey);
  const distribution: CapabilityDistribution = {
    grammar: 0,
    vocab: 0,
    reading: 0,
    listening: 0,
  };

  for (let offset = 0; offset < 7; offset += 1) {
    const dayKey = getDayKey(addDays(today, -offset));
    const sessions = getSessionsForDay(state, dayKey);

    for (const session of sessions) {
      const capability = MODE_CAPABILITY[session.modeId];
      if (capability) {
        distribution[capability] += 1;
      }
    }
  }

  return distribution;
};

export const getDashboardMetrics = (
  state: ProgressState,
  todayKey: string,
): DashboardMetrics => ({
  todayCompletedCount: getCompletedModeIdsForDay(state, todayKey).length,
  weeklySessions: getWeeklySessions(state, todayKey),
  totalSessions: getTotalSessions(state),
  currentStreak: getCurrentStreak(state, todayKey),
  bestStreak: getBestStreak(state),
  capabilityDistribution: getCapabilityDistribution(state, todayKey),
});

export const getDashboardInsight = (
  state: ProgressState,
  todayKey: string,
  weeklyGoal: number,
  todayPlan: TrainingMode[],
  now: Date = new Date(),
): DashboardInsight => {
  const metrics = getDashboardMetrics(state, todayKey);
  const reviewBacklogCounts = getReviewBacklogCounts(state);
  const studyBacklogCounts = getStudyBacklogCounts(state);
  const totalReviewBacklog = reviewBacklogCounts.review_wrong + reviewBacklogCounts.vocab_review_wrong;
  const totalStudyBacklog = studyBacklogCounts.grammar_study + studyBacklogCounts.vocab_study;
  const recommendedMode = todayPlan[0] ?? null;
  const task = getReviewTasks(state, now).find((item) => item.modeId === recommendedMode?.id);

  if (task && (task.modeId === 'reading_drill' || task.modeId === 'listening_analyze')) {
    return {
      headline: '先巩固待复习的读解与听力',
      body: `${task.reason}。进入后优先练习这些弱项对应的材料。`,
      recommendedModeId: task.modeId,
      tone: 'review', battleState: 'recovering',
    };
  }

  if (totalReviewBacklog > 0 && recommendedMode && task && REVIEW_MODE_IDS.includes(task.modeId as ReviewModeId)) {
    return {
      headline: '先回收错题，再推新内容',
      body: `${task.reason}，先完成这一轮回收，再继续新的训练。`,
      recommendedModeId: recommendedMode.id,
      tone: 'review',
      battleState: 'recovering',
    };
  }

  if (totalStudyBacklog > 0 && recommendedMode && (recommendedMode.id === 'grammar_study' || recommendedMode.id === 'vocab_study')) {
    return {
      headline: '重点攻克不稳的记忆项',
      body: `${task?.reason ?? `学习包里还有 ${totalStudyBacklog} 个不稳项`}，先回看这些项，再开启新阶段。`,
      recommendedModeId: recommendedMode.id,
      tone: 'review',
      battleState: 'recovering',
    };
  }

  if (metrics.todayCompletedCount === 0 && recommendedMode) {
    return {
      headline: `先完成今天的第 1 轮：${recommendedMode.title}`,
      body: '先把第一轮做起来，节奏一旦启动，后面的推进成本会明显下降。',
      recommendedModeId: recommendedMode.id,
      tone: 'focus',
      battleState: 'first_battle',
    };
  }

  if (metrics.todayCompletedCount < APP_CONFIG.DAILY_TARGET_SESSIONS) {
    const remaining = APP_CONFIG.DAILY_TARGET_SESSIONS - metrics.todayCompletedCount;
    return {
      headline: `今天再完成 ${remaining} 轮就达标`,
      body: recommendedMode
        ? `下一轮建议直接接 ${recommendedMode.title}，保持今天的推进连贯性。`
        : '今天的推荐已经接近完成，顺手把最后一轮补齐即可。',
      recommendedModeId: recommendedMode?.id,
      tone: 'focus',
      battleState: 'sprint',
    };
  }

  if (metrics.weeklySessions < weeklyGoal) {
    return {
      headline: '今日目标完成，顺手补强本周节奏',
      body: `本周还差 ${Math.max(weeklyGoal - metrics.weeklySessions, 0)} 轮达到周目标，现在继续练一轮最容易把节奏拉稳。`,
      recommendedModeId: recommendedMode?.id,
      tone: 'push',
      battleState: 'goal_reached',
    };
  }

  return {
    headline: '今天的节奏已经稳住',
    body: '今日目标和本周节奏都在线，接下来可以自由补薄弱项，也可以直接收尾。',
    recommendedModeId: recommendedMode?.id,
    tone: 'steady',
    battleState: 'goal_reached',
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
