import type { CompletedByDay, ProgressState } from '../models/progress';
import type { TrainingModeId } from '../models/training';

export const DEFAULT_WEEKLY_GOAL = 14;
const MAX_HISTORY_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const createDefaultProgressState = (): ProgressState => ({
  weeklyGoal: DEFAULT_WEEKLY_GOAL,
  completedByDay: {},
});

export const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const clampWeeklyGoal = (goal: number): number =>
  Math.max(6, Math.min(28, Math.round(goal)));

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

const pruneHistory = (completedByDay: CompletedByDay): CompletedByDay => {
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

export const normalizeProgressState = (raw: string | null): ProgressState => {
  if (!raw) {
    return createDefaultProgressState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    const weeklyGoal =
      typeof parsed.weeklyGoal === 'number' && Number.isFinite(parsed.weeklyGoal)
        ? clampWeeklyGoal(parsed.weeklyGoal)
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
    return createDefaultProgressState();
  }
};

export const toggleModeCompletion = (
  state: ProgressState,
  dayKey: string,
  modeId: TrainingModeId,
): ProgressState => {
  const todayIds = state.completedByDay[dayKey] ?? [];
  const nextTodayIds = todayIds.includes(modeId)
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

export const clearDay = (state: ProgressState, dayKey: string): ProgressState => {
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
