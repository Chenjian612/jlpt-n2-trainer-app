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

export function useDashboardViewModel() {
  const {
    state,
    todayKey,
    toggleMode,
    clearToday,
    setWeeklyGoal,
  } = useProgressStore();
  const todayCompleted = state.completedByDay[todayKey] ?? [];
  const deferredTodayCompleted = useDeferredValue(todayCompleted);

  const metrics = useMemo(
    () => getDashboardMetrics(state, todayKey),
    [state, todayKey],
  );
  const todayPlan = useMemo(
    () => getTodayPlan(TRAINING_MODES, deferredTodayCompleted),
    [deferredTodayCompleted],
  );
  const recentWeek = useMemo(
    () => buildRecentWeek(state, todayKey),
    [state, todayKey],
  );

  return {
    metrics,
    recentWeek,
    todayPlan,
    todayCompleted,
    trainingModes: TRAINING_MODES,
    weeklyGoal: state.weeklyGoal,
    dailyTarget: DAILY_TARGET,
    weeklyGoalOptions: WEEKLY_GOAL_OPTIONS,
    dailyProgress: getProgressRatio(metrics.todayCompletedCount, DAILY_TARGET),
    weeklyProgress: getProgressRatio(metrics.weeklySessions, state.weeklyGoal),
    todayKey,
    toggleMode,
    clearToday,
    setWeeklyGoal,
  };
}
