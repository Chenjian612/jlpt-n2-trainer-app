import { TrainingModeId } from '../data/trainingModes';

export const STORAGE_KEY = 'jlpt-n2-trainer-state-v1';
export const DEFAULT_WEEKLY_GOAL = 14;
const MAX_HISTORY_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CompletedByDay = Partial<Record<string, TrainingModeId[]>>;

export type StoredAppState = {
  weeklyGoal: number;
  completedByDay: CompletedByDay;
};

export type DashboardMetrics = {
  todayCompletedCount: number;
  weeklySessions: number;
  totalSessions: number;
  currentStreak: number;
  bestStreak: number;
};

export const createDefaultState = (): StoredAppState => ({
  weeklyGoal: DEFAULT_WEEKLY_GOAL,
  completedByDay: {},
});

export const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

export const normalizeState = (raw: string | null): StoredAppState => {
  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAppState>;
    const weeklyGoal =
      typeof parsed.weeklyGoal === 'number' && Number.isFinite(parsed.weeklyGoal)
        ? Math.max(6, Math.min(28, Math.round(parsed.weeklyGoal)))
        : DEFAULT_WEEKLY_GOAL;

    const completedByDay: CompletedByDay = {};

    if (parsed.completedByDay && typeof parsed.completedByDay === 'object') {
      for (const [dayKey, ids] of Object.entries(parsed.completedByDay)) {
        if (!Array.isArray(ids)) {
          continue;
        }

        const uniqueIds = Array.from(
          new Set(
            ids.filter((id): id is TrainingModeId => typeof id === 'string'),
          ),
        );

        if (uniqueIds.length > 0) {
          completedByDay[dayKey] = uniqueIds;
        }
      }
    }

    return {
      weeklyGoal,
      completedByDay: pruneHistory(completedByDay),
    };
  } catch {
    return createDefaultState();
  }
};

export const pruneHistory = (completedByDay: CompletedByDay): CompletedByDay => {
  const cutoff = addDays(new Date(), -MAX_HISTORY_DAYS);
  const next: CompletedByDay = {};

  for (const [dayKey, ids] of Object.entries(completedByDay)) {
    const safeIds = ids ?? [];

    if (safeIds.length === 0) {
      continue;
    }

    if (diffInDays(parseDayKey(dayKey), cutoff) >= 0) {
      next[dayKey] = safeIds;
    }
  }

  return next;
};

export const toggleModeCompletion = (
  state: StoredAppState,
  dayKey: string,
  modeId: TrainingModeId,
): StoredAppState => {
  const todayIds = state.completedByDay[dayKey] ?? [];
  const exists = todayIds.includes(modeId);
  const nextTodayIds = exists
    ? todayIds.filter((id) => id !== modeId)
    : [...todayIds, modeId];
  const nextCompletedByDay = { ...state.completedByDay };

  if (nextTodayIds.length === 0) {
    delete nextCompletedByDay[dayKey];
  } else {
    nextCompletedByDay[dayKey] = nextTodayIds;
  }

  return {
    ...state,
    completedByDay: pruneHistory(nextCompletedByDay),
  };
};

export const clearDay = (state: StoredAppState, dayKey: string): StoredAppState => {
  if (!state.completedByDay[dayKey]) {
    return state;
  }

  const nextCompletedByDay = { ...state.completedByDay };
  delete nextCompletedByDay[dayKey];

  return {
    ...state,
    completedByDay: nextCompletedByDay,
  };
};

const getActiveDayKeys = (completedByDay: CompletedByDay): string[] =>
  Object.keys(completedByDay)
    .filter((dayKey) => (completedByDay[dayKey]?.length ?? 0) > 0)
    .sort();

const getBestStreak = (completedByDay: CompletedByDay): number => {
  const activeDayKeys = getActiveDayKeys(completedByDay);

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

const getCurrentStreak = (completedByDay: CompletedByDay, todayKey: string): number => {
  const today = parseDayKey(todayKey);
  const active = new Set(getActiveDayKeys(completedByDay));
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

const getWeeklySessions = (completedByDay: CompletedByDay, todayKey: string): number => {
  const today = parseDayKey(todayKey);
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const dayKey = getDayKey(addDays(today, -offset));
    total += completedByDay[dayKey]?.length ?? 0;
  }

  return total;
};

const getTotalSessions = (completedByDay: CompletedByDay): number =>
  Object.values(completedByDay).reduce(
    (sum, ids) => sum + (ids?.length ?? 0),
    0,
  );

export const getDashboardMetrics = (
  state: StoredAppState,
  todayKey: string,
): DashboardMetrics => ({
  todayCompletedCount: state.completedByDay[todayKey]?.length ?? 0,
  weeklySessions: getWeeklySessions(state.completedByDay, todayKey),
  totalSessions: getTotalSessions(state.completedByDay),
  currentStreak: getCurrentStreak(state.completedByDay, todayKey),
  bestStreak: getBestStreak(state.completedByDay),
});

export const buildRecentWeek = (
  completedByDay: CompletedByDay,
  todayKey: string,
): Array<{ dayKey: string; label: string; count: number }> => {
  const today = parseDayKey(todayKey);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const dayKey = getDayKey(date);
    const labels = ['日', '一', '二', '三', '四', '五', '六'];

    return {
      dayKey,
      label: labels[date.getDay()],
      count: completedByDay[dayKey]?.length ?? 0,
    };
  });
};
