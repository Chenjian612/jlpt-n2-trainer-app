import { useMemo } from 'react';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { TRAINING_MODES } from '../../../data/seed/trainingModes';
import { getDashboardWeaknessSnapshot } from '../../../domain/services/coachService';
import {
  buildRecentWeek,
  getDashboardInsight,
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
import { APP_CONFIG } from '../../../config/constants';

export function useDashboardViewModel() {
  const { state, todayKey, clearToday, setWeeklyGoal } = useProgressStore();

  const todaySessions = getSessionsForDay(state, todayKey);
  const todayCompletedModeIds = getCompletedModeIdsForDay(state, todayKey);

  const metrics = getDashboardMetrics(state, todayKey);
  const todayPlan = getTodayPlan(TRAINING_MODES, state, todayKey);
  const recentWeek = buildRecentWeek(state, todayKey);

  const todaySessionCounts = todaySessions.reduce<Partial<Record<string, number>>>((counts, session) => {
    counts[session.modeId] = (counts[session.modeId] ?? 0) + 1;
    return counts;
  }, {});

  const reviewBacklogCounts = {
    review_wrong: getWrongReviewBacklogCount(state, 'review_wrong'),
    vocab_review_wrong: getWrongReviewBacklogCount(state, 'vocab_review_wrong'),
  };

  const insight = getDashboardInsight(state, todayKey, state.weeklyGoal, todayPlan);

  const recommendedMode =
    todayPlan.find((mode) => mode.id === insight.recommendedModeId) ??
    todayPlan[0] ??
    null;

  const weaknessSnapshot = getDashboardWeaknessSnapshot(state);

  const weaknessRecommendedMode =
    TRAINING_MODES.find((mode) => mode.id === weaknessSnapshot.recommendedModeId) ?? null;

  return {
    metrics,
    recentWeek,
    todayPlan,
    todayCompletedModeIds,
    todaySessionCounts,
    reviewBacklogCounts,
    trainingModes: TRAINING_MODES,
    weeklyGoal: state.weeklyGoal,
    dailyTarget: APP_CONFIG.DAILY_TARGET_SESSIONS,
    weeklyGoalOptions: WEEKLY_GOAL_OPTIONS,
    dailyProgress: getProgressRatio(metrics.todayCompletedCount, APP_CONFIG.DAILY_TARGET_SESSIONS),
    weeklyProgress: getProgressRatio(metrics.weeklySessions, state.weeklyGoal),
    insight,
    recommendedMode,
    weaknessSnapshot,
    weaknessRecommendedMode,
    todayKey,
    clearToday,
    setWeeklyGoal,
  };
}
