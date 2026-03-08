import { useDeferredValue, useMemo } from 'react';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { TRAINING_MODES } from '../../../data/seed/trainingModes';
import {
  buildRecentWeek,
  DAILY_TARGET,
  getDashboardMetrics,
  getProgressRatio,
  getTodayPlan,
  WEEKLY_GOAL_OPTIONS,
} from '../../../domain/services/dashboardService';
import {
  getCompletedModeIdsForDay,
  getSessionsForDay,
  getWrongReviewBacklogCount,
} from '../../../domain/services/progressService';

export function useDashboardViewModel() {
  const {
    state,
    todayKey,
    clearToday,
    setWeeklyGoal,
  } = useProgressStore();
  const todaySessions = useMemo(
    () => getSessionsForDay(state, todayKey),
    [state, todayKey],
  );
  const todayCompletedModeIds = useMemo(
    () => getCompletedModeIdsForDay(state, todayKey),
    [state, todayKey],
  );
  const deferredTodayCompletedModeIds = useDeferredValue(todayCompletedModeIds);

  const metrics = useMemo(
    () => getDashboardMetrics(state, todayKey),
    [state, todayKey],
  );
  const todayPlan = useMemo(
    () => getTodayPlan(TRAINING_MODES, deferredTodayCompletedModeIds),
    [deferredTodayCompletedModeIds],
  );
  const recentWeek = useMemo(
    () => buildRecentWeek(state, todayKey),
    [state, todayKey],
  );
  const todaySessionCounts = useMemo(
    () =>
      todaySessions.reduce<Partial<Record<string, number>>>((counts, session) => {
        counts[session.modeId] = (counts[session.modeId] ?? 0) + 1;
        return counts;
      }, {}),
    [todaySessions],
  );
  const reviewBacklogCounts = useMemo(
    () =>
      ({
        review_wrong: getWrongReviewBacklogCount(state, 'review_wrong'),
        vocab_review_wrong: getWrongReviewBacklogCount(
          state,
          'vocab_review_wrong',
        ),
      }) as Partial<Record<string, number>>,
    [state],
  );

  return {
    metrics,
    recentWeek,
    todayPlan,
    todayCompletedModeIds,
    todaySessionCounts,
    reviewBacklogCounts,
    trainingModes: TRAINING_MODES,
    weeklyGoal: state.weeklyGoal,
    dailyTarget: DAILY_TARGET,
    weeklyGoalOptions: WEEKLY_GOAL_OPTIONS,
    dailyProgress: getProgressRatio(metrics.todayCompletedCount, DAILY_TARGET),
    weeklyProgress: getProgressRatio(metrics.weeklySessions, state.weeklyGoal),
    todayKey,
    clearToday,
    setWeeklyGoal,
  };
}
