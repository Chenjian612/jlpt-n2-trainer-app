import type {
  DashboardMetrics,
  ProgressState,
  RecentDay,
} from '../models/progress';
import type { TrainingMode, TrainingModeId } from '../models/training';
import { DEFAULT_WEEKLY_GOAL, getDayKey } from './progressService';

export const DAILY_TARGET = 3;
export const WEEKLY_GOAL_OPTIONS = [10, DEFAULT_WEEKLY_GOAL, 18] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

export const getProgressRatio = (value: number, total: number): number =>
  total <= 0 ? 0 : Math.min(value / total, 1);

export const getTodayPlan = (
  trainingModes: TrainingMode[],
  completedModeIds: TrainingModeId[],
): TrainingMode[] =>
  trainingModes
    .filter((mode) => !completedModeIds.includes(mode.id))
    .slice(0, DAILY_TARGET);

const getActiveDayKeys = (state: ProgressState): string[] =>
  Object.keys(state.completedByDay)
    .filter((dayKey) => (state.completedByDay[dayKey]?.length ?? 0) > 0)
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
    total += state.completedByDay[dayKey]?.length ?? 0;
  }

  return total;
};

const getTotalSessions = (state: ProgressState): number =>
  Object.values(state.completedByDay).reduce(
    (sum, ids) => sum + (ids?.length ?? 0),
    0,
  );

export const getDashboardMetrics = (
  state: ProgressState,
  todayKey: string,
): DashboardMetrics => ({
  todayCompletedCount: state.completedByDay[todayKey]?.length ?? 0,
  weeklySessions: getWeeklySessions(state, todayKey),
  totalSessions: getTotalSessions(state),
  currentStreak: getCurrentStreak(state, todayKey),
  bestStreak: getBestStreak(state),
});

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
      count: state.completedByDay[dayKey]?.length ?? 0,
    };
  });
};
